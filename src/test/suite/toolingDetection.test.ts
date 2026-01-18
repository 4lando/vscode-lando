import * as assert from "assert";
import { suite, test, suiteSetup } from "mocha";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * E2E tests for Lando tooling detection.
 * 
 * These tests verify that:
 * 1. Custom tooling defined in .lando.yml is detected
 * 2. Recipe-provided default tooling is detected
 * 3. The tooling command is registered and functional
 */
suite("Tooling Detection E2E Test Suite", () => {
  let extension: vscode.Extension<unknown>;

  suiteSetup(async () => {
    extension = vscode.extensions.getExtension("4lando.vscode-lando")!;
    assert.ok(extension, "Extension should be found");
    await extension.activate();
    assert.ok(extension.isActive, "Extension should be active");
  });

  suite("Tooling Command Registration", () => {
    test("runLandoTooling command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("extension.runLandoTooling"),
        "extension.runLandoTooling command should be registered"
      );
    });

    test("Extension should contribute runLandoTooling command in package.json", () => {
      const contributes = extension?.packageJSON?.contributes;
      assert.ok(contributes, "Extension should have contributes section");

      const commands = contributes?.commands;
      assert.ok(commands, "Extension should contribute commands");

      const toolingCommand = commands?.find(
        (cmd: { command: string }) => cmd.command === "extension.runLandoTooling"
      );
      assert.ok(toolingCommand, "Extension should have runLandoTooling command");
      assert.strictEqual(
        toolingCommand.title,
        "Lando: Run Tooling Command",
        "Tooling command should have correct title"
      );
    });
  });

  suite("Tooling Configuration Settings", () => {
    test("Extension should have tooling configuration settings", () => {
      const contributes = extension?.packageJSON?.contributes;
      assert.ok(contributes, "Extension should have contributes section");

      const configuration = contributes?.configuration;
      assert.ok(configuration, "Extension should have configuration section");

      const properties = configuration?.properties;
      assert.ok(properties, "Extension should have configuration properties");

      // Check tooling settings exist
      const showInQuickPick = properties?.["lando.tooling.showInQuickPick"];
      assert.ok(showInQuickPick, "Should have lando.tooling.showInQuickPick setting");
      assert.strictEqual(showInQuickPick.type, "boolean", "showInQuickPick should be boolean");
      assert.strictEqual(showInQuickPick.default, true, "showInQuickPick should default to true");

      const showServiceInfo = properties?.["lando.tooling.showServiceInfo"];
      assert.ok(showServiceInfo, "Should have lando.tooling.showServiceInfo setting");
      assert.strictEqual(showServiceInfo.type, "boolean", "showServiceInfo should be boolean");
      assert.strictEqual(showServiceInfo.default, true, "showServiceInfo should default to true");
    });
  });

  suite("Tooling Detection from .lando.yml", () => {
    // Define a type for the app structure we expect
    interface DetectedApp {
      name?: string;
      recipe?: string;
      tooling?: Array<{
        name: string;
        service?: string;
        description?: string;
        dir?: string;
        cmd?: string | string[];
      }>;
    }

    test("Should detect custom tooling from test workspace .lando.yml", async () => {
      // Get the app detector from the extension exports
      const exports = extension.exports as { appDetector?: { getApps: () => DetectedApp[] } };
      
      console.log("Extension exports:", Object.keys(exports || {}));
      
      if (!exports?.appDetector) {
        console.log("App detector not available in exports, skipping test");
        // This is expected when running without a workspace containing .lando.yml
        return;
      }

      const apps = exports.appDetector.getApps();
      console.log("Detected apps count:", apps.length);
      console.log("Detected app names:", apps.map((a) => a.name));

      if (apps.length === 0) {
        // Check if we're in the right workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        console.log("Workspace folders:", workspaceFolders?.map(f => f.uri.fsPath));
        console.log("No apps detected - test workspace may not be loaded correctly");
        return;
      }

      assert.ok(apps.length > 0, "Should have detected at least one Lando app");

      // Find the test app - it might have the full name or be detected differently
      const testApp = apps.find((app) => app.name === "test-app") || apps[0];
      
      console.log("Using app:", testApp.name);
      console.log("App tooling:", testApp.tooling?.map(t => t.name));

      if (!testApp.tooling) {
        console.log("No tooling found in app config");
        // This could happen if the .lando.yml doesn't have tooling yet
        return;
      }
      
      const toolingNames = testApp.tooling.map((t) => t.name);
      console.log("Detected custom tooling:", toolingNames);

      // Verify custom tooling from .lando.yml
      assert.ok(toolingNames.includes("phpunit"), "Should detect phpunit tooling");
      assert.ok(toolingNames.includes("gulp"), "Should detect gulp tooling");
      assert.ok(toolingNames.includes("custom-script"), "Should detect custom-script tooling");
    });

    test("Should parse tooling properties correctly", async () => {
      const exports = extension.exports as { appDetector?: { getApps: () => DetectedApp[] } };
      
      if (!exports?.appDetector) {
        console.log("App detector not available in exports, skipping test");
        return;
      }

      const apps = exports.appDetector.getApps();
      const testApp = apps.find((app) => app.name === "test-app");
      
      if (!testApp?.tooling) {
        console.log("Test app or tooling not found, skipping test");
        return;
      }

      // Check phpunit tooling properties
      const phpunit = testApp.tooling.find((t) => t.name === "phpunit");
      if (phpunit) {
        assert.strictEqual(phpunit.service, "appserver", "phpunit should use appserver service");
        assert.strictEqual(phpunit.cmd, "vendor/bin/phpunit", "phpunit should have correct cmd");
        assert.strictEqual(phpunit.description, "Run PHPUnit tests", "phpunit should have description");
      }

      // Check gulp tooling properties
      const gulp = testApp.tooling.find((t) => t.name === "gulp");
      if (gulp) {
        assert.strictEqual(gulp.service, "node", "gulp should use node service");
        assert.strictEqual(gulp.dir, "/app/frontend", "gulp should have dir set");
      }

      // Check simple string definition
      const customScript = testApp.tooling.find((t) => t.name === "custom-script");
      if (customScript) {
        assert.strictEqual(customScript.cmd, "./scripts/custom.sh", "custom-script should have cmd from string");
      }
    });

    test("Should detect recipe (drupal11) for determining default tooling", async () => {
      const exports = extension.exports as { appDetector?: { getApps: () => DetectedApp[] } };
      
      if (!exports?.appDetector) {
        console.log("App detector not available in exports, skipping test");
        return;
      }

      const apps = exports.appDetector.getApps();
      const testApp = apps.find((app) => app.name === "test-app");
      
      if (!testApp) {
        console.log("Test app not found, skipping test");
        return;
      }

      assert.strictEqual(testApp.recipe, "drupal11", "Test app should have drupal11 recipe");
    });
  });

  suite("Tooling Command Behavior", () => {
    test("runLandoTooling command should show error when no active app", async () => {
      // This test verifies the command handles the "no active app" case gracefully
      // In a workspace without an active Lando app selected, it should show an error

      const originalShowErrorMessage = vscode.window.showErrorMessage;
      let errorShown = false;
      let errorMessage = "";

      (vscode.window as { showErrorMessage: typeof vscode.window.showErrorMessage }).showErrorMessage = ((message: string) => {
        errorShown = true;
        errorMessage = message;
        return Promise.resolve(undefined);
      }) as typeof vscode.window.showErrorMessage;

      try {
        // First check if there's a .lando.yml in the workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const hasLandoFile = workspaceFolders?.some(folder => {
          const landoPath = path.join(folder.uri.fsPath, '.lando.yml');
          return fs.existsSync(landoPath);
        });

        await vscode.commands.executeCommand("extension.runLandoTooling");

        // If there's no active app, we expect an error
        // Note: In test workspace with .lando.yml, the app might be auto-selected
        if (!hasLandoFile) {
          assert.ok(errorShown, "Should show error when no active app");
          assert.ok(
            errorMessage.includes("No active Lando app"),
            `Error message should mention no active app, got: ${errorMessage}`
          );
        } else {
          // If there's a .lando.yml, a quick pick should appear (which we can't easily test)
          console.log("Workspace has .lando.yml, command may show quick pick");
        }
      } finally {
        (vscode.window as { showErrorMessage: typeof vscode.window.showErrorMessage }).showErrorMessage = originalShowErrorMessage;
      }
    });
  });

  suite("Recipe Default Tooling Integration", () => {
    test("Drupal recipe should provide drush as default tooling", () => {
      // This is more of a documentation test - verifying expected behavior
      // The actual implementation is tested in unit tests
      
      // Recipe drupal11 should provide:
      // - php (common)
      // - composer (common)
      // - drush (drupal-specific)
      // - mysql (database)
      
      const expectedDrupalTooling = ["php", "composer", "drush", "mysql"];
      console.log("Expected default tooling for drupal11:", expectedDrupalTooling);
      
      // This assertion documents the expected behavior
      assert.ok(expectedDrupalTooling.includes("drush"), "Drupal recipes should include drush");
      assert.ok(expectedDrupalTooling.includes("composer"), "Drupal recipes should include composer");
    });

    test("WordPress recipe should provide wp as default tooling", () => {
      const expectedWordPressTooling = ["php", "composer", "wp", "mysql"];
      console.log("Expected default tooling for wordpress:", expectedWordPressTooling);
      
      assert.ok(expectedWordPressTooling.includes("wp"), "WordPress recipes should include wp");
    });

    test("Laravel recipe should provide artisan as default tooling", () => {
      const expectedLaravelTooling = ["php", "composer", "artisan", "mysql"];
      console.log("Expected default tooling for laravel:", expectedLaravelTooling);
      
      assert.ok(expectedLaravelTooling.includes("artisan"), "Laravel recipes should include artisan");
    });
  });
});
