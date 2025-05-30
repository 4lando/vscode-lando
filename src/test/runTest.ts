import * as path from 'path';
import { runTests, downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';
import * as cp from 'child_process';
import * as fs from 'fs';

async function getRequiredExtensions(): Promise<string[]> {
	const packageJsonPath = path.resolve(__dirname, '../../package.json');
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
	return packageJson.extensionDependencies || [];
}

function getInstalledExtensions(cliPath: string, args: string[]): string[] {
	try {
		const result = cp.spawnSync(cliPath, [...args, '--list-extensions'], { 
			encoding: 'utf-8',
			timeout: 10000, // 10 second timeout
			env: { ...process.env, DONT_PROMPT_WSL_INSTALL: '1' }
		});
		
		if (result.error) {
			console.log('Error listing extensions:', result.error.message);
			return [];
		}
		
		if (result.status !== 0) {
			console.log('Failed to list extensions, status:', result.status);
			return [];
		}
		
		const extensions = result.stdout.trim().split('\n').filter(ext => ext.length > 0);
		return extensions;
	} catch (error) {
		console.log('Exception listing extensions:', error);
		return [];
	}
}

function installMissingExtensions(cliPath: string, args: string[], requiredExtensions: string[], installedExtensions: string[]): void {
	const missingExtensions = requiredExtensions.filter(ext => !installedExtensions.includes(ext));
	
	if (missingExtensions.length === 0) {
		console.log('All required extensions are already installed');
		return;
	}

	console.log(`Installing missing extensions: ${missingExtensions.join(', ')}`);
	
	for (const extension of missingExtensions) {
		console.log(`Installing extension: ${extension}`);
		const result = cp.spawnSync(
			cliPath,
			[...args, '--install-extension', extension],
			{ 
				encoding: 'utf-8', 
				stdio: 'inherit',
				timeout: 30000, // 30 second timeout
				env: { ...process.env, DONT_PROMPT_WSL_INSTALL: '1' }
			}
		);
		
		if (result.error) {
			console.log(`Error installing ${extension}:`, result.error.message);
		}
	}
}

async function main() {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');
		const extensionTestsPath = path.resolve(__dirname, './suite/index');
		const testWorkspaceFile = path.resolve(__dirname, '../../test/test.code-workspace');

		// Download VS Code and get CLI path
		const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
		const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

		// Get required extensions from package.json
		const requiredExtensions = await getRequiredExtensions();
		console.log(`Required extensions: ${requiredExtensions.join(', ')}`);

		// Get currently installed extensions
		const installedExtensions = getInstalledExtensions(cliPath, args);
		console.log(`Installed extensions: ${installedExtensions.join(', ')}`);

		// Install missing extensions
		installMissingExtensions(cliPath, args, requiredExtensions, installedExtensions);

		// Wait a moment for extension installation to complete
		await new Promise(resolve => setTimeout(resolve, 2000));

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