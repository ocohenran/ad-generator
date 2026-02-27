import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = join(__dirname, '.meta-token.json');
const PUBLICATIONS_FILE = join(__dirname, 'data', 'publications.json');

const app = express();
app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const {
  META_APP_ID,
  META_APP_SECRET,
  META_AD_ACCOUNT_ID,
  META_REDIRECT_URI,
  WP_URL,
  WP_USER,
  WP_APP_PASSWORD,
} = process.env;

const GRAPH_API = 'https://graph.facebook.com/v21.0';

// CSRF state tokens for OAuth (short-lived, in-memory)
const pendingOAuthStates = new Map(); // state -> { createdAt }

// Complete Meta CTA type mapping
const CTA_TYPE_MAP = {
  'Apply Now': 'APPLY_NOW',
  'Book Now': 'BOOK_TRAVEL',
  'Contact Us': 'CONTACT_US',
  'Download': 'DOWNLOAD',
  'Get Offer': 'GET_OFFER',
  'Get Quote': 'GET_QUOTE',
  'Get Showtimes': 'GET_SHOWTIMES',
  'Install Now': 'INSTALL_MOBILE_APP',
  'Learn More': 'LEARN_MORE',
  'Listen Now': 'LISTEN_MUSIC',
  'Order Now': 'ORDER_NOW',
  'Request Time': 'REQUEST_TIME',
  'See Menu': 'SEE_MENU',
  'Shop Now': 'SHOP_NOW',
  'Sign Up': 'SIGN_UP',
  'Subscribe': 'SUBSCRIBE',
  'Watch More': 'WATCH_MORE',
  'Send Message': 'MESSAGE_PAGE',
  'Send WhatsApp': 'WHATSAPP_MESSAGE',
  'Call Now': 'CALL_NOW',
};

// --- Token persistence ---

function loadToken() {
  try {
    if (existsSync(TOKEN_FILE)) {
      return JSON.parse(readFileSync(TOKEN_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return null;
}

function saveToken(data) {
  writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
}

function loadPublications() {
  try {
    if (existsSync(PUBLICATIONS_FILE)) {
      return JSON.parse(readFileSync(PUBLICATIONS_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return [];
}

function savePublications(data) {
  writeFileSync(PUBLICATIONS_FILE, JSON.stringify(data, null, 2));
}

let tokenData = loadToken(); // { accessToken, userName, expiresAt }

// --- Helper: Graph API fetch ---

async function graphFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${GRAPH_API}${path}`;
  const res = await fetch(url, options);
  const json = await res.json();
  if (json.error) {
    const detail = json.error.error_user_msg || json.error.error_user_title || '';
    console.error(`Graph API error [${url.split('?')[0]}]: ${json.error.message} | ${detail} | subcode: ${json.error.error_subcode}`);
    throw new Error(detail || json.error.message || JSON.stringify(json.error));
  }
  return json;
}

// --- Routes ---

// Step 1: Redirect to Facebook OAuth
app.get('/api/meta/auth', (_req, res) => {
  const state = crypto.randomBytes(24).toString('hex');
  pendingOAuthStates.set(state, { createdAt: Date.now() });
  // Clean up stale states (older than 10 minutes)
  for (const [k, v] of pendingOAuthStates) {
    if (Date.now() - v.createdAt > 600_000) pendingOAuthStates.delete(k);
  }
  const scopes = 'ads_management,ads_read,business_management,pages_read_engagement,pages_show_list';
  const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}&scope=${scopes}&response_type=code&state=${state}`;
  res.redirect(url);
});

// Step 2: OAuth callback — exchange code for token
app.get('/api/meta/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }
  if (!state || !pendingOAuthStates.has(state)) {
    return res.status(403).send('Invalid or expired OAuth state. Please try connecting again.');
  }
  pendingOAuthStates.delete(state);

  try {
    // Exchange code for short-lived token
    const tokenUrl = `${GRAPH_API}/oauth/access_token?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(META_REDIRECT_URI)}&client_secret=${META_APP_SECRET}&code=${code}`;
    const shortLived = await graphFetch(tokenUrl);

    // Exchange for long-lived token
    const longLivedUrl = `${GRAPH_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&fb_exchange_token=${shortLived.access_token}`;
    const longLived = await graphFetch(longLivedUrl);

    // Get user info
    const me = await graphFetch(`${GRAPH_API}/me?access_token=${longLived.access_token}`);

    tokenData = {
      accessToken: longLived.access_token,
      userName: me.name,
      expiresAt: Date.now() + (longLived.expires_in || 5184000) * 1000,
    };
    saveToken(tokenData);

    // Close the popup
    res.send(`
      <html><body><script>
        window.opener && window.opener.postMessage({ type: 'meta-auth-success' }, window.opener.location.origin);
        window.close();
      </script><p>Connected! You can close this window.</p></body></html>
    `);
  } catch (err) {
    console.error('OAuth callback error:', err);
    const safeError = (err.message || 'Unknown error').replace(/[<>"'&]/g, '');
    res.status(500).send(`
      <html><body><script>
        window.opener && window.opener.postMessage({ type: 'meta-auth-error', error: ${JSON.stringify(safeError)} }, window.opener.location.origin);
        window.close();
      </script><p>Authentication failed. You can close this window.</p></body></html>
    `);
  }
});

// Connection status
app.get('/api/meta/status', (_req, res) => {
  if (!tokenData || !tokenData.accessToken) {
    return res.json({ connected: false });
  }
  const expired = tokenData.expiresAt && Date.now() > tokenData.expiresAt;
  res.json({
    connected: !expired,
    userName: tokenData.userName,
    adAccountId: META_AD_ACCOUNT_ID,
    expiresAt: tokenData.expiresAt,
  });
});

// Disconnect
app.post('/api/meta/disconnect', (_req, res) => {
  tokenData = null;
  try { writeFileSync(TOKEN_FILE, '{}'); } catch { /* ignore */ }
  res.json({ ok: true });
});

// Upload image to Meta ad account
app.post('/api/meta/upload-image', upload.single('image'), async (req, res) => {
  if (!tokenData?.accessToken) {
    return res.status(401).json({ error: 'Not connected to Meta' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  try {
    const filename = req.file.originalname || 'ad-creative.png';
    const imgBuffer = req.file.buffer;
    const base64 = imgBuffer.toString('base64');

    console.log(`Uploading image: ${filename}, buffer size: ${imgBuffer.length} bytes`);

    // Use base64 upload method instead of multipart (more reliable in Node.js)
    const url = `${GRAPH_API}/act_${META_AD_ACCOUNT_ID}/adimages`;
    const res2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        bytes: base64,
        access_token: tokenData.accessToken,
      }),
    });
    const json = await res2.json();

    if (json.error) {
      console.error('Meta image upload error detail:', JSON.stringify(json.error));
      throw new Error(json.error.message || JSON.stringify(json.error));
    }

    // Response has images keyed by filename
    const images = json.images || {};
    const imageData = Object.values(images)[0];

    res.json({
      imageHash: imageData?.hash,
      imageUrl: imageData?.url,
    });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a Meta object by ID (best-effort cleanup)
async function deleteObject(id, token) {
  try {
    await graphFetch(`${GRAPH_API}/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: token }),
    });
  } catch (err) {
    console.error(`Rollback: failed to delete ${id}:`, err.message);
  }
}

// Create a full paused ad (campaign + ad set + creative + ad)
app.post('/api/meta/create-ad', async (req, res) => {
  if (!tokenData?.accessToken) {
    return res.status(401).json({ error: 'Not connected to Meta' });
  }

  const {
    campaignName,
    dailyBudget,
    imageHash,
    headline,
    body: adBody,
    ctaText,
    linkUrl,
    pageId,
    countries,
  } = req.body;

  const token = tokenData.accessToken;
  const actId = `act_${META_AD_ACCOUNT_ID}`;
  const ctaType = CTA_TYPE_MAP[ctaText] || 'LEARN_MORE';
  const targetCountries = Array.isArray(countries) && countries.length > 0 ? countries : ['US'];

  // Track created objects for rollback
  const created = { campaignId: null, adSetId: null, creativeId: null, adId: null };

  try {
    // 1. Create campaign (paused)
    const campaign = await graphFetch(`${GRAPH_API}/${actId}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaignName || 'Ad Generator Campaign',
        objective: 'OUTCOME_TRAFFIC',
        status: 'PAUSED',
        special_ad_categories: [],
        is_adset_budget_sharing_enabled: false,
        access_token: token,
      }),
    });
    created.campaignId = campaign.id;

    // 2. Create ad set (paused)
    const adSet = await graphFetch(`${GRAPH_API}/${actId}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${campaignName || 'Ad Generator'} - Ad Set`,
        campaign_id: campaign.id,
        daily_budget: Math.round((dailyBudget || 10) * 100), // cents
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: { geo_locations: { countries: targetCountries } },
        start_time: new Date(Date.now() + 86400000).toISOString(),
        status: 'PAUSED',
        access_token: token,
      }),
    });
    created.adSetId = adSet.id;

    // 3. Create ad creative
    const creative = await graphFetch(`${GRAPH_API}/${actId}/adcreatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${campaignName || 'Ad Generator'} - Creative`,
        object_story_spec: {
          page_id: pageId,
          link_data: {
            image_hash: imageHash,
            link: linkUrl || 'https://gwork.ai',
            message: adBody || '',
            name: headline || '',
            call_to_action: { type: ctaType },
          },
        },
        access_token: token,
      }),
    });
    created.creativeId = creative.id;

    // 4. Create ad (paused)
    const ad = await graphFetch(`${GRAPH_API}/${actId}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${campaignName || 'Ad Generator'} - Ad`,
        adset_id: adSet.id,
        creative: { creative_id: creative.id },
        status: 'PAUSED',
        access_token: token,
      }),
    });
    created.adId = ad.id;

    res.json({
      campaignId: campaign.id,
      adSetId: adSet.id,
      creativeId: creative.id,
      adId: ad.id,
      adsManagerUrl: `https://www.facebook.com/adsmanager/manage/campaigns?act=${META_AD_ACCOUNT_ID}&campaign_ids=${campaign.id}`,
    });
  } catch (err) {
    console.error('Create ad error:', err);
    // Rollback: delete in reverse order (ad -> creative -> ad set -> campaign)
    if (created.adId) await deleteObject(created.adId, token);
    if (created.creativeId) await deleteObject(created.creativeId, token);
    if (created.adSetId) await deleteObject(created.adSetId, token);
    if (created.campaignId) await deleteObject(created.campaignId, token);
    res.status(500).json({ error: err.message });
  }
});

// Create bulk ads: 1 campaign + 1 ad set + N ads (each with own creative)
app.post('/api/meta/create-bulk-ads', async (req, res) => {
  if (!tokenData?.accessToken) {
    return res.status(401).json({ error: 'Not connected to Meta' });
  }

  const {
    campaignName,
    dailyBudget,
    linkUrl,
    pageId,
    ctaText,
    countries,
    ads,
  } = req.body;

  if (!Array.isArray(ads) || ads.length === 0) {
    return res.status(400).json({ error: 'ads array is required and must not be empty' });
  }
  if (ads.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 ads per bulk publish' });
  }

  const token = tokenData.accessToken;
  const actId = `act_${META_AD_ACCOUNT_ID}`;
  const defaultCtaType = CTA_TYPE_MAP[ctaText] || 'LEARN_MORE';
  const targetCountries = Array.isArray(countries) && countries.length > 0 ? countries : ['US'];

  // Track all created objects for rollback
  const created = { campaignId: null, adSetId: null, creatives: [], adIds: [] };

  try {
    // 1. Create campaign (paused)
    const campaign = await graphFetch(`${GRAPH_API}/${actId}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: campaignName || 'Ad Generator Bulk Campaign',
        objective: 'OUTCOME_TRAFFIC',
        status: 'PAUSED',
        special_ad_categories: [],
        is_adset_budget_sharing_enabled: false,
        access_token: token,
      }),
    });
    created.campaignId = campaign.id;

    // 2. Create ad set (paused)
    const adSet = await graphFetch(`${GRAPH_API}/${actId}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${campaignName || 'Ad Generator Bulk'} - Ad Set`,
        campaign_id: campaign.id,
        daily_budget: Math.round((dailyBudget || 10) * 100),
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: { geo_locations: { countries: targetCountries } },
        start_time: new Date(Date.now() + 86400000).toISOString(),
        status: 'PAUSED',
        access_token: token,
      }),
    });
    created.adSetId = adSet.id;

    // 3. For each ad: create creative + ad
    const createdAds = [];
    for (let i = 0; i < ads.length; i++) {
      const ad = ads[i];
      const adCtaType = CTA_TYPE_MAP[ad.ctaText] || defaultCtaType;

      const creative = await graphFetch(`${GRAPH_API}/${actId}/adcreatives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${campaignName || 'Bulk'} - Creative ${i + 1}`,
          object_story_spec: {
            page_id: pageId,
            link_data: {
              image_hash: ad.imageHash,
              link: linkUrl || 'https://gwork.ai',
              message: ad.body || '',
              name: ad.headline || '',
              call_to_action: { type: adCtaType },
            },
          },
          access_token: token,
        }),
      });
      created.creatives.push(creative.id);

      const adObj = await graphFetch(`${GRAPH_API}/${actId}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${campaignName || 'Bulk'} - Ad ${i + 1}`,
          adset_id: adSet.id,
          creative: { creative_id: creative.id },
          status: 'PAUSED',
          access_token: token,
        }),
      });
      created.adIds.push(adObj.id);

      createdAds.push({
        adId: adObj.id,
        creativeId: creative.id,
        variationId: ad.variationId,
      });
    }

    // 4. Track all publications
    const publications = loadPublications();
    for (const ad of ads) {
      const match = createdAds.find(c => c.variationId === ad.variationId);
      if (match) {
        publications.push({
          variationId: ad.variationId,
          adId: match.adId,
          campaignId: campaign.id,
          adSetId: adSet.id,
          headline: ad.headline || '',
          body: ad.body || '',
          ctaText: ad.ctaText || ctaText || '',
          publishedAt: Date.now(),
        });
      }
    }
    savePublications(publications);

    res.json({
      campaignId: campaign.id,
      adSetId: adSet.id,
      ads: createdAds,
      adsManagerUrl: `https://www.facebook.com/adsmanager/manage/campaigns?act=${META_AD_ACCOUNT_ID}&campaign_ids=${campaign.id}`,
    });
  } catch (err) {
    console.error('Bulk create ads error:', err);
    // Rollback in reverse order: ads -> creatives -> ad set -> campaign
    for (const id of created.adIds.reverse()) await deleteObject(id, token);
    for (const id of created.creatives.reverse()) await deleteObject(id, token);
    if (created.adSetId) await deleteObject(created.adSetId, token);
    if (created.campaignId) await deleteObject(created.campaignId, token);
    res.status(500).json({ error: err.message });
  }
});

// Get pages the user manages (needed for ad creative)
app.get('/api/meta/pages', async (_req, res) => {
  if (!tokenData?.accessToken) {
    return res.status(401).json({ error: 'Not connected to Meta' });
  }

  try {
    const result = await graphFetch(`${GRAPH_API}/me/accounts?access_token=${tokenData.accessToken}`);
    const pages = (result.data || []).map(p => ({ id: p.id, name: p.name }));
    res.json({ pages });
  } catch (err) {
    console.error('Pages fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Track a published ad
app.post('/api/meta/track-publish', (req, res) => {
  const { variationId, adId, campaignId, adSetId, headline, body, ctaText } = req.body;
  if (!variationId || !adId) {
    return res.status(400).json({ error: 'variationId and adId are required' });
  }

  const publications = loadPublications();
  publications.push({
    variationId,
    adId,
    campaignId: campaignId || '',
    adSetId: adSetId || '',
    headline: headline || '',
    body: body || '',
    ctaText: ctaText || '',
    publishedAt: Date.now(),
  });
  savePublications(publications);
  res.json({ ok: true });
});

// Get insights for all tracked publications
app.get('/api/meta/insights', async (req, res) => {
  if (!tokenData?.accessToken) {
    return res.status(401).json({ error: 'Not connected to Meta' });
  }

  const publications = loadPublications();
  if (publications.length === 0) {
    return res.json([]);
  }

  const { campaignId } = req.query;
  const filtered = campaignId
    ? publications.filter((p) => p.campaignId === campaignId)
    : publications;

  const results = await Promise.all(
    filtered.map(async (pub) => {
      try {
        // Fetch ad status
        const adInfo = await graphFetch(
          `${GRAPH_API}/${pub.adId}?fields=status&access_token=${tokenData.accessToken}`
        );

        // Fetch insights
        let metrics = null;
        try {
          const insights = await graphFetch(
            `${GRAPH_API}/${pub.adId}/insights?fields=spend,impressions,clicks,ctr,cpc,actions&access_token=${tokenData.accessToken}`
          );
          const data = insights.data?.[0];
          if (data) {
            const conversions = (data.actions || [])
              .filter((a) => a.action_type === 'offsite_conversion' || a.action_type === 'lead')
              .reduce((sum, a) => sum + parseInt(a.value || '0', 10), 0);
            metrics = {
              spend: parseFloat(data.spend || '0'),
              impressions: parseInt(data.impressions || '0', 10),
              clicks: parseInt(data.clicks || '0', 10),
              ctr: parseFloat(data.ctr || '0'),
              cpc: parseFloat(data.cpc || '0'),
              conversions,
            };
          }
        } catch {
          // No insights yet (ad just published or paused)
        }

        return {
          ...pub,
          metrics,
          status: adInfo.status || 'UNKNOWN',
        };
      } catch (err) {
        // Ad might have been deleted
        return {
          ...pub,
          metrics: null,
          status: 'DELETED',
        };
      }
    })
  );

  res.json(results);
});

// --- WordPress Landing Page ---

function contentToGutenberg(content) {
  const lines = [];

  // H1
  lines.push(`<!-- wp:heading {"level":1} -->`);
  lines.push(`<h1 class="wp-block-heading">${escapeHtml(content.title)}</h1>`);
  lines.push(`<!-- /wp:heading -->`);

  // Subheadline
  lines.push(`<!-- wp:paragraph {"fontSize":"large"} -->`);
  lines.push(`<p class="has-large-font-size"><strong>${escapeHtml(content.subheadline)}</strong></p>`);
  lines.push(`<!-- /wp:paragraph -->`);

  // Hero text
  lines.push(`<!-- wp:paragraph -->`);
  lines.push(`<p>${escapeHtml(content.heroText)}</p>`);
  lines.push(`<!-- /wp:paragraph -->`);

  // Benefits
  lines.push(`<!-- wp:heading {"level":2} -->`);
  lines.push(`<h2 class="wp-block-heading">Why It Works</h2>`);
  lines.push(`<!-- /wp:heading -->`);

  for (const benefit of content.benefits || []) {
    lines.push(`<!-- wp:heading {"level":3} -->`);
    lines.push(`<h3 class="wp-block-heading">${escapeHtml(benefit.heading)}</h3>`);
    lines.push(`<!-- /wp:heading -->`);
    lines.push(`<!-- wp:paragraph -->`);
    lines.push(`<p>${escapeHtml(benefit.body)}</p>`);
    lines.push(`<!-- /wp:paragraph -->`);
  }

  // CTA section
  lines.push(`<!-- wp:heading {"level":2} -->`);
  lines.push(`<h2 class="wp-block-heading">${escapeHtml(content.ctaHeading)}</h2>`);
  lines.push(`<!-- /wp:heading -->`);
  lines.push(`<!-- wp:paragraph -->`);
  lines.push(`<p>${escapeHtml(content.ctaBody)}</p>`);
  lines.push(`<!-- /wp:paragraph -->`);
  lines.push(`<!-- wp:buttons -->`);
  lines.push(`<div class="wp-block-buttons"><!-- wp:button -->`);
  lines.push(`<div class="wp-block-button"><a class="wp-block-button__link wp-element-button">${escapeHtml(content.ctaButton)}</a></div>`);
  lines.push(`<!-- /wp:button --></div>`);
  lines.push(`<!-- /wp:buttons -->`);

  // FAQs
  if (content.faqs && content.faqs.length > 0) {
    lines.push(`<!-- wp:heading {"level":2} -->`);
    lines.push(`<h2 class="wp-block-heading">Frequently Asked Questions</h2>`);
    lines.push(`<!-- /wp:heading -->`);

    for (const faq of content.faqs) {
      lines.push(`<!-- wp:heading {"level":3} -->`);
      lines.push(`<h3 class="wp-block-heading">${escapeHtml(faq.question)}</h3>`);
      lines.push(`<!-- /wp:heading -->`);
      lines.push(`<!-- wp:paragraph -->`);
      lines.push(`<p>${escapeHtml(faq.answer)}</p>`);
      lines.push(`<!-- /wp:paragraph -->`);
    }
  }

  return lines.join('\n');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function updateYoastSEO(pageId, seo) {
  if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
    throw new Error('WordPress credentials not configured');
  }

  const meta = {};
  if (seo.metaTitle) meta['yoast_wpseo_title'] = seo.metaTitle;
  if (seo.metaDescription) meta['yoast_wpseo_metadesc'] = seo.metaDescription;
  if (seo.focusKeyword) meta['yoast_wpseo_focuskw'] = seo.focusKeyword;

  if (Object.keys(meta).length === 0) return;

  const wpAuth = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

  // Use WP REST API to update Yoast meta fields.
  // Yoast SEO plugin registers these as rest-accessible meta keys on pages/posts.
  // Note: XML-RPC custom_fields silently fails for underscore-prefixed meta keys.
  const res = await fetch(`${WP_URL}/wp-json/wp/v2/pages/${pageId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${wpAuth}`,
    },
    body: JSON.stringify({ meta }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Yoast SEO update failed (HTTP ${res.status})`);
  }
}

app.post('/api/landing-page/publish', async (req, res) => {
  if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
    return res.status(500).json({ error: 'WordPress credentials not configured. Set WP_URL, WP_USER, WP_APP_PASSWORD in server/.env' });
  }

  const { content, title, slug, metaTitle, metaDescription, focusKeyword } = req.body;
  if (!content || !title) {
    return res.status(400).json({ error: 'content and title are required' });
  }

  const wpAuth = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

  try {
    // Build Gutenberg HTML from content
    const gutenbergHtml = contentToGutenberg(content);

    // Create draft page via WP REST API
    const createRes = await fetch(`${WP_URL}/wp-json/wp/v2/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${wpAuth}`,
      },
      body: JSON.stringify({
        title,
        content: gutenbergHtml,
        status: 'draft',
        slug: slug || '',
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(err.message || `WordPress API returned ${createRes.status}`);
    }

    const page = await createRes.json();
    const pageId = page.id;

    // Set Yoast SEO fields via REST API
    try {
      await updateYoastSEO(pageId, { metaTitle, metaDescription, focusKeyword });
    } catch (yoastErr) {
      console.error('Yoast SEO update failed (non-critical):', yoastErr.message);
    }

    res.json({
      pageId,
      editUrl: `${WP_URL}/wp-admin/post.php?post=${pageId}&action=edit`,
      previewUrl: page.link ? `${page.link}?preview=true` : '',
    });
  } catch (err) {
    console.error('Landing page publish error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── Landing page AI generation (server-side) ── */

const LANDING_PAGE_SYSTEM = `You are an expert landing page copywriter. Given a winning Meta ad (with performance data), generate a complete landing page that preserves the ad's winning angle and messaging.

The landing page must feel like a natural extension of the ad - when someone clicks the ad, the landing page headline should match what they just read.

Return a single JSON object with these exact keys:
- title: Main H1 (matches the ad's winning hook, max 10 words)
- subheadline: Supporting headline (1 sentence, expands the value prop)
- heroText: Hero paragraph (2-3 sentences, the core pitch)
- benefits: Array of 3-4 objects with { heading, body } - concrete outcomes, not features
- ctaHeading: CTA section heading (creates urgency)
- ctaBody: CTA section paragraph (1-2 sentences, final push)
- ctaButton: Button text (2-5 words)
- faqs: Array of 4-5 objects with { question, answer } - address objections
- seo: { metaTitle (max 60 chars with brand), metaDescription (max 155 chars), focusKeyword (2-3 words), slug (lowercase-dashed) }

Respond ONLY with the JSON object. No markdown fences, no explanation.`;

app.post('/api/landing-page/generate', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server' });

  const { headline, body, ctaText, cpc, ctr, spend, clicks } = req.body;
  if (!headline) return res.status(400).json({ error: 'headline is required' });

  const userMessage = `Winning Meta Ad:
Headline: "${headline}"
Body: "${body || ''}"
CTA: "${ctaText || ''}"

Performance Metrics:
- CPC: $${cpc != null ? Number(cpc).toFixed(2) : 'N/A'}
- CTR: ${ctr != null ? Number(ctr).toFixed(2) : 'N/A'}%
- Spend: $${spend != null ? Number(spend).toFixed(2) : 'N/A'}
- Clicks: ${clicks ?? 'N/A'}

Generate a landing page that extends this winning ad angle into a full page.`;

  try {
    let jsonStr = await callClaude(apiKey, {
      system: LANDING_PAGE_SYSTEM,
      userMessage,
      maxTokens: 4096,
    });

    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    if (!parsed.title || !parsed.heroText || !Array.isArray(parsed.benefits) || !Array.isArray(parsed.faqs)) {
      throw new Error('Invalid landing page structure from AI');
    }

    res.json(parsed);
  } catch (err) {
    console.error('Landing page generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── Claude API helper with model fallback ── */

const CLAUDE_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
];

async function callClaude(apiKey, { system, userMessage, maxTokens = 1024 }) {
  for (const model of CLAUDE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      if (response.status === 529 || response.status === 503) {
        console.log(`${model} overloaded (attempt ${attempt + 1}), retrying...`);
        await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
        continue;
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Claude API returned ${response.status}`);
      }

      const body = await response.json();
      const textBlock = body.content?.find((b) => b.type === 'text');
      if (!textBlock?.text) throw new Error('Empty response from Claude');
      console.log(`Used model: ${model}`);
      return textBlock.text.trim();
    }
    console.log(`${model} exhausted retries, trying next model...`);
  }
  throw new Error('All Claude models are overloaded. Try again in a minute.');
}

/* ── Keyword extraction ── */

app.post('/api/keywords/extract', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server' });

  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Text is required' });

  try {
    let jsonStr = await callClaude(apiKey, {
      system: `You are a Reddit search keyword expert. Given marketing copy (headlines, value propositions, taglines), extract 6-10 short search queries that real people would use on Reddit when discussing the problems, frustrations, or desires this copy addresses.

Rules:
- Each query should be 2-5 words — natural Reddit language, not marketing speak
- Focus on the PAIN POINTS and PROBLEMS implied by the copy, not the product features
- Include a mix of: frustrated rants, advice-seeking questions, and topic keywords
- Think about what someone would type into Reddit search BEFORE they know this product exists

Respond ONLY with a JSON array of strings. No markdown, no explanation, just the JSON array.`,
      userMessage: text,
    });

    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    const keywords = JSON.parse(jsonStr).filter((k) => typeof k === 'string');
    res.json({ keywords });
  } catch (err) {
    console.error('Keyword extraction error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── AI Brainstorm (server-side, avoids browser CORS / key issues) ── */

app.post('/api/brainstorm/generate', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server' });

  const { brief, tone } = req.body;
  if (!brief?.trim()) return res.status(400).json({ error: 'Brief is required' });

  try {
    let jsonStr = await callClaude(apiKey, {
      system: `You are a direct-response copywriter who has studied Gary Halbert, Eugene Schwartz, David Ogilvy, and modern Meta ad performance data. You write ads that STOP the scroll and make people click.

Your rules:
1. NEVER be generic. Every headline must have a specific hook — a number, a provocation, a counterintuitive claim, or a pattern interrupt.
2. Use the EXACT language from the brief. If the brief contains Reddit quotes or real customer language, weave those phrases directly into the copy. People click when they see their own words reflected back.
3. Headlines: max 10 words. Lead with the pain, the outcome, or the unexpected truth. No filler words. "How to..." is lazy — earn attention.
4. Primary text: 1-2 sentences. Be specific and concrete. Replace adjectives with evidence. "Better results" is weak. "34% fewer missed deadlines in 90 days" hits.
5. CTAs: Each ad gets a DIFFERENT CTA that matches its angle. "Learn More" is banned. Use action-specific CTAs that tell people exactly what happens next.
6. Mix these angles across the 8 variations:
   - Pain agitation (make the problem feel urgent)
   - Social proof / authority (numbers, logos, results)
   - Contrarian take (challenge conventional wisdom)
   - Direct benefit (what they get, fast)
   - Curiosity gap (open a loop they need to close)
   - Us vs them (old way vs new way)
   - Story hook (mini narrative in the headline)
   - Risk reversal (remove the objection)

Generate exactly 8 ad variations. Respond ONLY with a JSON array of objects with "headline", "paragraph", and "cta" keys. No markdown, no explanation.`,
      userMessage: `Tone: ${tone || 'Professional'}\n\nBrief:\n${brief}`,
      maxTokens: 2048,
    });

    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    const variations = JSON.parse(jsonStr).filter(
      (item) => item && typeof item.headline === 'string' && typeof item.paragraph === 'string'
    );
    res.json({ variations });
  } catch (err) {
    console.error('Brainstorm error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Meta Ads backend running on http://localhost:${PORT}`);
  console.log(`OAuth callback: ${META_REDIRECT_URI}`);
  console.log(`Ad Account: act_${META_AD_ACCOUNT_ID}`);
  if (tokenData?.accessToken) {
    console.log(`Connected as: ${tokenData.userName}`);
  }
});
