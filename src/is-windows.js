// @from https://raw.githubusercontent.com/jonschlinkert/is-invalid-path/master/index.js
const isWindows = (opts = {}) => process.platform !== 'win32' || opts.windows === true;

module.exports = isWindows;
