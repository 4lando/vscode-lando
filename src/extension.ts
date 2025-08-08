import * as vscode from "vscode";
import * as childProcess from 'child_process';
import * as path from "path";
import * as fs from "fs";
import { activateShellDecorations } from "./shellDecorations";

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
 * Gets the path to the PHP wrapper script
 * @returns The path to the appropriate PHP wrapper script
 */
function getPhpWrapperPath(): string {
  // Get the path to the PHP wrapper script in the extension
  const extensionPath = path.dirname(__dirname); // Go up from out/ to root
  const wrapperPath = process.platform === "win32" 
    ? path.join(extensionPath, "bin", "php.bat")
    : path.join(extensionPath, "php");
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
 * Activates the Lando extension
 * @param context - The extension context provided by VS Code
 */
export function activate(context: vscode.ExtensionContext) {
  // Create output channel
  outputChannel = vscode.window.createOutputChannel("Lando");
  outputChannel.show(true); // Force reveal the output channel
  
  outputChannel.appendLine("=".repeat(50));
  outputChannel.appendLine("Lando extension is now active!");
  outputChannel.appendLine("=".repeat(50));

  // Ensure YAML extension is available for enhanced YAML support
  const yamlExtension = vscode.extensions.getExtension('redhat.vscode-yaml');
  if (!yamlExtension) {
    outputChannel.appendLine("Warning: Red Hat YAML extension not found. Enhanced YAML support may be limited.");
  } else {
    outputChannel.appendLine("Red Hat YAML extension found - Enhanced YAML support with bash highlighting enabled");
  }

  // Get the workspace folder path
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  // Activate shell decorations for Landofile files
  activateShellDecorations(context);

  if (!workspaceFolder) {
    outputChannel.appendLine("No workspace folder found");
    // Register basic commands when no workspace folder is found
    registerBasicCommands(context);
    return;
  }

  outputChannel.appendLine(`Workspace folder: ${workspaceFolder}`);

  // Check if .lando.yml exists
  const landoFile = path.join(workspaceFolder, ".lando.yml");
  if (!fs.existsSync(landoFile)) {
    outputChannel.appendLine(".lando.yml not found - PHP integration will not activate");
    // Register basic commands when no .lando.yml is found
    registerBasicCommands(context);
    return;
  }

  // Parse app name from .lando.yml
  const landoConfig = parseLandoConfig(workspaceFolder);
  if (!landoConfig) {
    outputChannel.appendLine("Could not parse .lando.yml - PHP integration will not activate");
    registerBasicCommands(context);
    return;
  }

  outputChannel.appendLine(`Lando app: ${landoConfig.appName}`);
  outputChannel.appendLine(`Container name: ${landoConfig.phpContainer}`);

  // Check Lando status and start if needed
  checkAndStartLando(workspaceFolder, landoConfig, context);
  
  // Register all commands
  registerAllCommands(context, workspaceFolder, landoConfig);
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
      const cwd = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
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
    // Get configuration for auto-start
    
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
        terminal.sendText(          `alias php="VSCODE_LANDO_PHP_CONTAINER='${landoConfig.phpService}' VSCODE_LANDO_EXEC_CWD='${workingDir}' ${phpWrapperPath}"`        );
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

    if (originalPhpSettings.executablePath !== undefined) {
      await config.update(
        "executablePath",
        originalPhpSettings.executablePath,
        vscode.ConfigurationTarget.Workspace
      );
    }
    if (originalPhpSettings.validateExecutablePath !== undefined) {
      await config.update(
        "validate.executablePath",
        originalPhpSettings.validateExecutablePath,
        vscode.ConfigurationTarget.Workspace
      );
    }
    if (originalPhpSettings.debugExecutablePath !== undefined) {
      await config.update(
        "debug.executablePath",
        originalPhpSettings.debugExecutablePath,
        vscode.ConfigurationTarget.Workspace
      );
    }
    
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
  
  if (outputChannel) {
    outputChannel.appendLine("Lando extension is now deactivated!");
    outputChannel.dispose();
  }
}