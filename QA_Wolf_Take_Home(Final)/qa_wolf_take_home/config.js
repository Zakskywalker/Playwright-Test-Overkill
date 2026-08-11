const path = require('path');

/**
 * Central configuration and path helper for daily run output and report paths.
 */
const projectRoot = __dirname;
const buildDir = path.join(projectRoot, 'build');

/**
 * Returns a local date stamp in YYYY-MM-DD format.
 * @param {Date} [date=new Date()] - The date to format.
 * @returns {string}
 */
function getLocalDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Produces a stable time-based run identifier for an individual process invocation.
 * @param {Date} [date=new Date()] - The date/time to derive the run id from.
 * @returns {string}
 */
function getRunId(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}-${mm}-${ss}`;
}

// Cache a module-run id so calls without an explicit date share the same
// per-run subfolder (consistent across requires in the same process)
const MODULE_RUN_ID = getRunId(new Date());

/**
 * Returns the path configuration for the current run, including per-day
 * output folders and a timestamped subfolder for screenshots.
 *
 * If no date is provided, this function uses the module-level run id.
 * This keeps all modules within the same process writing to the same
 * per-run screenshot folder.
 *
 * @param {Date} [date] - Optional date to generate a historical run path.
 * @returns {{dateStamp:string, runId:string, projectRoot:string, buildDir:string, dailyDir:string, screenshotsDir:string, outputLogPath:string, setupLogPath:string, reportPath:string}}
 */
function getRunPaths(date) {
  const useModuleRunId = arguments.length === 0;
  const effectiveDate = date || new Date();
  const dateStamp = getLocalDateStamp(effectiveDate);
  const dailyDir = path.join(buildDir, dateStamp);
  const runId = useModuleRunId ? MODULE_RUN_ID : getRunId(effectiveDate);

  return {
    dateStamp,
    runId,
    projectRoot,
    buildDir,
    dailyDir,
    screenshotsDir: path.join(dailyDir, 'screenshots', runId),
    outputLogPath: path.join(dailyDir, 'output.log'),
    setupLogPath: path.join(dailyDir, 'setup.log'),
    reportPath: path.join(dailyDir, 'report.html'),
  };
}

module.exports = {
  articleLimit: 101,
  browserName: 'firefox',
  headless: false,
  testHeadless: false,
  hackerNewsNewestUrl: 'https://news.ycombinator.com/newest',
  minNodeMajor: 18,
  playwrightHome: 'https://playwright.dev/',
  projectRoot,
  buildDir,
  getLocalDateStamp,
  getRunPaths,
};
