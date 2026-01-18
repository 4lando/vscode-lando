import * as vscode from "vscode";
import * as childProcess from 'child_process';
import * as path from "path";
import * as fs from "fs";
import { activateShellDecorations } from "./shellDecorations";
import { activateLandofileLanguageFeatures } from "./landofileLanguageFeatures";
import { registerYamlReferenceProvider } from "./yamlReferenceProvider";
import { LandoAppDetector, LandoApp, LandoTooling } from "./landoAppDetector";
import { LandoStatusMonitor } from "./landoStatusMonitor";

/** Line ending for terminal output */
const CRLF = "\r\n";

// Global output channel for logging
let outputChannel: vscode.OutputChannel;

// Global storage for original PHP settings
interface OriginalPhpSettings {
  executablePath?: string;
  validateExecutablePath?: string;
  debugExecutablePath?: string;
  path?: string;
  binDir?: string;
}

let originalPhpSettings: OriginalPhpSettings | undefined;

/**
 * Interface for PHP plugin information
 */
interface PhpPlugin {
  id: string;
  name: string;
  isActive: boolean;
  canReload: boolean;
}

/**
 * Common PHP plugins that should be reloaded after Lando starts
 */
const COMMON_PHP_PLUGINS: PhpPlugin[] = [
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
 * Interface for Lando configuration
 */
interface LandoConfig {
  appName: string;
  cleanAppName: string;
  phpContainer: string;
  phpService: string;
}

interface ShellTaskDefinition extends vscode.TaskDefinition {
  command?: string;
  options?: {
    cwd?: string;
  };
}

/**
 * Parses Lando configuration from .lando.yml
 * @param workspaceFolder - The workspace folder path
 * @returns LandoConfig object or null if parsing fails
 */
function parseLandoConfig(workspaceFolder: string): LandoConfig | null {
  const landoFile = path.join(workspaceFolder, ".lando.yml");
  
  if (!fs.existsSync(landoFile)) {
    outputChannel.appendLine(".lando.yml not found");
    return null;
  }

  try {
    const landoContent = fs.readFileSync(landoFile, "utf8");
    
    // Parse the YAML-like content to extract the app name
    const nameMatch = landoContent.match(/^name:\s*(.+)$/m);
    if (!nameMatch) {
      outputChannel.appendLine("Could not find app name in .lando.yml");
      return null;
    }

    const appName = nameMatch[1].trim();
    outputChannel.appendLine(`Found app name: ${appName}`);

    // Clean the app name: remove dashes and underscores, make lowercase
    const cleanAppName = appName.replace(/[-_]/g, "").toLowerCase();
    outputChannel.appendLine(`Clean app name: ${cleanAppName}`);

    // Get the PHP service name from configuration
    const phpService = vscode.workspace.getConfiguration("lando").get("php.service", "appserver");
    outputChannel.appendLine(`PHP service: ${phpService}`);

    // Construct the container name
    const phpContainer = `${cleanAppName}_${phpService}_1`;
    outputChannel.appendLine(`Container name: ${phpContainer}`);

    return {
      appName,
      cleanAppName,
      phpService,
      phpContainer,
    };
  } catch (error: unknown) {
    outputChannel.appendLine(`Error parsing .lando.yml: ${error}`);
    return null;
  }
}

/**
 * Checks if Lando app is running
 * @param workspaceFolder - The workspace folder path
 * @param appName - The Lando app name
 * @returns Promise resolving to true if running, false otherwise
 */
async function checkLandoStatus(
  workspaceFolder: string,
  appName: string
): Promise<boolean> {
  try {
    const cleanAppName = appName.replace(/[-_]/g, "").toLowerCase();
    const command = `lando list --format=json --filter='app=${cleanAppName}'`;
    
    outputChannel.appendLine(`Checking Lando status: ${command}`);
    const result = childProcess.execSync(command, {
      cwd: workspaceFolder,
      encoding: "utf8",
      timeout: 10000,
    });

    const containers = JSON.parse(result);
    outputChannel.appendLine(
      `Lando containers: ${JSON.stringify(containers, null, 2)}`
    );

    // Check if any containers are running
    return containers.some((container: { running: boolean }) => container.running === true);
  } catch (error: unknown) {
    outputChannel.appendLine(`Error checking Lando status: ${error}`);
    return false;
  }
}

/**
 * Starts Lando app
 * @param workspaceFolder - The workspace folder path
 * @param notification - Optional notification promise for cancellation
 * @returns Promise resolving to true if started successfully, false otherwise
 */
async function startLando(
  workspaceFolder: string,
  notification?: Thenable<string | undefined>
): Promise<boolean> {
  return new Promise((resolve) => {
    outputChannel.appendLine("Starting Lando...");
    
    const landoProcess = childProcess.spawn("lando", ["start"], {
      cwd: workspaceFolder,
      stdio: "pipe",
    });

    let output = "";

    landoProcess.stdout.on("data", (data: Buffer) => {
      const message = data.toString();
      output += message;
      outputChannel.appendLine(`Lando output: ${message.trim()}`);
    });

    // Note: Many CLI tools (including Lando) output progress info to stderr,
    // so we log it but don't treat it as an error. Exit code is the source of truth.
    landoProcess.stderr.on("data", (data: Buffer) => {
      const message = data.toString();
      output += message;
      outputChannel.appendLine(`Lando stderr: ${message.trim()}`);
    });

    landoProcess.on("close", (code: number) => {
      outputChannel.appendLine(`Lando process exited with code ${code}`);
      
      // Use exit code as the sole indicator of success - stderr output is not an error indicator
      if (code === 0) {
        resolve(true);
      } else {
        outputChannel.appendLine(`Lando failed to start (exit code ${code}): ${output}`);
        resolve(false);
      }
    });

    landoProcess.on("error", (error: Error) => {
      outputChannel.appendLine(`Error starting Lando: ${error.message}`);
      resolve(false);
    });

    // Handle cancellation
    if (notification) {
      notification.then((selection) => {
        if (selection === "Cancel") {
          outputChannel.appendLine("Lando startup cancelled by user");
          landoProcess.kill();
          resolve(false);
        }
      });
    }
  });
}

/**
 * Stops Lando app
 * @param workspaceFolder - The workspace folder path
 * @param notification - Optional notification promise for cancellation
 * @returns Promise resolving to true if stopped successfully, false otherwise
 */
async function stopLando(
  workspaceFolder: string,
  notification?: Thenable<string | undefined>
): Promise<boolean> {
  return new Promise((resolve) => {
    outputChannel.appendLine("Stopping Lando...");
    
    const landoProcess = childProcess.spawn("lando", ["stop"], {
      cwd: workspaceFolder,
      stdio: "pipe",
    });

    let output = "";

    landoProcess.stdout.on("data", (data: Buffer) => {
      const message = data.toString();
      output += message;
      outputChannel.appendLine(`Lando output: ${message.trim()}`);
    });

    // Note: Many CLI tools (including Lando) output progress info to stderr,
    // so we log it but don't treat it as an error. Exit code is the source of truth.
    landoProcess.stderr.on("data", (data: Buffer) => {
      const message = data.toString();
      output += message;
      outputChannel.appendLine(`Lando stderr: ${message.trim()}`);
    });

    landoProcess.on("close", (code: number) => {
      outputChannel.appendLine(`Lando process exited with code ${code}`);
      
      // Use exit code as the sole indicator of success - stderr output is not an error indicator
      if (code === 0) {
        resolve(true);
      } else {
        outputChannel.appendLine(`Lando failed to stop (exit code ${code}): ${output}`);
        resolve(false);
      }
    });

    landoProcess.on("error", (error: Error) => {
      outputChannel.appendLine(`Error stopping Lando: ${error.message}`);
      resolve(false);
    });

    // Handle cancellation
    if (notification) {
      notification.then((selection) => {
        if (selection === "Cancel") {
          outputChannel.appendLine("Lando stop cancelled by user");
          landoProcess.kill();
          resolve(false);
        }
      });
    }
  });
}

/**
 * Represents a URL exposed by a Lando service
 */
interface LandoServiceUrl {
  /** The service name (e.g., 'appserver', 'database') */
  service: string;
  /** The full URL */
  url: string;
  /** Whether this is the primary URL for the service */
  primary: boolean;
}

/**
 * Gets the URLs exposed by a Lando app
 * @param workspaceFolder - The workspace folder path
 * @returns Promise resolving to array of service URLs
 */
async function getLandoUrls(workspaceFolder: string): Promise<LandoServiceUrl[]> {
  const urls: LandoServiceUrl[] = [];
  
  try {
    const result = childProcess.execSync('lando info --format=json', {
      cwd: workspaceFolder,
      encoding: 'utf8',
      timeout: 15000,
    });

    const services = JSON.parse(result) as Array<{
      service: string;
      urls?: string[];
    }>;

    for (const service of services) {
      if (service.urls && service.urls.length > 0) {
        // First URL is considered primary
        service.urls.forEach((url, index) => {
          urls.push({
            service: service.service,
            url,
            primary: index === 0
          });
        });
      }
    }

    outputChannel.appendLine(`Found ${urls.length} URL(s) for Lando app`);
  } catch (error: unknown) {
    outputChannel.appendLine(`Error getting Lando URLs: ${error}`);
  }

  return urls;
}

/**
 * Gets the primary URL for a Lando app (first URL of the first service with URLs)
 * @param workspaceFolder - The workspace folder path
 * @returns Promise resolving to the primary URL or undefined
 */
async function getPrimaryLandoUrl(workspaceFolder: string): Promise<string | undefined> {
  const urls = await getLandoUrls(workspaceFolder);
  // Return the first primary URL (typically the appserver)
  const primary = urls.find(u => u.primary);
  return primary?.url;
}

/**
 * Represents a Lando service
 */
interface LandoService {
  /** The service name (e.g., 'appserver', 'database') */
  name: string;
  /** The service type (e.g., 'php', 'mysql') */
  type: string;
}

/**
 * Gets the services defined in a Lando app
 * @param workspaceFolder - The workspace folder path
 * @returns Promise resolving to array of services
 */
async function getLandoServices(workspaceFolder: string): Promise<LandoService[]> {
  const services: LandoService[] = [];
  
  try {
    const result = childProcess.execSync('lando info --format=json', {
      cwd: workspaceFolder,
      encoding: 'utf8',
      timeout: 15000,
    });

    const serviceData = JSON.parse(result) as Array<{
      service: string;
      type?: string;
    }>;

    for (const service of serviceData) {
      services.push({
        name: service.service,
        type: service.type || 'unknown'
      });
    }

    outputChannel.appendLine(`Found ${services.length} service(s) for Lando app`);
  } catch (error: unknown) {
    outputChannel.appendLine(`Error getting Lando services: ${error}`);
  }

  return services;
}

/**
 * Gets default tooling commands provided by Lando recipes
 * @param recipe - The recipe type (e.g., 'drupal10', 'wordpress', 'lamp')
 * @returns Array of default tooling commands for the recipe
 */
function getRecipeDefaultTooling(recipe?: string): LandoTooling[] {
  if (!recipe) {
    return [];
  }

  const defaultTooling: LandoTooling[] = [];

  // Common tooling across most recipes
  const commonTooling: LandoTooling[] = [
    { name: 'php', service: 'appserver', description: 'Run PHP commands', isCustom: false },
    { name: 'composer', service: 'appserver', description: 'Run Composer commands', isCustom: false },
  ];

  // Recipe-specific tooling
  const recipeLower = recipe.toLowerCase();

  if (recipeLower.startsWith('drupal') || recipeLower === 'backdrop') {
    defaultTooling.push(
      { name: 'drush', service: 'appserver', description: 'Run Drush commands', isCustom: false }
    );
  }

  if (recipeLower === 'wordpress') {
    defaultTooling.push(
      { name: 'wp', service: 'appserver', description: 'Run WP-CLI commands', isCustom: false }
    );
  }

  if (recipeLower === 'laravel') {
    defaultTooling.push(
      { name: 'artisan', service: 'appserver', description: 'Run Laravel Artisan commands', isCustom: false }
    );
  }

  if (recipeLower === 'symfony') {
    defaultTooling.push(
      { name: 'console', service: 'appserver', description: 'Run Symfony console commands', isCustom: false }
    );
  }

  if (recipeLower.includes('node') || recipeLower === 'mean' || recipeLower === 'lamp' || recipeLower === 'lemp') {
    defaultTooling.push(
      { name: 'node', service: 'appserver', description: 'Run Node.js commands', isCustom: false },
      { name: 'npm', service: 'appserver', description: 'Run npm commands', isCustom: false },
      { name: 'yarn', service: 'appserver', description: 'Run Yarn commands', isCustom: false }
    );
  }

  // Add MySQL/MariaDB tooling if likely present
  if (['lamp', 'lemp', 'drupal', 'drupal7', 'drupal8', 'drupal9', 'drupal10', 'drupal11', 
       'wordpress', 'laravel', 'symfony', 'backdrop', 'joomla', 'magento2', 'pantheon'].includes(recipeLower)) {
    defaultTooling.push(
      { name: 'mysql', service: 'database', description: 'Run MySQL commands', isCustom: false }
    );
  }

  return [...commonTooling, ...defaultTooling];
}

/**
 * Runs a Lando tooling command in a terminal
 * @param app - The Lando app to run the command in
 * @param command - The tooling command name
 * @param args - Optional arguments to pass to the command
 */
async function runLandoToolingCommand(
  app: LandoApp,
  command: string,
  args?: string
): Promise<void> {
  // Build the full command
  let fullCommand = `lando ${command}`;
  if (args && args.trim()) {
    fullCommand += ` ${args.trim()}`;
  }

  outputChannel.appendLine(`Running tooling command: ${fullCommand}`);

  // Create a terminal for the command
  const terminalName = `Lando: ${command}`;
  
  // Check if there's already a terminal with this name
  const existingTerminal = vscode.window.terminals.find(t => t.name === terminalName);
  
  const terminal = existingTerminal || vscode.window.createTerminal({
    name: terminalName,
    cwd: app.rootPath,
  });

  // Send the command
  terminal.sendText(fullCommand);
  terminal.show();
}

/**
 * Restarts Lando app
 * @param workspaceFolder - The workspace folder path
 * @param notification - Optional notification promise for cancellation
 * @returns Promise resolving to true if restarted successfully, false otherwise
 */
async function restartLando(
  workspaceFolder: string,
  notification?: Thenable<string | undefined>
): Promise<boolean> {
  return new Promise((resolve) => {
    outputChannel.appendLine("Restarting Lando...");
    
    const landoProcess = childProcess.spawn("lando", ["restart"], {
      cwd: workspaceFolder,
      stdio: "pipe",
    });

    let output = "";

    landoProcess.stdout.on("data", (data: Buffer) => {
      const message = data.toString();
      output += message;
      outputChannel.appendLine(`Lando output: ${message.trim()}`);
    });

    // Note: Many CLI tools (including Lando) output progress info to stderr,
    // so we log it but don't treat it as an error. Exit code is the source of truth.
    landoProcess.stderr.on("data", (data: Buffer) => {
      const message = data.toString();
      output += message;
      outputChannel.appendLine(`Lando stderr: ${message.trim()}`);
    });

    landoProcess.on("close", (code: number) => {
      outputChannel.appendLine(`Lando process exited with code ${code}`);
      
      // Use exit code as the sole indicator of success - stderr output is not an error indicator
      if (code === 0) {
        resolve(true);
      } else {
        outputChannel.appendLine(`Lando failed to restart (exit code ${code}): ${output}`);
        resolve(false);
      }
    });

    landoProcess.on("error", (error: Error) => {
      outputChannel.appendLine(`Error restarting Lando: ${error.message}`);
      resolve(false);
    });

    // Handle cancellation
    if (notification) {
      notification.then((selection) => {
        if (selection === "Cancel") {
          outputChannel.appendLine("Lando restart cancelled by user");
          landoProcess.kill();
          resolve(false);
        }
      });
    }
  });
}

/**
 * Gets the path to the PHP wrapper script
 * @returns The path to the appropriate PHP wrapper script
 */
function getPhpWrapperPath(): string {
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
 * Checks for active PHP plugins and returns their status
 * @returns Array of PHP plugins with their active status
 */
function checkPhpPlugins(): PhpPlugin[] {
  const plugins = [...COMMON_PHP_PLUGINS];
  
  for (const plugin of plugins) {
    const extension = vscode.extensions.getExtension(plugin.id);
    plugin.isActive = extension?.isActive || false;
  }
  
  return plugins;
}

/**
 * Reloads PHP plugins that are currently active
 * @param plugins - Array of PHP plugins to check and reload
 * @returns Promise that resolves when reload is complete
 */
async function reloadPhpPlugins(plugins: PhpPlugin[]): Promise<void> {
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
 */
async function checkAndReloadPhpPlugins(): Promise<void> {
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
    await reloadPhpPlugins(plugins);
  } else {
    outputChannel.appendLine("No active PHP plugins found");
  }
}

/**
 * Overrides PHP executable paths in VS Code configuration
 * @param phpWrapperPath - Path to the PHP wrapper script
 * @param phpContainer - Docker container name
 * @param workingDir - Working directory inside container
 */
async function overridePhpExecutablePath(
  phpWrapperPath: string,
  phpContainer: string,
  workingDir: string
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
  originalPhpSettings = {
    executablePath: originalExecutablePath as string | undefined,
    validateExecutablePath: originalValidatePath as string | undefined,
    debugExecutablePath: originalDebugPath as string | undefined,
    path: originalPath,
    binDir: binDir,
  };
}



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
 * Currently selected/active Lando app
 */
let activeLandoApp: LandoApp | undefined;

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

  // Set up status bar for detected apps
  setupLandoAppsStatusBar(context);

  // Register app detection commands
  registerAppDetectionCommands(context);

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
    registerBasicCommands(context);
    return { schemaProvider, appDetector: landoAppDetector };
  }

  outputChannel.appendLine(`Workspace folder: ${workspaceFolder}`);

  // Check if .lando.yml exists (using detector)
  if (!landoAppDetector.hasApps()) {
    outputChannel.appendLine("No Lando apps detected - PHP integration will not activate");
    // Register basic commands when no .lando.yml is found
    registerBasicCommands(context);
    return { schemaProvider, appDetector: landoAppDetector };
  }

  // Use the active app's configuration
  const activeApp = activeLandoApp;
  if (!activeApp) {
    outputChannel.appendLine("No active Lando app - PHP integration will not activate");
    registerBasicCommands(context);
    return { schemaProvider, appDetector: landoAppDetector };
  }

  // Convert LandoApp to LandoConfig for backward compatibility
  const landoConfig = convertAppToConfig(activeApp);
  
  outputChannel.appendLine(`Active Lando app: ${landoConfig.appName}`);
  outputChannel.appendLine(`Container name: ${landoConfig.phpContainer}`);

  // Check Lando status and start if needed
  checkAndStartLando(activeApp.rootPath, landoConfig, context);
  
  // Register all commands
  registerAllCommands(context, activeApp.rootPath, landoConfig);
  
  // Register the Landofile status bar item
  landoStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(landoStatusBarItem);
  updateLandoStatusBarItem(vscode.window.activeTextEditor);
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateLandoStatusBarItem));
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(() => updateLandoStatusBarItem(vscode.window.activeTextEditor)));
  
  return { schemaProvider, appDetector: landoAppDetector };
}

/**
 * Converts a LandoApp to LandoConfig for backward compatibility
 */
function convertAppToConfig(app: LandoApp): LandoConfig {
  const phpService = vscode.workspace.getConfiguration("lando").get("php.service", "appserver");
  return {
    appName: app.name,
    cleanAppName: app.cleanName,
    phpService,
    phpContainer: `${app.cleanName}_${phpService}_1`
  };
}

/**
 * Sets the active Lando app
 */
function setActiveLandoApp(app: LandoApp | undefined): void {
  activeLandoApp = app;
  updateLandoAppsStatusBar();
  
  if (app) {
    outputChannel.appendLine(`Active Lando app set to: ${app.name} (${app.configPath})`);
  } else {
    outputChannel.appendLine('No active Lando app');
  }
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
 * Updates the Lando apps status bar item
 */
function updateLandoAppsStatusBar(): void {
  if (!landoAppsStatusBarItem || !landoAppDetector) {
    return;
  }

  const appCount = landoAppDetector.getAppCount();
  
  if (appCount === 0) {
    landoAppsStatusBarItem.hide();
    return;
  }

  if (activeLandoApp) {
    // Get status from the status monitor
    const status = landoStatusMonitor?.getStatus(activeLandoApp);
    const isRunning = status?.running ?? false;
    
    // Use different icons for running vs stopped
    const icon = isRunning ? '$(debug-start)' : '$(debug-stop)';
    const statusText = isRunning ? 'Running' : 'Stopped';
    
    landoAppsStatusBarItem.text = `${icon} ${activeLandoApp.name}`;
    
    // Set color based on status
    landoAppsStatusBarItem.backgroundColor = isRunning 
      ? undefined 
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
    landoAppsStatusBarItem.text = `$(server) ${appCount} Lando app${appCount > 1 ? 's' : ''}`;
    landoAppsStatusBarItem.tooltip = `${appCount} Lando app${appCount > 1 ? 's' : ''} detected - Click to select`;
    landoAppsStatusBarItem.backgroundColor = undefined;
  }
  
  landoAppsStatusBarItem.show();
}

/**
 * Registers commands for Lando app detection
 */
function registerAppDetectionCommands(context: vscode.ExtensionContext): void {
  // Command to select a Lando app or show quick actions
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.selectLandoApp', async () => {
      if (!landoAppDetector) {
        vscode.window.showErrorMessage('Lando app detector not initialized');
        return;
      }

      const apps = landoAppDetector.getApps();
      
      if (apps.length === 0) {
        vscode.window.showInformationMessage('No Lando apps detected in workspace');
        return;
      }

      // Build quick actions menu
      interface QuickActionItem extends vscode.QuickPickItem {
        action?: 'start' | 'stop' | 'restart' | 'refresh' | 'switch' | 'openUrl' | 'copyUrl' | 'viewLogs' | 'runTooling';
        app?: LandoApp;
      }

      // Auto-select if there's exactly one app and no active app set
      if (!activeLandoApp && apps.length === 1) {
        setActiveLandoApp(apps[0]);
      }

      const items: QuickActionItem[] = [];
      
      if (activeLandoApp) {
        const status = landoStatusMonitor?.getStatus(activeLandoApp);
        const isRunning = status?.running ?? false;
        
        // Show contextual actions based on status
        if (isRunning) {
          items.push({
            label: '$(link-external) Open in Browser',
            description: `Open ${activeLandoApp.name} URL`,
            action: 'openUrl'
          });
          items.push({
            label: '$(copy) Copy URL',
            description: `Copy ${activeLandoApp.name} URL to clipboard`,
            action: 'copyUrl'
          });
          items.push({
            label: '$(output) View Logs',
            description: `View ${activeLandoApp.name} logs`,
            action: 'viewLogs'
          });
          items.push({
            label: '$(debug-stop) Stop',
            description: `Stop ${activeLandoApp.name}`,
            action: 'stop'
          });
          items.push({
            label: '$(debug-restart) Restart',
            description: `Restart ${activeLandoApp.name}`,
            action: 'restart'
          });
          // Show tooling option if tooling is available
          const hasTooling = (activeLandoApp.tooling && activeLandoApp.tooling.length > 0) ||
                             getRecipeDefaultTooling(activeLandoApp.recipe).length > 0;
          if (hasTooling) {
            items.push({
              label: '$(terminal) Run Tooling',
              description: `Run tooling commands (drush, composer, etc.)`,
              action: 'runTooling'
            });
          }
        } else {
          items.push({
            label: '$(debug-start) Start',
            description: `Start ${activeLandoApp.name}`,
            action: 'start'
          });
        }
        
        items.push({
          label: '$(refresh) Refresh Status',
          description: 'Refresh the current status',
          action: 'refresh'
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

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: activeLandoApp ? `${activeLandoApp.name} - Select an action` : 'Select a Lando app',
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
            setActiveLandoApp(selectedApp.app);
            vscode.window.showInformationMessage(`Active Lando app: ${selectedApp.app.name}`);
          }
          break;
      }
    })
  );

  // Command to rescan for Lando apps
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.rescanLandoApps', async () => {
      if (!landoAppDetector) {
        vscode.window.showErrorMessage('Lando app detector not initialized');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Scanning for Lando apps...',
          cancellable: false
        },
        async () => {
          await landoAppDetector!.rescan();
        }
      );

      const appCount = landoAppDetector.getAppCount();
      vscode.window.showInformationMessage(
        `Found ${appCount} Lando app${appCount !== 1 ? 's' : ''}`
      );
    })
  );

  // Command to refresh Lando status
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.refreshLandoStatus', async () => {
      if (!landoStatusMonitor) {
        vscode.window.showErrorMessage('Lando status monitor not initialized');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Refreshing Lando status...',
          cancellable: false
        },
        async () => {
          await landoStatusMonitor!.refresh();
        }
      );

      if (activeLandoApp) {
        const status = landoStatusMonitor.getStatus(activeLandoApp);
        const statusText = status?.running ? 'running' : 'stopped';
        vscode.window.showInformationMessage(
          `${activeLandoApp.name} is ${statusText}`
        );
      }
    })
  );

  // Command to start the active Lando app
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.startLandoApp', async () => {
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

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
          const result = await startLando(activeLandoApp!.rootPath, notification);
          return result;
        }
      );

      if (success) {
        vscode.window.showInformationMessage(`${activeLandoApp.name} started successfully`);
        // Refresh the status
        await landoStatusMonitor?.refresh();
      } else {
        vscode.window.showErrorMessage(`Failed to start ${activeLandoApp.name}`);
      }
    })
  );

  // Command to stop the active Lando app
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.stopLandoApp', async () => {
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

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
          const result = await stopLando(activeLandoApp!.rootPath, notification);
          return result;
        }
      );

      if (success) {
        vscode.window.showInformationMessage(`${activeLandoApp.name} stopped successfully`);
        // Refresh the status
        await landoStatusMonitor?.refresh();
      } else {
        vscode.window.showErrorMessage(`Failed to stop ${activeLandoApp.name}`);
      }
    })
  );

  // Command to restart the active Lando app
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.restartLandoApp', async () => {
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

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
          const result = await restartLando(activeLandoApp!.rootPath, notification);
          return result;
        }
      );

      if (success) {
        vscode.window.showInformationMessage(`${activeLandoApp.name} restarted successfully`);
        // Refresh the status
        await landoStatusMonitor?.refresh();
      } else {
        vscode.window.showErrorMessage(`Failed to restart ${activeLandoApp.name}`);
      }
    })
  );

  // Command to open the active Lando app's URL in browser
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.openLandoUrl', async () => {
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

      // Check if the app is running
      const status = landoStatusMonitor?.getStatus(activeLandoApp);
      if (!status?.running) {
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

      const urls = await getLandoUrls(activeLandoApp.rootPath);
      
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
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

      // Check if the app is running
      const status = landoStatusMonitor?.getStatus(activeLandoApp);
      if (!status?.running) {
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

      const urls = await getLandoUrls(activeLandoApp.rootPath);
      
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

  // Command to view Lando logs
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.viewLandoLogs', async () => {
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

      // Check if the app is running
      const status = landoStatusMonitor?.getStatus(activeLandoApp);
      if (!status?.running) {
        const action = await vscode.window.showWarningMessage(
          `${activeLandoApp.name} is not running. Start it first?`,
          'Start',
          'Cancel'
        );
        if (action === 'Start') {
          await vscode.commands.executeCommand('extension.startLandoApp');
          // Wait a bit for containers to be running
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          return;
        }
      }

      // Get available services
      const services = await getLandoServices(activeLandoApp.rootPath);
      
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

  // Command to run Lando tooling
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.runLandoTooling', async () => {
      if (!activeLandoApp) {
        vscode.window.showErrorMessage('No active Lando app selected');
        return;
      }

      // Get tooling commands from the app config
      const tooling = activeLandoApp.tooling || [];
      
      // Also get recipe-based default tooling
      const recipeTooling = getRecipeDefaultTooling(activeLandoApp.recipe);
      
      // Combine app-defined tooling with recipe defaults (app tooling takes precedence)
      const appToolingNames = new Set(tooling.map(t => t.name));
      const combinedTooling = [
        ...tooling,
        ...recipeTooling.filter(t => !appToolingNames.has(t.name))
      ];

      if (combinedTooling.length === 0) {
        vscode.window.showInformationMessage(
          `No tooling commands detected for ${activeLandoApp.name}. ` +
          `Add a 'tooling' section to your .lando.yml to define custom commands.`
        );
        return;
      }

      const config = vscode.workspace.getConfiguration('lando.tooling');
      const showServiceInfo = config.get('showServiceInfo', true);

      // Build quick pick items
      interface ToolingQuickPickItem extends vscode.QuickPickItem {
        tooling: LandoTooling;
      }

      const items: ToolingQuickPickItem[] = combinedTooling.map(tool => {
        let description = '';
        if (showServiceInfo && tool.service) {
          description = `Service: ${tool.service}`;
        }
        if (tool.description) {
          description = description ? `${description} - ${tool.description}` : tool.description;
        }
        if (!tool.isCustom) {
          description = description ? `${description} (recipe default)` : 'Recipe default';
        }

        return {
          label: `$(terminal) ${tool.name}`,
          description,
          detail: tool.cmd ? (Array.isArray(tool.cmd) ? tool.cmd.join(' ') : tool.cmd) : undefined,
          tooling: tool
        };
      });

      // Show quick pick
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Select a tooling command to run for ${activeLandoApp.name}`,
        title: 'Lando Tooling',
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (!selected) {
        return;
      }

      // Ask for additional arguments
      const args = await vscode.window.showInputBox({
        prompt: `Enter arguments for 'lando ${selected.tooling.name}' (optional)`,
        placeHolder: 'e.g., --help, status, etc.'
      });

      // Run the command in terminal
      await runLandoToolingCommand(activeLandoApp, selected.tooling.name, args);
    })
  );
}

/**
 * Registers basic Lando commands (without PHP integration)
 * @param context - The extension context
 */
function registerBasicCommands(context: vscode.ExtensionContext) {
  const writeEmitter = new vscode.EventEmitter<string>();

  // Register the run Lando command
  registerRunLandoCommand(context, writeEmitter);
}

/**
 * Registers all commands including PHP integration
 * @param context - The extension context
 * @param workspaceFolder - The workspace folder path
 * @param landoConfig - The parsed Lando configuration
 */
function registerAllCommands(
  context: vscode.ExtensionContext,
  workspaceFolder: string,
  landoConfig: LandoConfig
) {
  const writeEmitter = new vscode.EventEmitter<string>();
  
  // Register basic commands
  registerRunLandoCommand(context, writeEmitter);
  
  // Register PHP-specific commands
  registerPhpCommands(context, workspaceFolder, landoConfig);
}

/**
 * Registers the run Lando command
 * @param context - The extension context
 * @param writeEmitter - The event emitter for terminal output
 */
function registerRunLandoCommand(
  context: vscode.ExtensionContext,
  writeEmitter: vscode.EventEmitter<string>
) {
  /**
   * Command handler to run arbitrary Lando commands
   * Creates a terminal with PTY for interactive command execution
   */
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.runLando", async () => {
      const command = await vscode.window.showInputBox({
        prompt: "Enter Lando command",
        placeHolder: "e.g., start, stop, rebuild",
      });

      if (!command) {
        return;
      }

      // TODO: Support multiple workspaces and multiple lando apps per workspace
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) {
        vscode.window.showErrorMessage("No workspace found");
        return;
      }

      // Start Lando process
      const landoProcess = childProcess.spawn("lando", command.split(" "), {
        cwd: cwd,
        shell: false,
        env: { ...process.env, TERM: "xterm-256color", FORCE_COLOR: "true" },
        killSignal: "SIGINT",
      });

      // Lando process output handling
      landoProcess.stdout.on("data", (data: Buffer) => {
        // Terminal expects \r\n line endings
        const output = data.toString().replace(/\n/g, CRLF);
        writeEmitter.fire(output);
      });
      landoProcess.stderr.on("data", (data: Buffer) => {
        // Terminal expects \r\n line endings
        const output = data.toString().replace(/\n/g, CRLF);
        writeEmitter.fire(output);
      });

      // Terminal pty implementation
      const pty = {
        onDidWrite: writeEmitter.event,
        open: () =>
          writeEmitter.fire(`Running: lando ${command}${CRLF}${CRLF}`),
        close: () => {
          landoProcess.stdin.end();
        },
        handleInput: (data: string) => {
          landoProcess.stdin.write(data);
          if (data === "\x03") {
            // Ctrl+C
            writeEmitter.fire("^C");
            landoProcess.kill("SIGINT");
            return;
          }
        },
      };
      const terminal = vscode.window.createTerminal({
        name: `Lando`,
        pty,
      });

      terminal.show();

      // Do things when the Lando process exits
      landoProcess.on("close", (code: number) => {
        if (code !== 0) {
          writeEmitter.fire(
            `\x1b[31mLando process exited with code ${code}\x1b[0m\r\n`
          );
        }
        // Disable terminal input
        writeEmitter.fire("\x1b[?25l");
        pty.handleInput = () => {};
      });
    })
  );
}

/**
 * Registers PHP-related commands
 * @param context - The extension context
 * @param workspaceFolder - The workspace folder path
 * @param landoConfig - The parsed Lando configuration
 */
function registerPhpCommands(
  context: vscode.ExtensionContext,
  workspaceFolder: string,
  landoConfig: LandoConfig
) {
  /**
   * Command handler to enable Lando PHP interpreter
   * Uses a Docker-based approach with wrapper scripts
   */
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.enablePhpInterpreter",
      async () => {
        const workingDir = vscode.workspace.getConfiguration("lando").get("appMount", "/app");
        const phpWrapperPath = getPhpWrapperPath();
        
        try {
          await overridePhpExecutablePath(phpWrapperPath, landoConfig.phpContainer, workingDir);

          // Set environment variables for the extension process
          process.env.PHP_EXECUTABLE = phpWrapperPath;
          process.env.VSCODE_LANDO_PHP_CONTAINER = landoConfig.phpContainer;
          process.env.VSCODE_LANDO_EXEC_CWD = workingDir;

          vscode.window.showInformationMessage(
            `Lando PHP interpreter enabled (${landoConfig.appName})`
          );
          outputChannel.appendLine(`PHP wrapper enabled: ${phpWrapperPath}`);
          outputChannel.appendLine(`Container: ${landoConfig.phpContainer}`);
          outputChannel.appendLine(`Working directory: ${workingDir}`);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to enable PHP interpreter: ${error}`
          );
          outputChannel.appendLine(`Error enabling PHP: ${error}`);
        }
      }
    )
  );

  /**
   * Command handler to disable Lando PHP interpreter
   * Restores original VS Code PHP configuration
   */
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.disablePhpInterpreter",
      async () => {
        await restoreOriginalPhpSettings();
        vscode.window.showInformationMessage("Lando PHP interpreter disabled");
      }
    )
  );

  // Register additional PHP management commands
  registerPhpManagementCommands(context, workspaceFolder, landoConfig);
}

/**
 * Registers additional PHP management commands
 * @param context - The extension context
 * @param workspaceFolder - The workspace folder path
 * @param landoConfig - The parsed Lando configuration
 */
function registerPhpManagementCommands(
  context: vscode.ExtensionContext,
  workspaceFolder: string,
  landoConfig: LandoConfig
) {
  const workingDir = vscode.workspace.getConfiguration("lando").get("appMount", "/app");
  
  // Command to set up PHP alias in terminal
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.setPhpEnvironment", () => {
      const terminal = vscode.window.activeTerminal;
      if (terminal) {
        const phpWrapperPath = getPhpWrapperPath();
        terminal.sendText(`cd "${workspaceFolder}"`);
        if (process.platform !== "win32") {
          terminal.sendText(
            `alias php="VSCODE_LANDO_PHP_CONTAINER='${landoConfig.phpService}' VSCODE_LANDO_EXEC_CWD='${workingDir}' ${phpWrapperPath}"`
          );
          terminal.sendText(
            `echo "PHP now uses: ${phpWrapperPath} with container ${landoConfig.phpService}"`
          );
        } else {
          terminal.sendText(`set VSCODE_LANDO_PHP_CONTAINER=${landoConfig.phpService}`);
          terminal.sendText(`set VSCODE_LANDO_EXEC_CWD=${workingDir}`);
          terminal.sendText(`doskey php=${phpWrapperPath} $*`);
          terminal.sendText(
            `echo "PHP now uses: ${phpWrapperPath} with container ${landoConfig.phpService}"`
          );
        }
        vscode.window.showInformationMessage(
          `PHP alias set for ${landoConfig.phpContainer}`
        );
      } else {
        vscode.window.showWarningMessage("No active terminal found");
      }
    })
  );

  // Command to check Lando status
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.checkLandoStatus", async () => {
      try {
        const isRunning = await checkLandoStatus(
          workspaceFolder,
          landoConfig.appName
        );
        if (isRunning) {
          vscode.window.showInformationMessage(
            `Lando is running (${landoConfig.appName})`
          );
        } else {
          vscode.window.showWarningMessage(
            `Lando is not running (${landoConfig.appName})`
          );
        }
      } catch (error: unknown) {
        vscode.window.showErrorMessage("Error checking Lando status");
        outputChannel.appendLine(`Error checking status: ${error}`);
      }
    })
  );

  // Command to refresh PHP configuration
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.refreshPhpConfig", async () => {
      const phpWrapperPath = getPhpWrapperPath();
      await overridePhpExecutablePath(phpWrapperPath, landoConfig.phpContainer, workingDir);
      vscode.window.showInformationMessage("PHP configuration refreshed");
    })
  );

  // Command to test PHP wrapper
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.testPhpWrapper", () => {
      const phpWrapperPath = getPhpWrapperPath();
      const terminal = vscode.window.createTerminal("PHP Test");
      terminal.sendText(`cd "${workspaceFolder}"`);
      terminal.sendText(
        `VSCODE_LANDO_PHP_CONTAINER="${landoConfig.phpContainer}" VSCODE_LANDO_EXEC_CWD="${workingDir}" "${phpWrapperPath}" --version`
      );
      terminal.show();
      vscode.window.showInformationMessage("Testing PHP wrapper in new terminal");
    })
  );

  // Command to check and reload PHP plugins
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.checkPhpPlugins", async () => {
      await checkAndReloadPhpPlugins();
    })
  );

  // Command to show Landofile language information
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showLandofileInfo", () => {
      const panel = vscode.window.createWebviewPanel(
        'landofileInfo',
        'Landofile Language Features',
        vscode.ViewColumn.One,
        {}
      );
      
      panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Landofile Language Features</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
            h1 { color: #007acc; }
            h2 { color: #333; margin-top: 30px; }
            code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
            .feature { margin: 10px 0; padding: 10px; background: #f8f9fa; border-left: 4px solid #007acc; }
            .supported { color: #28a745; }
            .usage { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <h1>Enhanced Landofile Language Features</h1>
          <div class="usage">
            <h3>🚀 Available Features</h3>
            <div class="feature">
              <strong>📝 JSON Schema Integration</strong><br>
              Schema-based autocomplete, validation, and documentation using official Lando specification
            </div>
            <div class="feature">
              <strong>🐚 Shell Command Integration</strong><br>
              Bash syntax highlighting in build, run, and cmd sections with shell decorations
            </div>
            <div class="feature">
              <strong>🎯 Lando-Specific Enhancements</strong><br>
              Recipe suggestions, service type autocomplete, and custom validation patterns
            </div>
            <div class="feature">
              <strong>⚙️ Editor Features</strong><br>
              Auto-formatting, smart indentation, bracket matching, and code folding
            </div>
          </div>
          
          <h2>Usage</h2>
          <ul>
            <li><strong>Schema Autocomplete:</strong> Type <code>:</code> after a key to see schema-based suggestions</li>
            <li><strong>Enhanced Hover:</strong> Hover over keys for schema documentation + Lando hints</li>
            <li><strong>Real-time Validation:</strong> Get validation feedback from both schema and custom rules</li>
            <li><strong>Formatting:</strong> Use <code>Shift+Alt+F</code> to format with schema awareness</li>
          </ul>
          
          <h2>Schema-Driven Features</h2>
          <div class="supported">
            <strong>Property autocomplete:</strong> All Lando configuration keys from schema<br>
            <strong>Value validation:</strong> Enforced by JSON schema specification<br>
            <strong>Type checking:</strong> Schema ensures correct data types<br>
            <strong>Documentation:</strong> Hover shows schema descriptions
          </div>
          
          <h2>JSON Schema Source</h2>
          <p>The extension uses the official Lando JSON schema specification:</p>
          <code>https://4lando.github.io/lando-spec/landofile-spec.json</code>
          
          <p><em>This ensures all autocomplete, validation, and documentation are based on the official Lando specification.</em></p>
        </body>
        </html>
      `;
    })
  );
}

/**
 * Checks Lando status and starts if needed
 * @param workspaceFolder - The workspace folder path
 * @param landoConfig - The parsed Lando configuration
 * @param context - The extension context
 */
async function checkAndStartLando(
  workspaceFolder: string,
  landoConfig: LandoConfig,
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    // Check if Lando app is running
    const isRunning = await checkLandoStatus(workspaceFolder, landoConfig.appName);
    
    if (isRunning) {
      outputChannel.appendLine("Lando app is running");
      setupDockerMode(context, workspaceFolder, landoConfig);
      vscode.window.showInformationMessage(
        `Lando app ready (${landoConfig.appName})`
      );
      
      // Check and reload PHP plugins for already running Lando
      await checkAndReloadPhpPlugins();
    } else {
      outputChannel.appendLine("Lando app is not running - starting...");
      
      // Show notification that Lando is starting
      const notification = vscode.window.showInformationMessage(
        `Starting Lando (${landoConfig.appName})... This may take a few minutes.`,
        "Cancel"
      );

      // Start Lando
      const landoStarted = await startLando(workspaceFolder, notification);
      
      if (landoStarted) {
        outputChannel.appendLine("Lando started successfully");
        setupDockerMode(context, workspaceFolder, landoConfig);
        vscode.window.showInformationMessage(
          `Lando app ready (${landoConfig.appName})`
        );
        
        // Check and reload PHP plugins after successful Lando startup
        await checkAndReloadPhpPlugins();
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
 * Sets up Docker mode with terminal and task integration
 * @param context - The extension context
 * @param workspaceFolder - The workspace folder path
 * @param landoConfig - The parsed Lando configuration
 */
function setupDockerMode(
  context: vscode.ExtensionContext,
  workspaceFolder: string,
  landoConfig: LandoConfig
): void {
  const phpService = vscode.workspace.getConfiguration("lando").get("php.service", "appserver");
  outputChannel.appendLine(
    `Setting up Docker mode with container: ${landoConfig.cleanAppName}_${phpService}_1`
  );
  const workingDir = vscode.workspace.getConfiguration("lando").get("appMount", "/app");
  const phpWrapperPath = getPhpWrapperPath();
  
  // Automatically enable PHP interpreter
  overridePhpExecutablePath(phpWrapperPath, landoConfig.phpContainer, workingDir);

  // Set environment variables for the extension process
  process.env.PHP_EXECUTABLE = phpWrapperPath;
  process.env.VSCODE_LANDO_PHP_CONTAINER = landoConfig.phpService;
  process.env.VSCODE_LANDO_EXEC_CWD = workingDir;

  // Hook into terminal creation to set up Docker PHP
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

  // Hook into task execution to replace PHP commands with Docker
  const taskStartListener = vscode.tasks.onDidStartTask((taskEvent) => {
    const task = taskEvent.execution.task;
    if (task.definition && task.definition.type === "shell") {
      const shellTask = task.definition as ShellTaskDefinition;
      if (shellTask.command && shellTask.command.includes("php")) {
        const originalCommand = shellTask.command;
        if (!originalCommand.includes("lando") && !originalCommand.includes(phpWrapperPath)) {
          const newCommand = originalCommand.replace(
            /^php\b/,
            `VSCODE_LANDO_PHP_CONTAINER='${landoConfig.phpContainer}' VSCODE_LANDO_EXEC_CWD='${workingDir}' ${phpWrapperPath}`
          );
          shellTask.command = newCommand;
          if (shellTask.options) {
            shellTask.options.cwd = workspaceFolder;
          } else {
            shellTask.options = { cwd: workspaceFolder };
          }
          outputChannel.appendLine(
            `Replaced PHP command: ${originalCommand} -> ${newCommand}`
          );
        }
      }
    }
  });
  
  context.subscriptions.push(taskStartListener);

  outputChannel.appendLine(`PHP wrapper path: ${phpWrapperPath}`);
  outputChannel.appendLine(`Container name: ${landoConfig.phpContainer}`);
  outputChannel.appendLine(`Working directory: ${workingDir}`);
}

/**
 * Restores original PHP settings
 */
async function restoreOriginalPhpSettings(): Promise<void> {
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
    
    // Restore original PATH if it was modified
    if (originalPhpSettings.path !== undefined && originalPhpSettings.binDir !== undefined) {
      const currentPath = process.env.PATH || "";
      const binDir = originalPhpSettings.binDir;
      
      // Remove our bin directory from PATH
      const pathParts = currentPath.split(path.delimiter);
      const filteredPathParts = pathParts.filter(part => part !== binDir);
      process.env.PATH = filteredPathParts.join(path.delimiter);
      
      outputChannel.appendLine(`Removed ${binDir} from PATH`);
    }
    
    outputChannel.appendLine("Original PHP settings restored");
    originalPhpSettings = undefined;
  }
}

/**
 * Deactivates the extension
 * Called when the extension is deactivated
 */
export async function deactivate(): Promise<void> {
  // Restore original PHP settings if they were changed
  await restoreOriginalPhpSettings();
  
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