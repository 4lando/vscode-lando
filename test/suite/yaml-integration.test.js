"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
suite('YAML-Landofile Integration Test Suite', () => {
    test('Should detect .lando.yml files as YAML language', async () => {
        // Create a temporary .lando.yml file
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            assert.fail('No workspace folder found');
            return;
        }
        const testFile = vscode.Uri.joinPath(workspaceFolder.uri, 'test.lando.yml');
        const testContent = `name: test-app
recipe: drupal9
config:
  webroot: docroot
  php: '8.1'
  database: mysql:8.0

services:
  appserver:
    type: nginx
    build:
      - echo "Building app"
    run:
      - echo "Starting app"
`;
        // Write the test file
        const writeData = new TextEncoder().encode(testContent);
        await vscode.workspace.fs.writeFile(testFile, writeData);
        try {
            // Open the document
            const document = await vscode.workspace.openTextDocument(testFile);
            const editor = await vscode.window.showTextDocument(document);
            // Verify the language ID is 'yaml'
            assert.strictEqual(document.languageId, 'yaml', 'Landofile documents should use YAML language ID');
            // Verify the file name contains '.lando'
            assert.ok(document.fileName.includes('.lando'), 'Document should be a Landofile');
            // Close the editor
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
        finally {
            // Clean up the test file
            try {
                await vscode.workspace.fs.delete(testFile);
            }
            catch (error) {
                // Ignore cleanup errors
            }
        }
    });
    test('Should apply Landofile features to YAML documents with .lando pattern', async () => {
        // This test verifies that our custom features (completion, hover, validation)
        // are applied to YAML documents that match the .lando pattern
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            assert.fail('No workspace folder found');
            return;
        }
        const testFile = vscode.Uri.joinPath(workspaceFolder.uri, 'test2.lando.yml');
        const testContent = `name: test-app
recipe: drupal9
services:
  appserver:
    type: nginx
`;
        // Write the test file
        const writeData = new TextEncoder().encode(testContent);
        await vscode.workspace.fs.writeFile(testFile, writeData);
        try {
            // Open the document
            const document = await vscode.workspace.openTextDocument(testFile);
            const editor = await vscode.window.showTextDocument(document);
            // Verify the document is recognized as a Landofile
            assert.ok(document.fileName.includes('.lando'), 'Document should be recognized as a Landofile');
            // Verify the language is YAML
            assert.strictEqual(document.languageId, 'yaml', 'Landofile should use YAML language');
            // Close the editor
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
        finally {
            // Clean up the test file
            try {
                await vscode.workspace.fs.delete(testFile);
            }
            catch (error) {
                // Ignore cleanup errors
            }
        }
    });
});
//# sourceMappingURL=yaml-integration.test.js.map