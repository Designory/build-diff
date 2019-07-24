#!/usr/bin/env node

const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

const fs = require('fs-extra');
const colors = require('colors');
const glob = require('globby');
const { trimStart } = require('lodash');

(async () => {
	// @todo use an argument parsing lib
	let build_old = process.argv[2];
	let build_new = process.argv[3];

	const usage_message = '[USAGE] '.yellow + 'Run with:\n\n\t'.green + 'node zip-diffs.js old_build_dir new_build_dir\n';

	if (!build_old || !build_new) {
		console.log(usage_message);
		process.exit(1);
	}

	// Check that build folders exist
	let build_old_exists = fs.existsSync(build_old);
	let build_new_exists = fs.existsSync(build_new);

	if (!build_old_exists || !build_new_exists) {
		console.log('The passed build directories do not exist:'.red, `\n  "${build_old}"\n  "${build_new}"\n`);
		console.log(usage_message);
		process.exit(1);
	}
	
	console.log(`Comparing "${build_old.magenta}" against "${build_new.magenta}"...`);

	// If we are here, both directories exist, so let's compute the differences between them
	let diff_result;
	try {
		process.stdout.write('Diffing directories... '.yellow);
		diff_result = await execPromise(`diff -q -r "${build_old}" "${build_new}"`);
	} catch (error) {
		/**
		 * `diff` exits with code '1' (an error) when it finds differences. But this is actually what we want!
		 * If we have something other than 1, then quit our program. Otherwise, get our stdout and carry on.
		 */
		if (error.code === 1) {
			diff_result = { stdout: error.stdout };
		} else {
			console.log('\nThere was an error running the "diff" process:\n'.red, error);
			process.exit(1);
		}
	}

	console.log('Done'.green);

	process.stdout.write('Parsing diff results... '.yellow);

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

	if (files_added.length + files_updated + files_deleted.length === 0) {
		console.error(`No files were different between "${build_old}" and "${build_new}", exiting`);
		process.exit(0);
	}

	// Concat 'added' and 'updated' since functionally they are no different when uploading to AWS (or other)
	let files_changed = files_updated.concat(files_added);

	// Sort all files alphabetically
	files_deleted.sort();
	files_changed.sort();

	console.log('Done'.green);

	let output_dir = 'build_for_upload';
	output_dir = path.resolve(output_dir);

	// Create our output directory
	await fs.ensureDir(output_dir);

	// Copy our changed files over to the output directory!
	if (files_changed.length) {
		process.stdout.write('Copying over changed files... '.yellow);

		await Promise.all(
			files_changed.map(file => {
				return new Promise((resolve, reject) => {
					fs.copy(`${build_new}${path.sep}${file}`, `${output_dir}${path.sep}${file}`)
						.then(() => resolve())
						.catch(() => reject());
				});
			})
		);

		console.log('Done'.green);
	}

	// Zip the files up
	// @todo Use a native option
	process.stdout.write('Zipping changed files... '.yellow);
	await execPromise(` zip -9 -x "**/.DS_Store" -q -r ${output_dir}.zip ${output_dir}`);
	console.log('Done'.green);

	// Output the list of files that were deleted
	if (files_deleted.length) {
		console.log('\nThe following files were deleted:'.red);
		console.log('  ' + files_deleted.join('\n  ') + '\n');
	}

	if (files_changed.length) {
		console.log('\nThe following files were changed:'.green);
		console.log('  ' + files_changed.join('\n  ') + '\n');
	}

	let relative_output_dir = path.relative(process.cwd(), output_dir);
	console.log(`All changed files have been copied to ${relative_output_dir.cyan}, and zipped in ${(relative_output_dir + '.zip').cyan}\n`);
})();
