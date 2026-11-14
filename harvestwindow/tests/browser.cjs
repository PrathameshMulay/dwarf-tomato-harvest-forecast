const {chromium} = require('playwright');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../dashboard/index.html')).href);
    await page.waitForSelector('#operations-table tbody tr');
    assert.match(await page.locator('#market-result').textContent(), /Harvest 2024-11-14/);
    await page.click('[data-route="long"]');
    assert.match(await page.locator('#market-result').textContent(), /Harvest 2024-11-12/);
    await page.click('[data-route="local"]');
    await page.fill('#market-form [name=quantity]', '10000');
    assert.match(await page.locator('#market-result').textContent(), /capacity/);
    await page.fill('#market-form [name=quantity]', '500');
    await page.locator('#sample-entry summary').click();
    await page.fill('#sample-form [name=grams]', '10');
    await page.click('#sample-form button');
    assert.match(await page.locator('#market-result').textContent(), /rejection limit/);
    assert.equal(await page.locator('#ml-metrics tbody tr').count(),10);
    for (const model of ['xgboost', 'xgboost_heat', 'hybrid', 'hierarchical']) {
      await page.selectOption('#ml-model', model);
      assert.equal(await page.locator('#ml-days tbody tr').count(),22);
    }
    for (const name of ['MuGrow','IDEAS','Reference','Tomatonuts','Trigger','Agrifusion']) {
      await page.selectOption('#room', name);
      assert.equal(await page.locator('#operations-table tbody tr').count(),13);
      assert((await page.locator('#best-date').textContent()).length > 0);
    }
    await page.selectOption('#room','IDEAS');
    assert((await page.locator('#operations-table').textContent()).includes('suspect readings'));
    await page.locator('#operations summary').click();
    await page.fill('#channel-search','substrate');
    assert(await page.locator('#data-channel option').count() > 0);
    assert(await page.locator('#channel-table tbody tr').count() > 30);
    await page.fill('#channel-search','no-such-channel');
    assert.equal(await page.locator('#channel-summary').textContent(),'No matching channels.');
    await page.fill('#channel-search','');
    await page.selectOption('#data-source','weather');
    assert(await page.locator('#channel-table tbody tr').count() > 30);
    await page.fill('#order-form [name=quantity]','1000000');
    assert((await page.locator('#order-result').textContent()).includes('shortfall'));
    await page.fill('#order-form [name=quantity]','1500');
    await page.check('#order-form [name=samples]');
    assert((await page.locator('#order-result').textContent()).includes('revealed'));
    await page.fill('#order-form [name=quantity]','');
    assert(await page.locator('#export-order').isDisabled());
    await page.fill('#order-form [name=quantity]','1500');
    const download = page.waitForEvent('download'); await page.click('#export-order');
    assert.equal((await download).suggestedFilename(),'harvestwindow-order-plan.json');
    await page.fill('#journal-form [name=owner]','QA');
    await page.fill('#journal-form [name=task]','Inspect sensor <test>');
    await page.fill('#journal-form [name=pots]','50');
    await page.fill('#journal-form [name=revenue]','100');
    await page.fill('#journal-form [name=cost]','20');
    await page.click('#journal-form button');
    await page.click('#journal-table button');
    assert((await page.locator('#journal-summary').textContent()).includes('80.00'));
    await page.reload();
    assert((await page.locator('#journal-table').textContent()).includes('Inspect sensor <test>'));
    assert((await page.locator('#journal-summary').textContent()).includes('80.00'));
    await page.locator('#import-journal').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":1,"entries":[{}]}')});
    await page.waitForFunction(() => document.getElementById('journal-message').textContent === 'Invalid journal backup.');
    assert.equal(await page.locator('#journal-message').textContent(),'Invalid journal backup.');
    await page.locator('#import-journal').setInputFiles({name:'good.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,entries:[{id:'fixture',room:'MuGrow',date:'2024-11-06',owner:'QA',task:'Imported',status:'Open',pots:0,revenue:0,cost:0}]}))});
    await page.waitForFunction(() => document.querySelectorAll('#journal-table tbody tr').length === 2);
    assert.equal(await page.locator('#journal-table tbody tr').count(),2);
    await page.evaluate(() => localStorage.removeItem('harvestwindow-journal-v1'));
    await page.reload();
    if (process.env.HARVESTWINDOW_SCREENSHOT) {
      await page.screenshot({path:process.env.HARVESTWINDOW_SCREENSHOT,fullPage:true});
    }
    await page.setViewportSize({width:390,height:844});
    await page.reload();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
    assert.deepEqual(errors,[]);
    console.log('Browser workflow, all rooms, exports, persistence, import validation, and mobile layout passed.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
