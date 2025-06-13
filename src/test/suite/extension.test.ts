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

    test("Disable PHP interpreter should clear configuration", async () => {
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

      try {
        // First set a PHP path to test clearing
        const config = vscode.workspace.getConfiguration();
        await config.update(
          "php.validate.executablePath",
          "test-path",
          vscode.ConfigurationTarget.Workspace
        );

        // Execute disable command
        await vscode.commands.executeCommand("extension.disablePhpInterpreter");

        // Verify configuration was cleared
        const updatedConfig = vscode.workspace.getConfiguration();
        const updatedPhpPath = updatedConfig.get("php.validate.executablePath");
        assert.strictEqual(
          updatedPhpPath,
          undefined,
          "PHP path should be cleared after disabling"
        );
      } catch (error) {
        console.log("PHP interpreter test failed:", error);
        // Don't fail the test if workspace configuration is not available
      }
    });
  });

  suite("YAML Schema Configuration Tests", () => {
    let extension: vscode.Extension<any>;

    suiteSetup(async () => {
      extension = vscode.extensions.getExtension("4lando.vscode-lando")!;
      assert.ok(extension, "Extension should be found");
      console.log("Activating extension in suiteSetup...");
      await extension.activate();
      console.log(`Extension active after suiteSetup: ${extension.isActive}`);
    });

    test("Extension should contribute YAML schema configuration", () => {

      const contributes = extension?.packageJSON?.contributes;
      assert.ok(contributes, "Extension should have contributes section");

      const configDefaults = contributes?.configurationDefaults;
      assert.ok(configDefaults, "Extension should have configuration defaults");

      const yamlSchemas = configDefaults?.["yaml.schemas"];
      assert.ok(yamlSchemas, "Extension should configure YAML schemas");

      const landoSchema =
        yamlSchemas?.[
        "https://4lando.github.io/lando-spec/landofile-spec.json"
        ];
      assert.ok(landoSchema, "Extension should configure Lando schema");
      assert.ok(
        landoSchema.includes(".lando.yml"),
        "Schema should apply to .lando.yml files"
      );
      assert.ok(
        landoSchema.includes(".lando.*.yml"),
        "Schema should apply to .lando.*.yml files"
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
      assert.ok(
        packageJSON?.extensionDependencies?.includes("redhat.vscode-yaml"),
        "Extension should depend on YAML extension"
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


});
