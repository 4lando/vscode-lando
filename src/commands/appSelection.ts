/**
 * App Selection Commands
 * 
 * This module registers commands for selecting and managing Lando apps.
 * 
 * @module commands/appSelection
 */

import * as vscode from "vscode";
import { CommandDependencies } from "../types";
import { LandoApp } from "../landoAppDetector";
import { 
  LandoAppState,
  isStateRunning,
  isStateBusy,
  getStateLabel,
} from "../landoStatusMonitor";

/**
 * Registers app selection and status commands
 * @param context - The extension context
 * @param deps - Command dependencies
 */
export function registerAppSelectionCommands(
  context: vscode.ExtensionContext,
  deps: CommandDependencies
): void {
  const { getActiveApp, setActiveApp, statusMonitor, appDetector } = deps;

  // Command to select a Lando app or show quick actions
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.selectLandoApp', async () => {
      const apps = appDetector.getApps();
      
      if (apps.length === 0) {
        vscode.window.showInformationMessage('No Lando apps detected in workspace');
        return;
      }

      // Build quick actions menu
      interface QuickActionItem extends vscode.QuickPickItem {
        action?: 'start' | 'stop' | 'restart' | 'refresh' | 'switch' | 'openUrl' | 'copyUrl' | 'viewLogs' | 'runTooling' | 'documentation';
        app?: LandoApp;
      }

      const activeLandoApp = getActiveApp();

      // Auto-select if there's exactly one app and no active app set
      if (!activeLandoApp && apps.length === 1) {
        setActiveApp(apps[0]);
      }

      const items: QuickActionItem[] = [];
      const currentActiveApp = getActiveApp(); // Re-get after potential auto-select
      
      if (currentActiveApp) {
        const status = statusMonitor.getStatus(currentActiveApp);
        const appState = status?.state ?? LandoAppState.Unknown;
        const isRunning = isStateRunning(appState);
        const isBusy = isStateBusy(appState);
        
        // Show contextual actions based on status
        if (isRunning && !isBusy) {
          items.push({
            label: '$(link-external) Open in Browser',
            description: `Open ${currentActiveApp.name} URL`,
            action: 'openUrl'
          });
          items.push({
            label: '$(copy) Copy URL',
            description: `Copy ${currentActiveApp.name} URL to clipboard`,
            action: 'copyUrl'
          });
          items.push({
            label: '$(output) View Logs',
            description: `View ${currentActiveApp.name} logs`,
            action: 'viewLogs'
          });
          items.push({
            label: '$(debug-stop) Stop',
            description: `Stop ${currentActiveApp.name}`,
            action: 'stop'
          });
          items.push({
            label: '$(debug-restart) Restart',
            description: `Restart ${currentActiveApp.name}`,
            action: 'restart'
          });
          // Always show tooling option - Lando will be queried for available commands
          // Even without custom tooling in .lando.yml, recipes provide default commands
          items.push({
            label: '$(terminal) Run Tooling',
            description: `Run tooling commands (drush, composer, etc.)`,
            action: 'runTooling'
          });
        } else {
          items.push({
            label: '$(debug-start) Start',
            description: `Start ${currentActiveApp.name}`,
            action: 'start'
          });
        }
        
        items.push({
          label: '$(refresh) Refresh Status',
          description: 'Refresh the current status',
          action: 'refresh'
        });
        
        items.push({
          label: '$(book) Documentation',
          description: 'Open Lando documentation',
          action: 'documentation'
        });
      }
      
      // If there are multiple apps, add switch option
      if (apps.length > 1) {
        items.push({
          label: '$(list-selection) Switch App',
          description: `${apps.length} apps available`,
          action: 'switch'
        });
      }
      
      // Always show documentation option (even when no app is selected)
      if (!currentActiveApp) {
        items.push({
          label: '$(book) Documentation',
          description: 'Open Lando documentation',
          action: 'documentation'
        });
      }

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: currentActiveApp ? `${currentActiveApp.name} - Select an action` : 'Select a Lando app',
        title: 'Lando'
      });

      if (!selected) {
        return;
      }

      switch (selected.action) {
        case 'start':
          await vscode.commands.executeCommand('extension.startLandoApp');
          break;
        case 'stop':
          await vscode.commands.executeCommand('extension.stopLandoApp');
          break;
        case 'restart':
          await vscode.commands.executeCommand('extension.restartLandoApp');
          break;
        case 'refresh':
          await vscode.commands.executeCommand('extension.refreshLandoStatus');
          break;
        case 'openUrl':
          await vscode.commands.executeCommand('extension.openLandoUrl');
          break;
        case 'copyUrl':
          await vscode.commands.executeCommand('extension.copyLandoUrl');
          break;
        case 'viewLogs':
          await vscode.commands.executeCommand('extension.viewLandoLogs');
          break;
        case 'runTooling':
          await vscode.commands.executeCommand('extension.runLandoTooling');
          break;
        case 'documentation':
          await vscode.commands.executeCommand('extension.openLandoDocumentation');
          break;
        case 'switch':
          // Show app selection submenu
          const appItems = apps.map(app => ({
            label: app.name,
            description: app.recipe || 'Custom',
            detail: app.rootPath,
            app
          }));

          const selectedApp = await vscode.window.showQuickPick(appItems, {
            placeHolder: 'Select a Lando app to activate',
            title: 'Lando Apps'
          });

          if (selectedApp) {
            setActiveApp(selectedApp.app);
            vscode.window.showInformationMessage(`Active Lando app: ${selectedApp.app.name}`);
          }
          break;
      }
    })
  );

  // Command to rescan for Lando apps
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.rescanLandoApps', async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Scanning for Lando apps...',
          cancellable: false
        },
        async () => {
          await appDetector.rescan();
        }
      );

      const appCount = appDetector.getAppCount();
      vscode.window.showInformationMessage(
        `Found ${appCount} Lando app${appCount !== 1 ? 's' : ''}`
      );
    })
  );

  // Command to refresh Lando status
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.refreshLandoStatus', async () => {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Refreshing Lando status...',
          cancellable: false
        },
        async () => {
          await statusMonitor.refresh();
        }
      );

      const activeLandoApp = getActiveApp();
      if (activeLandoApp) {
        const status = statusMonitor.getStatus(activeLandoApp);
        const statusText = getStateLabel(status?.state ?? LandoAppState.Unknown);
        vscode.window.showInformationMessage(
          `${activeLandoApp.name} is ${statusText}`
        );
      }
    })
  );
}
