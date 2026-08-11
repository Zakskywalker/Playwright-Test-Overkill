/**
 * Utility classes and helpers for data collection, screenshot capture, table
 * modelling, and terminal report generation.
 * @module utilities
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');
const paths = config.getRunPaths();
const logger = require('./logging');

/**
 * ETL helper for collected article data, including dates, titles, and links.
 */
class Data {
  temp = '';
  dates = [];
  titleLine = [];
  links = [];

     /**
      * Ensures build and screenshot directories exist for the current run.
      * @param {string} buildDir - Path to the daily build directory.
      * @param {string} ScreenCapsDir - Path to the per-run screenshot directory.
      */
     DirCreation(buildDir, ScreenCapsDir) {
       if (!fs.existsSync(buildDir)) {
         fs.mkdirSync(buildDir, { recursive: true });
       }

       if (!fs.existsSync(ScreenCapsDir)) {
         fs.mkdirSync(ScreenCapsDir, { recursive: true });
       }
     }

     /**
      * Converts a timestamp string to a human-friendly relative time phrase.
      * @param {string} inputString - A timestamp in the format YYYY-MM-DDTHH:MM:SS 0.
      * @returns {string|null}
      */
     formatRelativeTime(inputString) {
    const formatRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\s+(\d+)$/;
    const match = inputString.match(formatRegex);

    if (!match) {
      return null;
    }

    const [, year, month, day, hours, minutes, seconds] = match;
    const dateObj = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));

    if (Number.isNaN(dateObj.getTime())) {
      return null;
    }

    const now = new Date();
    const diffInSeconds = Math.floor((now - dateObj) / 1000);
    const safeSeconds = diffInSeconds < 0 ? 0 : diffInSeconds;

    if (safeSeconds < 60) {
      return `${safeSeconds} second${safeSeconds === 1 ? '' : 's'} ago`;
    }

    const diffInMinutes = Math.floor(safeSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }

  /**
   * Converts a relative age string into a total number of minutes.
   * Supported units: days, hours, mins.
   * @param {string} ageString
   * @returns {number|null}
   */
  parseRelativeDateData(ageString) {
    if (!ageString) return null;

    const lower = ageString.toLowerCase();
    let totalMinutes = 0;

    const daysMatch = lower.match(/(\d+)\s*day/);
    const hoursMatch = lower.match(/(\d+)\s*hour/);
    const minsMatch = lower.match(/(\d+)\s*min/);

    if (daysMatch) totalMinutes += parseInt(daysMatch[1], 10) * 1440;
    if (hoursMatch) totalMinutes += parseInt(hoursMatch[1], 10) * 60;
    if (minsMatch) totalMinutes += parseInt(minsMatch[1], 10);

    return totalMinutes;
  }

  /**
   * Collects article metadata from the page and appends it to the internal arrays.
   * @param {'dates'|'titleLine'|'links'} data
   * @param {import('playwright').Page} page
   * @param {boolean|null} [initial=null] - When null, overwrites the initial arrays.
   */
  async dataCollector(data, page, initial = null) {
    switch (data) {
    case 'dates':
      if (initial == null) {
        this.dates = await page.$$eval('.age', (elements) =>
          elements.slice(0, 100).map((element) => element.title.trim())
        );
      } else {
        this.dates = this.dates.concat(await page.$$eval('.age', (elements) =>
          elements.slice(0, 100).map((element) => element.title.trim())
        ));
      }
      break;

    case 'titleLine':
      if (initial == null) {
        this.titleLine = await page.$$eval('.titleline', (elements) =>
          elements.slice(0, 100).map((element) => element.textContent.trim())
        );
      } else {
        this.titleLine = this.titleLine.concat(await page.$$eval('.titleline', (elements) =>
          elements.slice(0, 100).map((element) => element.textContent.trim())
        ));
      }
      break;

    case 'links':
      if (initial == null) {
        this.links = await page.$$eval('.titleline > a', (elements) =>
          elements.slice(0, 100).map((element) => element.href)
        );
      } else {
        this.links = this.links.concat(await page.$$eval('.titleline > a', (elements) =>
          elements.slice(0, 100).map((element) => element.href)
        ));
      }
      break;

    default:
      throw new Error(`Unknown data collector type: ${data}`);
  }
}

 /**
  * Generates a plain-text table from an array of row objects.
  * @param {Array<Record<string, any>>} array
  * @returns {Promise<string>}
  */
 async generateTextTable(array) {
  if (array.length === 0) return '';

  const headers = Object.keys(array[0]);
  const colWidths = headers.reduce((acc, header) => {
    acc[header] = Math.max(
      header.length,
      ...array.map((row) => String(row[header] ?? '').length)
    );
    return acc;
  }, {});

  const buildSeparator = () =>
    '+' + headers.map((header) => '-'.repeat(colWidths[header] + 2)).join('+') + '+';

  const buildRow = (rowObj) =>
    '|' + headers.map((header) => ` ${String(rowObj[header] ?? '').padEnd(colWidths[header])} `).join('|') + '|';

  const lines = [
    buildSeparator(),
    '|' + headers.map((header) => ` ${header.toUpperCase().padEnd(colWidths[header])} `).join('|') + '|',
    buildSeparator(),
    ...array.map((row) => buildRow(row)),
    buildSeparator(),
  ];

  return lines.join('\n');
}


}

/**
 * Captures page screenshots into the per-run screenshot folder.
 */
class Camera {
  ScreenCapsDir = paths.screenshotsDir;
  photoSnaps = 0;

  /**
   * Saves a full-page screenshot for the current run.
   * @param {import('playwright').Page} page
   */
  async snap(page) {
    try {
      // Ensure screenshot directory exists (necessary on fresh runs or different OS filesystems)
      if (!fs.existsSync(this.ScreenCapsDir)) {
        fs.mkdirSync(this.ScreenCapsDir, { recursive: true });
      }

      const fileName = `playwright-shot_${this.photoSnaps++}.png`;
      const targetPath = path.join(this.ScreenCapsDir, fileName);

      await page.screenshot({
        path: targetPath,
        fullPage: true,
      });
    } catch (error) {
      if (error && error.message && error.message.includes('Target page, context or browser has been closed')) {
        logger.warn('Skipping screenshot because the page was already closed.');
        return;
      }
      throw error;
    }
  }
}

/**
 * Lightweight table model for report row creation.
 */
class Table {
  tableData = [];
  rows = config.articleLimit;
  cols = 4; // index, age, text date, passedval

  /**
   * Appends a structured row object to a target array.
   * @param {Array<Object>} table
   * @param {Array<any>} dat
   */
  async push(table, dat) {
    table.push({
      Index: dat[0],
      AgeText: dat[1],
      TitleText: dat[2],
      TitleDate: dat[3],
      MinutesElapsed: dat[4],
      ValidOrder: dat[5],
    });
  }
}

/**
 * Terminal helper for centralized console output and report construction.
 */
class Terminal {
  constructor(dataInstance = null) {
    this.data = dataInstance; // optional Data instance; prefer passing explicitly
  }

  /**
   * Writes a normal line of text to the shared logger.
   * @param {string} txt
   */
  async cOut(txt) {
    logger.log(txt);
  }

  /**
   * Emits two blank lines for readability.
   */
  async dSpace() {
    logger.log('');
    logger.log('');
  }

  /**
   * Writes a table object to the shared logger.
   * @param {any} data
   */
  async tabGen(data) {
    logger.table(data);
  }

  /**
   * Renders different CLI outputs based on the selected script action.
   * @param {string} choice
   * @param {Array<any>} [vars=null]
   * @returns {Promise<string>}
   */
  async script(choice, vars = null) {
    try {
      switch(choice){
        case("verify"):
         this.cOut(`Verifying article age is descending: First ${vars[0]} articles: Descending order is ${vars[1] ? 'valid' : 'invalid'}`);     
        break;
        case("ext"):
         this.cOut("External Data Generation: ");
        break;
        case("line"):
        this.cOut("");
        this.cOut("========================================================================"); 
        this.cOut(""); 
        break; 
        case("total"):
         // Ensure we have a Data instance available
         if (!this.data) {
           // fall back to global if present
           this.data = (typeof global !== 'undefined' && global.data) ? global.data : null;
         }

         let tableStr = '';
         if (this.data && typeof this.data.generateTextTable === 'function') {
           try {
             tableStr = await this.data.generateTextTable(vars[4]);
           } catch (err) {
             logger.warn('generateTextTable failed: ' + (err.message || err));
             tableStr = '<error generating table>';
           }
         } else {
           tableStr = '<no table data available>';
         }

         return [
          '--- Hacker News Sort Check ---',
          `Timestamp: ${vars[0]}`,
          `Run date folder: ${vars[1]}`,
          'YCombinator test completed:',
          `Verifying article age is descending: First ${vars[2]} articles: Descending order is ${vars[3] ? 'valid' : 'invalid'}`,
          'Table data:' + tableStr,
          '',
        ].join('\n');
        break;
      }
    } catch (err) {
      logger.error('Terminal.script error: ' + err);
      return '<terminal script error>';
    }
    return '';
  }
}

//Exports
module.exports = {Data, Camera, Table, Terminal}; 

