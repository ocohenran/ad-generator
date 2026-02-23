import puppeteer from 'puppeteer';

const APP_URL = 'http://localhost:5176';
const API_URL = 'http://localhost:3002';
const TIMEOUT = 180_000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1400, height: 900 },
    args: ['--window-size=1400,900'],
  });

  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [CONSOLE ERROR] ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`  [PAGE ERROR] ${err.message}`));

  let passes = 0;
  let fails = 0;
  function pass(msg) { passes++; console.log(`   PASS: ${msg}`); }
  function fail(msg) { fails++; console.log(`   FAIL: ${msg}`); }

  // ── Step 1: Auth first — navigate to OAuth directly ──
  console.log('\n1. Checking Meta connection...');
  const statusRes = await fetch(`${API_URL}/api/meta/status`);
  const status = await statusRes.json();

  if (!status.connected) {
    console.log('   Not connected. Opening Facebook OAuth...');
    await page.goto(`${API_URL}/api/meta/auth`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});

    console.log('\n   ╔══════════════════════════════════════════════════════════╗');
    console.log('   ║  Log in to Facebook in the browser window and approve.  ║');
    console.log('   ║  The page will say "Connected! You can close this       ║');
    console.log('   ║  window" when done. Waiting up to 3 minutes...          ║');
    console.log('   ╚══════════════════════════════════════════════════════════╝\n');

    let connected = false;
    const start = Date.now();
    while (Date.now() - start < TIMEOUT) {
      await sleep(3000);
      try {
        const check = await fetch(`${API_URL}/api/meta/status`);
        const s = await check.json();
        if (s.connected) {
          connected = true;
          console.log(`   Connected as: ${s.userName}`);
          break;
        }
      } catch { /* ignore */ }
      process.stdout.write('.');
    }

    if (!connected) {
      fail('Timed out waiting for Facebook login.');
      console.log('\nBrowser left open. Ctrl+C to exit.');
      await new Promise(() => {});
    }
    pass('Authenticated with Meta.');
  } else {
    pass(`Already connected as: ${status.userName}`);
  }

  // ── Step 2: Load app ──
  console.log('\n2. Loading app...');
  await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  pass('App loaded.');

  // ── Step 3: Check Bulk Publish button ──
  console.log('\n3. Looking for Bulk Publish button...');
  const bulkBtn = await page.waitForSelector('button::-p-text(Bulk Publish)', { timeout: 10000 });
  const bulkBtnText = await bulkBtn.evaluate(el => el.textContent);
  const bulkBtnDisabled = await bulkBtn.evaluate(el => el.disabled);
  console.log(`   Found: "${bulkBtnText}" (disabled: ${bulkBtnDisabled})`);

  const variationCount = await page.evaluate(() => {
    const grid = document.querySelector('.thumb-grid');
    return grid ? grid.children.length : 0;
  });
  console.log(`   Variations in grid: ${variationCount}`);

  if (variationCount >= 2 && !bulkBtnDisabled) {
    pass('Button enabled with 2+ variations.');
  } else if (variationCount < 2) {
    fail('Need at least 2 variations to test.');
    await browser.close();
    process.exit(1);
  }

  // ── Step 4: Open modal ──
  console.log('\n4. Opening Bulk Publish modal...');
  await bulkBtn.click();
  await sleep(1500);

  const modal = await page.waitForSelector('.modal-overlay', { timeout: 5000 });
  if (modal) pass('Modal opened.');
  else { fail('Modal did not open.'); await browser.close(); process.exit(1); }

  // Wait for connection check inside modal
  await sleep(3000);

  const modalText = await page.evaluate(() => {
    const overlay = document.querySelector('.modal-overlay');
    return overlay ? overlay.textContent : '';
  });

  if (modalText.includes('Connected as')) {
    pass('Modal shows connected status.');
  } else if (modalText.includes('Select Variations')) {
    pass('Modal shows variation picker.');
  } else {
    console.log(`   Modal content: "${modalText.slice(0, 100)}..."`);
  }

  // ── Step 5: Variation picker ──
  console.log('\n5. Testing variation picker...');
  await sleep(500);

  const checkboxes = await page.$$('.modal-overlay input[type="checkbox"]');
  console.log(`   Found ${checkboxes.length} variation checkboxes.`);
  if (checkboxes.length > 0) pass(`${checkboxes.length} variations shown.`);
  else { fail('No checkboxes.'); await browser.close(); process.exit(1); }

  // Select All
  const selectAllBtn = await page.$('button::-p-text(Select All)');
  if (selectAllBtn) {
    await selectAllBtn.click();
    await sleep(300);
    const checked = await page.evaluate(() =>
      document.querySelectorAll('.modal-overlay input[type="checkbox"]:checked').length
    );
    if (checked === checkboxes.length) pass(`Select All: ${checked}/${checkboxes.length}.`);
    else fail(`Select All: ${checked}/${checkboxes.length}.`);
  }

  // Deselect All
  const deselectBtn = await page.$('button::-p-text(Deselect All)');
  if (deselectBtn) {
    await deselectBtn.click();
    await sleep(300);
    const checked = await page.evaluate(() =>
      document.querySelectorAll('.modal-overlay input[type="checkbox"]:checked').length
    );
    if (checked === 0) pass('Deselect All: all unchecked.');
    else fail(`Deselect All: ${checked} still checked.`);
  }

  // ── Step 6: Min 2 validation ──
  console.log('\n6. Testing min 2 validation...');
  await checkboxes[0].click();
  await sleep(200);

  let nextBtn = await page.$('button::-p-text(Next)');
  if (nextBtn) {
    await nextBtn.click();
    await sleep(500);
    const hasError = await page.evaluate(() => {
      const overlay = document.querySelector('.modal-overlay');
      return overlay?.textContent?.includes('at least 2') || false;
    });
    if (hasError) pass('Min 2 validation shown.');
    else fail('Min 2 validation not shown.');
  }

  // ── Step 7: Select all, go to config ──
  console.log('\n7. Selecting all, going to config...');
  const selectAllBtn2 = await page.$('button::-p-text(Select All)');
  if (selectAllBtn2) { await selectAllBtn2.click(); await sleep(300); }

  nextBtn = await page.$('button::-p-text(Next)');
  if (nextBtn) { await nextBtn.click(); await sleep(800); }

  // ── Step 8: Config screen ──
  console.log('\n8. Checking config screen...');
  const configText = await page.evaluate(() => {
    const overlay = document.querySelector('.modal-overlay');
    return overlay ? overlay.textContent : '';
  });

  for (const label of ['Campaign Name', 'Facebook Page', 'Daily Budget', 'Link URL', 'CTA Button', 'Target Countries', 'Bulk Publish Summary', 'Back to selection']) {
    if (configText.includes(label)) pass(`"${label}" present.`);
    else fail(`"${label}" missing.`);
  }

  // ── Step 9: Back button ──
  console.log('\n9. Testing back button...');
  const backBtn = await page.$('button::-p-text(Back to selection)');
  if (backBtn) {
    await backBtn.click();
    await sleep(400);
    const hasCheckboxes = await page.evaluate(() =>
      document.querySelectorAll('.modal-overlay input[type="checkbox"]').length > 0
    );
    if (hasCheckboxes) pass('Back to selection works.');
    else fail('Back to selection did not show checkboxes.');

    // Return to config
    nextBtn = await page.$('button::-p-text(Next)');
    if (nextBtn) { await nextBtn.click(); await sleep(500); }
  }

  // ── Step 10: Fill config ──
  console.log('\n10. Filling campaign config...');
  const campaignInput = await page.$('.modal-overlay input.editor-input');
  if (campaignInput) {
    await campaignInput.click({ clickCount: 3 });
    await campaignInput.type('Puppeteer Bulk Test');
    pass('Campaign name set.');
  }

  const pageOptions = await page.evaluate(() => {
    const selects = document.querySelectorAll('.modal-overlay select.editor-input');
    if (selects.length > 0) {
      return Array.from(selects[0].options).map(o => ({ value: o.value, text: o.text }));
    }
    return [];
  });
  console.log(`   Facebook pages: ${pageOptions.map(o => o.text).join(', ') || 'none'}`);
  if (pageOptions.length > 0) pass('Pages loaded.');
  else fail('No Facebook pages found.');

  // ── Step 11: Publish ──
  console.log('\n11. Publishing...');
  const publishBtn = await page.$('button::-p-text(Publish All)');
  if (publishBtn) {
    const isDisabled = await publishBtn.evaluate(el => el.disabled);
    if (isDisabled) {
      fail('Publish button disabled.');
    } else {
      await publishBtn.click();

      let done = false;
      const pubStart = Date.now();
      let lastLog = '';
      while (Date.now() - pubStart < TIMEOUT && !done) {
        await sleep(2000);
        const statusText = await page.evaluate(() => {
          const overlay = document.querySelector('.modal-overlay');
          return overlay ? overlay.textContent : '';
        });

        for (const pattern of [/Rendering image \d+\/\d+/, /Uploading image \d+\/\d+/, /Creating campaign/]) {
          const m = statusText.match(pattern);
          if (m && m[0] !== lastLog) {
            lastLog = m[0];
            console.log(`   ${m[0]}`);
          }
        }

        if (/\d+ Ads Created/i.test(statusText)) {
          const n = statusText.match(/(\d+) Ads Created/i);
          pass(`${n[1]} ads created in 1 campaign!`);
          done = true;
        } else if (statusText.includes('Publish Failed') || statusText.includes('Failed')) {
          // Extract the error message
          const errMsg = await page.evaluate(() => {
            const ps = document.querySelectorAll('.modal-overlay p');
            for (const p of ps) {
              if (p.style?.color?.includes('ef4444') || (p.textContent && p.textContent.length > 5 && !p.textContent.includes('rolled back'))) {
                if (p.style?.color) return p.textContent;
              }
            }
            return 'unknown error';
          });
          fail(`Publish failed: ${errMsg}`);
          done = true;
        }
      }

      if (!done) fail('Publish timed out.');
    }
  }

  // ── Step 12: Ads Manager link ──
  const adsManagerLink = await page.$('a[href*="adsmanager"]');
  if (adsManagerLink) {
    const href = await adsManagerLink.evaluate(el => el.href);
    pass(`Ads Manager link: ${href}`);
  }

  // ── Step 13: Server publications ──
  console.log('\n13. Checking server publications...');
  try {
    const pubsRes = await fetch(`${API_URL}/api/meta/insights`);
    if (pubsRes.ok) {
      const pubs = await pubsRes.json();
      console.log(`   ${pubs.length} tracked publication(s) on server.`);
      if (pubs.length > 0) pass('Publications tracked.');
    }
  } catch { console.log('   Could not check.'); }

  // ── Summary ──
  console.log('\n══════════════════════════════════════════');
  console.log(`  QA Results: ${passes} PASSED, ${fails} FAILED`);
  console.log('══════════════════════════════════════════\n');

  if (fails > 0) {
    console.log('Browser left open for inspection. Ctrl+C to exit.');
    await new Promise(() => {});
  } else {
    console.log('All tests passed! Closing in 5s...');
    await sleep(5000);
    await browser.close();
  }
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
