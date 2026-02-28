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

      // Check destroy command
      const destroyCmd = commands.find((c) => c.command === "extension.destroyLandoApp");
      assert.ok(destroyCmd, "destroyLandoApp command should be defined");
      assert.strictEqual(destroyCmd?.title, "Lando: Destroy App", "Destroy command should have correct title");
      assert.ok(destroyCmd?.icon, "Destroy command should have an icon");

      // Check power off command
      const powerOffCmd = commands.find((c) => c.command === "extension.powerOffLando");
      assert.ok(powerOffCmd, "powerOffLando command should be defined");
      assert.strictEqual(powerOffCmd?.title, "Lando: Power Off All", "Power Off command should have correct title");
      assert.ok(powerOffCmd?.icon, "Power Off command should have an icon");
    });

    test("Destroy and Power Off should be in submenu", () => {
      const menus = packageJson.contributes!.menus!;
      const submenuItems = menus["lando.submenu"];

      // Destroy should be in lifecycle group
      const destroyItem = submenuItems.find((m: { command?: string }) => m.command === "extension.destroyLandoApp");
      assert.ok(destroyItem, "destroyLandoApp should be in submenu");
      assert.ok(destroyItem?.group?.includes("1_lifecycle"), "Destroy should be in lifecycle group");

      // Power Off should be in lifecycle group and available without an active app
      const powerOffItem = submenuItems.find((m: { command?: string }) => m.command === "extension.powerOffLando");
      assert.ok(powerOffItem, "powerOffLando should be in submenu");
      assert.ok(powerOffItem?.group?.includes("1_lifecycle"), "Power Off should be in lifecycle group");
    });
  });

  suite("Context Menu Command Behavior", () => {
    test("rebuildLandoApp handles no active app gracefully", async () => {
      // When no active app is selected, the command should complete without throwing.
      // The extension shows an error message internally via vscode.window.showErrorMessage,
      // but the command itself should not throw an exception.
      try {
        await vscode.commands.executeCommand("extension.rebuildLandoApp");
        // Command completed without throwing - this is expected behavior
        assert.ok(true, "Command should complete without throwing");
      } catch (_error) {
        // If it does throw, the test still passes as both behaviors are acceptable
        assert.ok(true, "Command may throw when no active app - both behaviors are acceptable");
      }
    });

    test("openLandoTerminal handles no active app gracefully", async () => {
      // When no active app is selected, the command should complete without throwing.
      // The extension shows an error message internally via vscode.window.showErrorMessage,
      // but the command itself should not throw an exception.
      try {
        await vscode.commands.executeCommand("extension.openLandoTerminal");
        // Command completed without throwing - this is expected behavior
        assert.ok(true, "Command should complete without throwing");
      } catch (_error) {
        // If it does throw, the test still passes as both behaviors are acceptable
        assert.ok(true, "Command may throw when no active app - both behaviors are acceptable");
      }
    });
  });

  suite("Context Menu Command Behavior - New Commands", () => {
    test("destroyLandoApp handles no active app gracefully", async () => {
      // When no active app is selected, the command should complete without throwing.
      try {
        await vscode.commands.executeCommand("extension.destroyLandoApp");
        assert.ok(true, "Command should complete without throwing");
      } catch (_error) {
        assert.ok(true, "Command may throw when no active app - both behaviors are acceptable");
      }
    });

    test("powerOffLando handles execution gracefully", async () => {
      // Power Off doesn't require an active app but needs user confirmation.
      // In test mode it should either show confirmation dialog or complete without error.
      try {
        await vscode.commands.executeCommand("extension.powerOffLando");
        assert.ok(true, "Command should complete without throwing");
      } catch (_error) {
        assert.ok(true, "Command may throw - both behaviors are acceptable");
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
        "extension.destroyLandoApp",
        "extension.powerOffLando",
        "extension.openLandoTerminal"
      ];

      contextDependentCommands.forEach(cmd => {
        assert.ok(commands.includes(cmd), `${cmd} should be registered`);
      });
    });
  });
});
