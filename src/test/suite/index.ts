import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		color: true,
		timeout: 30000
	});

	const testsRoot = path.resolve(__dirname, '..');

	return new Promise(async (c, e) => {
		try {
			const testPatternArg = process.argv.find(arg => arg.startsWith('--test-pattern='));
			const testFilePattern = testPatternArg ? testPatternArg.split('=')[1] : '**/**.test.js';

			const files = await glob(testFilePattern, { cwd: testsRoot });

			// Add files to the test suite
			files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

			// Run the mocha test
			mocha.run((failures: number) => {
				if (failures > 0) {
					e(new Error(`${failures} tests failed.`));
				} else {
					c();
				}
			});
		} catch (err) {
			e(err);
		}
	});
} 