#!/usr/bin/env node

const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

const fs = require('fs-extra');
const colors = require('colors');
const { trimStart } = require('lodash');
const parseArgs = require('minimist');

const diffDirectories = require('./src/gen-diff-object');

(async () => {
	const argv = parseArgs(process.argv.slice(2));

	// Minimst uses an underscore (`_` for non-keyed arguments)
	let [build_old, build_new] = argv._;

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

	let { filesAdded: files_added, filesUpdated: files_updated, filesDeleted: files_deleted } = await diffDirectories(
		build_old,
		build_new
	);

	if (files_added.length + files_updated + files_deleted.length === 0) {
		console.error(`No files were different between "${build_old}" and "${build_new}", exiting`);
		process.exit(0);
	}

	// Concat 'added' and 'updated' since functionally they are no different when uploading to AWS (or other)
	let files_changed = files_updated.concat(files_added);

	// Sort newly formed `files_changed`; other lists are already sorted
	files_changed.sort();

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
	let relative_output_dir = path.relative(process.cwd(), output_dir);
	await execPromise(`zip -9 -x "**/.DS_Store" -q -r ${relative_output_dir}.zip ${relative_output_dir}`);
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

	console.log(`All changed files have been copied to ${relative_output_dir.cyan}, and zipped in ${(relative_output_dir + '.zip').cyan}\n`);
})();
