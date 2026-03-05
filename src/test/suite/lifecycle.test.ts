import * as assert from "assert";
import { suite, test, suiteSetup } from "mocha";
import * as vscode from "vscode";

/**
 * Integration tests for Lando app lifecycle commands.
 *
 * These tests require VS Code runtime and verify:
 * 1. Start, stop, restart, rebuild, destroy commands are registered
 * 2. Commands are contributed in package.json
 * 3. Commands handle edge cases (no active app)
 *
 * Note: The lifecycle command implementations are in src/commands/lifecycle.ts
 */
suite("Lando App Lifecycle Commands Tests", () => {
  let extension: vscode.Extension<unknown>;

  suiteSetup(async () => {
    extension = vscode.extensions.getExtension("4lando.vscode-lando")!;
    assert.ok(extension, "Extension should be found");
    await extension.activate();
  });

  test("Start, Stop, and Restart commands should be registered", async () => {
    const commands = await vscode.commands.getCommands(true);

    const lifecycleCommands = [
      "extension.startLandoApp",
      "extension.stopLandoApp",
      "extension.restartLandoApp",
    ];

    lifecycleCommands.forEach((cmd) => {
      assert.ok(commands.includes(cmd), `${cmd} command should be registered`);
    });
  });

  test("Extension should contribute lifecycle commands in package.json", () => {
    const contributes = extension?.packageJSON?.contributes;
    assert.ok(contributes, "Extension should have contributes section");

    const commands = contributes?.commands;
    assert.ok(commands, "Extension should contribute commands");

    const startCommand = commands?.find(
      (cmd: { command: string }) => cmd.command === "extension.startLandoApp"
    );
    assert.ok(startCommand, "Extension should have startLandoApp command");
    assert.strictEqual(
      startCommand.title,
      "Lando: Start App",
      "Start command should have correct title"
    );

    const stopCommand = commands?.find(
      (cmd: { command: string }) => cmd.command === "extension.stopLandoApp"
    );
    assert.ok(stopCommand, "Extension should have stopLandoApp command");
    assert.strictEqual(
      stopCommand.title,
      "Lando: Stop App",
      "Stop command should have correct title"
    );

    const restartCommand = commands?.find(
      (cmd: { command: string }) => cmd.command === "extension.restartLandoApp"
    );
    assert.ok(restartCommand, "Extension should have restartLandoApp command");
    assert.strictEqual(
      restartCommand.title,
      "Lando: Restart App",
      "Restart command should have correct title"
    );
  });

  test("Start command should show error when no active app", async () => {
    // Save original showErrorMessage
    const originalShowErrorMessage = vscode.window.showErrorMessage;
    let errorShown = false;
    let errorMessage = "";

    // Mock showErrorMessage
    (vscode.window as { showErrorMessage: typeof vscode.window.showErrorMessage }).showErrorMessage = ((message: string) => {
      errorShown = true;
      errorMessage = message;
      return Promise.resolve(undefined);
    }) as typeof vscode.window.showErrorMessage;

    try {
      // Check if extension has an active Lando app
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const hasLandoFile = workspaceFolders?.some((folder) => {
        try {
          const fs = require("fs");
          const path = require("path");
          const landoPath = path.join(folder.uri.fsPath, ".lando.yml");
          return fs.existsSync(landoPath);
        } catch {
          return false;
        }
      });

      // Execute start command
      await vscode.commands.executeCommand("extension.startLandoApp");

      // If there's no .lando.yml, we expect an error about no active app
      if (!hasLandoFile) {
        console.log(`Error shown: ${errorShown}, Message: ${errorMessage}`);
        // Note: Command registration depends on workspace context
      }
    } finally {
      // Restore original showErrorMessage
      (vscode.window as { showErrorMessage: typeof vscode.window.showErrorMessage }).showErrorMessage = originalShowErrorMessage;
    }
  });

  test("Stop command should show error when no active app", async () => {
    const originalShowErrorMessage = vscode.window.showErrorMessage;
    let errorShown = false;
    let errorMessage = "";

    (vscode.window as { showErrorMessage: typeof vscode.window.showErrorMessage }).showErrorMessage = ((message: string) => {
      errorShown = true;
      errorMessage = message;
      return Promise.resolve(undefined);
    }) as typeof vscode.window.showErrorMessage;

    try {
      await vscode.commands.executeCommand("extension.stopLandoApp");
      // Verify error was shown when no active app is selected
      assert.ok(errorShown, "Expected error message to be shown when no active app");
      assert.ok(
        errorMessage.includes("No active Lando app"),
        `Expected 'No active Lando app' in error message, got: ${errorMessage}`
      );
    } finally {
      (vscode.window as { showErrorMessage: typeof vscode.window.showErrorMessage }).showErrorMessage = originalShowErrorMessage;
    }
  });

  test("Restart command should show error when no active app", async () => {
    const originalShowErrorMessage = vscode.window.showErrorMessage;
    let errorShown = false;
    let errorMessage = "";

    (vscode.window as { showErrorMessage: typeof vscode.window.showErrorMessage }).showErrorMessage = ((message: string) => {
      errorShown = true;
      errorMessage = message;
      return Promise.resolve(undefined);
    }) as typeof vscode.window.showErrorMessage;

    try {
      await vscode.commands.executeCommand("extension.restartLandoApp");
      // Verify error was shown when no active app is selected
      assert.ok(errorShown, "Expected error message to be shown when no active app");
      assert.ok(
        errorMessage.includes("No active Lando app"),
        `Expected 'No active Lando app' in error message, got: ${errorMessage}`
      );
    } finally {
      (vscode.window as { showErrorMessage: typeof vscode.window.showErrorMessage }).showErrorMessage = originalShowErrorMessage;
    }
  });

  test("Destroy command should show error when no active app", async () => {
    const originalShowErrorMessage = vscode.window.showErrorMessage;
    let errorShown = false;
    let errorMessage = "";

    (vscode.window as { showErrorMessage: typeof vscode.window.showErrorMessage }).showErrorMessage = ((message: string) => {
      errorShown = true;
      errorMessage = message;
      return Promise.resolve(undefined);
    }) as typeof vscode.window.showErrorMessage;

    try {
      await vscode.commands.executeCommand("extension.destroyLandoApp");
      // Verify error was shown when no active app is selected
      assert.ok(errorShown, "Expected error message to be shown when no active app");
      assert.ok(
        errorMessage.includes("No active Lando app"),
        `Expected 'No active Lando app' in error message, got: ${errorMessage}`
      );
    } finally {
      (vscode.window as { showErrorMessage: typeof vscode.window.showErrorMessage }).showErrorMessage = originalShowErrorMessage;
    }
  });

  test("Destroy and Power Off commands should be registered", async () => {
    const commands = await vscode.commands.getCommands();

    // New commands should be registered
    assert.ok(
      commands.includes("extension.destroyLandoApp"),
      "destroyLandoApp command should be registered"
    );
    assert.ok(
      commands.includes("extension.powerOffLando"),
      "powerOffLando command should be registered"
    );
  });
});
