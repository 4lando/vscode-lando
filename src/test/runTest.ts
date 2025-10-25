import * as path from 'path';
import { runTests, downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';
import * as fs from 'fs';

async function main() {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');
		const extensionTestsPath = path.resolve(__dirname, './suite/index');
		const testWorkspaceFile = path.resolve(__dirname, '../../test/test.code-workspace');

		// Download VS Code and get CLI path
		const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');

		// Stage 1: Test non-activation with a single file (outside of any Lando workspace)
		console.log('Running Stage 1: Testing non-activation with a single file...');
		
		// Create a temporary file outside the project directory
		const os = require('os');
		const tempDir = os.tmpdir();
		const tempFilePath = path.join(tempDir, 'vscode-lando-test-dummy.txt');
		fs.writeFileSync(tempFilePath, 'This is a test file for vscode-lando extension testing.');
		
		try {
			await runTests({
				extensionDevelopmentPath,
				extensionTestsPath: path.resolve(__dirname, './suite'), // Point to the suite directory
				vscodeExecutablePath,
				launchArgs: [
					tempFilePath,
					'--disable-workspace-trust',
					'--test-pattern=noActivation.test.js' // Pass the pattern to index.ts
				]
			});
		} finally {
			// Clean up temp file
			if (fs.existsSync(tempFilePath)) {
				fs.unlinkSync(tempFilePath);
			}
		}

		// Stage 2: Run full test suite with the workspace
		console.log('Running Stage 2: Running full test suite with the workspace...');
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath: path.resolve(__dirname, './suite'), // Point to the suite directory
			vscodeExecutablePath,
			launchArgs: [
				testWorkspaceFile,
				'--disable-workspace-trust',
				'--test-pattern=extension.test.js,unit.test.js' // Pass the pattern to index.ts
			]
		});
	} catch (err) {
		console.error('Failed to run tests');
		console.error(err);
		process.exit(1);
	}
}

main();