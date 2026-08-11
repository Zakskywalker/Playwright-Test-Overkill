const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const config = require('../config');

describe('Run paths and day-change behavior', () => {
  test('getRunPaths produces different dailyDir for different mock days', () => {
    const dateA = new Date('2026-01-01T10:00:00Z');
    const dateB = new Date('2026-01-02T10:00:00Z');

    const pathsA = config.getRunPaths(dateA);
    const pathsB = config.getRunPaths(dateB);

    // dateStamp should reflect the provided mock date
    assert.strictEqual(pathsA.dateStamp, '2026-01-01');
    assert.strictEqual(pathsB.dateStamp, '2026-01-02');

    // dailyDir should end with the dateStamp folder
    assert.ok(pathsA.dailyDir.endsWith(path.join('build', '2026-01-01')));
    assert.ok(pathsB.dailyDir.endsWith(path.join('build', '2026-01-02')));

    // screenshotsDir should include the dateStamp and a runId subfolder (HH-MM-SS)
    const segmentsA = pathsA.screenshotsDir.split(path.sep);
    const segmentsB = pathsB.screenshotsDir.split(path.sep);
    assert.ok(segmentsA.includes('2026-01-01'));
    assert.ok(segmentsB.includes('2026-01-02'));

    // runId should be present and be a string like HH-MM-SS
    assert.match(pathsA.runId, /^[0-2][0-9]-[0-5][0-9]-[0-5][0-9]$/);
    assert.match(pathsB.runId, /^[0-2][0-9]-[0-5][0-9]-[0-5][0-9]$/);
  });
});
