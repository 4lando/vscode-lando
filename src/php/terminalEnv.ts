/**
 * Terminal Environment Configuration for PHP
 * 
 * This module handles VS Code terminal environment settings to enable
 * PHP command interception via the Lando PHP wrapper.
 * 
 * @module php/terminalEnv
 */

import * as vscode from "vscode";
import * as path from "path";
import { LandoConfig, OriginalPhpSettings } from "../types";

/**
 * Configures terminal environment settings to enable PHP command interception.
 * This modifies VS Code's terminal.integrated.env.* settings to:
 * 1. Prepend the extension's bin directory to PATH (so `php` resolves to our wrapper)
 * 2. Set VSCODE_LANDO_PHP_CONTAINER and VSCODE_LANDO_EXEC_CWD environment variables
 * 
 * This approach ensures ALL terminals (including task terminals) automatically use
 * the Lando PHP wrapper without requiring manual setup or command modification.
 * 
 * @param extensionPath - The extension's installation path
 * @param landoConfig - The parsed Lando configuration
 * @param workingDir - The working directory inside the container
 * @param originalSettings - Object to store original settings for restoration
 * @param outputChannel - Output channel for logging
 */
export async function configureTerminalEnvironment(
  extensionPath: string,
  landoConfig: LandoConfig,
  workingDir: string,
  originalSettings: OriginalPhpSettings,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const binDir = path.join(extensionPath, "bin");
  const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
  
  // Helper function to configure environment for a specific platform
  const configureForPlatform = async (
    platform: "linux" | "osx" | "windows",
    pathSeparator: string,
    pathEnvVar: string
  ) => {
    const envKey = `env.${platform}` as const;
    const currentEnv = terminalConfig.get<Record<string, string | null>>(envKey) || {};
    
    // Store original settings
    if (platform === "linux") {
      originalSettings.terminalEnvLinux = { ...currentEnv };
    } else if (platform === "osx") {
      originalSettings.terminalEnvOsx = { ...currentEnv };
    } else {
      originalSettings.terminalEnvWindows = { ...currentEnv };
    }
    
    // Build new environment with our additions
    const newEnv: Record<string, string | null> = { ...currentEnv };
    
    // Prepend our bin directory to PATH (only if not already present)
    const currentPath = currentEnv[pathEnvVar] || `\${env:${pathEnvVar}}`;
    const alreadyHasBinDir = currentPath.startsWith(binDir + pathSeparator) || currentPath === binDir;
    newEnv[pathEnvVar] = alreadyHasBinDir ? currentPath : `${binDir}${pathSeparator}${currentPath}`;
    
    // Set Lando environment variables
    newEnv["VSCODE_LANDO_PHP_CONTAINER"] = landoConfig.phpContainer;
    newEnv["VSCODE_LANDO_EXEC_CWD"] = workingDir;
    
    await terminalConfig.update(envKey, newEnv, vscode.ConfigurationTarget.Workspace);
    outputChannel.appendLine(`Configured terminal environment for ${platform}: PATH prepended with ${binDir}`);
  };
  
  // Configure for all platforms (VS Code will use the appropriate one)
  await configureForPlatform("linux", ":", "PATH");
  await configureForPlatform("osx", ":", "PATH");
  await configureForPlatform("windows", ";", "Path");
  
  // Store binDir for cleanup
  originalSettings.binDir = binDir;
  
  outputChannel.appendLine("Terminal environment configured for PHP interception");
}

/**
 * Restores the original terminal environment settings that were modified
 * by configureTerminalEnvironment()
 * 
 * @param originalSettings - The stored original settings
 * @param outputChannel - Output channel for logging
 */
export async function restoreTerminalEnvironment(
  originalSettings: OriginalPhpSettings | undefined,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  if (!originalSettings) {
    return;
  }
  
  const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
  
  // Restore each platform's environment settings
  if (originalSettings.terminalEnvLinux !== undefined) {
    // If the original value was empty/undefined, we need to set it to undefined to remove it
    const value = Object.keys(originalSettings.terminalEnvLinux).length === 0 
      ? undefined 
      : originalSettings.terminalEnvLinux;
    await terminalConfig.update("env.linux", value, vscode.ConfigurationTarget.Workspace);
    outputChannel.appendLine("Restored terminal.integrated.env.linux");
  }
  
  if (originalSettings.terminalEnvOsx !== undefined) {
    const value = Object.keys(originalSettings.terminalEnvOsx).length === 0 
      ? undefined 
      : originalSettings.terminalEnvOsx;
    await terminalConfig.update("env.osx", value, vscode.ConfigurationTarget.Workspace);
    outputChannel.appendLine("Restored terminal.integrated.env.osx");
  }
  
  if (originalSettings.terminalEnvWindows !== undefined) {
    const value = Object.keys(originalSettings.terminalEnvWindows).length === 0 
      ? undefined 
      : originalSettings.terminalEnvWindows;
    await terminalConfig.update("env.windows", value, vscode.ConfigurationTarget.Workspace);
    outputChannel.appendLine("Restored terminal.integrated.env.windows");
  }
  
  outputChannel.appendLine("Terminal environment settings restored");
}
