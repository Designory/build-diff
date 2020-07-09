/**
 * @see https://medium.com/@zorrodg/integration-tests-on-node-js-cli-part-1-why-and-how-fa5b1ba552fe
 */
const { spawn, fork } = require('child_process');
const concat = require('concat-stream');
function createProcess(processPath, args = [], env = null) {
	args = [processPath].concat(args);

	return spawn('node', args, {
		env: Object.assign(
			{
				NODE_ENV: 'test',
			},
			env
		),
	});
}

function createFork(processPath, args = [], env = null) {
	const new_env = Object.assign(
		{},
		process.env,
		{
			NODE_ENV: 'test',
		},
		env
	);

	return fork(processPath, args, {
		env: new_env,
		silent: true,
	});
}

function execute(processPath, args = [], opts = {}) {
	const { env = null } = opts;
	const childProcess = createFork(processPath, args, env);
	childProcess.stdin.setEncoding('utf-8');
	const promise = new Promise((resolve, reject) => {
		childProcess.stderr.once('data', (err) => {
			reject(err.toString());
		});
		childProcess.on('error', reject);
		childProcess.stdout.pipe(
			concat((result) => {
				resolve(result.toString());
			})
		);
	});
	return promise;
}

module.exports = { execute };
