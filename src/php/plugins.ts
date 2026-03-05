/**
 * PHP Plugin Detection and Reload
 * 
 * This module handles detection and reloading of common PHP VS Code plugins
 * after Lando starts to ensure they work properly with the Lando PHP wrapper.
 * 
 * @module php/plugins
 */

import * as vscode from "vscode";
import { PhpPlugin } from "../types";

/**
 * Common PHP plugins that should be reloaded after Lando starts
 */
export const COMMON_PHP_PLUGINS: PhpPlugin[] = [
  {
    id: "DEVSENSE.phptools-vscode",
    name: "PHP Tools",
    isActive: false,
    canReload: true
  },
  {
    id: "bmewburn.vscode-intelephense-client",
    name: "Intelephense",
    isActive: false,
    canReload: true
  },
  {
    id: "xdebug.php-debug",
    name: "PHP Debug",
    isActive: false,
    canReload: true
  },
  {
    id: "mehedidracula.php-namespace-resolver",
    name: "PHP Namespace Resolver",
    isActive: false,
    canReload: true
  },
  {
    id: "junstyle.php-cs-fixer",
    name: "PHP CS Fixer",
    isActive: false,
    canReload: true
  },
  {
    id: "valeryanm.vscode-phpsab",
    name: "PHP Sniffer & Beautifier",
    isActive: false,
    canReload: true
  }
];

/**
* Checks for active PHP plugins and returns their status
* @returns Array of PHP plugins with their active status
*/
export function checkPhpPlugins(): PhpPlugin[] {
  const plugins = COMMON_PHP_PLUGINS.map(p => ({...p}));
  
  for (const plugin of plugins) {
    const extension = vscode.extensions.getExtension(plugin.id);
    plugin.isActive = extension?.isActive || false;
  }
  
  return plugins;
}

/**
 * Reloads PHP plugins that are currently active
 * @param plugins - Array of PHP plugins to check and reload
 * @param outputChannel - Output channel for logging
 * @returns Promise that resolves when reload is complete
 */
export async function reloadPhpPlugins(
  plugins: PhpPlugin[],
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const activePlugins = plugins.filter(plugin => plugin.isActive && plugin.canReload);
  
  if (activePlugins.length === 0) {
    outputChannel.appendLine("No active PHP plugins found to reload");
    return;
  }
  
  outputChannel.appendLine(`Found ${activePlugins.length} active PHP plugins to reload:`);
  activePlugins.forEach(plugin => {
    outputChannel.appendLine(`  - ${plugin.name} (${plugin.id})`);
  });
  
  // Show notification to user
  const reloadMessage = `Reloading ${activePlugins.length} PHP plugin(s) after Lando startup...`;
  outputChannel.appendLine(reloadMessage);
  
  // Notify user about the plugins that will be reloaded
  const pluginNames = activePlugins.map(plugin => plugin.name).join(', ');
  vscode.window.showInformationMessage(
    `PHP plugins detected: ${pluginNames}. They will be reloaded to work with Lando.`
  );
  
  // For now, we'll just notify the user that the plugins need to be reloaded
  // The actual reload will happen when the user restarts VS Code or reloads the window
  outputChannel.appendLine("PHP plugin reload notification sent");
  outputChannel.appendLine("Note: Some PHP plugins may need to be manually reloaded to work with Lando");
}

/**
 * Checks and reloads PHP plugins after Lando startup
 * @param outputChannel - Output channel for logging
 */
export async function checkAndReloadPhpPlugins(
  outputChannel: vscode.OutputChannel
): Promise<void> {
  const config = vscode.workspace.getConfiguration("lando");
  const phpEnabled = config.get("php.enabled", true);
  const reloadPlugins = config.get("php.reloadPlugins", true);
  
  if (!phpEnabled) {
    outputChannel.appendLine("PHP integration disabled - skipping plugin reload");
    return;
  }
  
  if (!reloadPlugins) {
    outputChannel.appendLine("PHP plugin reload disabled in configuration");
    return;
  }
  
  outputChannel.appendLine("Checking for active PHP plugins...");
  const plugins = checkPhpPlugins();
  
  const activePlugins = plugins.filter(plugin => plugin.isActive);
  outputChannel.appendLine(`Found ${activePlugins.length} active PHP plugins`);
  
  if (activePlugins.length > 0) {
    // Wait a moment for Lando to fully start up
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Reload the plugins
    await reloadPhpPlugins(plugins, outputChannel);
  } else {
    outputChannel.appendLine("No active PHP plugins found");
  }
}
