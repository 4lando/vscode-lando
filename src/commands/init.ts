/**
 * Init Commands
 * 
 * This module registers commands for creating new Lando apps.
 * 
 * @module commands/init
 */

import * as vscode from "vscode";
import { LandoAppDetector } from "../landoAppDetector";
import { runInitWizard } from "../landoInit";

/**
 * Registers init-related commands
 * @param context - The extension context
 * @param appDetector - The Lando app detector instance
 * @param outputChannel - Output channel for logging
 */
export function registerInitCommands(
  context: vscode.ExtensionContext,
  appDetector: LandoAppDetector,
  outputChannel: vscode.OutputChannel
): void {
  // Command to create a new Lando app using the initialization wizard
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.createLandoApp', async () => {
      const result = await runInitWizard(outputChannel);
      if (result) {
        // Trigger a rescan to pick up the new app
        await appDetector.rescan();
      }
    })
  );
}
