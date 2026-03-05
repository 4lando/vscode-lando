/**
 * Lando VS Code Extension
 * 
 * This is the main entry point for the Lando VS Code extension.
 * It handles activation, deactivation, and wiring up all the modules.
 * 
 * @module extension
 */

import * as vscode from "vscode";
import { activateShellDecorations } from "./shellDecorations";
import { activateLandofileLanguageFeatures } from "./landofileLanguageFeatures";
import { registerYamlReferenceProvider } from "./yamlReferenceProvider";
import { LandoAppDetector, LandoApp } from "./landoAppDetector";
import { 
  LandoStatusMonitor, 
  LandoAppState,
  isStateRunning,
  isStateBusy,
  getStateLabel,
} from "./landoStatusMonitor";
import { LandoTreeDataProvider } from "./landoTreeDataProvider";
import { CommandDependencies, convertAppToConfig } from "./types";
import { registerAllCommands, registerAllCommandsWithPhp } from "./commands";
import { 
  setupDockerMode, 
  restoreOriginalPhpSettings, 
  checkAndReloadPhpPlugins 
} from "./php";
import { checkLandoStatus, startLando } from "./helpers/lando";

// Global output channel for logging
let outputChannel: vscode.OutputChannel;

/**
 * Status bar item for Landofile (YAML)
 */
let landoStatusBarItem: vscode.StatusBarItem | undefined;

/**
 * Status bar item for detected Lando apps
 */
let landoAppsStatusBarItem: vscode.StatusBarItem | undefined;

/**
 * Global Lando app detector instance
 */
let landoAppDetector: LandoAppDetector | undefined;

/**
 * Global Lando status monitor instance
 */
let landoStatusMonitor: LandoStatusMonitor | undefined;

/**
 * Global Lando TreeView provider instance
 */
let landoTreeDataProvider: LandoTreeDataProvider | undefined;

/**
 * Currently selected/active Lando app
 */
let activeLandoApp: LandoApp | undefined;

/**
 * Updates the Landofile status bar item based on the active editor
 */
function updateLandoStatusBarItem(editor: vscode.TextEditor | undefined) {
  if (!editor) {
    landoStatusBarItem?.hide();
    return;
  }
  const fileName = editor.document.fileName.split(/[\\/]/).pop() || '';
  if (fileName.match(/^\.lando(\..+)?\.yml$/) && editor.document.languageId === 'landofile') {
    landoStatusBarItem!.text = 'Landofile';
    landoStatusBarItem!.tooltip = 'Lando Landofile';
    landoStatusBarItem!.show();
  } else {
    landoStatusBarItem?.hide();
  }
}

/**
 * Sets the active Lando app and updates context for menu visibility
 */
function setActiveLandoApp(app: LandoApp | undefined): void {
  activeLandoApp = app;
  
  // Set context for 'when' clauses in menus
  vscode.commands.executeCommand('setContext', 'lando:hasActiveApp', app !== undefined);
  
  updateLandoAppsStatusBar();
  
  if (app) {
    outputChannel.appendLine(`Active Lando app set to: ${app.name} (${app.configPath})`);
  } else {
    outputChannel.appendLine('No active Lando app');
  }
}

/**
 * Gets the currently active Lando app
 */
function getActiveLandoApp(): LandoApp | undefined {
  return activeLandoApp;
}

/**
 * Sets up the status bar item for detected Lando apps
 */
function setupLandoAppsStatusBar(context: vscode.ExtensionContext): void {
  landoAppsStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    99 // Just after the Landofile status bar
  );
  landoAppsStatusBarItem.command = 'extension.selectLandoApp';
  context.subscriptions.push(landoAppsStatusBarItem);
  updateLandoAppsStatusBar();
}

/**
 * Updates the Lando apps status bar item and context values for menu visibility
 */
function updateLandoAppsStatusBar(): void {
  if (!landoAppsStatusBarItem || !landoAppDetector) {
    return;
  }

  const appCount = landoAppDetector.getAppCount();
  
  // Set context for 'when' clauses in menus
  vscode.commands.executeCommand('setContext', 'lando:hasApps', appCount > 0);
  
  if (appCount === 0) {
    vscode.commands.executeCommand('setContext', 'lando:appRunning', false);
    landoAppsStatusBarItem.hide();
    return;
  }

  if (activeLandoApp) {
    // Get status from the status monitor
    const status = landoStatusMonitor?.getStatus(activeLandoApp);
    const appState = status?.state ?? LandoAppState.Unknown;
    const isRunning = isStateRunning(appState);
    const isBusy = isStateBusy(appState);
    
    // Set context for 'when' clauses in menus
    vscode.commands.executeCommand('setContext', 'lando:appRunning', isRunning);
    vscode.commands.executeCommand('setContext', 'lando:appBusy', isBusy);
    vscode.commands.executeCommand('setContext', 'lando:appState', appState);
    
    // Use different icons for different states
    let icon = '$(debug-stop)';
    if (isRunning) {
      icon = '$(debug-start)';
    } else if (isBusy) {
      icon = '$(sync~spin)';
    }
    
    const statusText = getStateLabel(appState);
    
    landoAppsStatusBarItem.text = `${icon} ${activeLandoApp.name}`;
    
    // Set color based on status
    landoAppsStatusBarItem.backgroundColor = isRunning 
      ? undefined 
      : isBusy
        ? new vscode.ThemeColor('statusBarItem.prominentBackground')
        : new vscode.ThemeColor('statusBarItem.warningBackground');
    
    // Build tooltip with status information
    let tooltip = `Lando App: ${activeLandoApp.name}\n`;
    tooltip += `Status: ${statusText}`;
    if (status) {
      tooltip += ` (${status.runningContainers}/${status.totalContainers} containers)`;
    }
    tooltip += `\nPath: ${activeLandoApp.rootPath}`;
    if (appCount > 1) {
      tooltip += `\n\n${appCount} apps detected - Click to switch`;
    } else {
      tooltip += `\n\nClick to view options`;
    }
    landoAppsStatusBarItem.tooltip = tooltip;
  } else {
    // No active app selected
    vscode.commands.executeCommand('setContext', 'lando:appRunning', false);
    landoAppsStatusBarItem.text = `$(server) ${appCount} Lando app${appCount > 1 ? 's' : ''}`;
    landoAppsStatusBarItem.tooltip = `${appCount} Lando app${appCount > 1 ? 's' : ''} detected - Click to select`;
    landoAppsStatusBarItem.backgroundColor = undefined;
  }
  
  landoAppsStatusBarItem.show();
}

/**
 * Creates the command dependencies object
 */
function createCommandDependencies(): CommandDependencies {
  return {
    outputChannel,
    getActiveApp: getActiveLandoApp,
    setActiveApp: setActiveLandoApp,
    statusMonitor: landoStatusMonitor!,
    appDetector: landoAppDetector!,
  };
}

/**
 * Checks Lando status and starts if needed
 */
async function checkAndStartLando(
  workspaceFolder: string,
  context: vscode.ExtensionContext
): Promise<void> {
  const activeApp = activeLandoApp;
  if (!activeApp) {
    return;
  }
  
  const landoConfig = convertAppToConfig(activeApp);
  
  try {
    // Check if Lando app is running
    const isRunning = await checkLandoStatus(workspaceFolder, landoConfig.appName, outputChannel);
    
    if (isRunning) {
      outputChannel.appendLine("Lando app is running");
      await setupDockerMode(context, workspaceFolder, landoConfig, outputChannel);
      vscode.window.showInformationMessage(
        `Lando app ready (${landoConfig.appName})`
      );
      
      // Check and reload PHP plugins for already running Lando
      await checkAndReloadPhpPlugins(outputChannel);
    } else {
      outputChannel.appendLine("Lando app is not running - starting...");
      
      // Show notification that Lando is starting
      const notification = vscode.window.showInformationMessage(
        `Starting Lando (${landoConfig.appName})... This may take a few minutes.`,
        "Cancel"
      );

      // Start Lando
      const landoStarted = await startLando(workspaceFolder, outputChannel, notification);
      
      if (landoStarted) {
        outputChannel.appendLine("Lando started successfully");
        await setupDockerMode(context, workspaceFolder, landoConfig, outputChannel);
        vscode.window.showInformationMessage(
          `Lando app ready (${landoConfig.appName})`
        );
        
        // Check and reload PHP plugins after successful Lando startup
        await checkAndReloadPhpPlugins(outputChannel);
      } else {
        outputChannel.appendLine("Failed to start Lando");
        vscode.window.showErrorMessage(
          `Failed to start Lando (${landoConfig.appName})`
        );
      }
    }
  } catch (error: unknown) {
    outputChannel.appendLine(`Error checking/starting Lando: ${error}`);
    vscode.window.showErrorMessage("Error checking Lando status");
  }
}

/**
 * Activates the Lando extension
 * @param context - The extension context provided by VS Code
 */
export async function activate(context: vscode.ExtensionContext) {
  // Create output channel
  outputChannel = vscode.window.createOutputChannel("Lando");
  outputChannel.show(true); // Force reveal the output channel
  
  outputChannel.appendLine("=".repeat(50));
  outputChannel.appendLine("Lando extension is now active!");
  outputChannel.appendLine("=".repeat(50));

  // Activate YAML reference provider for anchor/alias navigation
  registerYamlReferenceProvider(context);

  // Activate shell decorations for Landofile files
  activateShellDecorations(context);

  // Activate Landofile language features and get schema provider
  const schemaProvider = activateLandofileLanguageFeatures(context);

  // Initialize the Lando app detector
  landoAppDetector = new LandoAppDetector();
  await landoAppDetector.activate(context, outputChannel);

  // Initialize the Lando status monitor
  landoStatusMonitor = new LandoStatusMonitor();
  await landoStatusMonitor.activate(context, outputChannel);
  
  // Set initial apps for the status monitor
  landoStatusMonitor.setApps(landoAppDetector.getApps());
  
  // Update status bar when status changes
  landoStatusMonitor.onDidChangeStatus(() => {
    updateLandoAppsStatusBar();
  });
  
  landoStatusMonitor.onDidUpdateStatuses(() => {
    updateLandoAppsStatusBar();
  });

  // Initialize the Lando TreeView provider
  landoTreeDataProvider = new LandoTreeDataProvider();
  landoTreeDataProvider.activate(context, landoAppDetector, landoStatusMonitor, outputChannel);

  // Set up status bar for detected apps
  setupLandoAppsStatusBar(context);

  // Listen for app detection changes
  landoAppDetector.onDidChangeApps(event => {
    // Update the status monitor with new apps list
    landoStatusMonitor?.setApps(event.apps);
    
    updateLandoAppsStatusBar();
    
    if (event.added.length > 0) {
      const names = event.added.map(a => a.name).join(', ');
      outputChannel.appendLine(`New Lando apps detected: ${names}`);
    }
    if (event.removed.length > 0) {
      const names = event.removed.map(a => a.name).join(', ');
      outputChannel.appendLine(`Lando apps removed: ${names}`);
    }

    // Auto-select the first app if none is selected
    if (!activeLandoApp && event.apps.length > 0) {
      setActiveLandoApp(landoAppDetector!.getPrimaryApp());
    }
    
    // Clear active app if it was removed
    if (activeLandoApp && event.removed.some(a => a.configPath === activeLandoApp?.configPath)) {
      setActiveLandoApp(landoAppDetector!.getPrimaryApp());
    }
  });

  // Set the initial active app
  const primaryApp = landoAppDetector.getPrimaryApp();
  if (primaryApp) {
    setActiveLandoApp(primaryApp);
  }

  // Get the workspace folder path (for backward compatibility)
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  if (!workspaceFolder) {
    outputChannel.appendLine("No workspace folder found");
    // Register basic commands when no workspace folder is found
    const deps = createCommandDependencies();
    registerAllCommands(context, deps);
    return { schemaProvider, appDetector: landoAppDetector };
  }

  outputChannel.appendLine(`Workspace folder: ${workspaceFolder}`);

  // Check if any Lando apps exist
  if (!landoAppDetector.hasApps()) {
    outputChannel.appendLine("No Lando apps detected - PHP integration will not activate");
    // Register basic commands when no .lando.yml is found
    const deps = createCommandDependencies();
    registerAllCommands(context, deps);
    return { schemaProvider, appDetector: landoAppDetector };
  }

  // Use the active app's configuration
  const activeApp = activeLandoApp;
  if (!activeApp) {
    outputChannel.appendLine("No active Lando app - PHP integration will not activate");
    const deps = createCommandDependencies();
    registerAllCommands(context, deps);
    return { schemaProvider, appDetector: landoAppDetector };
  }

  // Convert LandoApp to LandoConfig for backward compatibility
  const landoConfig = convertAppToConfig(activeApp);
  
  outputChannel.appendLine(`Active Lando app: ${landoConfig.appName}`);
  outputChannel.appendLine(`Container name: ${landoConfig.phpContainer}`);

  // Check Lando status and start if needed
  checkAndStartLando(activeApp.rootPath, context);
  
  // Register all commands including PHP integration
  const deps = createCommandDependencies();
  registerAllCommandsWithPhp(context, deps, activeApp.rootPath, landoConfig);
  
  // Register the Landofile status bar item
  landoStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(landoStatusBarItem);
  updateLandoStatusBarItem(vscode.window.activeTextEditor);
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateLandoStatusBarItem));
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(() => updateLandoStatusBarItem(vscode.window.activeTextEditor)));
  
  return { schemaProvider, appDetector: landoAppDetector };
}

/**
 * Deactivates the extension
 * Called when the extension is deactivated
 */
export async function deactivate(): Promise<void> {
  // Restore original PHP settings if they were changed
  if (outputChannel) {
    await restoreOriginalPhpSettings(outputChannel);
  }
  
  // Dispose of the status monitor
  if (landoStatusMonitor) {
    landoStatusMonitor.dispose();
    landoStatusMonitor = undefined;
  }
  
  // Dispose of the app detector
  if (landoAppDetector) {
    landoAppDetector.dispose();
    landoAppDetector = undefined;
  }
  
  // Clear active app reference
  activeLandoApp = undefined;
  
  if (outputChannel) {
    outputChannel.appendLine("Lando extension is now deactivated!");
    outputChannel.dispose();
  }
}
