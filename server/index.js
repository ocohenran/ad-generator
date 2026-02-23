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

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const {
  META_APP_ID,
  META_APP_SECRET,
  META_AD_ACCOUNT_ID,
  META_REDIRECT_URI,
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

let tokenData = loadToken(); // { accessToken, userName, expiresAt }

// --- Helper: Graph API fetch ---

async function graphFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${GRAPH_API}${path}`;
  const res = await fetch(url, options);
  const json = await res.json();
  if (json.error) {
    throw new Error(json.error.message || JSON.stringify(json.error));
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
  const scopes = 'ads_management,ads_read,business_management';
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
        window.opener && window.opener.postMessage({ type: 'meta-auth-success' }, 'http://localhost:5173');
        window.close();
      </script><p>Connected! You can close this window.</p></body></html>
    `);
  } catch (err) {
    console.error('OAuth callback error:', err);
    const safeError = (err.message || 'Unknown error').replace(/[<>"'&]/g, '');
    res.status(500).send(`
      <html><body><script>
        window.opener && window.opener.postMessage({ type: 'meta-auth-error', error: ${JSON.stringify(safeError)} }, 'http://localhost:5173');
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
    const formData = new FormData();
    formData.append('filename', req.file.originalname || 'ad-creative.png');
    formData.append('bytes', new Blob([req.file.buffer]), req.file.originalname || 'ad-creative.png');
    formData.append('access_token', tokenData.accessToken);

    const result = await graphFetch(`${GRAPH_API}/act_${META_AD_ACCOUNT_ID}/adimages`, {
      method: 'POST',
      body: formData,
    });

    // Response has images keyed by filename
    const images = result.images || {};
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Meta Ads backend running on http://localhost:${PORT}`);
  console.log(`OAuth callback: ${META_REDIRECT_URI}`);
  console.log(`Ad Account: act_${META_AD_ACCOUNT_ID}`);
  if (tokenData?.accessToken) {
    console.log(`Connected as: ${tokenData.userName}`);
  }
});
