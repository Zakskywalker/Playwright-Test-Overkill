// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const fs = require('fs');
const playwright = require('playwright');
const HtmlReportGenerator = require('./html-report-generator');
const config = require('./config');
const {Data, Camera, Table, Terminal} = require('./utilities');
const setup = require('./setup');
const paths = config.getRunPaths();
const buildDir = paths.dailyDir;
const filePath = paths.outputLogPath;

let isDescending = true;

//Initialize new classes
cam = new Camera(); 
data = new Data(); 
tab = new Table(); 
trmnl = new Terminal(data); 

//Verify Directories exist and create if not. 
data.DirCreation(buildDir,cam.ScreenCapsDir);

/**
 * Main end-to-end test runner that loads Hacker News, collects content,
 * generates screenshots, writes terminal output to logs, and creates an HTML report.
 */
async function Test_Runner() {
  //Set base variables for run: 
  //camera shots set to 0, Pull in browser config options.
  cam.photoSnaps = 0;
  let configChoice = config.browserName || 'firefox';

  //Dynamically look up and launch the selected browser type.
  if (!playwright[configChoice]) {
    throw new Error(`Invalid browser choice: ${configChoice}`);
  }
  trmnl.cOut(`Starting ${configChoice}...`);
  trmnl.dSpace(); 
  const browser = await playwright[configChoice].launch({
    headless: config.headless
  });
  
  //Pull browser and page details for test run.
  const context = await browser.newContext();
  const page = await context.newPage();

  //Load page and perform automated actions and scrape.
  try {
    await page.goto(config.hackerNewsNewestUrl);
    await page.waitForLoadState('networkidle');

    //Scrapping actions to collections.
    await data.dataCollector('dates', page, true);
    await data.dataCollector('titleLine', page, true);
    await data.dataCollector('links', page, true);
    //Attemp to find the More link and upper Rank for currentLoad.
    let moreLink = await page.$('.morelink');
    let linkRank = await page.locator('.rank').filter({ visible: true }).allInnerTexts();
    let currentLoad = parseInt(linkRank[linkRank.length - 1], 10);

    //Screenshot of current page
    await cam.snap(page);

    //Loop till collection is complete collecting 100 of the newest article listings. 
    while (currentLoad <= 101 && moreLink) {
      moreLink = await page.$('a.morelink');
      if (!moreLink) break;

      await moreLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      linkRank = await page.locator('.rank').filter({ visible: true }).allInnerTexts();

      await data.dataCollector('dates', page, false);
      await data.dataCollector('titleLine', page, false);
      await data.dataCollector('links', page, false);

      await cam.snap(page); 

      currentLoad = parseInt(linkRank[linkRank.length - 1], 10);
    }
    //Make sure all collections are correctly set at 100. 
    data.dates = data.dates.slice(0, tab.rows);
    data.titleLine = data.titleLine.slice(0, tab.rows);
    data.links = data.links.slice(0, tab.rows);
    
    //Scripting data out to the terminal. 
    trmnl.cOut("Running Hacker News Sort Check...");
    await sortHackerNewsArticles(page, browser, context, data.dates);

    await trmnl.tabGen(tab.tableData);
    await trmnl.script("verify", [(data.dates.length - 1), isDescending]);
    await trmnl.dSpace();
    await trmnl.script("ext");
    const terminalOutput = await trmnl.script("total", [new Date().toISOString(), paths.dateStamp, (data.dates.length - 1), isDescending, tab.tableData]);
   
    //Append the data to the log to reflect the terminal output. 
    fs.appendFileSync(filePath, terminalOutput, 'utf8');
    trmnl.cOut(`Log successfully updated at ${filePath}`);
    
    //Generation of HTML Report.
    const reportGenerator = new HtmlReportGenerator(paths.reportPath);
    reportGenerator.writeReport(tab.tableData, data.links);
  } finally {
    //Close browser and end the main loop. 
    await browser.close();
  }
}

/**
 * Validates that Hacker News article ages are in descending order and
 * populates the table model with the collected metadata.
 * @param {import('playwright').Page} page
 * @param {import('playwright').Browser} browser
 * @param {import('playwright').BrowserContext} context
 * @param {string[]} datesToCheck
 */
async function sortHackerNewsArticles(page, browser, context, datesToCheck) {
  //Reset Required Variables
  tab.tableData = [];
  isDescending = true;
  //Run date formatting and verification checks
  //validate that remains descending. 
  for (let i = 0; i < datesToCheck.length - 1; i++) {
    const currentAgeText = data.formatRelativeTime(datesToCheck[i]);
    const nextAgeText = datesToCheck[i + 1] ? data.formatRelativeTime(datesToCheck[i + 1]) : null;

    trmnl.cOut(`Analyzing article ${i + 1}: ${datesToCheck[i]} - ${datesToCheck[i + 1]}`);
    trmnl.cOut(`Analyzing article ${i + 1}: ${currentAgeText} - ${nextAgeText}`);

    const currentMins = data.parseRelativeDateData(currentAgeText);
    const nextMins = data.parseRelativeDateData(nextAgeText);
    const isValid = nextMins === null || currentMins <= nextMins;

    if (!isValid) {
      isDescending = false;
    }

     tab.push(tab.tableData,
    [i+1, currentAgeText, data.titleLine[i], datesToCheck[i], currentMins, isValid]);
  }
   trmnl.dSpace(); 
}

//Application Run
(async () => { 
  await setup.main(); 
  await Test_Runner();
})();
