/**
 * PHP Commands
 * 
 * This module registers PHP-related VS Code commands for Lando integration.
 * 
 * @module php/commands
 */

import * as vscode from "vscode";
import { LandoConfig } from "../types";
import { checkLandoStatus } from "../helpers/lando";
import { 
  getPhpWrapperPath, 
  overridePhpExecutablePath, 
  restoreOriginalPhpSettings,
  checkAndReloadPhpPlugins 
} from "./index";

/**
 * Registers PHP-related commands
 * @param context - The extension context
 * @param workspaceFolder - The workspace folder path
 * @param landoConfig - The parsed Lando configuration
 * @param outputChannel - Output channel for logging
 */
export function registerPhpCommands(
  context: vscode.ExtensionContext,
  workspaceFolder: string,
  landoConfig: LandoConfig,
  outputChannel: vscode.OutputChannel
): void {
  // Command to enable Lando PHP interpreter
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.enablePhpInterpreter",
      async () => {
        const workingDir = vscode.workspace.getConfiguration("lando").get("appMount", "/app");
        const phpWrapperPath = getPhpWrapperPath(outputChannel);
        
        try {
          await overridePhpExecutablePath(phpWrapperPath, landoConfig.phpContainer, workingDir, outputChannel);

          // Set environment variables for the extension process
          process.env.PHP_EXECUTABLE = phpWrapperPath;
          process.env.VSCODE_LANDO_PHP_CONTAINER = landoConfig.phpContainer;
          process.env.VSCODE_LANDO_EXEC_CWD = workingDir;

          vscode.window.showInformationMessage(
            `Lando PHP interpreter enabled (${landoConfig.appName})`
          );
          outputChannel.appendLine(`PHP wrapper enabled: ${phpWrapperPath}`);
          outputChannel.appendLine(`Container: ${landoConfig.phpContainer}`);
          outputChannel.appendLine(`Working directory: ${workingDir}`);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to enable PHP interpreter: ${error}`
          );
          outputChannel.appendLine(`Error enabling PHP: ${error}`);
        }
      }
    )
  );

  // Command to disable Lando PHP interpreter
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.disablePhpInterpreter",
      async () => {
        await restoreOriginalPhpSettings(outputChannel);
        vscode.window.showInformationMessage("Lando PHP interpreter disabled");
      }
    )
  );

  // Command to set up PHP alias in terminal
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.setPhpEnvironment", () => {
      const workingDir = vscode.workspace.getConfiguration("lando").get("appMount", "/app");
      const terminal = vscode.window.activeTerminal;
      const phpWrapperPath = getPhpWrapperPath(outputChannel);
      
      if (terminal) {
        terminal.sendText(`cd "${workspaceFolder}"`);
        if (process.platform !== "win32") {
          terminal.sendText(
            `alias php="VSCODE_LANDO_PHP_CONTAINER='${landoConfig.phpService}' VSCODE_LANDO_EXEC_CWD='${workingDir}' ${phpWrapperPath}"`
          );
          terminal.sendText(
            `echo "PHP now uses: ${phpWrapperPath} with container ${landoConfig.phpService}"`
          );
        } else {
          terminal.sendText(`set VSCODE_LANDO_PHP_CONTAINER=${landoConfig.phpService}`);
          terminal.sendText(`set VSCODE_LANDO_EXEC_CWD=${workingDir}`);
          terminal.sendText(`doskey php=${phpWrapperPath} $*`);
          terminal.sendText(
            `echo "PHP now uses: ${phpWrapperPath} with container ${landoConfig.phpService}"`
          );
        }
        vscode.window.showInformationMessage(
          `PHP alias set for ${landoConfig.phpContainer}`
        );
      } else {
        vscode.window.showWarningMessage("No active terminal found");
      }
    })
  );

  // Command to check Lando status
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.checkLandoStatus", async () => {
      try {
        const isRunning = await checkLandoStatus(
          workspaceFolder,
          landoConfig.appName,
          outputChannel
        );
        if (isRunning) {
          vscode.window.showInformationMessage(
            `Lando is running (${landoConfig.appName})`
          );
        } else {
          vscode.window.showWarningMessage(
            `Lando is not running (${landoConfig.appName})`
          );
        }
      } catch (error: unknown) {
        vscode.window.showErrorMessage("Error checking Lando status");
        outputChannel.appendLine(`Error checking status: ${error}`);
      }
    })
  );

  // Command to refresh PHP configuration
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.refreshPhpConfig", async () => {
      const workingDir = vscode.workspace.getConfiguration("lando").get("appMount", "/app");
      const phpWrapperPath = getPhpWrapperPath(outputChannel);
      await overridePhpExecutablePath(phpWrapperPath, landoConfig.phpContainer, workingDir, outputChannel);
      vscode.window.showInformationMessage("PHP configuration refreshed");
    })
  );

  // Command to test PHP wrapper
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.testPhpWrapper", () => {
      const workingDir = vscode.workspace.getConfiguration("lando").get("appMount", "/app");
      const phpWrapperPath = getPhpWrapperPath(outputChannel);
      const terminal = vscode.window.createTerminal("PHP Test");
      terminal.sendText(`cd "${workspaceFolder}"`);
      terminal.sendText(
        `VSCODE_LANDO_PHP_CONTAINER="${landoConfig.phpContainer}" VSCODE_LANDO_EXEC_CWD="${workingDir}" "${phpWrapperPath}" --version`
      );
      terminal.show();
      vscode.window.showInformationMessage("Testing PHP wrapper in new terminal");
    })
  );

  // Command to check and reload PHP plugins
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.checkPhpPlugins", async () => {
      await checkAndReloadPhpPlugins(outputChannel);
    })
  );

  // Command to show Landofile language information
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showLandofileInfo", () => {
      const panel = vscode.window.createWebviewPanel(
        'landofileInfo',
        'Landofile Language Features',
        vscode.ViewColumn.One,
        {}
      );
      
      panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Landofile Language Features</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
            h1 { color: #007acc; }
            h2 { color: #333; margin-top: 30px; }
            code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
            .feature { margin: 10px 0; padding: 10px; background: #f8f9fa; border-left: 4px solid #007acc; }
            .supported { color: #28a745; }
            .usage { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <h1>Enhanced Landofile Language Features</h1>
          <div class="usage">
            <h3>Available Features</h3>
            <div class="feature">
              <strong>JSON Schema Integration</strong><br>
              Schema-based autocomplete, validation, and documentation using official Lando specification
            </div>
            <div class="feature">
              <strong>Shell Command Integration</strong><br>
              Bash syntax highlighting in build, run, and cmd sections with shell decorations
            </div>
            <div class="feature">
              <strong>Lando-Specific Enhancements</strong><br>
              Recipe suggestions, service type autocomplete, and custom validation patterns
            </div>
            <div class="feature">
              <strong>Editor Features</strong><br>
              Auto-formatting, smart indentation, bracket matching, and code folding
            </div>
          </div>
          
          <h2>Usage</h2>
          <ul>
            <li><strong>Schema Autocomplete:</strong> Type <code>:</code> after a key to see schema-based suggestions</li>
            <li><strong>Enhanced Hover:</strong> Hover over keys for schema documentation + Lando hints</li>
            <li><strong>Real-time Validation:</strong> Get validation feedback from both schema and custom rules</li>
            <li><strong>Formatting:</strong> Use <code>Shift+Alt+F</code> to format with schema awareness</li>
          </ul>
          
          <h2>Schema-Driven Features</h2>
          <div class="supported">
            <strong>Property autocomplete:</strong> All Lando configuration keys from schema<br>
            <strong>Value validation:</strong> Enforced by JSON schema specification<br>
            <strong>Type checking:</strong> Schema ensures correct data types<br>
            <strong>Documentation:</strong> Hover shows schema descriptions
          </div>
          
          <h2>JSON Schema Source</h2>
          <p>The extension uses the official Lando JSON schema specification:</p>
          <code>https://lando-community.github.io/lando-spec/landofile-spec.json</code>
          
          <p><em>This ensures all autocomplete, validation, and documentation are based on the official Lando specification.</em></p>
        </body>
        </html>
      `;
    })
  );
}
