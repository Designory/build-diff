const fs = require('fs');
const path = require('path');

const getPaths = (bin_path) => {
	const envPath = process.env.PATH || '';
	const envExt = process.env.PATHEXT || '';
	return envPath
		.replace(/["]+/g, '')
		.split(path.delimiter)
		.map((chunk) => {
			return envExt.split(path.delimiter).map((ext) => path.join(chunk, bin_path + ext));
		})
		.reduce((a, b) => a.concat(b));
};

/**
 * Helper utility to check if a binary exists in our $PATH variable. Used to
 * see if the user has `zip` installed (and maybe others).
 * @see https://github.com/springernature/hasbin/blob/5af037b/lib/hasbin.js
 * @returns {Boolean}
 */
const hasBinary = (bin) => {
	return getPaths(bin).some((filePath) => {
		try {
			return fs.statSync(filePath).isFile();
		} catch (error) {
			return false;
		}
	});
};

module.exports = hasBinary;
