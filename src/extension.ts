import * as vscode from "vscode";
import * as child_process from "child_process";

const CRLF = "\r\n";

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
        const output = data.toString().replace(/\n/g, CRLF);
        writeEmitter.fire(output);
      });
      landoProcess.stderr.on("data", (data) => {
        // Terminal expects \r\n line endings
        const output = data.toString().replace(/\n/g, CRLF);
        writeEmitter.fire(output);
      });

      // Terminal pty implementation
      const pty = {
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
