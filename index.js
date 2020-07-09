#!/usr/bin/env node

const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

const fs = require('fs-extra');
const colors = require('colors');
const parseArgs = require('minimist');

const hasBinary = require('./src/has-binary');
const diffDirectories = require('./src/gen-diff-object');
const isInvalidPath = require('./src/is-invalid-path');

(async () => {
	const has_zip = hasBinary('zip');
	const has_diff = hasBinary('diff');

	if (!(has_zip && has_diff)) {
		// prettier-ignore
		console.error(`Could not find both "${'zip'.yellow}" and "${'diff'.yellow}" binaries, both of which are required. Exiting.`);
		process.exit(1);
	}

	const arg_options = {
		boolean: ['quiet', 'json'],
		string: ['output'],
		default: {
			quiet: false,
			json: false,
			output: 'build_for_upload',
		},
		alias: {
			q: 'quiet',
			j: 'json',
			o: 'output',
		},
	};
	const argv = parseArgs(process.argv.slice(2), arg_options);

	// Minimst uses an underscore (`_` for non-keyed arguments)
	let [build_old, build_new] = argv._;

	// @todo Have options table automatically generated
	const usage_message = `
Usage: build-diff [options] <old-build-directory> <new-build-directory>

CLI to compare two folders and copy out the differences between them

Version 0.3.0

Options:
  -q, --quiet          Hides progress as it compares the directories. Defaults to false.
  -j, --json           Outputs results as JSON. Defaults to false.
  -o, --output <name>  Name of the output folder and ZIP file. Defaults to "build_for_upload".
`;

	if (!build_old || !build_new) {
		console.error(usage_message);
		process.exit(1);
	}

	// Check that build folders exist
	let build_old_exists = fs.existsSync(build_old);
	let build_new_exists = fs.existsSync(build_new);

	if (!build_old_exists || !build_new_exists) {
		console.error(
			'The passed build directories do not exist:'.red,
			`\n  "${build_old}"\n  "${build_new}"\n`
		);
		console.error(usage_message);
		process.exit(1);
	}

	// Destructure flags
	const { quiet, json, output } = argv;

	if (isInvalidPath(output)) {
		console.error(
			'The passed output directory has invalid characters:'.red,
			`\n  "${output}"\n`
		);
		console.error(usage_message);
		process.exit(1);
	}

	!quiet && console.log(`Comparing "${build_old.magenta}" against "${build_new.magenta}"...`);

	// If we are here, both directories exist, so let's compute the differences between them

	let {
		filesAdded: files_added,
		filesUpdated: files_updated,
		filesDeleted: files_deleted,
	} = await diffDirectories(build_old, build_new, { quiet });

	if (files_added.length + files_updated + files_deleted.length === 0) {
		console.error(`No files were different between "${build_old}" and "${build_new}", exiting`);
		process.exit(0);
	}

	// Concat 'added' and 'updated' since functionally they are no different when uploading to AWS (or other)
	let files_changed = files_updated.concat(files_added);

	// Sort newly formed `files_changed`; other lists are already sorted
	files_changed.sort();

	let output_dir = path.resolve(output);

	// Create our output directory
	try {
		await fs.ensureDir(output_dir);
	} catch (e) {
		console.error(`Unable to create output directory at "${output_dir}"`);
		console.error(e);
		process.exit(2);
	}

	// Copy our changed files over to the output directory!
	if (files_changed.length) {
		!quiet && process.stdout.write('Copying over changed files... '.yellow);

		await Promise.all(
			files_changed.map((file) => {
				return new Promise((resolve, reject) => {
					fs.copy(`${build_new}${path.sep}${file}`, `${output_dir}${path.sep}${file}`)
						.then(() => resolve())
						.catch(() => reject());
				});
			})
		);

		!quiet && console.log('Done'.green);
	}

	// Zip the files up
	// @todo Use a native option
	!quiet && process.stdout.write('Zipping changed files... '.yellow);
	let relative_output_dir = path.relative(process.cwd(), output_dir);
	await execPromise(
		`zip -9 -x "**/.DS_Store" -q -r ${relative_output_dir}.zip ${relative_output_dir}`
	);
	!quiet && console.log('Done\n'.green);

	if (json) {
		const json_output = {
			filesDeleted: files_deleted,
			filesChanged: files_changed,
			outputDir: relative_output_dir,
			outputZip: relative_output_dir + '.zip',
		};

		console.log(JSON.stringify(json_output));
	} else {
		if (files_deleted.length) {
			console.log('The following files were deleted:'.red);
			console.log('  ' + files_deleted.join('\n  ') + '\n');
		}

		if (files_changed.length) {
			console.log('\nThe following files were changed:'.green);
			console.log('  ' + files_changed.join('\n  ') + '\n');
		}

		console.log(
			`All changed files have been copied to ${relative_output_dir.cyan}, and zipped in ${
				(relative_output_dir + '.zip').cyan
			}\n`
		);
	}
})();
