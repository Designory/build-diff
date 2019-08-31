const { readdirSync, statSync } = require('fs');
const { basename, join, relative } = require('path');

const getListOfDirectories = path => readdirSync(path).filter(f => statSync(join(path, f)).isDirectory());
const relative_path = relative(process.cwd(), __dirname);

const test_directories = getListOfDirectories(relative_path);
const PATHS_LOOKUP = {};
test_directories.forEach(dir => (PATHS_LOOKUP[dir] = { old_dir: join(relative_path, dir, 'old'), new_dir: join(relative_path, dir, 'new') }));

/**
 * Exports an object with keys that match all directories immediately
 * within this 'folders-to-compare' directory. The values on this object
 * are also objects with an `old_dir` and `new_dir` key, that are relative (to
 * this directory) paths to the 'old' and 'new directories.
 * 
 * This is a bit overkill but the idea is that I can destructure these
 * within my tests and pass that to `diffDirectories`.
 * 
 * @example PATHS_LOOKUP = { 'no-change': { old_dir: 'folders-to-compare/no-change/old', new_dir: 'folders-to-compare/no-change/new' } }
 */
module.exports = PATHS_LOOKUP;
