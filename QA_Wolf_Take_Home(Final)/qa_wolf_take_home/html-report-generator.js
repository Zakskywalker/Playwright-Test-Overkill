/**
 * HTML report generator for the QA Wolf run output.
 * Creates a timeline visualization and interactive row navigation from
 * scraped article data.
 */
const fs = require('fs');
const path = require('path');
const logger = require('./logging');

class HtmlReportGenerator {
    /**
     * @param {string} outputPath - The set file path where the report will be written.
     */
    constructor(outputPath) {
        this.outputPath = outputPath;
    }

    /**
     * Clean date strings to make sure Node can parse them cleanly.
     */
    parseCleanDate(dateStr) {
        if (!dateStr) return new Date();
        const [isoDatePart] = String(dateStr).split(' ');
        const parsed = new Date(isoDatePart);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    }

    /**
     * Escapes HTML special characters to prevent markup injection.
     * @param {any} value
     * @returns {string}
     */
    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Compiles the data array, timeline chart, and links into the final HTML layout.
     * @param {Array<Object>} dataArray - Array of table test rows.
     * @param {Array<string>} linksArray - Array of standalone clickable target URLs.
     */
    writeReport(dataArray, linksArray = []) {
        try {
            if (!dataArray || dataArray.length === 0) {
                throw new Error("Cannot generate a report from an empty dataset.");
            }

            // 1. Process client runtime data configuration for chart plotting calculations
            const processedItems = dataArray.map((row, idx) => {
                const rowIndex = row.Index ?? (idx + 1);
                const safeTitle = row.TitleText || '';
                const shortTitle = safeTitle.substring(0, 6).replace(/[^a-zA-Z0-9]/g, '_');
                const rowAnchorId = 'row-' + rowIndex + '-' + shortTitle;
                const targetLink = linksArray[idx] || '#';
                const parsedDate = this.parseCleanDate(row.TitleDate);

                return {
                    ...row,
                    computedIndex: rowIndex,
                    anchorId: rowAnchorId,
                    targetLink: targetLink,
                    displayTime: parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                };
            });

            // 2. Generate the dynamic SVG chart with evenly spaced index markers.
            const paddingX = 70;
            const chartWidth = Math.max(1200, processedItems.length * 34);
            const chartHeight = 120;
            const innerWidth = chartWidth - (paddingX * 2);

            const chartPoints = processedItems.map((item, idx) => {
                const percentage = processedItems.length === 1 ? 0.5 : idx / (processedItems.length - 1);
                const cx = paddingX + (percentage * innerWidth);
                const cy = 58;
                const dotColor = item.ValidOrder === true ? '#4caf50' : '#f44336';
                const tooltip = 'Index: ' + item.computedIndex + '\n' +
                    'Title: ' + item.TitleText + '\n' +
                    'Age: ' + item.AgeText + '\n' +
                    'Date: ' + item.TitleDate;
                
                return {
                    id: item.anchorId,
                    cx: cx.toFixed(1),
                    cy: cy,
                    color: dotColor,
                    label: String(item.computedIndex),
                    time: item.displayTime,
                    tooltip: tooltip
                };
            });

            const pathD = chartPoints
                .map((pt, i) => (i === 0 ? 'M ' : ' L ') + pt.cx + ' ' + pt.cy)
                .join('');

            const svgNodes = chartPoints.map(pt => {
                return '<g class="chart-node" onclick="scrollToRow(\'' + pt.id + '\')" data-target-id="' + pt.id + '">' +
                       '<title>' + this.escapeHtml(pt.tooltip) + '</title>' +
                       '<line x1="' + pt.cx + '" y1="82" x2="' + pt.cx + '" y2="92" class="chart-tick" />' +
                       '<circle cx="' + pt.cx + '" cy="' + pt.cy + '" r="12" fill="' + pt.color + '" stroke="#121212" stroke-width="3" />' +
                       '<text x="' + pt.cx + '" y="' + (pt.cy + 4) + '" text-anchor="middle" class="chart-label">' + this.escapeHtml(pt.label) + '</text>' +
                       '<text x="' + pt.cx + '" y="108" text-anchor="middle" class="chart-time">' + this.escapeHtml(pt.time) + '</text>' +
                       '</g>';
            }).join('\n');

            const svgTimelineHtml = '<svg viewBox="0 0 ' + chartWidth + ' ' + chartHeight + '" width="' + chartWidth + '" height="' + chartHeight + '" role="img" aria-label="Article timeline chart">' +
                                    '<path d="' + pathD + '" stroke="#777" stroke-width="4" fill="none" stroke-linecap="round" />' +
                                    svgNodes +
                                    '</svg>';

            // 3. Generate individual markup segments for the layout views
            const sidebarHtml = processedItems.map((item) => {
                const label = '(' + item.computedIndex + ') ' + item.TitleText;
                return '<div class="test-item" id="nav-item-' + item.anchorId + '" onclick="scrollToRow(\'' + item.anchorId + '\')" title="' + this.escapeHtml(label) + '">' + this.escapeHtml(label) + '</div>';
            }).join('\n');

            const tableRowsHtml = processedItems.map((item) => {
                const statusClass = item.ValidOrder === true ? 'status-pass' : 'status-fail';
                const statusText = item.ValidOrder === true ? 'PASS' : 'FAIL';
                const linkCellHtml = item.targetLink !== '#' 
                    ? '<a href="' + this.escapeHtml(item.targetLink) + '" target="_blank" rel="noopener noreferrer" class="row-link">Open Link</a>'
                    : '<span style="color: #555;">None</span>';

                return '<tr id="' + item.anchorId + '">' +
                       '<td>' + item.computedIndex + '</td>' +
                       '<td>' + this.escapeHtml(item.AgeText) + '</td>' +
                       '<td class="title-cell">' + this.escapeHtml(item.TitleText) + '</td>' +
                       '<td style="font-family: monospace; color: #aaa;">' + this.escapeHtml(item.TitleDate) + '</td>' +
                       '<td>' + this.escapeHtml(item.MinutesElapsed) + 'm</td>' +
                       '<td class="' + statusClass + '">' + statusText + '</td>' +
                       '<td>' + linkCellHtml + '</td>' +
                       '</tr>';
            }).join('\n');

            // 4. Base template with valid document structure.
            const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Progressive Dashboard Report</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background-color: #121212;
      color: #e0e0e0;
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    nav {
      width: 260px;
      background-color: #1e1e1e;
      border-right: 1px solid #333;
      padding: 20px;
      overflow-y: auto;
      box-sizing: border-box;
    }
    nav h2 {
      font-size: 1.1rem;
      margin-top: 0;
      color: #fff;
      border-bottom: 1px solid #333;
      padding-bottom: 10px;
    }
    .test-item {
      padding: 12px 10px;
      margin-bottom: 6px;
      background-color: #2a2a2a;
      cursor: pointer;
      border-radius: 4px;
      transition: background 0.2s, border-left 0.1s;
      font-size: 0.9rem;
      font-family: monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-left: 3px solid transparent;
    }
    .test-item:hover, .test-item.active {
      background-color: #383838;
    }
    .test-item.active {
      border-left-color: #64b5f6;
      color: #fff;
      background-color: #3f3f3f;
    }
    .viewport-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      min-width: 0;
    }
    .sticky-header-panel {
      background-color: #1a1a1a;
      border-bottom: 1px solid #333;
      padding: 20px 30px;
      z-index: 10;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    }
    .sticky-header-panel h1 {
      margin: 0 0 15px 0;
      font-size: 1.5rem;
      color: #fff;
    }
    .chart-wrapper {
      background-color: #111;
      border: 1px solid #2d2d2d;
      border-radius: 6px;
      padding: 15px 10px 5px 10px;
      overflow-x: auto;
      overflow-y: hidden;
    }
    .chart-wrapper svg {
      display: block;
      min-width: 100%;
    }
    .chart-node {
      cursor: pointer;
    }
    .chart-node circle {
      transition: r 0.2s, stroke 0.2s;
    }
    .chart-node:hover circle, .chart-node.active circle {
      r: 15px;
      stroke: #64b5f6;
    }
    .chart-label {
      font-size: 9px;
      fill: #fff;
      font-weight: 700;
      font-family: monospace;
      pointer-events: none;
    }
    .chart-time {
      font-size: 9px;
      fill: #999;
      font-family: monospace;
      pointer-events: none;
    }
    .chart-tick {
      stroke: #555;
      stroke-width: 2;
      pointer-events: none;
    }
    .scrollable-table-area {
      flex: 1;
      padding: 30px;
      overflow: auto;
      scroll-behavior: smooth;
      box-sizing: border-box;
    }
    .table-container {
      width: 100%;
      background-color: #1e1e1e;
      border-radius: 6px;
      border: 1px solid #333;
      overflow: auto;
      margin-bottom: 40px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th, td {
      padding: 14px 16px;
      border-bottom: 1px solid #333;
      font-size: 0.9rem;
      vertical-align: top;
    }
    th {
      background-color: #252525;
      color: #fff;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 2;
    }
    tr {
      transition: background-color 0.2s;
    }
    tr:hover {
      background-color: #252525;
    }
    tr.highlighted-row {
      background-color: #1c2d42 !important;
      outline: 1px solid #64b5f6;
    }
    .title-cell {
      max-width: 420px;
      word-break: break-word;
    }
    .status-pass { color: #4caf50; font-weight: bold; }
    .status-fail { color: #f44336; font-weight: bold; }
    .row-link { color: #64b5f6; text-decoration: none; }
    .row-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <nav>
    <h2>Navigation Index</h2>
    ${sidebarHtml}
  </nav>
  <main class="viewport-main">
    <section class="sticky-header-panel">
      <h1>Linear Timeline Progression Report</h1>
      <div class="chart-wrapper">
        ${svgTimelineHtml}
      </div>
    </section>
    <section class="scrollable-table-area">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>(Index)</th>
              <th>Age Text</th>
              <th>Title Text</th>
              <th>Title Date</th>
              <th>Elapsed</th>
              <th>Status</th>
              <th>Link Cell</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
    </section>
  </main>
  <script>
    function scrollToRow(rowId) {
      var targetRow = document.getElementById(rowId);
      if (!targetRow) return;

      var navItems = document.querySelectorAll('.test-item');
      for (var i = 0; i < navItems.length; i++) {
        navItems[i].classList.remove('active');
      }
      var activeNav = document.getElementById('nav-item-' + rowId);
      if (activeNav) {
        activeNav.classList.add('active');
        activeNav.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      var chartNodes = document.querySelectorAll('.chart-node');
      for (var j = 0; j < chartNodes.length; j++) {
        chartNodes[j].classList.remove('active');
      }
      var activeNode = document.querySelector('.chart-node[data-target-id="' + rowId + '"]');
      if (activeNode) {
        activeNode.classList.add('active');
        activeNode.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }

      var rows = document.querySelectorAll('tbody tr');
      for (var k = 0; k < rows.length; k++) {
        rows[k].classList.remove('highlighted-row');
      }
      targetRow.classList.add('highlighted-row');
      targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  </script>
</body>
</html>`;
            const targetDir = path.dirname(this.outputPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }

            fs.writeFileSync(this.outputPath, htmlContent, 'utf8');
            logger.log('Report successfully compiled at: ' + this.outputPath);
        } catch (error) {
            logger.error('Failed to run writeReport steps: ' + error);
        }
    }
}
module.exports = HtmlReportGenerator;
