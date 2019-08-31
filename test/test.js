const assert = require('assert');
const diffDirectories = require('../src/gen-diff-object');

// Ensure tests are run on mac operating system
if (process.platform !== 'darwin') {
	console.error('Tests are only supported on macOS at this time');
	process.exit(1);
}

const PATHS_LOOKUP = require('./folders-to-compare/paths-lookup');

const FILES_ADDED = 'filesAdded';
const FILES_DELETED = 'filesDeleted';
const FILES_UPDATED = 'filesUpdated';
const RESULTS_KEYS = [FILES_ADDED, FILES_DELETED, FILES_UPDATED];

describe('`diffDirectories` method', function() {
	it('should return three keys: `filesAdded`, `filesDeleted`, and `filesUpdated`', function(done) {
		let { old_dir, new_dir } = PATHS_LOOKUP['no-change'];

		diffDirectories(old_dir, new_dir, { log: false })
			.then(result => {
				let keys = Object.keys(result);
				keys.sort();

				assert.deepEqual(keys, RESULTS_KEYS);
				done();
			})
			.catch(done);
	});

	it('should return empty arrays when no differences are found', function(done) {
		let { old_dir, new_dir } = PATHS_LOOKUP['no-change'];

		diffDirectories(old_dir, new_dir, { log: false })
			.then(result => {
				RESULTS_KEYS.forEach(key => {
					assert.strictEqual(result[key].length, 0);
				});

				done();
			})
			.catch(done);
	});

	it('should return find new files', function(done) {
		let { old_dir, new_dir } = PATHS_LOOKUP['new-file'];

		diffDirectories(old_dir, new_dir, { log: false })
			.then(result => {
				assert.strictEqual(result[FILES_ADDED].length, 1);
				assert.strictEqual(result[FILES_DELETED].length, 0);
				assert.strictEqual(result[FILES_UPDATED].length, 0);

				done();
			})
			.catch(done);
	});

	it('should return find updated files', function(done) {
		let { old_dir, new_dir } = PATHS_LOOKUP['updated-file'];

		diffDirectories(old_dir, new_dir, { log: false })
			.then(result => {
				assert.strictEqual(result[FILES_ADDED].length, 0);
				assert.strictEqual(result[FILES_DELETED].length, 0);
				assert.strictEqual(result[FILES_UPDATED].length, 1);

				done();
			})
			.catch(done);
	});
});
