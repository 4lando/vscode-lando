/**
 * PHP Integration Module
 * 
 * This module provides PHP integration for Lando, including:
 * - PHP wrapper configuration
 * - Terminal environment setup
 * - VS Code PHP settings management
 * 
 * @module php
 */

import * as vscode from "vscode";
import * as path from "path";
import { LandoConfig, OriginalPhpSettings } from "../types";
import { configureTerminalEnvironment, restoreTerminalEnvironment } from "./terminalEnv";

// Re-export for convenience
export { checkAndReloadPhpPlugins } from "./plugins";
export { checkPhpPlugins, reloadPhpPlugins, COMMON_PHP_PLUGINS } from "./plugins";
export { configureTerminalEnvironment, restoreTerminalEnvironment } from "./terminalEnv";

/** Module-level storage for original PHP settings */
let originalPhpSettings: OriginalPhpSettings | undefined;

/**
 * Gets the current original PHP settings
 */
export function getOriginalPhpSettings(): OriginalPhpSettings | undefined {
  return originalPhpSettings;
}

/**
 * Sets the original PHP settings (for testing or external use)
 */
export function setOriginalPhpSettings(settings: OriginalPhpSettings | undefined): void {
  originalPhpSettings = settings;
}

/**
 * Gets the path to the PHP wrapper script
 * @param outputChannel - Output channel for logging
 * @returns The path to the appropriate PHP wrapper script
 */
export function getPhpWrapperPath(outputChannel: vscode.OutputChannel): string {
  // Get the current extension's path from VS Code
  const currentExtension = vscode.extensions.getExtension("4lando.vscode-lando");
  const extensionPath = currentExtension?.extensionPath;
  
  if (!extensionPath) {
    outputChannel.appendLine("Error: Could not determine extension path");
    throw new Error("Could not determine extension path");
  }
  
  outputChannel.appendLine(`Extension path: ${extensionPath}`);
  
  // Always use the actual extension path - VS Code variables like 
  // "${extensionInstallFolder:...}" are only resolved in certain configuration
  // contexts, not when building file paths in JavaScript code.
  const wrapperPath = process.platform === "win32"
    ? path.join(extensionPath, "bin", "php.bat")
    : path.join(extensionPath, "bin", "php");
  
  outputChannel.appendLine(`PHP wrapper path: ${wrapperPath}`);
  return wrapperPath;
}

/**
 * Overrides PHP executable paths in VS Code configuration
 * @param phpWrapperPath - Path to the PHP wrapper script
 * @param phpContainer - Docker container name
 * @param workingDir - Working directory inside container
 * @param outputChannel - Output channel for logging
 */
export async function overridePhpExecutablePath(
  phpWrapperPath: string,
  phpContainer: string,
  workingDir: string,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const config = vscode.workspace.getConfiguration("php");
  
  // Store original values to restore later
  const originalExecutablePath = config.inspect("executablePath")?.workspaceValue;
  const originalValidatePath = config.inspect("validate.executablePath")?.workspaceValue;
  const originalDebugPath = config.inspect("debug.executablePath")?.workspaceValue;

  outputChannel.appendLine(`Original executablePath: ${originalExecutablePath}`);
  outputChannel.appendLine(`Original validateExecutablePath: ${originalValidatePath}`);
  outputChannel.appendLine(`Original debugExecutablePath: ${originalDebugPath}`);
  
  // Update settings.json in Workspace
  await config.update("executablePath", phpWrapperPath, vscode.ConfigurationTarget.Workspace);
  await config.update("validate.executablePath", phpWrapperPath, vscode.ConfigurationTarget.Workspace);
  await config.update("debug.executablePath", phpWrapperPath, vscode.ConfigurationTarget.Workspace);
  
  outputChannel.appendLine(`Set executablePath to: ${phpWrapperPath}`);
  outputChannel.appendLine(`Set validate.executablePath to: ${phpWrapperPath}`);
  outputChannel.appendLine(`Set debug.executablePath to: ${phpWrapperPath}`);

  // Add extension bin directory to PATH
  const binDir = path.dirname(phpWrapperPath);
  const originalPath = process.env.PATH || "";
  if (!originalPath.includes(binDir)) {
    process.env.PATH = `${binDir}${path.delimiter}${originalPath}`;
    outputChannel.appendLine(`Added ${binDir} to PATH`);
  }
  
  outputChannel.appendLine(`PHP settings overridden for workspace. Working dir: ${workingDir}`);
  
  // Store original values for restoration on deactivation
  if (!originalPhpSettings) {
    originalPhpSettings = {};
  }
  originalPhpSettings.executablePath = originalExecutablePath as string | undefined;
  originalPhpSettings.validateExecutablePath = originalValidatePath as string | undefined;
  originalPhpSettings.debugExecutablePath = originalDebugPath as string | undefined;
  originalPhpSettings.path = originalPath;
  originalPhpSettings.binDir = binDir;
}

/**
 * Restores original PHP settings
 * @param outputChannel - Output channel for logging
 */
export async function restoreOriginalPhpSettings(
  outputChannel: vscode.OutputChannel
): Promise<void> {
  if (originalPhpSettings) {
    const config = vscode.workspace.getConfiguration("php");
    
    outputChannel.appendLine(`Restoring executablePath to: ${originalPhpSettings.executablePath}`);
    outputChannel.appendLine(`Restoring validateExecutablePath to: ${originalPhpSettings.validateExecutablePath}`);
    outputChannel.appendLine(`Restoring debugExecutablePath to: ${originalPhpSettings.debugExecutablePath}`);

    await config.update(
      "executablePath",
      originalPhpSettings.executablePath,
      vscode.ConfigurationTarget.Workspace
    );
    await config.update(
      "validate.executablePath",
      originalPhpSettings.validateExecutablePath,
      vscode.ConfigurationTarget.Workspace
    );
    await config.update(
      "debug.executablePath",
      originalPhpSettings.debugExecutablePath,
      vscode.ConfigurationTarget.Workspace
    );
    
    // Restore terminal environment settings
    await restoreTerminalEnvironment(originalPhpSettings, outputChannel);
    
    outputChannel.appendLine("Original PHP settings restored");
    originalPhpSettings = undefined;
  }
}

/**
 * Sets up Docker mode with terminal and task integration
 * @param context - The extension context
 * @param workspaceFolder - The workspace folder path
 * @param landoConfig - The parsed Lando configuration
 * @param outputChannel - Output channel for logging
 */
export async function setupDockerMode(
  context: vscode.ExtensionContext,
  workspaceFolder: string,
  landoConfig: LandoConfig,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const phpService = vscode.workspace.getConfiguration("lando").get("php.service", "appserver");
  outputChannel.appendLine(
    `Setting up Docker mode with container: ${landoConfig.cleanAppName}_${phpService}_1`
  );
  const workingDir = vscode.workspace.getConfiguration("lando").get("appMount", "/app");
  const phpWrapperPath = getPhpWrapperPath(outputChannel);
  
  // Automatically enable PHP interpreter
  await overridePhpExecutablePath(phpWrapperPath, landoConfig.phpContainer, workingDir, outputChannel);

  // Set environment variables for the extension process
  process.env.PHP_EXECUTABLE = phpWrapperPath;
  process.env.VSCODE_LANDO_PHP_CONTAINER = landoConfig.phpService;
  process.env.VSCODE_LANDO_EXEC_CWD = workingDir;

  // Configure terminal environment so that all terminals (including task terminals)
  // have the PHP wrapper in PATH and the required environment variables.
  // This ensures PHP commands in VS Code tasks are properly redirected to Lando.
  if (!originalPhpSettings) {
    originalPhpSettings = {};
  }
  await configureTerminalEnvironment(
    context.extensionPath,
    landoConfig,
    workingDir,
    originalPhpSettings,
    outputChannel
  );

  // Hook into terminal creation to set up Docker PHP (for existing terminals and fallback)
  const terminalCreateListener = vscode.window.onDidOpenTerminal((terminal) => {
    // Give terminal a moment to initialize
    setTimeout(() => {
      terminal.sendText(`cd "${workspaceFolder}"`);
      if (process.platform !== "win32") {
        terminal.sendText(
          `alias php="VSCODE_LANDO_PHP_CONTAINER='${landoConfig.phpService}' VSCODE_LANDO_EXEC_CWD='${workingDir}' ${phpWrapperPath}"`
        );
      } else {
        terminal.sendText(`set VSCODE_LANDO_PHP_CONTAINER=${landoConfig.phpService}`);
        terminal.sendText(`set VSCODE_LANDO_EXEC_CWD=${workingDir}`);
        terminal.sendText(`doskey php=${phpWrapperPath} $*`);
      }
    }, 100);
  });

  context.subscriptions.push(terminalCreateListener);

  outputChannel.appendLine(`PHP wrapper path: ${phpWrapperPath}`);
  outputChannel.appendLine(`Container name: ${landoConfig.phpContainer}`);
  outputChannel.appendLine(`Working directory: ${workingDir}`);
}
