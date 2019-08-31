const assert = require('assert');
const diffDirectories = require('../src/gen-diff-object');

// Ensure tests are run on mac operating system
if (process.platform !== 'darwin') {
	console.error('Tests are only supported on macOS at this time');
	process.exit(1);
}

const PATHS_LOOKUP = require('./folders-to-compare/paths-lookup');

describe('`diffDirectories` method', function() {
	it('should return three keys: `filesAdded`, `filesDeleted`, and `filesUpdated`', function(done) {
		let { old_dir, new_dir } = PATHS_LOOKUP['no-change'];

		diffDirectories(old_dir, new_dir, { log: false }).then(result => {
			let keys = Object.keys(result);
			keys.sort();

			assert.deepEqual(keys, ['filesAdded', 'filesDeleted', 'filesUpdated']);
			done();
		});
	});
});
