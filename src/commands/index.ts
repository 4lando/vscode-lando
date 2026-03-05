/**
 * Commands Module
 * 
 * This module aggregates all command registration functions and provides
 * a single entry point for registering all commands.
 * 
 * @module commands
 */

import * as vscode from "vscode";
import { CommandDependencies, LandoConfig } from "../types";
import { registerLifecycleCommands } from "./lifecycle";
import { registerUrlCommands } from "./urls";
import { registerTerminalCommands } from "./terminal";
import { registerToolingCommands } from "./tooling";
import { registerAppSelectionCommands } from "./appSelection";
import { registerDocumentationCommands } from "./documentation";
import { registerInitCommands } from "./init";
import { registerPhpCommands } from "../php/commands";

// Re-export individual registration functions for granular control
export { registerLifecycleCommands } from "./lifecycle";
export { registerUrlCommands } from "./urls";
export { registerTerminalCommands } from "./terminal";
export { registerToolingCommands } from "./tooling";
export { registerAppSelectionCommands } from "./appSelection";
export { registerDocumentationCommands } from "./documentation";
export { registerInitCommands } from "./init";

/**
 * Registers all Lando commands that don't require PHP integration
 * @param context - The extension context
 * @param deps - Command dependencies
 */
export function registerAllCommands(
  context: vscode.ExtensionContext,
  deps: CommandDependencies
): void {
  // Register app selection commands (select app, rescan, refresh status)
  registerAppSelectionCommands(context, deps);
  
  // Register lifecycle commands (start, stop, restart, rebuild, destroy, powerOff)
  registerLifecycleCommands(context, deps);
  
  // Register URL commands (open, copy)
  registerUrlCommands(context, deps);
  
  // Register terminal commands (open terminal, view logs)
  registerTerminalCommands(context, deps);
  
  // Register tooling commands (run tooling, run lando)
  registerToolingCommands(context, deps);
  
  // Register documentation command
  registerDocumentationCommands(context, deps.getActiveApp, deps.outputChannel);
  
  // Register init command (create new app)
  registerInitCommands(context, deps.appDetector, deps.outputChannel);
}

/**
 * Registers all Lando commands including PHP integration
 * @param context - The extension context
 * @param deps - Command dependencies
 * @param workspaceFolder - The workspace folder path
 * @param landoConfig - The parsed Lando configuration
 */
export function registerAllCommandsWithPhp(
  context: vscode.ExtensionContext,
  deps: CommandDependencies,
  workspaceFolder: string,
  landoConfig: LandoConfig
): void {
  // Register all non-PHP commands
  registerAllCommands(context, deps);
  
  // Register PHP-specific commands
  registerPhpCommands(context, workspaceFolder, landoConfig, deps.outputChannel);
}
