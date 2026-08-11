const os = require('os');

/**
 * Centralized logging helper that preserves log semantics and buffers
 * setup output for later writing to a log file.
 * @module logging
 */
const lines = [];

/**
 * Logs a message to the console and retains it in-memory for later output.
 * @param {any} [message='']
 */
function log(message = '') {
  const text = String(message);
  lines.push(text);
  console.log(text);
}

/**
 * Emits a warning to the console without storing it in the regular output buffer.
 * @param {any} [message='']
 */
function warn(message = '') {
  const text = String(message);
  console.warn(text);
}

/**
 * Emits an error to the console.
 * @param {any} [message='']
 */
function error(message = '') {
  const text = String(message);
  console.error(text);
}

/**
 * Logs a formatted table to the console.
 * @param {any} data
 */
function table(data) {
  console.table(data);
}

/**
 * Returns a copy of the current buffered log lines.
 * @returns {string[]}
 */
function getLines() {
  return lines.slice();
}

/**
 * Clears the buffered log lines.
 */
function clearLines() {
  lines.length = 0;
}

module.exports = {
  log,
  warn,
  error,
  table,
  getLines,
  clearLines,
};
