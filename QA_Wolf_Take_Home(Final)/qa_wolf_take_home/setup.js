//setup.js: 
//Validates if the proper environment is setup based on the config data
//and what is available in the workdirectory, will attempt to help install
//missing requirements or point the user where to install. 
//
//Partially Generated with AI(Codex): Modified and Verified Zak Millikin. 
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execFileSync } = require('child_process');
const { createRequire } = require('module');
const config = require('./config');

const paths = config.getRunPaths();
const PROJECT_ROOT = config.projectRoot;
const BUILD_DIR = config.buildDir;
const SETUP_LOG = paths.setupLogPath;
const OUTPUT_LOG = paths.outputLogPath;
const PLAYWRIGHT_HOME = config.playwrightHome;
const MIN_NODE_MAJOR = config.minNodeMajor;

const logger = require('./logging');
const log = logger.log;

/**
 * Ensures the build root and current daily output directory exist.
 * Creates both directories recursively when missing.
 */
function ensureBuildDir() {
  for (const directoryPath of [BUILD_DIR, paths.dailyDir]) {
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }
  }
}

/**
 * Writes a standardized section header to the setup log output.
 * @param {string} title - The title text displayed between separators.
 */
function section(title) {
  log('');
  log('='.repeat(72));
  log(title);
  log('='.repeat(72));
}

/**
 * Executes a command and returns trimmed stdout, or null on failure.
 * @param {string} command
 * @param {string[]} args
 * @param {Object} [options={}] 
 * @returns {string|null}
 */
function runCommand(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Locates an npm CLI entrypoint within the current Node installation.
 * @returns {string|null}
 */
function getNpmCliPath() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * Executes an npm command and returns stdout, using the best available npm entrypoint.
 * @param {string[]} args - Arguments to pass to npm.
 * @param {Object} [options={}] - Child process options.
 * @returns {string|null}
 */
function runNpm(args, options = {}) {
  const npmCliPath = getNpmCliPath();
  if (npmCliPath) {
    return runCommand(process.execPath, [npmCliPath, ...args], options);
  }

  return runCommand(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, options);
}

/**
 * Executes an npm command with inherited stdio so progress messages appear live.
 * @param {string[]} args - Arguments to pass to npm.
 * @param {Object} [options={}] - Child process options.
 * @returns {Buffer|string|undefined}
 */
function execNpm(args, options = {}) {
  const npmCliPath = getNpmCliPath();
  if (npmCliPath) {
    return execFileSync(process.execPath, [npmCliPath, ...args], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      ...options,
    });
  }

  return execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    ...options,
  });
}

/**
 * Detects whether a given package is installed inside the project and returns its metadata.
 * @param {string} packageName
 * @returns {{found:boolean, version:string|null, packageJsonPath:string|null, source:string|null, error?:Error}}
 */
function getPackageVersion(packageName) {
  try {
    const packageJsonPath = require.resolve(path.join(packageName, 'package.json'), {
      paths: [PROJECT_ROOT],
    });
    return {
      found: true,
      version: require(packageJsonPath).version,
      packageJsonPath,
      source: 'local node_modules',
    };
  } catch (error) {
    return {
      found: false,
      version: null,
      packageJsonPath: null,
      source: null,
      error,
    };
  }
}

/**
 * Resolves a user-specified Playwright package location and validates it.
 * @param {string} location - Path to a directory or package.json file.
 * @returns {{found:boolean, version:string, packageJsonPath:string, source:string}}
 */
function getPlaywrightFromLocation(location) {
  const resolved = path.resolve(PROJECT_ROOT, location);
  const packageJsonPath = fs.statSync(resolved).isDirectory()
    ? path.join(resolved, 'package.json')
    : resolved;

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('No package.json found at ' + packageJsonPath);
  }

  const packageJson = require(packageJsonPath);
  if (packageJson.name !== 'playwright') {
    throw new Error('The selected package is "' + packageJson.name + '", not "playwright".');
  }

  const requireFromPackage = createRequire(packageJsonPath);
  requireFromPackage('playwright');

  return {
    found: true,
    version: packageJson.version,
    packageJsonPath,
    source: 'custom location',
  };
}

/**
 * Detects runtime details, including whether the process is running in Docker.
 * @returns {{platform:string, arch:string, osRelease:string, isDocker:boolean, playwrightBrowsersPath:string}}
 */
function detectRuntime() {
  const isDocker =
    fs.existsSync('/.dockerenv') ||
    fs.existsSync('/run/.containerenv') ||
    process.env.CONTAINER === 'true' ||
    process.env.DOCKER_CONTAINER === 'true';

  return {
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    isDocker,
    playwrightBrowsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH || '(not set)',
  };
}

/**
 * Validates that the installed Node.js version meets the minimum requirement.
 * @returns {boolean}
 */
function checkNode() {
  const version = process.version;
  const major = Number(version.replace(/^v/, '').split('.')[0]);
  const ok = Number.isFinite(major) && major >= MIN_NODE_MAJOR;

  log('Node executable: ' + process.execPath);
  log('Node version: ' + version + (ok ? ' OK' : ' WARNING'));
  if (!ok) {
    log('Setup instruction: Install Node.js ' + MIN_NODE_MAJOR + '+ before running this project.');
  }

  return ok;
}

/**
 * Checks whether npm is available and logs the version.
 * @returns {string|null}
 */
function checkNpm() {
  const version = runNpm(['--version']);
  log('npm version: ' + (version || 'not found'));
  if (!version) {
    log('Setup instruction: Install npm or reinstall Node.js from https://nodejs.org/.');
  }
  return version;
}

/**
 * Reads the installed playwright version using npm metadata.
 * @returns {string|null}
 */
function checkPlaywrightNpmVersion() {
  const npmList = runNpm(['list', 'playwright', '--depth=0', '--json']);
  if (!npmList) return null;

  try {
    const parsed = JSON.parse(npmList);
    return parsed.dependencies?.playwright?.version || null;
  } catch (error) {
    return null;
  }
}

/**
 * Checks installed Playwright browser binaries by invoking the executable path
 * helper on each supported runtime.
 * @param {Object} playwright - The imported Playwright module.
 * @returns {Array<{browserName:string, executablePath:string|null, exists:boolean, error?:string}>}
 */
function checkPlaywrightBrowsers(playwright) {
  const browserResults = [];
  const browserNames = ['chromium', 'firefox', 'webkit'];

  for (const browserName of browserNames) {
    try {
      const executablePath = playwright[browserName].executablePath();
      browserResults.push({
        browserName,
        executablePath,
        exists: fs.existsSync(executablePath),
      });
    } catch (error) {
      browserResults.push({
        browserName,
        executablePath: null,
        exists: false,
        error: error.message,
      });
    }
  }

  return browserResults;
}

/**
 * Prints a framed text modal to the terminal with a list of recovery options.
 * @param {string} message
 * @param {string[]} options
 */
function printModal(message, options) {
  const width = 74;
  const border = '+' + '-'.repeat(width - 2) + '+';
  const wrapped = [];
  const words = message.split(/\s+/);
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length > width - 6) {
      wrapped.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) wrapped.push(current);

  console.log('');
  console.log(border);
  console.log('| SETUP ACTION REQUIRED'.padEnd(width - 1) + '|');
  console.log(border);
  for (const line of wrapped) {
    console.log('| ' + line.padEnd(width - 4) + ' |');
  }
  console.log('|'.padEnd(width - 1) + '|');
  for (const option of options) {
    console.log('| ' + option.padEnd(width - 4) + ' |');
  }
  console.log(border);
}

/**
 * Prompts the user for input via stdin and returns the trimmed response.
 * @param {string} question
 * @returns {Promise<string>}
 */
function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Presents recovery choices for missing Playwright and executes the chosen path.
 * @returns {Promise<{found:boolean, version:string, packageJsonPath:string, source:string}|null>}
 */
async function recoverMissingPlaywright() {
  printModal(
    'Playwright could not be found. Choose a recovery option so setup can continue.',
    [
      '1. Enter a Playwright package location',
      '2. Install Playwright with npm',
      '3. Skip and write manual setup instructions',
    ]
  );

  const choice = await ask('Select 1, 2, or 3: ');

  if (choice === '1') {
    const location = await ask('Path to Playwright package folder or package.json: ');
    try {
      const result = getPlaywrightFromLocation(location);
      log('Playwright found at custom location: ' + result.packageJsonPath);
      log('Playwright version: ' + result.version);
      return result;
    } catch (error) {
      log('Custom Playwright location failed: ' + error.message);
      return null;
    }
  }

  if (choice === '2') {
    log('Installing Playwright with npm...');
    try {
      execNpm(['install', 'playwright']);
      return getPackageVersion('playwright');
    } catch (error) {
      log('npm install playwright failed.');
      return null;
    }
  }

  return null;
}

/**
 * Persists the current buffered setup logs to disk.
 * Writes the primary setup log and appends a descriptive section to the output log.
 */
function writeLogs() {
  ensureBuildDir();
  const text = logger.getLines().join(os.EOL) + os.EOL;
  fs.writeFileSync(SETUP_LOG, text, 'utf8');
  fs.appendFileSync(
    OUTPUT_LOG,
    os.EOL + '--- Setup Instructions / Environment Check ---' + os.EOL + text,
    'utf8'
  );
}

/**
 * Runs the full setup validation workflow, logs environment details, and
 * writes output to the daily setup log files.
 */
async function main() {
  ensureBuildDir();

  section('QA Wolf Project Setup Check');
  log('Timestamp: ' + new Date().toISOString());
  log('Project root: ' + PROJECT_ROOT);
  log('Daily output folder: ' + paths.dailyDir);

  section('Runtime');
  const runtime = detectRuntime();
  log('Platform: ' + runtime.platform);
  log('Architecture: ' + runtime.arch);
  log('OS release: ' + runtime.osRelease);
  log('Docker/container: ' + (runtime.isDocker ? 'yes' : 'no'));
  log('PLAYWRIGHT_BROWSERS_PATH: ' + runtime.playwrightBrowsersPath);
  if (runtime.isDocker && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
    log('Setup instruction: In Docker, install browsers during image build with `npx playwright install --with-deps`.');
    log('Setup instruction: If browsers are preinstalled in a shared path, set PLAYWRIGHT_BROWSERS_PATH to that directory.');
  }

  section('Node And npm');
  checkNode();
  checkNpm();

  section('Playwright Package');
  let playwrightPackage = getPackageVersion('playwright');
  const npmPlaywrightVersion = checkPlaywrightNpmVersion();

  if (!playwrightPackage.found) {
    log('Playwright package: not found in local node_modules');
    playwrightPackage = await recoverMissingPlaywright();
  }

  if (playwrightPackage?.found) {
    log('Playwright package source: ' + playwrightPackage.source);
    log('Playwright package path: ' + playwrightPackage.packageJsonPath);
    log('Playwright package version: ' + playwrightPackage.version);
    log('Playwright npm version: ' + (npmPlaywrightVersion || playwrightPackage.version));

    try {
      const playwright = require('playwright');
      const browserResults = checkPlaywrightBrowsers(playwright);
      section('Playwright Browsers');
      for (const result of browserResults) {
        log(result.browserName + ': ' + (result.exists ? 'found ' : 'missing ') + (result.executablePath || 'no executable path'));
      }

      if (browserResults.some((result) => !result.exists)) {
        log('Setup instruction: Browser binaries are missing. Run `npx playwright install`.');
        if (runtime.isDocker) {
          log('Setup instruction: For Docker/Linux dependencies, run `npx playwright install --with-deps`.');
        }
      }
    } catch (error) {
      log('Playwright could not be required after detection: ' + error.message);
      log('Setup instruction: Run `npm install` from the project root, then run `npx playwright install`.');
    }
  } else {
    section('Manual Setup Required');
    log('Playwright is still unavailable.');
    log('Setup instruction: Run `npm install playwright` from the project root.');
    log('Setup instruction: Then run `npx playwright install`.');
    log('Setup instruction: Playwright homepage: ' + PLAYWRIGHT_HOME);
  }

  section('Result');
  log('Setup log written to: ' + SETUP_LOG);
  log('Setup details appended to: ' + OUTPUT_LOG);
  writeLogs();
}

if (require.main === module) {
  main().catch((error) => {
    log('Setup failed unexpectedly: ' + error.stack);
    log('Setup instruction: Visit ' + PLAYWRIGHT_HOME + ' for installation instructions.');
    writeLogs();
    process.exitCode = 1;
  });
}

//Exports:
module.exports = {
  main,
  checkPlaywrightBrowsers,
  // Expose internals for testing and advanced usage
  getPackageVersion,
  getPlaywrightFromLocation,
  runNpm,
  execNpm,
  ask,
  printModal,
  detectRuntime,
  checkNode,
  checkNpm,
  checkPlaywrightNpmVersion,
  writeLogs,
  ensureBuildDir,
};
