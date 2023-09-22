import * as vscode from "vscode";
import { exec } from "child_process";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel("Lando");

  let disposable = vscode.commands.registerCommand(
    "extension.runLando",
    async () => {
      const command = await vscode.window.showInputBox({
        prompt: "Enter Lando command",
        placeHolder: "e.g., start, stop, rebuild",
      });

      if (command) {
        outputChannel.clear();
        outputChannel.show(true);
        outputChannel.appendLine(`Running: lando ${command}`);

        exec(`lando ${command}`, (error, stdout, stderr) => {
          if (error) {
            outputChannel.appendLine(`Error: ${stderr}`);
            vscode.window.showErrorMessage(
              `Lando command failed. See output for details.`
            );
          } else {
            outputChannel.appendLine(`Output: ${stdout}`);
            vscode.window.showInformationMessage(
              `Lando command executed successfully.`
            );
          }
        });
      }

      if (command) {
        exec(`lando ${command}`, (error, stdout, stderr) => {
          if (error) {
            vscode.window.showErrorMessage(`Error: ${stderr}`);
          }
        });
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
