/**
 * Lifecycle Commands
 * 
 * This module registers Lando app lifecycle commands:
 * start, stop, restart, rebuild, destroy, powerOff
 * 
 * @module commands/lifecycle
 */

import * as vscode from "vscode";
import { CommandDependencies } from "../types";
import { 
  LandoAppState,
  getStateLabel,
} from "../landoStatusMonitor";
import { 
  startLando, 
  stopLando, 
  restartLando, 
  rebuildLando, 
  destroyLando, 
  powerOffLando 
} from "../helpers/lando";
import { checkAndReloadPhpPlugins } from "../php";

/**
 * Registers lifecycle-related commands
 * @param context - The extension context
 * @param deps - Command dependencies
 */
export function registerLifecycleCommands(
  context: vscode.ExtensionContext,
  deps: CommandDependencies
): void {
  const { outputChannel, getActiveApp, statusMonitor } = deps;

  // Command to start the active Lando app
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.startLandoApp', async () => {
      const activeLandoApp = getActiveApp();
      
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

      // Check if we can start (prevent conflicting operations)
      if (!statusMonitor.canTransition(activeLandoApp, LandoAppState.Starting)) {
        const currentState = statusMonitor.getState(activeLandoApp);
        vscode.window.showWarningMessage(
          `Cannot start: ${activeLandoApp.name} is currently ${getStateLabel(currentState).toLowerCase()}`
        );
        return;
      }

      // Mark as starting - this updates the UI immediately
      statusMonitor.markStarting(activeLandoApp);

      const notification = vscode.window.showInformationMessage(
        `Starting ${activeLandoApp.name}... This may take a few minutes.`,
        'Cancel'
      );

      const success = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Starting ${activeLandoApp.name}...`,
          cancellable: false
        },
        async () => {
          const result = await startLando(activeLandoApp!.rootPath, outputChannel, notification);
          return result;
        }
      );

      if (success) {
        vscode.window.showInformationMessage(`${activeLandoApp.name} started successfully`);
        // Refresh the status - this will transition to Running state
        await statusMonitor.refresh();
      } else {
        // Mark error state
        statusMonitor.markError(activeLandoApp, 'Start command failed');
        vscode.window.showErrorMessage(`Failed to start ${activeLandoApp.name}`);
      }
    })
  );

  // Command to stop the active Lando app
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.stopLandoApp', async () => {
      const activeLandoApp = getActiveApp();
      
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

      // Check if we can stop (prevent conflicting operations)
      if (!statusMonitor.canTransition(activeLandoApp, LandoAppState.Stopping)) {
        const currentState = statusMonitor.getState(activeLandoApp);
        vscode.window.showWarningMessage(
          `Cannot stop: ${activeLandoApp.name} is currently ${getStateLabel(currentState).toLowerCase()}`
        );
        return;
      }

      // Mark as stopping - this updates the UI immediately
      statusMonitor.markStopping(activeLandoApp);

      const notification = vscode.window.showInformationMessage(
        `Stopping ${activeLandoApp.name}...`,
        'Cancel'
      );

      const success = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Stopping ${activeLandoApp.name}...`,
          cancellable: false
        },
        async () => {
          const result = await stopLando(activeLandoApp!.rootPath, outputChannel, notification);
          return result;
        }
      );

      if (success) {
        vscode.window.showInformationMessage(`${activeLandoApp.name} stopped successfully`);
        // Refresh the status - this will transition to Stopped state
        await statusMonitor.refresh();
      } else {
        // Mark error state
        statusMonitor.markError(activeLandoApp, 'Stop command failed');
        vscode.window.showErrorMessage(`Failed to stop ${activeLandoApp.name}`);
      }
    })
  );

  // Command to restart the active Lando app
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.restartLandoApp', async () => {
      const activeLandoApp = getActiveApp();
      
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

      // Check if we can restart (treat as stopping - it's a compound operation)
      if (!statusMonitor.canTransition(activeLandoApp, LandoAppState.Stopping)) {
        const currentState = statusMonitor.getState(activeLandoApp);
        vscode.window.showWarningMessage(
          `Cannot restart: ${activeLandoApp.name} is currently ${getStateLabel(currentState).toLowerCase()}`
        );
        return;
      }

      // Mark as stopping for UI (restart = stop + start)
      statusMonitor.markStopping(activeLandoApp);

      const notification = vscode.window.showInformationMessage(
        `Restarting ${activeLandoApp.name}... This may take a few minutes.`,
        'Cancel'
      );

      const success = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Restarting ${activeLandoApp.name}...`,
          cancellable: false
        },
        async () => {
          const result = await restartLando(activeLandoApp!.rootPath, outputChannel, notification);
          return result;
        }
      );

      if (success) {
        vscode.window.showInformationMessage(`${activeLandoApp.name} restarted successfully`);
        // Refresh the status - this will transition to Running state
        await statusMonitor.refresh();
      } else {
        // Mark error state
        statusMonitor.markError(activeLandoApp, 'Restart command failed');
        vscode.window.showErrorMessage(`Failed to restart ${activeLandoApp.name}`);
      }
    })
  );

  // Command to rebuild the active Lando app (destructive)
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.rebuildLandoApp', async () => {
      const activeLandoApp = getActiveApp();
      
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

      // Check if we can rebuild (prevent conflicting operations)
      if (!statusMonitor.canTransition(activeLandoApp, LandoAppState.Rebuilding)) {
        const currentState = statusMonitor.getState(activeLandoApp);
        vscode.window.showWarningMessage(
          `Cannot rebuild: ${activeLandoApp.name} is currently ${getStateLabel(currentState).toLowerCase()}`
        );
        return;
      }

      // Warn user about destructive action
      const confirm = await vscode.window.showWarningMessage(
        `Rebuild will destroy and recreate ${activeLandoApp.name}'s containers. ` +
        `Local data in containers will be lost. Continue?`,
        { modal: true },
        'Rebuild'
      );

      if (confirm !== 'Rebuild') {
        return;
      }

      // Mark as rebuilding - this updates the UI immediately
      statusMonitor.markRebuilding(activeLandoApp);

      const notification = vscode.window.showInformationMessage(
        `Rebuilding ${activeLandoApp.name}... This may take several minutes.`,
        'Cancel'
      );

      const success = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Rebuilding ${activeLandoApp.name}...`,
          cancellable: false
        },
        async () => {
          const result = await rebuildLando(activeLandoApp!.rootPath, outputChannel, notification);
          return result;
        }
      );

      if (success) {
        vscode.window.showInformationMessage(`${activeLandoApp.name} rebuilt successfully`);
        // Refresh the status - this will transition to Running state
        await statusMonitor.refresh();
        // Check and reload PHP plugins after rebuild
        await checkAndReloadPhpPlugins(outputChannel);
      } else {
        // Mark error state
        statusMonitor.markError(activeLandoApp, 'Rebuild command failed');
        vscode.window.showErrorMessage(`Failed to rebuild ${activeLandoApp.name}`);
      }
    })
  );

  // Command to destroy the active Lando app (very destructive - removes everything)
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.destroyLandoApp', async () => {
      const activeLandoApp = getActiveApp();
      
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

      // Check if we can destroy (prevent conflicting operations)
      if (!statusMonitor.canTransition(activeLandoApp, LandoAppState.Destroying)) {
        const currentState = statusMonitor.getState(activeLandoApp);
        vscode.window.showWarningMessage(
          `Cannot destroy: ${activeLandoApp.name} is currently ${getStateLabel(currentState).toLowerCase()}`
        );
        return;
      }

      // Show a strong warning about the destructive nature of this action
      const confirm = await vscode.window.showWarningMessage(
        `DESTROY ${activeLandoApp.name}?\n\n` +
        `This will completely remove all containers, networks, and volumes for this app. ` +
        `Any data stored in containers (databases, uploads, etc.) will be permanently deleted.\n\n` +
        `Your project files will NOT be affected.`,
        { modal: true },
        'Destroy',
        'Cancel'
      );

      if (confirm !== 'Destroy') {
        return;
      }

      // Second confirmation for extra safety
      // Capture app name and root path early to prevent TOCTOU race condition
      const appName = activeLandoApp.name;
      const appRootPath = activeLandoApp.rootPath;
      const appForState = activeLandoApp; // Capture reference for state machine
      const typedName = await vscode.window.showInputBox({
        prompt: `Type the app name "${appName}" to confirm destruction`,
        placeHolder: appName,
        validateInput: (value) => {
          if (value !== appName) {
            return 'App name does not match';
          }
          return null;
        }
      });

      if (typedName !== appName) {
        return;
      }

      // Mark as destroying - this updates the UI immediately
      statusMonitor.markDestroying(appForState);

      const notification = vscode.window.showInformationMessage(
        `Destroying ${appName}...`,
        'Cancel'
      );

      const success = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Destroying ${appName}...`,
          cancellable: false
        },
        async () => {
          const result = await destroyLando(appRootPath, outputChannel, notification);
          return result;
        }
      );

      if (success) {
        vscode.window.showInformationMessage(`${appName} destroyed successfully`);
        // Refresh the status - app will now appear as stopped
        await statusMonitor.refresh();
      } else {
        // Mark error state
        statusMonitor.markError(appForState, 'Destroy command failed');
        vscode.window.showErrorMessage(`Failed to destroy ${appName}`);
      }
    })
  );

  // Command to power off Lando containers globally
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.powerOffLando', async () => {
      // Confirm the action
      const confirm = await vscode.window.showWarningMessage(
        `Power off all Lando containers?\n\n` +
        `This will stop ALL running Lando apps on your system, not just the ones in this workspace.`,
        { modal: true },
        'Power Off',
        'Cancel'
      );

      if (confirm !== 'Power Off') {
        return;
      }

      const notification = vscode.window.showInformationMessage(
        'Powering off all Lando containers...',
        'Cancel'
      );

      const success = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Powering off all Lando containers...',
          cancellable: false
        },
        async () => {
          const result = await powerOffLando(outputChannel, notification);
          return result;
        }
      );

      if (success) {
        vscode.window.showInformationMessage('All Lando containers powered off');
        // Refresh the status - all apps will now appear as stopped
        await statusMonitor.refresh();
      } else {
        vscode.window.showErrorMessage('Failed to power off Lando containers');
      }
    })
  );
}
