import * as assert from "assert";
import { suite, test } from "mocha";
import * as vscode from "vscode";

suite("Extension Activation Test", () => {
  test("Extension behavior should differ based on workspace context", async () => {
    const extension = vscode.extensions.getExtension("4lando.vscode-lando");
    assert.ok(extension, "Extension should be found");

    // When Stage 1 runs (single file mode), there should be no workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      // This is Stage 1 - single file mode
      console.log("Stage 1: Single file mode - limited functionality expected");
      
      // In single file mode, the extension might be activated by the test framework,
      // but it should only register basic commands (not PHP-specific ones)
      const allCommands = await vscode.commands.getCommands(true);
      const landoCommands = allCommands.filter(cmd => cmd.startsWith("extension."));
      const phpCommands = landoCommands.filter(cmd => 
        cmd.includes("PhpInterpreter") || cmd.includes("PhpPlugins") || cmd.includes("Php")
      );
      
      console.log(`Found ${landoCommands.length} extension commands in single file mode:`);
      console.log(landoCommands.join(", "));
      console.log(`Found ${phpCommands.length} PHP-related commands`);
      
      // PHP-specific commands should NOT be available in single file mode
      assert.strictEqual(phpCommands.length, 0, "No PHP-specific commands should be registered in single file mode");
      
      // Filter to only our extension's commands (not other extensions)
      const ourLandoCommands = landoCommands.filter(cmd => 
        cmd === "extension.runLando" || 
        cmd.startsWith("extension.enablePhp") ||
        cmd.startsWith("extension.disablePhp") ||
        cmd.startsWith("extension.checkPhp") ||
        cmd.startsWith("extension.setPhp") ||
        cmd.startsWith("extension.refreshPhp") ||
        cmd.startsWith("extension.testPhp") ||
        cmd.startsWith("extension.checkLando")
      );
      
      console.log(`Found ${ourLandoCommands.length} of our Lando extension commands`);
      
      // Our Lando extension should only register basic commands in single file mode (if any)
      if (ourLandoCommands.length > 0) {
        // If our extension is activated, it should register basic commands
        assert.ok(ourLandoCommands.includes("extension.runLando"), "runLando should be available if our extension is activated");
        } else {
        // If no commands, that's also acceptable - extension might not be activated
        console.log("Extension not activated in single file mode - this is expected behavior");
      }
      
    } else {
      // This is Stage 2 - workspace mode, check if workspace has .lando.yml
      const hasLandoFile = workspaceFolders.some(folder => {
        try {
          const fs = require('fs');
          const path = require('path');
          const landoPath = path.join(folder.uri.fsPath, '.lando.yml');
          return fs.existsSync(landoPath);
        } catch {
          return false;
        }
      });

      if (hasLandoFile) {
        console.log("Stage 2: Workspace with .lando.yml - full functionality expected");
        // Extension should be active and have all commands in workspace with .lando.yml
        assert.strictEqual(extension.isActive, true, "Extension should be active in workspace with .lando.yml");
        
        const allCommands = await vscode.commands.getCommands(true);
        const phpCommands = [
          "extension.enablePhpInterpreter",
          "extension.disablePhpInterpreter", 
          "extension.checkPhpPlugins"
        ];
        
        phpCommands.forEach(cmd => {
          assert.ok(allCommands.includes(cmd), `${cmd} should be available in workspace with .lando.yml`);
        });
        
      } else {
        console.log("Stage 2: Workspace without .lando.yml - basic functionality only");
        // Extension might be active but should not register PHP commands
        const allCommands = await vscode.commands.getCommands(true);
        const phpCommands = allCommands.filter(cmd => 
          cmd.includes("PhpInterpreter") || cmd.includes("PhpPlugins") || cmd.includes("Php")
        );
        
        assert.strictEqual(phpCommands.length, 0, "No PHP-specific commands should be available in workspace without .lando.yml");
      }
    }
  }).timeout(5000);
});
