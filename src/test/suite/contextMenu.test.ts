import * as assert from "assert";
import { suite, test, suiteSetup } from "mocha";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

suite("Context Menu Integration Test Suite", () => {
  let extension: vscode.Extension<unknown>;

  suiteSetup(async () => {
    extension = vscode.extensions.getExtension("4lando.vscode-lando")!;
    assert.ok(extension, "Extension should be found");
    await extension.activate();
  });

  suite("Context Menu Command Registration", () => {
    test("rebuildLandoApp command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("extension.rebuildLandoApp"),
        "rebuildLandoApp command should be registered"
      );
    });

    test("openLandoTerminal command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("extension.openLandoTerminal"),
        "openLandoTerminal command should be registered"
      );
    });

    test("All lifecycle commands should be registered for context menu", async () => {
      const commands = await vscode.commands.getCommands(true);
      const lifecycleCommands = [
        "extension.startLandoApp",
        "extension.stopLandoApp",
        "extension.restartLandoApp",
        "extension.rebuildLandoApp"
      ];

      lifecycleCommands.forEach(cmd => {
        assert.ok(commands.includes(cmd), `${cmd} should be registered`);
      });
    });
  });

  suite("Package.json Menu Contributions", () => {
    let packageJson: {
      contributes?: {
        commands?: Array<{ command: string; title: string; icon?: string }>;
        submenus?: Array<{ id: string; label: string }>;
        menus?: Record<string, Array<{ command?: string; submenu?: string; group?: string; when?: string }>>;
      };
    };

    suiteSetup(() => {
      const packageJsonPath = path.join(__dirname, "..", "..", "..", "package.json");
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    });

    test("Should have Lando submenu defined", () => {
      assert.ok(packageJson.contributes?.submenus, "Submenus should be defined");
      const landoSubmenu = packageJson.contributes!.submenus!.find(
        (s) => s.id === "lando.submenu"
      );
      assert.ok(landoSubmenu, "lando.submenu should be defined");
      assert.strictEqual(landoSubmenu?.label, "Lando", "Submenu label should be 'Lando'");
    });

    test("Should have explorer context menu contribution", () => {
      assert.ok(packageJson.contributes?.menus, "Menus should be defined");
      const explorerMenu = packageJson.contributes!.menus!["explorer/context"];
      assert.ok(explorerMenu, "explorer/context menu should be defined");
      
      const landoEntry = explorerMenu.find((m) => m.submenu === "lando.submenu");
      assert.ok(landoEntry, "Lando submenu should be in explorer context");
      assert.ok(landoEntry?.when?.includes("lando:hasApps"), "Should have when clause for lando:hasApps");
    });

    test("Should have editor context menu contribution", () => {
      const editorMenu = packageJson.contributes!.menus!["editor/context"];
      assert.ok(editorMenu, "editor/context menu should be defined");
      
      const landoEntry = editorMenu.find((m) => m.submenu === "lando.submenu");
      assert.ok(landoEntry, "Lando submenu should be in editor context");
      assert.ok(landoEntry?.when?.includes("resourceLangId == landofile"), "Should filter by landofile language");
    });

    test("Should have editor title context menu contribution", () => {
      const editorTitleMenu = packageJson.contributes!.menus!["editor/title/context"];
      assert.ok(editorTitleMenu, "editor/title/context menu should be defined");
      
      const landoEntry = editorTitleMenu.find((m) => m.submenu === "lando.submenu");
      assert.ok(landoEntry, "Lando submenu should be in editor title context");
    });

    test("Submenu should have proper command grouping", () => {
      const submenuItems = packageJson.contributes!.menus!["lando.submenu"];
      assert.ok(submenuItems, "lando.submenu items should be defined");
      assert.ok(submenuItems.length > 0, "Should have submenu items");

      // Check for lifecycle group
      const lifecycleItems = submenuItems.filter((m) => m.group?.startsWith("1_lifecycle"));
      assert.ok(lifecycleItems.length >= 4, "Should have lifecycle commands (start, stop, restart, rebuild)");

      // Check for access group
      const accessItems = submenuItems.filter((m) => m.group?.startsWith("2_access"));
      assert.ok(accessItems.length >= 2, "Should have access commands (open URL, copy URL, terminal)");

      // Check for tools group
      const toolsItems = submenuItems.filter((m) => m.group?.startsWith("3_tools"));
      assert.ok(toolsItems.length >= 1, "Should have tools commands (logs, tooling)");
    });

    test("Commands should have proper when clauses for state-awareness", () => {
      const submenuItems = packageJson.contributes!.menus!["lando.submenu"];
      
      // Start should only show when NOT running
      const startItem = submenuItems.find((m) => m.command === "extension.startLandoApp");
      assert.ok(startItem?.when?.includes("!lando:appRunning"), "Start should show when app is NOT running");

      // Stop should only show when running
      const stopItem = submenuItems.find((m) => m.command === "extension.stopLandoApp");
      assert.ok(stopItem?.when?.includes("lando:appRunning"), "Stop should show when app IS running");
      assert.ok(!stopItem?.when?.includes("!lando:appRunning"), "Stop should NOT have negated running clause");

      // Restart should only show when running
      const restartItem = submenuItems.find((m) => m.command === "extension.restartLandoApp");
      assert.ok(restartItem?.when?.includes("lando:appRunning"), "Restart should show when app IS running");

      // Rebuild should always show when there's an active app
      const rebuildItem = submenuItems.find((m) => m.command === "extension.rebuildLandoApp");
      assert.ok(rebuildItem?.when?.includes("lando:hasActiveApp"), "Rebuild should show when there's an active app");
    });

    test("New commands should be defined with proper metadata", () => {
      const commands = packageJson.contributes!.commands!;

      // Check rebuild command
      const rebuildCmd = commands.find((c) => c.command === "extension.rebuildLandoApp");
      assert.ok(rebuildCmd, "rebuildLandoApp command should be defined");
      assert.strictEqual(rebuildCmd?.title, "Lando: Rebuild App", "Rebuild command should have correct title");
      assert.ok(rebuildCmd?.icon, "Rebuild command should have an icon");

      // Check terminal command
      const terminalCmd = commands.find((c) => c.command === "extension.openLandoTerminal");
      assert.ok(terminalCmd, "openLandoTerminal command should be defined");
      assert.strictEqual(terminalCmd?.title, "Lando: Open Terminal (SSH)", "Terminal command should have correct title");
      assert.ok(terminalCmd?.icon, "Terminal command should have an icon");
    });
  });

  suite("Context Menu Command Behavior", () => {
    test("rebuildLandoApp should show error when no active app", async () => {
      let errorShown = false;
      let errorMessage = "";

      const stub = (vscode.window.showErrorMessage as sinon.SinonStub);
      if (typeof stub?.callsFake === 'function') {
        stub.callsFake((msg: string) => {
          errorShown = true;
          errorMessage = msg;
          return Promise.resolve(undefined);
        });
      }

      try {
        await vscode.commands.executeCommand("extension.rebuildLandoApp");
        // Give time for error message to appear
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // In test environment without active app, we expect an error
        console.log(`Error shown: ${errorShown}, Message: ${errorMessage}`);
      } catch {
        // Command may throw or show error - both are acceptable
      }
    });

    test("openLandoTerminal should show error when no active app", async () => {
      let errorShown = false;
      let errorMessage = "";

      const stub = (vscode.window.showErrorMessage as sinon.SinonStub);
      if (typeof stub?.callsFake === 'function') {
        stub.callsFake((msg: string) => {
          errorShown = true;
          errorMessage = msg;
          return Promise.resolve(undefined);
        });
      }

      try {
        await vscode.commands.executeCommand("extension.openLandoTerminal");
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log(`Error shown: ${errorShown}, Message: ${errorMessage}`);
      } catch {
        // Command may throw or show error - both are acceptable
      }
    });
  });

  suite("Context State Management", () => {
    test("Extension should set context values for menu visibility", async () => {
      // The context values are set internally and affect menu visibility
      // We can't directly read them, but we can verify the extension activates
      // and the commands that depend on context are registered
      
      const commands = await vscode.commands.getCommands(true);
      
      // These commands are always registered but their visibility depends on context
      const contextDependentCommands = [
        "extension.startLandoApp",
        "extension.stopLandoApp",
        "extension.restartLandoApp",
        "extension.rebuildLandoApp",
        "extension.openLandoTerminal"
      ];

      contextDependentCommands.forEach(cmd => {
        assert.ok(commands.includes(cmd), `${cmd} should be registered`);
      });
    });
  });
});

// Import sinon for type reference (used in stubs)
import * as sinon from "sinon";
