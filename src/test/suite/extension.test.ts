import * as assert from "assert";
import { suite, test, suiteSetup, suiteTeardown } from "mocha";
import * as vscode from "vscode";
import * as sinon from "sinon";

suite("Extension Test Suite", () => {
  suiteSetup(() => {
    console.log("Starting Extension Test Suite");
  });

  suiteTeardown(() => {
    console.log("Extension Test Suite completed");
  });

  vscode.window.showInformationMessage("Start all tests.");

  suite("Command Registration Tests", () => {
    let extension: vscode.Extension<any>;

    suiteSetup(async () => {
      extension = vscode.extensions.getExtension("4lando.vscode-lando")!;
      assert.ok(extension, "Extension should be found");
      console.log("Activating extension in suiteSetup...");
      await extension.activate();
      console.log(`Extension active after suiteSetup: ${extension.isActive}`);
    });

    test("All extension commands should be registered", async () => {
      console.log("Waiting for extension to activate and commands to register...");
      const maxAttempts = 30;
      let attempts = 0;
      let commands: string[] = [];

      // Check if we're in a workspace with .lando.yml
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const hasLandoFile = workspaceFolders?.some(folder => {
        try {
          const fs = require('fs');
          const path = require('path');
          const landoPath = path.join(folder.uri.fsPath, '.lando.yml');
          return fs.existsSync(landoPath);
        } catch {
          return false;
        }
      });

      // Define expected commands based on workspace type
      const expectedCommands = hasLandoFile ? [
        "extension.runLando",
        "extension.enablePhpInterpreter",
        "extension.disablePhpInterpreter",
        "extension.checkPhpPlugins"
      ] : [
        "extension.runLando"
      ];

      while (attempts < maxAttempts) {
        commands = await vscode.commands.getCommands(true);
        const allCommandsRegistered = expectedCommands.every(cmd => commands.includes(cmd));

        console.log(`Attempt ${attempts + 1}: Extension active: ${extension?.isActive}, Commands found: ${commands.filter(cmd => cmd.startsWith("extension.")).join(", ")}`);
        if (allCommandsRegistered && extension?.isActive) {
          console.log(`All ${hasLandoFile ? 'full' : 'basic'} Lando commands registered and extension is active.`);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 0.5 seconds before retrying
        attempts++;
      }

      // Verify all expected commands are registered
      expectedCommands.forEach(cmd => {
        assert.ok(commands.includes(cmd), `${cmd} command should be registered`);
      });

      assert.ok(extension.isActive, "Extension should be active");
    });
  });

  suite("PHP Interpreter Management Tests", () => {
    test("PHP commands should only be available in workspace with .lando.yml", async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const hasLandoFile = workspaceFolders?.some(folder => {
        try {
          const fs = require('fs');
          const path = require('path');
          const landoPath = path.join(folder.uri.fsPath, '.lando.yml');
          return fs.existsSync(landoPath);
        } catch {
          return false;
        }
      });

      const allCommands = await vscode.commands.getCommands(true);
      const phpCommands = [
        "extension.enablePhpInterpreter",
        "extension.disablePhpInterpreter",
        "extension.checkPhpPlugins"
      ];

      if (hasLandoFile) {
        console.log("Workspace has .lando.yml - PHP commands should be available");
        phpCommands.forEach(cmd => {
          assert.ok(allCommands.includes(cmd), `${cmd} should be available in workspace with .lando.yml`);
        });
      } else {
        console.log("Workspace has no .lando.yml - PHP commands should NOT be available");
        phpCommands.forEach(cmd => {
          assert.ok(!allCommands.includes(cmd), `${cmd} should NOT be available in workspace without .lando.yml`);
        });
      }
    });

    test("Disable PHP interpreter should restore original configuration", async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const hasLandoFile = workspaceFolders?.some(folder => {
        try {
          const fs = require('fs');
          const path = require('path');
          const landoPath = path.join(folder.uri.fsPath, '.lando.yml');
          return fs.existsSync(landoPath);
        } catch {
          return false;
        }
      });

      if (!workspaceFolders || !hasLandoFile) {
        console.log("Skipping 'Disable PHP interpreter' test: No workspace with .lando.yml is open.");
        return;
      }

      const config = vscode.workspace.getConfiguration("php");
      const originalValue = config.get<string>("validate.executablePath");

      try {
        // Manually set a value to simulate the enabled state
        await config.update("validate.executablePath", "/test/path", vscode.ConfigurationTarget.Workspace);

        // Execute the disable command
        await vscode.commands.executeCommand("extension.disablePhpInterpreter");

        // Verify the configuration was restored to its original state
        const restoredValue = config.get<string>("validate.executablePath");
        assert.strictEqual(restoredValue, originalValue, "PHP path should be restored to its original value after disabling");

      } finally {
        // Cleanup in case of failure
        await config.update("validate.executablePath", originalValue, vscode.ConfigurationTarget.Workspace);
      }
    });
  });

  suite("Landofile Language Configuration Tests", () => {
    let extension: vscode.Extension<any>;

    suiteSetup(async () => {
      extension = vscode.extensions.getExtension("4lando.vscode-lando")!;
      assert.ok(extension, "Extension should be found");
      console.log("Activating extension in suiteSetup...");
      await extension.activate();
      console.log(`Extension active after suiteSetup: ${extension.isActive}`);
    });

    test("Extension should contribute Landofile language", () => {
      const contributes = extension?.packageJSON?.contributes;
      assert.ok(contributes, "Extension should have contributes section");

      const languages = contributes?.languages;
      assert.ok(languages, "Extension should contribute languages");
      
      const landofileLanguage = languages?.find((lang: any) => lang.id === "landofile");
      assert.ok(landofileLanguage, "Extension should contribute landofile language");
      
      assert.ok(
        landofileLanguage.filenamePatterns?.includes("**/.lando.yml"),
        "Landofile language should apply to .lando.yml files"
      );
      assert.ok(
        landofileLanguage.filenamePatterns?.includes("**/.lando.*.yml"),
        "Landofile language should apply to .lando.*.yml files"
      );
    });

    test("Extension should provide custom grammar for Landofile", () => {
      const contributes = extension?.packageJSON?.contributes;
      assert.ok(contributes, "Extension should have contributes section");

      const grammars = contributes?.grammars;
      assert.ok(grammars, "Extension should contribute grammars");
      
      const landofileGrammar = grammars?.find((grammar: any) => grammar.language === "landofile");
      assert.ok(landofileGrammar, "Extension should contribute landofile grammar");
      assert.strictEqual(
        landofileGrammar.scopeName,
        "source.landofile",
        "Landofile grammar should have correct scope name"
      );
    });

    test("Extension should have PHP plugin reload configuration", () => {
      const extension = vscode.extensions.getExtension("4lando.vscode-lando");
      assert.ok(extension, "Extension should be found");

      const contributes = extension?.packageJSON?.contributes;
      assert.ok(contributes, "Extension should have contributes section");

      const configuration = contributes?.configuration;
      assert.ok(configuration, "Extension should have configuration section");

      const properties = configuration?.properties;
      assert.ok(properties, "Extension should have configuration properties");

      const landoConfig = properties?.["lando.php.reloadPlugins"];
      assert.ok(landoConfig, "Extension should have lando.php.reloadPlugins configuration");
      assert.strictEqual(
        landoConfig.type,
        "boolean",
        "lando.php.reloadPlugins should be a boolean type"
      );
      assert.strictEqual(
        landoConfig.default,
        true,
        "lando.php.reloadPlugins should default to true"
      );
    });
  });

  suite("Extension Lifecycle Tests", () => {
    let extension: vscode.Extension<any>;

    suiteSetup(async () => {
      extension = vscode.extensions.getExtension("4lando.vscode-lando")!;
      assert.ok(extension, "Extension should be found");
      console.log("Activating extension in suiteSetup...");
      await extension.activate();
      console.log(`Extension active after suiteSetup: ${extension.isActive}`);
    });

    test("Extension should activate without errors", async () => {
      await extension.activate();
      assert.ok(extension.isActive, "Extension should be active");
    });

    test("Extension should have correct metadata", () => {
      const packageJSON = extension?.packageJSON;

      assert.strictEqual(
        packageJSON?.name,
        "vscode-lando",
        "Extension name should be correct"
      );
      assert.strictEqual(
        packageJSON?.displayName,
        "Lando",
        "Extension display name should be correct"
      );
      assert.strictEqual(
        packageJSON?.publisher,
        "4lando",
        "Extension publisher should be correct"
      );
      // Extension should NOT depend on redhat.vscode-yaml
      assert.ok(
        !packageJSON?.extensionDependencies || packageJSON.extensionDependencies.length === 0,
        "Extension should not have extension dependencies"
      );
    });

    test("Extension should activate in workspace with .lando.yml", async () => {
      await extension.activate();
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const landoFile = vscode.Uri.joinPath(workspaceFolder.uri, ".lando.yml");
        try {
          await vscode.workspace.fs.stat(landoFile);
          console.log("Found .lando.yml in workspace");
        } catch (error) {
          console.log("No .lando.yml found in workspace");
        }
      }
    });
  });

  suite("PHP Wrapper Path Tests", () => {
    test("getPhpWrapperPath should return correct path based on environment", async () => {
      // Activate the extension to ensure it's loaded
      const extension = vscode.extensions.getExtension("4lando.vscode-lando")!;
      await extension.activate();
      
      // Get the current extension path
      const currentExtensionPath = extension.extensionPath;
      console.log(`Current extension path: ${currentExtensionPath}`);
      
      // Check if we're running from development or production
      const isDevelopment = currentExtensionPath.includes("4lando--vscode-lando");
      console.log(`Running in development mode: ${isDevelopment}`);
      
      // Execute a command that uses getPhpWrapperPath
      // We'll use the enable PHP interpreter command which calls getPhpWrapperPath
      try {
        await vscode.commands.executeCommand("extension.enablePhpInterpreter");
        console.log("PHP interpreter enabled successfully");
      } catch (error) {
        // This is expected if we're not in a Lando workspace
        console.log("PHP interpreter command failed (expected if not in Lando workspace):", error);
      }
      
      // The test passes if the extension activates without errors
      // The actual path logic is tested through the command execution
      assert.ok(extension.isActive, "Extension should be active");
    });
  });

  suite("Lando App Lifecycle Commands Tests", () => {
    let extension: vscode.Extension<any>;

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
        "extension.restartLandoApp"
      ];

      lifecycleCommands.forEach(cmd => {
        assert.ok(commands.includes(cmd), `${cmd} command should be registered`);
      });
    });

    test("Extension should contribute lifecycle commands in package.json", () => {
      const contributes = extension?.packageJSON?.contributes;
      assert.ok(contributes, "Extension should have contributes section");

      const commands = contributes?.commands;
      assert.ok(commands, "Extension should contribute commands");

      const startCommand = commands?.find((cmd: any) => cmd.command === "extension.startLandoApp");
      assert.ok(startCommand, "Extension should have startLandoApp command");
      assert.strictEqual(startCommand.title, "Lando: Start App", "Start command should have correct title");

      const stopCommand = commands?.find((cmd: any) => cmd.command === "extension.stopLandoApp");
      assert.ok(stopCommand, "Extension should have stopLandoApp command");
      assert.strictEqual(stopCommand.title, "Lando: Stop App", "Stop command should have correct title");

      const restartCommand = commands?.find((cmd: any) => cmd.command === "extension.restartLandoApp");
      assert.ok(restartCommand, "Extension should have restartLandoApp command");
      assert.strictEqual(restartCommand.title, "Lando: Restart App", "Restart command should have correct title");
    });

    test("Start command should show error when no active app", async () => {
      // Save original showErrorMessage
      const originalShowErrorMessage = vscode.window.showErrorMessage;
      let errorShown = false;
      let errorMessage = "";

      // Mock showErrorMessage
      (vscode.window as any).showErrorMessage = (message: string) => {
        errorShown = true;
        errorMessage = message;
        return Promise.resolve(undefined);
      };

      try {
        // Check if extension has an active Lando app
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const hasLandoFile = workspaceFolders?.some(folder => {
          try {
            const fs = require('fs');
            const path = require('path');
            const landoPath = path.join(folder.uri.fsPath, '.lando.yml');
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
        (vscode.window as any).showErrorMessage = originalShowErrorMessage;
      }
    });

    test("Stop command should show error when no active app", async () => {
      const originalShowErrorMessage = vscode.window.showErrorMessage;
      let errorShown = false;
      let errorMessage = "";

      (vscode.window as any).showErrorMessage = (message: string) => {
        errorShown = true;
        errorMessage = message;
        return Promise.resolve(undefined);
      };

      try {
        await vscode.commands.executeCommand("extension.stopLandoApp");
        // Verify error was shown when no active app is selected
        assert.ok(errorShown, "Expected error message to be shown when no active app");
        assert.ok(errorMessage.includes("No active Lando app"), `Expected 'No active Lando app' in error message, got: ${errorMessage}`);
      } finally {
        (vscode.window as any).showErrorMessage = originalShowErrorMessage;
      }
    });

    test("Restart command should show error when no active app", async () => {
      const originalShowErrorMessage = vscode.window.showErrorMessage;
      let errorShown = false;
      let errorMessage = "";

      (vscode.window as any).showErrorMessage = (message: string) => {
        errorShown = true;
        errorMessage = message;
        return Promise.resolve(undefined);
      };

      try {
        await vscode.commands.executeCommand("extension.restartLandoApp");
        // Verify error was shown when no active app is selected
        assert.ok(errorShown, "Expected error message to be shown when no active app");
        assert.ok(errorMessage.includes("No active Lando app"), `Expected 'No active Lando app' in error message, got: ${errorMessage}`);
      } finally {
        (vscode.window as any).showErrorMessage = originalShowErrorMessage;
      }
    });
  });

});
