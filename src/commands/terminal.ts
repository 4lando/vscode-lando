/**
 * Terminal Commands
 * 
 * This module registers commands for opening terminals and viewing logs.
 * 
 * @module commands/terminal
 */

import * as vscode from "vscode";
import { CommandDependencies } from "../types";
import { 
  LandoAppState,
  isStateRunning,
  isStateBusy,
  getStateLabel,
} from "../landoStatusMonitor";
import { getLandoServices } from "../helpers/lando";

/**
 * Registers terminal-related commands
 * @param context - The extension context
 * @param deps - Command dependencies
 */
export function registerTerminalCommands(
  context: vscode.ExtensionContext,
  deps: CommandDependencies
): void {
  const { outputChannel, getActiveApp, statusMonitor } = deps;

  // Command to open a terminal connected to a Lando service (SSH)
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.openLandoTerminal', async () => {
      const activeLandoApp = getActiveApp();
      
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

      // Check if the app is running
      const status = statusMonitor.getStatus(activeLandoApp);
      const appState = status?.state ?? LandoAppState.Unknown;
      
      if (isStateBusy(appState)) {
        vscode.window.showWarningMessage(
          `${activeLandoApp.name} is ${getStateLabel(appState).toLowerCase()}, please wait...`
        );
        return;
      }
      
      if (!isStateRunning(appState)) {
        const action = await vscode.window.showWarningMessage(
          `${activeLandoApp.name} is not running. Start it first?`,
          'Start',
          'Cancel'
        );
        if (action === 'Start') {
          await vscode.commands.executeCommand('extension.startLandoApp');
          // startLandoApp already waits for completion and refreshes status
        } else {
          return;
        }
      }

      // Get available services
      const services = await getLandoServices(activeLandoApp.rootPath, outputChannel);
      
      if (services.length === 0) {
        vscode.window.showErrorMessage(`No services available for ${activeLandoApp.name}`);
        return;
      }

      interface ServiceQuickPickItem extends vscode.QuickPickItem {
        service: string;
      }

      // Build quick pick items
      const items: ServiceQuickPickItem[] = services.map(service => ({
        label: `$(terminal) ${service.name}`,
        description: service.type,
        service: service.name
      }));

      // If there's only one service, use it directly
      let selectedService: string;
      if (services.length === 1) {
        selectedService = services[0].name;
      } else {
        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a service to connect to',
          title: `${activeLandoApp.name} - Open Terminal`
        });

        if (!selected) {
          return;
        }
        selectedService = selected.service;
      }

      // Create a terminal with lando ssh
      const terminalName = `Lando: ${activeLandoApp.name} (${selectedService})`;
      
      // Check for existing terminal
      const existingTerminal = vscode.window.terminals.find(t => t.name === terminalName);
      if (existingTerminal) {
        existingTerminal.show();
        return;
      }

      const terminal = vscode.window.createTerminal({
        name: terminalName,
        cwd: activeLandoApp.rootPath,
      });

      // Use lando ssh to connect to the service
      terminal.sendText(`lando ssh -s ${selectedService}`);
      terminal.show();
    })
  );

  // Command to view Lando logs
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.viewLandoLogs', async () => {
      const activeLandoApp = getActiveApp();
      
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

      // Check if the app is running
      const status = statusMonitor.getStatus(activeLandoApp);
      const appState = status?.state ?? LandoAppState.Unknown;
      
      if (isStateBusy(appState)) {
        vscode.window.showWarningMessage(
          `${activeLandoApp.name} is ${getStateLabel(appState).toLowerCase()}, please wait...`
        );
        return;
      }
      
      if (!isStateRunning(appState)) {
        const action = await vscode.window.showWarningMessage(
          `${activeLandoApp.name} is not running. Start it first?`,
          'Start',
          'Cancel'
        );
        if (action === 'Start') {
          await vscode.commands.executeCommand('extension.startLandoApp');
          // startLandoApp already waits for completion and refreshes status
        } else {
          return;
        }
      }

      // Get available services
      const services = await getLandoServices(activeLandoApp.rootPath, outputChannel);
      
      interface LogsQuickPickItem extends vscode.QuickPickItem {
        service?: string;
      }

      const items: LogsQuickPickItem[] = [
        {
          label: '$(list-flat) All Services',
          description: 'View logs from all services',
          service: undefined
        }
      ];

      // Add individual services
      for (const service of services) {
        items.push({
          label: `$(server) ${service.name}`,
          description: service.type,
          service: service.name
        });
      }

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select which service logs to view',
        title: `${activeLandoApp.name} Logs`
      });

      if (!selected) {
        return;
      }

      // Build the lando logs command
      const logArgs = ['logs', '-f'];  // -f to follow logs
      if (selected.service) {
        logArgs.push('-s', selected.service);
      }

      // Create a terminal for log viewing
      const terminalName = selected.service
        ? `Lando Logs: ${selected.service}`
        : `Lando Logs: ${activeLandoApp.name}`;

      const terminal = vscode.window.createTerminal({
        name: terminalName,
        cwd: activeLandoApp.rootPath,
      });

      // Send the lando logs command to the terminal
      terminal.sendText(`lando ${logArgs.join(' ')}`);
      terminal.show();
    })
  );
}
