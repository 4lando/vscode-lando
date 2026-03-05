/**
 * URL Commands
 * 
 * This module registers commands for opening and copying Lando app URLs.
 * 
 * @module commands/urls
 */

import * as vscode from "vscode";
import { CommandDependencies } from "../types";
import { 
  LandoAppState,
  isStateRunning,
  isStateBusy,
  getStateLabel,
} from "../landoStatusMonitor";
import { getLandoUrls } from "../helpers/lando";

/**
 * Registers URL-related commands
 * @param context - The extension context
 * @param deps - Command dependencies
 */
export function registerUrlCommands(
  context: vscode.ExtensionContext,
  deps: CommandDependencies
): void {
  const { outputChannel, getActiveApp, statusMonitor } = deps;

  // Command to open the active Lando app's URL in browser
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.openLandoUrl', async () => {
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
          // Wait a bit for URLs to be available
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          return;
        }
      }

      const urls = await getLandoUrls(activeLandoApp.rootPath, outputChannel);
      
      if (urls.length === 0) {
        vscode.window.showWarningMessage(`No URLs available for ${activeLandoApp.name}`);
        return;
      }

      if (urls.length === 1) {
        // Open the only URL directly
        await vscode.env.openExternal(vscode.Uri.parse(urls[0].url));
        return;
      }

      // Show picker for multiple URLs
      const items = urls.map(u => ({
        label: u.url,
        description: u.service + (u.primary ? ' (primary)' : ''),
        url: u.url
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a URL to open',
        title: `${activeLandoApp.name} URLs`
      });

      if (selected) {
        await vscode.env.openExternal(vscode.Uri.parse(selected.url));
      }
    })
  );

  // Command to copy the active Lando app's URL to clipboard
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.copyLandoUrl', async () => {
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

      const urls = await getLandoUrls(activeLandoApp.rootPath, outputChannel);
      
      if (urls.length === 0) {
        vscode.window.showWarningMessage(`No URLs available for ${activeLandoApp.name}`);
        return;
      }

      if (urls.length === 1) {
        // Copy the only URL directly
        await vscode.env.clipboard.writeText(urls[0].url);
        vscode.window.showInformationMessage(`Copied: ${urls[0].url}`);
        return;
      }

      // Show picker for multiple URLs
      const items = urls.map(u => ({
        label: u.url,
        description: u.service + (u.primary ? ' (primary)' : ''),
        url: u.url
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a URL to copy',
        title: `${activeLandoApp.name} URLs`
      });

      if (selected) {
        await vscode.env.clipboard.writeText(selected.url);
        vscode.window.showInformationMessage(`Copied: ${selected.url}`);
      }
    })
  );
}
