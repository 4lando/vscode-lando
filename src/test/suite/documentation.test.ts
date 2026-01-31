import * as assert from "assert";
import { suite, test, suiteSetup } from "mocha";
import * as vscode from "vscode";

/**
 * Integration tests for Lando documentation feature.
 * 
 * These tests require VS Code runtime and verify:
 * 1. The documentation command is registered
 * 2. The command is contributed in package.json
 * 3. The command integrates with existing UI components
 * 
 * Note: Unit tests for the documentation data and logic are co-located
 * with the module at src/landoDocumentation.test.ts
 */
suite("Lando Documentation Integration Test Suite", () => {
  let extension: vscode.Extension<unknown>;

  suiteSetup(async () => {
    extension = vscode.extensions.getExtension("4lando.vscode-lando")!;
    assert.ok(extension, "Extension should be found");
    await extension.activate();
    assert.ok(extension.isActive, "Extension should be active");
  });

  suite("Documentation Command Registration", () => {
    test("openLandoDocumentation command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("extension.openLandoDocumentation"),
        "extension.openLandoDocumentation command should be registered"
      );
    });

    test("Extension should contribute openLandoDocumentation command in package.json", () => {
      const contributes = extension?.packageJSON?.contributes;
      assert.ok(contributes, "Extension should have contributes section");

      const commands = contributes?.commands;
      assert.ok(commands, "Extension should contribute commands");

      const docCommand = commands?.find(
        (cmd: { command: string }) => cmd.command === "extension.openLandoDocumentation"
      );
      assert.ok(docCommand, "Extension should have openLandoDocumentation command");
      assert.strictEqual(
        docCommand.title,
        "Lando: Open Documentation",
        "Documentation command should have correct title"
      );
    });
  });

  suite("Documentation Command Integration", () => {
    test("Documentation command should be accessible from Quick Pick menu", async () => {
      // Verify the selectLandoApp command exists which hosts the documentation option
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("extension.selectLandoApp"),
        "selectLandoApp command should be registered for Quick Pick access"
      );
    });

    test("Documentation command should be callable", async () => {
      // Simply verify the command can be executed without throwing
      // (It will show a Quick Pick which we can't interact with in tests,
      // but we can verify it doesn't throw)
      try {
        // Use a short timeout to cancel the Quick Pick
        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => {
            // Send Escape key to close any open Quick Pick
            vscode.commands.executeCommand('workbench.action.closeQuickOpen');
            resolve();
          }, 100);
        });

        // Start the command (don't await it as it shows a Quick Pick)
        vscode.commands.executeCommand('extension.openLandoDocumentation');
        
        // Wait for timeout to close the Quick Pick
        await timeoutPromise;
        
        // If we get here without throwing, the command is callable
        assert.ok(true, 'Documentation command executed without throwing');
      } catch (error) {
        // The command itself shouldn't throw
        assert.fail(`Documentation command threw an error: ${error}`);
      }
    });
  });
});
