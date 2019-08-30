const CHANGED_FILES_BLACKLIST = require('./diff-blacklist');

const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

const fs = require('fs-extra');
const colors = require('colors');
const glob = require('globby');
const { trimStart } = require('lodash');

const diffDirectories = async (build_old, build_new, { blacklist = CHANGED_FILES_BLACKLIST, log = true } = {}) => {
	let diff_result;

	try {
		log && process.stdout.write('Diffing directories... '.yellow);
		diff_result = await execPromise(`diff -q -r "${build_old}" "${build_new}"`);
	} catch (error) {
		/**
		 * `diff` exits with code '1' (an error) when it finds differences. But this is actually what we want!
		 * If we have something other than 1, then quit our program. Otherwise, get our stdout and carry on.
		 */
		if (error.code === 1) {
			diff_result = { stdout: error.stdout };
		} else {
			log && console.log('\nThere was an error running the "diff" process:\n'.red, error);
			process.exit(1);
		}
	}

	log && console.log('Done'.green);

	log && process.stdout.write('Parsing diff results... '.yellow);

	/**
	 * @note Documentation notes on `diff` program output:
	 *
	 * We are passing in the `-q` and `-r` options, which means we only output
	 * the file names that are different, and we recursively look through the directories
	 * for any differences (respectively).
	 *
	 * There are 3 variations on what the output could be:
	 *
	 * 1. New files
	 * 2. Deleted files
	 * 3. Updated
	 *
	 * Four our builds (under S3), we no longer differentiate between _updated_ and _new_
	 * files, so we only care about those that are _deleted_, and those that have _changed_.
	 *
	 * Note that in the below examples, `build-new` and `build-old` will be replaced by whatever
	 * arguments you passed into the your `build_new` and `build_old` variables / arguments above.
	 *
	 * If a file is **new**, its output will look like
	 *
	 *     Only in build-new: a-newly-added-file.txt
	 *     Only in build-new/existing-dir: a-newly-added-file-within-a-directory.txt
	 *     Only in build-new: a-newly-added-directory
	 *
	 * If a file is **deleted**, its output will look like
	 *
	 *     Only in build-old: a-deleted-file.txt
	 *     Only in build-old/existing-dir: a-deleted-file-within-a-directory.txt
	 *     Only in build-old: a-deleted-directory
	 *
	 * And if a file has been **updated**, its output will look like
	 *
	 *     Files build-old/file.txt and build-new/file.txt differ
	 *     Files build-old/existing-dir/other-file.txt and build-new/existing-dir/other-file.txt differ
	 */
	let diff_output = diff_result.stdout;
	let diff_output_array = diff_output.split('\n').filter(v => v);

	const files_deleted_regex = new RegExp(`^Only in ${build_old}(.*?): (.*)$`, 'i');
	const files_added_regex = new RegExp(`^Only in ${build_new}(.*?): (.*)$`, 'i');
	const files_updated_regex = new RegExp(`^Files (.*?) and (.*?) differ$`, 'i');

	// Calculate what files were deleted, added, or updated
	let files_deleted = diff_output_array.filter(line => files_deleted_regex.test(line));
	let files_added = diff_output_array.filter(line => files_added_regex.test(line));
	let files_updated = diff_output_array.filter(line => files_updated_regex.test(line));

	// Parse out real file paths from our above lists
	files_deleted = files_deleted.map(line => {
		let [_match, subdir, file] = files_deleted_regex.exec(line);

		// Trim leading slash on subdir
		subdir = trimStart(subdir, path.sep);

		return subdir ? subdir + path.sep + file : file;
	});
	files_added = files_added.map(line => {
		let [_match, subdir, file] = files_added_regex.exec(line);

		// Trim leading slash on subdir
		subdir = trimStart(subdir, path.sep);

		return subdir ? subdir + path.sep + file : file;
	});
	files_updated = files_updated.map(line => {
		// `old_path` and `new_path` only differ in their leading directory string. Otherwise, the file pathname is the same.
		let [_match, old_path] = files_updated_regex.exec(line);

		// Remove build dir from `old_path` and `new_path`, and trim leading slash
		let file_path = old_path.replace(new RegExp(`^${build_old}`), '');
		file_path = trimStart(file_path, path.sep);

		return file_path;
	});

	// Filter files we don't care about
	files_changed = files_changed.filter(file => !blacklist.includes(file));

	// Sort all files alphabetically
	files_added.sort();
	files_updated.sort();
	files_deleted.sort();

	log && console.log('Done'.green);

	return {
		filesAdded: files_added,
		filesUpdated: files_updated,
		filesDeleted: files_deleted,
	};
};
