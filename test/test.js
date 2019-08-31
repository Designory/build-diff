const assert = require('assert');
const diffDirectories = require('../src/gen-diff-object');

// Ensure tests are run on mac operating system
if (process.platform !== 'darwin') {
	console.error('Tests are only supported on macOS at this time');
	process.exit(1);
}

const PATHS_LOOKUP = require('./folders-to-compare/paths-lookup');

describe('`diffDirectories` method', function() {

});
