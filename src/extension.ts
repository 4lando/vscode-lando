import * as vscode from "vscode";
import * as child_process from "child_process";

export function activate(context: vscode.ExtensionContext) {
  const writeEmitter = new vscode.EventEmitter<string>();
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.runLando", async () => {
      const command = await vscode.window.showInputBox({
        prompt: "Enter Lando command",
        placeHolder: "e.g., start, stop, rebuild",
      });

      if (!command) {
        return;
      }

      // TODO: Support multiple workspaces and multiple lando apps per workspace
      let cwd = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      if (!cwd) {
        vscode.window.showErrorMessage("No workspace found");
        return;
      }

      // Start Lando process
      const landoProcess = child_process.spawn("lando", command.split(" "), {
        cwd: cwd,
        shell: false,
        env: { ...process.env, TERM: "xterm-256color", FORCE_COLOR: "true" },
        killSignal: "SIGINT",
      });

      // Lando process output handling
      landoProcess.stdout.on("data", (data) => {
        // Terminal expects \r\n line endings
        const output = data.toString().replace(/\n/g, "\r\n");
        writeEmitter.fire(output);
      });
      landoProcess.stderr.on("data", (data) => {
        // Terminal expects \r\n line endings
        const output = data.toString().replace(/\n/g, "\r\n");
        writeEmitter.fire(output);
      });

      // Terminal pty implementation
      let line = "";
      const pty = {
        onDidWrite: writeEmitter.event,
        open: () => writeEmitter.fire(`Running: lando ${command}\r\n\n`),
        close: () => {
          landoProcess.stdin.end();
        },
        handleInput: (data: string) => {
          landoProcess.stdin.write(data);
          if (data === "\x7f") {
            // Backspace
            if (line.length === 0) {
              return;
            }
            line = line.substr(0, line.length - 1);
            // Move cursor backward
            writeEmitter.fire("\x1b[D");
            // Delete character
            writeEmitter.fire("\x1b[P");
            return;
          }
          if (data === "\x03") {
            // Ctrl+C
            writeEmitter.fire("^C");
            landoProcess.kill("SIGINT");
            return;
          }
          if (data === "\x1b[A") {
            // Up arrow
            return;
          }
          if (data === "\x1b[B") {
            // Down arrow
            return;
          }
          if (data === "\x1b[C") {
            // Right arrow
            return;
          }
          writeEmitter.fire(data);
        },
      };
      const terminal = vscode.window.createTerminal({
        name: `Lando`,
        pty,
      });

      terminal.show();

      landoProcess.on("close", (code) => {
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

export function deactivate() {}
