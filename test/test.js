const fs = require('fs-extra');
const path = require('path');
const assert = require('assert');
const diffDirectories = require('../src/gen-diff-object');
const DEFAULT_BLACKLIST = require('../src/diff-blacklist');
const cmd = require('./cmd');
const bin = path.resolve(__dirname, '../index.js');

// @todo ensure `diff` binary is installed an available

const PATHS_LOOKUP = require('./folders-to-compare/paths-lookup');

const FILES_ADDED = 'filesAdded';
const FILES_DELETED = 'filesDeleted';
const FILES_UPDATED = 'filesUpdated';
const RESULTS_KEYS = [FILES_ADDED, FILES_DELETED, FILES_UPDATED];

describe('`diffDirectories` method', function() {
	it('should return three keys: `filesAdded`, `filesDeleted`, and `filesUpdated`', function(done) {
		let { old_dir, new_dir } = PATHS_LOOKUP['no-change'];

		diffDirectories(old_dir, new_dir, { quiet: true })
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

		diffDirectories(old_dir, new_dir, { quiet: true })
			.then(result => {
				RESULTS_KEYS.forEach(key => {
					assert.strictEqual(result[key].length, 0);
				});

				done();
			})
			.catch(done);
	});

	it('should find new files', function(done) {
		let { old_dir, new_dir } = PATHS_LOOKUP['new-file'];

		diffDirectories(old_dir, new_dir, { quiet: true })
			.then(result => {
				assert.strictEqual(result[FILES_ADDED].length, 1);
				assert.strictEqual(result[FILES_DELETED].length, 0);
				assert.strictEqual(result[FILES_UPDATED].length, 0);

				done();
			})
			.catch(done);
	});

	it('should find new folders', function(done) {
		let { old_dir, new_dir } = PATHS_LOOKUP['new-folder'];

		diffDirectories(old_dir, new_dir, { quiet: true })
			.then(result => {
				assert.strictEqual(result[FILES_ADDED].length, 1);
				assert.strictEqual(result[FILES_DELETED].length, 0);
				assert.strictEqual(result[FILES_UPDATED].length, 0);

				done();
			})
			.catch(done);
	});

	// @todo Remove this test once we _do_ return all files within new folders
	it('should find new folders but not report all new files within that new folder', function(done) {
		let { old_dir, new_dir } = PATHS_LOOKUP['new-folder-with-many-new-files'];

		diffDirectories(old_dir, new_dir, { quiet: true })
			.then(result => {
				// New folder contains 3 files, but just gets reported as one new folder
				assert.strictEqual(result[FILES_ADDED].length, 1);
				assert.strictEqual(result[FILES_DELETED].length, 0);
				assert.strictEqual(result[FILES_UPDATED].length, 0);

				done();
			})
			.catch(done);
	});

	it('should find updated files', function(done) {
		let { old_dir, new_dir } = PATHS_LOOKUP['updated-file'];

		diffDirectories(old_dir, new_dir, { quiet: true })
			.then(result => {
				assert.strictEqual(result[FILES_ADDED].length, 0);
				assert.strictEqual(result[FILES_DELETED].length, 0);
				assert.strictEqual(result[FILES_UPDATED].length, 1);

				done();
			})
			.catch(done);
	});

	it('should find deleted files', function(done) {
		let { old_dir, new_dir } = PATHS_LOOKUP['deleted-file'];

		diffDirectories(old_dir, new_dir, { quiet: true })
			.then(result => {
				assert.strictEqual(result[FILES_ADDED].length, 0);
				assert.strictEqual(result[FILES_DELETED].length, 1);
				assert.strictEqual(result[FILES_UPDATED].length, 0);

				done();
			})
			.catch(done);
	});

	it('should handle new/updated/deleted all at once', function(done) {
		let { old_dir, new_dir } = PATHS_LOOKUP['all-combinations'];

		diffDirectories(old_dir, new_dir, { quiet: true })
			.then(result => {
				// 1 new file + 1 new folder
				assert.strictEqual(result[FILES_ADDED].length, 2);
				assert.strictEqual(result[FILES_DELETED].length, 1);
				assert.strictEqual(result[FILES_UPDATED].length, 1);

				done();
			})
			.catch(done);
	});

	// @todo support regex/globs instead of exact matches
	it('should ignore updated files on blacklist', function(done) {
		let { old_dir, new_dir } = PATHS_LOOKUP['blacklist-file'];

		diffDirectories(old_dir, new_dir, { quiet: true })
			.then(result => {
				assert.strictEqual(result[FILES_ADDED].length, 0);
				assert.strictEqual(result[FILES_DELETED].length, 0);
				assert.strictEqual(result[FILES_UPDATED].length, 1);
			})
			.then(() =>
				// Run diff again, but ignore 'file.txt'
				diffDirectories(old_dir, new_dir, { quiet: true, blacklist: [...DEFAULT_BLACKLIST, 'file.txt'] })
			)
			.then(result => {
				// With blacklist, we shouldn't have any diffs
				assert.strictEqual(result[FILES_ADDED].length, 0);
				assert.strictEqual(result[FILES_DELETED].length, 0);
				assert.strictEqual(result[FILES_UPDATED].length, 0);

				done();
			})
			.catch(done);
	});
});

describe('Command Line usage', function () {
	it('should use "build_for_upload" as default output dir', async function () {
		const output = 'build_for_upload';
		let { old_dir, new_dir } = PATHS_LOOKUP['blacklist-file'];
		try {
			await cmd.execute(bin, [old_dir, new_dir]);
		} catch (err) {
			assert.ifError(err);
		}

		const dir = path.resolve(__dirname, `../${output}`);
		const zip = path.resolve(__dirname, `../${output}.zip`);
		let build_folder_exists = await fs.exists(dir);
		let build_zip_exists = await fs.exists(zip);
		assert.ok(build_folder_exists);
		assert.ok(build_zip_exists);

		await fs.remove(dir);
		await fs.remove(zip);
	});

	it('should accept custom output dirs', async function () {
		const output = 'custom_output';
		let { old_dir, new_dir } = PATHS_LOOKUP['blacklist-file'];

		// Test both `-o` and `--output`
		for (let cli_arg of ['-o', '--output']) {
			try {
				await cmd.execute(bin, [cli_arg, output, old_dir, new_dir]);
			} catch (err) {
				assert.ifError(err);
			}

			const dir = path.resolve(__dirname, `../${output}`);
			const zip = path.resolve(__dirname, `../${output}.zip`);
			let build_folder_exists = await fs.exists(dir);
			let build_zip_exists = await fs.exists(zip);
			assert.ok(build_folder_exists);
			assert.ok(build_zip_exists);

			await fs.remove(dir);
			await fs.remove(zip);
		}
	});
});
