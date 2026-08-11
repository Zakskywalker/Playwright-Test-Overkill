const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const setup = require('../setup');
const logger = require('../logging');
const config = require('../config');

function cleanupBuildSubdir(dateStamp) {
  const buildDir = path.join(__dirname, '..', 'build', dateStamp);
  try {
    fs.rmSync(buildDir, { recursive: true, force: true });
  } catch (e) {}
}

describe('Setup modal flows and instructions', () => {
  test('recoverMissingPlaywright choice 1 (custom location) is handled and logged', async () => {
    logger.clearLines();

    // prevent external npm calls
    setup.runNpm = (args) => '9.0.0';
    setup.execNpm = (args) => null;

    // monkeypatch: initial getPackageVersion returns not found
    setup.getPackageVersion = (name) => ({ found: false });

    // getPlaywrightFromLocation returns a found package
    setup.getPlaywrightFromLocation = (location) => ({ found: true, version: '1.2.3', packageJsonPath: location, source: 'custom location' });

    // simulate user entering '1' then a path
    let calls = 0;
    setup.ask = async (q) => {
      calls += 1;
      if (calls === 1) return '1';
      return '/tmp/fake-playwright';
    };

    // Stub require('playwright') so setup.main can check browser executables
    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function(request) {
      if (request === 'playwright') {
        return {
          chromium: { executablePath: () => '/fake/chromium' },
          firefox: { executablePath: () => '/fake/firefox' },
          webkit: { executablePath: () => '/fake/webkit' },
        };
      }
      return originalLoad.apply(this, arguments);
    };

    // Call main and then inspect logger
    await setup.main();

    // restore Module._load
    Module._load = originalLoad;

    const lines = logger.getLines().join('\n');
    assert.ok(lines.includes('Playwright found at custom location') || lines.includes('Playwright package source') || lines.includes('Playwright package path'), 'Expected log to mention playwright custom location');

    // cleanup created build folder for that date
    const dateStamp = config.getLocalDateStamp();
    cleanupBuildSubdir(dateStamp);
  });

  test('recoverMissingPlaywright choice 2 (install) calls execNpm and then reports found', async () => {
    logger.clearLines();

    // prevent external npm calls
    setup.runNpm = (args) => '9.0.0';
    // Set up installed flag
    let installed = false;
    // initial getPackageVersion returns not found; after "install" it returns found
    setup.getPackageVersion = (name) => ({ found: installed, version: installed ? '1.2.3' : null });

    // execNpm will set installed true
    setup.execNpm = (args, options) => {
      installed = true;
      return null;
    };

    // simulate user entering '2' to install
    setup.ask = async (q) => {
      return '2';
    };

    await setup.main();

    const lines = logger.getLines().join('\n');
    assert.ok(lines.includes('Playwright package version') || lines.includes('Playwright npm version') || lines.includes('Playwright package source'), 'Expected logs to show playwright details after install');

    // cleanup
    const dateStamp = config.getLocalDateStamp();
    cleanupBuildSubdir(dateStamp);
  });

  test('Setup warns when browser binaries missing and logs instruction to run npx playwright install', async () => {
    logger.clearLines();

    // prevent external npm calls
    setup.runNpm = (args) => '9.0.0';

    // getPackageVersion returns found true
    setup.getPackageVersion = (name) => ({ found: true, version: '1.2.3', packageJsonPath: '/fake', source: 'local node_modules' });

    // force checkPlaywrightBrowsers to report a missing binary
    setup.checkPlaywrightBrowsers = (playwright) => [{ browserName: 'chromium', executablePath: null, exists: false }];

    // Stub require('playwright') so setup.main will call our checkPlaywrightBrowsers
    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function(request) {
      if (request === 'playwright') {
        return {
          chromium: { executablePath: () => '/fake/chromium' },
          firefox: { executablePath: () => '/fake/firefox' },
          webkit: { executablePath: () => '/fake/webkit' },
        };
      }
      return originalLoad.apply(this, arguments);
    };

    await setup.main();
    Module._load = originalLoad;

    const lines = logger.getLines().join('\n');
    assert.ok(lines.includes('npx playwright install') || lines.includes('Browser binaries are missing') || lines.includes('playwright install'), 'Expected a setup instruction about installing browsers');

    // cleanup
    const dateStamp = config.getLocalDateStamp();
    cleanupBuildSubdir(dateStamp);
  });
});
