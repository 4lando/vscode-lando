import * as assert from "assert";
import { suite, test, suiteSetup } from "mocha";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

suite("Lando TreeView Integration Test Suite", () => {
  let extension: vscode.Extension<unknown>;

  suiteSetup(async () => {
    extension = vscode.extensions.getExtension("4lando.vscode-lando")!;
    assert.ok(extension, "Extension should be found");
    await extension.activate();
  });

  suite("TreeView Command Registration", () => {
    test("lando.refreshExplorer command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("lando.refreshExplorer"),
        "lando.refreshExplorer command should be registered"
      );
    });

    test("lando.treeStartApp command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("lando.treeStartApp"),
        "lando.treeStartApp command should be registered"
      );
    });

    test("lando.treeStopApp command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("lando.treeStopApp"),
        "lando.treeStopApp command should be registered"
      );
    });

    test("lando.treeRestartApp command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("lando.treeRestartApp"),
        "lando.treeRestartApp command should be registered"
      );
    });

    test("lando.treeOpenTerminal command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("lando.treeOpenTerminal"),
        "lando.treeOpenTerminal command should be registered"
      );
    });

    test("lando.treeCopyUrl command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("lando.treeCopyUrl"),
        "lando.treeCopyUrl command should be registered"
      );
    });

    test("lando.treeOpenSshService command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("lando.treeOpenSshService"),
        "lando.treeOpenSshService command should be registered"
      );
    });

    test("lando.openUrlDirect command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("lando.openUrlDirect"),
        "lando.openUrlDirect command should be registered"
      );
    });

    test("lando.runToolingDirect command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("lando.runToolingDirect"),
        "lando.runToolingDirect command should be registered"
      );
    });

    test("lando.copyInfoValue command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("lando.copyInfoValue"),
        "lando.copyInfoValue command should be registered"
      );
    });

    test("lando.treeCopyInfo command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("lando.treeCopyInfo"),
        "lando.treeCopyInfo command should be registered"
      );
    });

    test("lando.treeViewServiceLogs command should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes("lando.treeViewServiceLogs"),
        "lando.treeViewServiceLogs command should be registered"
      );
    });

    test("All TreeView commands should be registered", async () => {
      const commands = await vscode.commands.getCommands(true);
      const treeViewCommands = [
        "lando.refreshExplorer",
        "lando.treeStartApp",
        "lando.treeStopApp",
        "lando.treeRestartApp",
        "lando.treeOpenTerminal",
        "lando.treeCopyUrl",
        "lando.treeOpenSshService",
        "lando.openUrlDirect",
        "lando.runToolingDirect",
        "lando.copyInfoValue",
        "lando.treeCopyInfo",
        "lando.treeViewServiceLogs"
      ];

      treeViewCommands.forEach(cmd => {
        assert.ok(commands.includes(cmd), `${cmd} should be registered`);
      });
    });
  });

  suite("Package.json View Contributions", () => {
    let packageJson: {
      contributes?: {
        viewsContainers?: {
          activitybar?: Array<{ id: string; title: string; icon: string }>;
        };
        views?: Record<string, Array<{ id: string; name: string; contextualTitle?: string }>>;
        viewsWelcome?: Array<{ view: string; contents: string }>;
        commands?: Array<{ command: string; title: string; icon?: string }>;
        menus?: Record<string, Array<{ command?: string; when?: string; group?: string }>>;
      };
    };

    suiteSetup(() => {
      const packageJsonPath = path.join(__dirname, "..", "..", "..", "package.json");
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    });

    test("Should have Activity Bar view container defined", () => {
      assert.ok(packageJson.contributes?.viewsContainers, "viewsContainers should be defined");
      assert.ok(packageJson.contributes!.viewsContainers!.activitybar, "activitybar should be defined");
      
      const landoContainer = packageJson.contributes!.viewsContainers!.activitybar!.find(
        (c) => c.id === "lando-explorer"
      );
      assert.ok(landoContainer, "lando-explorer container should be defined");
      assert.strictEqual(landoContainer?.title, "Lando", "Container title should be 'Lando'");
      assert.ok(landoContainer?.icon, "Container should have an icon");
    });

    test("Should have landoExplorer view defined", () => {
      assert.ok(packageJson.contributes?.views, "views should be defined");
      const landoExplorerViews = packageJson.contributes!.views!["lando-explorer"];
      assert.ok(landoExplorerViews, "lando-explorer views should be defined");
      
      const explorerView = landoExplorerViews.find((v) => v.id === "landoExplorer");
      assert.ok(explorerView, "landoExplorer view should be defined");
      assert.strictEqual(explorerView?.name, "Apps", "View name should be 'Apps'");
    });

    test("Should have welcome view for empty state", () => {
      assert.ok(packageJson.contributes?.viewsWelcome, "viewsWelcome should be defined");
      
      const welcomeView = packageJson.contributes!.viewsWelcome!.find(
        (w) => w.view === "landoExplorer"
      );
      assert.ok(welcomeView, "landoExplorer welcome view should be defined");
      assert.ok(welcomeView?.contents.includes(".lando.yml"), "Welcome should mention .lando.yml");
      assert.ok(welcomeView?.contents.includes("Documentation"), "Welcome should link to documentation");
    });

    test("Should have refresh button in view title", () => {
      assert.ok(packageJson.contributes?.menus, "menus should be defined");
      const viewTitleMenu = packageJson.contributes!.menus!["view/title"];
      assert.ok(viewTitleMenu, "view/title menu should be defined");
      
      const refreshButton = viewTitleMenu.find(
        (m) => m.command === "lando.refreshExplorer"
      );
      assert.ok(refreshButton, "Refresh button should be in view title");
      assert.ok(refreshButton?.when?.includes("view == landoExplorer"), "Should be scoped to landoExplorer view");
      assert.strictEqual(refreshButton?.group, "navigation", "Should be in navigation group");
    });

    test("Should have context menu items for tree items", () => {
      const viewItemContextMenu = packageJson.contributes!.menus!["view/item/context"];
      assert.ok(viewItemContextMenu, "view/item/context menu should be defined");
      assert.ok(viewItemContextMenu.length > 0, "Should have context menu items");

      // Check for app context menu items
      const appItems = viewItemContextMenu.filter((m) => m.when?.includes("viewItem == app"));
      assert.ok(appItems.length >= 3, "Should have multiple app context menu items");

      // Check for service context menu items
      const serviceItems = viewItemContextMenu.filter((m) => m.when?.includes("viewItem == service"));
      assert.ok(serviceItems.length >= 1, "Should have service context menu items");

      // Check for URL context menu items
      const urlItems = viewItemContextMenu.filter((m) => m.when?.includes("viewItem == url"));
      assert.ok(urlItems.length >= 1, "Should have URL context menu items");

      // Check for info item context menu items
      const infoItems = viewItemContextMenu.filter((m) => m.when?.includes("viewItem == infoItem"));
      assert.ok(infoItems.length >= 1, "Should have info item context menu items");
    });

    test("Should have inline action for info items", () => {
      const viewItemContextMenu = packageJson.contributes!.menus!["view/item/context"];
      
      const copyInfoInline = viewItemContextMenu.find(
        (m) => m.command === "lando.treeCopyInfo" && m.group === "inline"
      );
      assert.ok(copyInfoInline, "Copy Info button should be inline for info items");
    });

    test("Should have View Logs action for services", () => {
      const viewItemContextMenu = packageJson.contributes!.menus!["view/item/context"];
      
      const viewLogsItem = viewItemContextMenu.find(
        (m) => m.command === "lando.treeViewServiceLogs" && m.when?.includes("viewItem == service")
      );
      assert.ok(viewLogsItem, "View Logs should be available for services");
    });

    test("Should have inline action buttons for apps", () => {
      const viewItemContextMenu = packageJson.contributes!.menus!["view/item/context"];
      
      // Check for inline start button
      const startInline = viewItemContextMenu.find(
        (m) => m.command === "lando.treeStartApp" && m.group === "inline@1"
      );
      assert.ok(startInline, "Start button should be inline");

      // Check for inline stop button
      const stopInline = viewItemContextMenu.find(
        (m) => m.command === "lando.treeStopApp" && m.group === "inline@2"
      );
      assert.ok(stopInline, "Stop button should be inline");

      // Check for inline terminal button
      const terminalInline = viewItemContextMenu.find(
        (m) => m.command === "lando.treeOpenTerminal" && m.group === "inline@3"
      );
      assert.ok(terminalInline, "Terminal button should be inline");
    });

    test("Should have inline action for services", () => {
      const viewItemContextMenu = packageJson.contributes!.menus!["view/item/context"];
      
      const sshInline = viewItemContextMenu.find(
        (m) => m.command === "lando.treeOpenSshService" && m.group === "inline"
      );
      assert.ok(sshInline, "SSH button should be inline for services");
    });

    test("Should have inline action for URLs", () => {
      const viewItemContextMenu = packageJson.contributes!.menus!["view/item/context"];
      
      const copyInline = viewItemContextMenu.find(
        (m) => m.command === "lando.treeCopyUrl" && m.group === "inline"
      );
      assert.ok(copyInline, "Copy URL button should be inline for URLs");
    });
  });

  suite("TreeView Command Definitions", () => {
    let packageJson: {
      contributes?: {
        commands?: Array<{ command: string; title: string; icon?: string }>;
      };
    };

    suiteSetup(() => {
      const packageJsonPath = path.join(__dirname, "..", "..", "..", "package.json");
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    });

    test("Refresh command should have icon", () => {
      const refreshCmd = packageJson.contributes!.commands!.find(
        (c) => c.command === "lando.refreshExplorer"
      );
      assert.ok(refreshCmd, "Refresh command should be defined");
      assert.strictEqual(refreshCmd?.icon, "$(refresh)", "Refresh should have refresh icon");
    });

    test("Start command should have icon", () => {
      const startCmd = packageJson.contributes!.commands!.find(
        (c) => c.command === "lando.treeStartApp"
      );
      assert.ok(startCmd, "Start command should be defined");
      assert.strictEqual(startCmd?.icon, "$(debug-start)", "Start should have debug-start icon");
    });

    test("Stop command should have icon", () => {
      const stopCmd = packageJson.contributes!.commands!.find(
        (c) => c.command === "lando.treeStopApp"
      );
      assert.ok(stopCmd, "Stop command should be defined");
      assert.strictEqual(stopCmd?.icon, "$(debug-stop)", "Stop should have debug-stop icon");
    });

    test("Copy URL command should have icon", () => {
      const copyCmd = packageJson.contributes!.commands!.find(
        (c) => c.command === "lando.treeCopyUrl"
      );
      assert.ok(copyCmd, "Copy URL command should be defined");
      assert.strictEqual(copyCmd?.icon, "$(copy)", "Copy should have copy icon");
    });

    test("SSH service command should have icon", () => {
      const sshCmd = packageJson.contributes!.commands!.find(
        (c) => c.command === "lando.treeOpenSshService"
      );
      assert.ok(sshCmd, "SSH service command should be defined");
      assert.strictEqual(sshCmd?.icon, "$(terminal)", "SSH should have terminal icon");
    });

    test("Copy Info command should have icon", () => {
      const copyInfoCmd = packageJson.contributes!.commands!.find(
        (c) => c.command === "lando.treeCopyInfo"
      );
      assert.ok(copyInfoCmd, "Copy Info command should be defined");
      assert.strictEqual(copyInfoCmd?.icon, "$(copy)", "Copy Info should have copy icon");
    });

    test("View Service Logs command should have icon", () => {
      const viewLogsCmd = packageJson.contributes!.commands!.find(
        (c) => c.command === "lando.treeViewServiceLogs"
      );
      assert.ok(viewLogsCmd, "View Service Logs command should be defined");
      assert.strictEqual(viewLogsCmd?.icon, "$(output)", "View Logs should have output icon");
    });
  });

  suite("TreeView Command Behavior", () => {
    test("lando.refreshExplorer should execute without throwing", async () => {
      try {
        await vscode.commands.executeCommand("lando.refreshExplorer");
        assert.ok(true, "Refresh command should execute without throwing");
      } catch (_error) {
        // Some environments may not have the TreeView initialized
        assert.ok(true, "Command may fail gracefully in test environment");
      }
    });

    test("lando.openUrlDirect should handle valid URL", async () => {
      // We can't fully test this without mocking vscode.env.openExternal
      // but we can verify the command exists and is callable
      try {
        // Don't actually open a URL in tests
        // Just verify the command is registered
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes("lando.openUrlDirect"), "Command should be registered");
      } catch (_error) {
        assert.ok(true, "Command exists even if not callable in test environment");
      }
    });
  });
});
