/**
 * Tooling Commands
 * 
 * This module registers commands for running Lando tooling commands.
 * 
 * @module commands/tooling
 */

import * as vscode from "vscode";
import * as childProcess from "child_process";
import { CommandDependencies } from "../types";
import { LandoTooling } from "../landoAppDetector";
import { getLandoAvailableTooling, runLandoToolingCommand } from "../helpers/lando";

/** Line ending for terminal output */
const CRLF = "\r\n";

/**
 * Registers tooling-related commands
 * @param context - The extension context
 * @param deps - Command dependencies
 */
export function registerToolingCommands(
  context: vscode.ExtensionContext,
  deps: CommandDependencies
): void {
  const { outputChannel, getActiveApp } = deps;

  // Command to run Lando tooling
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.runLandoTooling', async () => {
      const activeLandoApp = getActiveApp();
      
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

      // Get tooling commands from the app config (custom tooling in .lando.yml)
      const customTooling = activeLandoApp.tooling || [];
      
      // Query Lando for available tooling commands (includes recipe defaults)
      const landoTooling = await getLandoAvailableTooling(activeLandoApp.rootPath, outputChannel);
      
      // Combine: custom tooling takes precedence over Lando-provided tooling
      const customToolingNames = new Set(customTooling.map((t: LandoTooling) => t.name));
      const combinedTooling = [
        ...customTooling,
        ...landoTooling.filter((t: LandoTooling) => !customToolingNames.has(t.name))
      ];

      if (combinedTooling.length === 0) {
        vscode.window.showInformationMessage(
          `No tooling commands detected for ${activeLandoApp.name}. ` +
          `Add a 'tooling' section to your .lando.yml to define custom commands.`
        );
        return;
      }

      const config = vscode.workspace.getConfiguration('lando.tooling');
      const showServiceInfo = config.get('showServiceInfo', true);

      // Build quick pick items
      interface ToolingQuickPickItem extends vscode.QuickPickItem {
        tooling: LandoTooling;
      }

      const items: ToolingQuickPickItem[] = combinedTooling.map(tool => {
        let description = '';
        if (showServiceInfo && tool.service) {
          description = `Service: ${tool.service}`;
        }
        if (tool.description) {
          description = description ? `${description} - ${tool.description}` : tool.description;
        }
        if (!tool.isCustom) {
          description = description ? `${description} (recipe default)` : 'Recipe default';
        }

        return {
          label: `$(terminal) ${tool.name}`,
          description,
          detail: tool.cmd ? (Array.isArray(tool.cmd) ? tool.cmd.join(' ') : tool.cmd) : undefined,
          tooling: tool
        };
      });

      // Show quick pick
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Select a tooling command to run for ${activeLandoApp.name}`,
        title: 'Lando Tooling',
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (!selected) {
        return;
      }

      // Ask for additional arguments
      const args = await vscode.window.showInputBox({
        prompt: `Enter arguments for 'lando ${selected.tooling.name}' (optional)`,
        placeHolder: 'e.g., --help, status, etc.'
      });

      // If user pressed Escape (undefined), cancel the operation
      // Empty string means they submitted without typing anything (run without args)
      if (args === undefined) {
        return;
      }

      // Run the command in terminal
      await runLandoToolingCommand(activeLandoApp, selected.tooling.name, outputChannel, args);
    })
  );

  // Command to run arbitrary Lando commands
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.runLando", async () => {
      const writeEmitter = new vscode.EventEmitter<string>();
      
      const command = await vscode.window.showInputBox({
        prompt: "Enter Lando command",
        placeHolder: "e.g., start, stop, rebuild",
      });

      if (!command) {
        return;
      }

      // TODO: Support multiple workspaces and multiple lando apps per workspace
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) {
        vscode.window.showErrorMessage("No workspace found");
        return;
      }

      // Start Lando process
      const landoProcess = childProcess.spawn("lando", command.split(" "), {
        cwd: cwd,
        shell: false,
        env: { ...process.env, TERM: "xterm-256color", FORCE_COLOR: "true" },
        killSignal: "SIGINT",
      });

      // Lando process output handling
      landoProcess.stdout.on("data", (data: Buffer) => {
        // Terminal expects \r\n line endings
        const output = data.toString().replace(/\n/g, CRLF);
        writeEmitter.fire(output);
      });
      landoProcess.stderr.on("data", (data: Buffer) => {
        // Terminal expects \r\n line endings
        const output = data.toString().replace(/\n/g, CRLF);
        writeEmitter.fire(output);
      });

      // Terminal pty implementation
      const pty: vscode.Pseudoterminal = {
        onDidWrite: writeEmitter.event,
        open: () =>
          writeEmitter.fire(`Running: lando ${command}${CRLF}${CRLF}`),
        close: () => {
          landoProcess.stdin.end();
        },
        handleInput: (data: string) => {
          landoProcess.stdin.write(data);
          if (data === "\x03") {
            // Ctrl+C
            writeEmitter.fire("^C");
            landoProcess.kill("SIGINT");
            return;
          }
        },
      };
      const terminal = vscode.window.createTerminal({
        name: `Lando`,
        pty,
      });

      terminal.show();

      // Do things when the Lando process exits
      landoProcess.on("close", (code: number) => {
        if (code !== 0) {
          writeEmitter.fire(
            `\x1b[31mLando process exited with code ${code}\x1b[0m\r\n`
          );
        }
        // Disable terminal input
        writeEmitter.fire("\x1b[?25l");
        pty.handleInput = () => {};
      });
    })
  );
}
