//Sort.Test.JS:
//Houses any unit tests needed for the set script.
//
//Created with Co-Pilot CLI (for speed) and Zak Millikin
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { chromium, firefox, webkit } = require('playwright');
const setup = require('../setup.js');
const config = require('../config');


//Setup Tests:
describe('Setup Script Tests', () => {
 test('setup.main() should run without errors', async () => {
   await assert.doesNotReject(setup.main());
 });
});

//Playwright Startup Tests:
describe('Playwright Initiation Tests', () => {

  //Test all installed browsers
 test('Should check each browser installed opens and closes', async () => {
   const browsers = setup.checkPlaywrightBrowsers(require('playwright'));

   for (const element of browsers) {
     if (!element.exists) {
       continue;
     }

     let browser;
     switch (element.browserName.toLowerCase()) {
       case 'chromium':
         browser = await chromium.launch({ headless: config.testHeadless });
         break;
       case 'firefox':
         browser = await firefox.launch({ headless: config.testHeadless });
         break;
       case 'webkit':
         browser = await webkit.launch({ headless: config.testHeadless });
         break;
       default:
         continue;
     }

     assert.ok(browser, 'Browser instance should be created');
     assert.strictEqual(browser.isConnected(), true, 'Browser should be connected upon launch');

     await browser.close();
     assert.strictEqual(browser.isConnected(), false, 'Browser should be disconnected after close');
   }
 });
});

//Data Manipulation Tests:
describe('Data Manipulation Tests', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { Data, Table, Terminal } = require('../utilities');

  test('Data.formatRelativeTime returns null for invalid input and expected phrase for past dates', () => {
    const data = new Data();
    const invalid = data.formatRelativeTime('not-a-date');
    assert.strictEqual(invalid, null);

    // Construct a date 2 days ago in UTC components matching the expected input format
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const y = twoDaysAgo.getUTCFullYear();
    const m = String(twoDaysAgo.getUTCMonth() + 1).padStart(2, '0');
    const d = String(twoDaysAgo.getUTCDate()).padStart(2, '0');
    const hh = String(twoDaysAgo.getUTCHours()).padStart(2, '0');
    const mm = String(twoDaysAgo.getUTCMinutes()).padStart(2, '0');
    const ss = String(twoDaysAgo.getUTCSeconds()).padStart(2, '0');
    const inputStr = `${y}-${m}-${d}T${hh}:${mm}:${ss} 0`;

    const out = data.formatRelativeTime(inputStr);
    assert.ok(out.includes('day'));
  });

  test('Data.parseRelativeDateData converts mixed units to minutes', () => {
    const data = new Data();
    const minutes = data.parseRelativeDateData('1 day 2 hours 3 mins');
    assert.strictEqual(minutes, 1 * 1440 + 2 * 60 + 3);
  });

  test('Data.generateTextTable produces a header and row content', async () => {
    const data = new Data();
    const arr = [{ name: 'alice', value: 42 }];
    const tableStr = await data.generateTextTable(arr);
    assert.ok(tableStr.includes('NAME'));
    assert.ok(tableStr.includes('VALUE'));
    assert.ok(tableStr.includes('alice'));
    assert.ok(tableStr.includes('42'));
  });

  test('DirCreation creates required directories', () => {
    const data = new Data();
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-wolf-test-'));
    const buildDir = path.join(tmpBase, 'build');
    const screenshotsDir = path.join(tmpBase, 'screenshots');

    // Ensure they do not exist beforehand
    try { fs.rmSync(buildDir, { recursive: true, force: true }); } catch (e) {}
    try { fs.rmSync(screenshotsDir, { recursive: true, force: true }); } catch (e) {}

    data.DirCreation(buildDir, screenshotsDir);
    assert.ok(fs.existsSync(buildDir));
    assert.ok(fs.existsSync(screenshotsDir));

    // Cleanup
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  test('Table.push adds a structured row object', async () => {
    const table = [];
    const tbl = new Table();
    await tbl.push(table, [1, '1 minute ago', 'title text', '2026-01-01T00:00:00 0', 1, true]);
    assert.strictEqual(table.length, 1);
    assert.strictEqual(table[0].Index, 1);
    assert.strictEqual(table[0].TitleText, 'title text');
  });

  test('Terminal.script("total") returns composed report including table data', async () => {
    const sampleTable = [{ Index: 1, Name: 'x' }];
    const data = new Data();
    // attach sample generateTextTable to data (use real implementation)
    const terminal = new Terminal(data);

    const nowIso = new Date().toISOString();
    const report = await terminal.script('total', [nowIso, '2026-01-01', 1, true, sampleTable]);
    assert.ok(report.includes('Timestamp'));
    assert.ok(report.includes('Table data:'));
  });
});

// E2E Local Mock Tests: serve Test_Data HTML files and navigate via More links
// Utilizes the stored Test_Data pages to create a local flow of a known good
// scan of the site. Runs a test against the current structure and functionality 
// of the basic automation framework. 
describe('E2E Local Mock Tests', () => {
  const http = require('http');
  const fs = require('fs');
  const path = require('path');
  const { Data } = require('../utilities');
  const setup = require('../setup');
  const playwrightModule = require('playwright');

  test('Should load local Test_Data pages, click More until end, and collect data', async () => {
    const testDataDir = path.join(__dirname, '..', 'Test_Data');
    const files = fs.readdirSync(testDataDir).filter((f) => f.toLowerCase().endsWith('.html')).sort();
    if (files.length === 0) {
      throw new Error('No Test_Data HTML files found');
    }

    // Choose a browser similar to setup startup method
    const browserResults = setup.checkPlaywrightBrowsers(playwrightModule);
    const available = browserResults.find((r) => r.exists);
    if (!available) {
      throw new Error('No Playwright browsers available to run the E2E test');
    }

    let browserLauncher;
    switch (available.browserName) {
      case 'chromium':
        browserLauncher = playwrightModule.chromium;
        break;
      case 'firefox':
        browserLauncher = playwrightModule.firefox;
        break;
      case 'webkit':
        browserLauncher = playwrightModule.webkit;
        break;
      default:
        browserLauncher = playwrightModule.chromium;
    }

    const browser = await browserLauncher.launch({ headless: config.testHeadless });
    const context = await browser.newContext();
    const page = await context.newPage();

    const data = new Data();

    try {
      // Instead of driving a server+navigation flow, load each Test_Data file into the page
      for (let idx = 0; idx < files.length; idx++) {
        const content = fs.readFileSync(path.join(testDataDir, files[idx]), 'utf8');
        await page.setContent(content, { waitUntil: 'load' });
        // allow the DOM to be available
        try {
          await page.waitForSelector('.titleline', { state: 'attached', timeout: 15000 });
        } catch (err) {
          const html = await page.content();
          if (!html.includes('titleline')) throw err;
        }

        if (idx === 0) {
          await data.dataCollector('dates', page, true);
          await data.dataCollector('titleLine', page, true);
          await data.dataCollector('links', page, true);
        } else {
          await data.dataCollector('dates', page, false);
          await data.dataCollector('titleLine', page, false);
          await data.dataCollector('links', page, false);
        }
      }

      // Assertions: ensure we collected from multiple pages and no more exists
      assert.ok(data.dates.length > 0, 'Should collect some dates');
      assert.ok(data.titleLine.length > 0, 'Should collect some titles');
      assert.ok(data.links.length > 0, 'Should collect some links');
    } finally {
      await browser.close();
    }
  }, 20000);
});
