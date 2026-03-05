/**
 * Lando Helper Functions
 * 
 * This module provides helper functions for interacting with Lando CLI,
 * including running commands, querying status, and getting service information.
 * 
 * @module helpers/lando
 */

import * as vscode from "vscode";
import * as childProcess from "child_process";
import { LandoApp, LandoTooling } from "../landoAppDetector";
import { LandoServiceUrl, LandoService } from "../types";

/**
 * Core Lando commands that are not tooling commands.
 * These are filtered out when querying available tooling.
 */
export const LANDO_CORE_COMMANDS = new Set([
  'config',
  'destroy',
  'exec',
  'info',
  'init',
  'list',
  'logs',
  'poweroff',
  'rebuild',
  'restart',
  'start',
  'stop',
  'update',
  'version',
  'share',
  'ssh',
  'db-export',
  'db-import',
]);

/**
 * Checks if Lando app is running
 * @param workspaceFolder - The workspace folder path
 * @param appName - The Lando app name
 * @param outputChannel - Output channel for logging
 * @returns Promise resolving to true if running, false otherwise
 */
export async function checkLandoStatus(
  workspaceFolder: string,
  appName: string,
  outputChannel: vscode.OutputChannel
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
 * Generic helper to run a Lando command
 * @param commandName - The name of the command for logging (e.g., "start", "stop")
 * @param args - The command arguments to pass to lando
 * @param outputChannel - Output channel for logging
 * @param workspaceFolder - Optional workspace folder path (if command is app-specific)
 * @param notification - Optional notification promise for cancellation
 * @returns Promise resolving to true if command succeeded, false otherwise
 */
export async function runLandoCommand(
  commandName: string,
  args: string[],
  outputChannel: vscode.OutputChannel,
  workspaceFolder?: string,
  notification?: Thenable<string | undefined>
): Promise<boolean> {
  return new Promise((resolve) => {
    outputChannel.appendLine(`${commandName.charAt(0).toUpperCase() + commandName.slice(1)} Lando...`);
    
    const spawnOptions: childProcess.SpawnOptions = {
      stdio: "pipe",
    };
    
    if (workspaceFolder) {
      spawnOptions.cwd = workspaceFolder;
    }
    
    const landoProcess = childProcess.spawn("lando", args, spawnOptions);

    let output = "";

    landoProcess.stdout?.on("data", (data: Buffer) => {
      const message = data.toString();
      output += message;
      outputChannel.appendLine(`Lando output: ${message.trim()}`);
    });

    landoProcess.stderr?.on("data", (data: Buffer) => {
      const message = data.toString();
      output += message;
      outputChannel.appendLine(`Lando stderr: ${message.trim()}`);
    });

    landoProcess.on("close", (code: number) => {
      outputChannel.appendLine(`Lando process exited with code ${code}`);
      
      if (code === 0) {
        resolve(true);
      } else {
        outputChannel.appendLine(`Lando failed to ${commandName} (exit code ${code}): ${output}`);
        resolve(false);
      }
    });

    landoProcess.on("error", (error: Error) => {
      outputChannel.appendLine(`Error ${commandName}ing Lando: ${error.message}`);
      resolve(false);
    });

    if (notification) {
      notification.then((selection) => {
        if (selection === "Cancel") {
          outputChannel.appendLine(`Lando ${commandName} cancelled by user`);
          landoProcess.kill();
          resolve(false);
        }
      });
    }
  });
}

/**
 * Starts Lando app
 * @param workspaceFolder - The workspace folder path
 * @param outputChannel - Output channel for logging
 * @param notification - Optional notification promise for cancellation
 * @returns Promise resolving to true if started successfully, false otherwise
 */
export async function startLando(
  workspaceFolder: string,
  outputChannel: vscode.OutputChannel,
  notification?: Thenable<string | undefined>
): Promise<boolean> {
  return runLandoCommand("start", ["start"], outputChannel, workspaceFolder, notification);
}

/**
 * Stops Lando app
 * @param workspaceFolder - The workspace folder path
 * @param outputChannel - Output channel for logging
 * @param notification - Optional notification promise for cancellation
 * @returns Promise resolving to true if stopped successfully, false otherwise
 */
export async function stopLando(
  workspaceFolder: string,
  outputChannel: vscode.OutputChannel,
  notification?: Thenable<string | undefined>
): Promise<boolean> {
  return runLandoCommand("stop", ["stop"], outputChannel, workspaceFolder, notification);
}

/**
 * Restarts Lando app
 * @param workspaceFolder - The workspace folder path
 * @param outputChannel - Output channel for logging
 * @param notification - Optional notification promise for cancellation
 * @returns Promise resolving to true if restarted successfully, false otherwise
 */
export async function restartLando(
  workspaceFolder: string,
  outputChannel: vscode.OutputChannel,
  notification?: Thenable<string | undefined>
): Promise<boolean> {
  return runLandoCommand("restart", ["restart"], outputChannel, workspaceFolder, notification);
}

/**
 * Rebuilds Lando app (destructive - recreates containers)
 * @param workspaceFolder - The workspace folder path
 * @param outputChannel - Output channel for logging
 * @param notification - Optional notification promise for cancellation
 * @returns Promise resolving to true if rebuilt successfully, false otherwise
 */
export async function rebuildLando(
  workspaceFolder: string,
  outputChannel: vscode.OutputChannel,
  notification?: Thenable<string | undefined>
): Promise<boolean> {
  return runLandoCommand("rebuild", ["rebuild", "-y"], outputChannel, workspaceFolder, notification);
}

/**
 * Destroys Lando app (removes containers and optionally data)
 * @param workspaceFolder - The workspace folder path
 * @param outputChannel - Output channel for logging
 * @param notification - Optional notification promise for cancellation
 * @returns Promise resolving to true if destroyed successfully, false otherwise
 */
export async function destroyLando(
  workspaceFolder: string,
  outputChannel: vscode.OutputChannel,
  notification?: Thenable<string | undefined>
): Promise<boolean> {
  return runLandoCommand("destroy", ["destroy", "-y"], outputChannel, workspaceFolder, notification);
}

/**
 * Powers off all Lando containers globally
 * @param outputChannel - Output channel for logging
 * @param notification - Optional notification promise for cancellation
 * @returns Promise resolving to true if powered off successfully, false otherwise
 */
export async function powerOffLando(
  outputChannel: vscode.OutputChannel,
  notification?: Thenable<string | undefined>
): Promise<boolean> {
  return runLandoCommand("poweroff", ["poweroff"], outputChannel, undefined, notification);
}

/**
 * Gets the URLs exposed by a Lando app
 * @param workspaceFolder - The workspace folder path
 * @param outputChannel - Output channel for logging
 * @returns Promise resolving to array of service URLs
 */
export async function getLandoUrls(
  workspaceFolder: string,
  outputChannel: vscode.OutputChannel
): Promise<LandoServiceUrl[]> {
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
 * Gets the services defined in a Lando app
 * @param workspaceFolder - The workspace folder path
 * @param outputChannel - Output channel for logging
 * @returns Promise resolving to array of services
 */
export async function getLandoServices(
  workspaceFolder: string,
  outputChannel: vscode.OutputChannel
): Promise<LandoService[]> {
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
 * Queries Lando to get available tooling commands for an app.
 * This runs `lando` with no arguments in the app directory and parses the output
 * to extract tooling commands (filtering out core Lando commands).
 * 
 * @param appRootPath - The root path of the Lando app
 * @param outputChannel - Output channel for logging
 * @returns Promise resolving to array of available tooling commands
 */
export async function getLandoAvailableTooling(
  appRootPath: string,
  outputChannel: vscode.OutputChannel
): Promise<LandoTooling[]> {
  return new Promise((resolve) => {
    const tooling: LandoTooling[] = [];
    
    const landoProcess = childProcess.spawn('lando', [], {
      cwd: appRootPath,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    landoProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    landoProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    landoProcess.on('error', (error) => {
      outputChannel.appendLine(`Error querying Lando tooling: ${error.message}`);
      resolve([]);
    });

    landoProcess.on('close', (code) => {
      if (code !== 0 && !stdout) {
        outputChannel.appendLine(`Lando tooling query failed with code ${code}: ${stderr}`);
        resolve([]);
        return;
      }

      try {
        // Parse the output to extract commands
        // Format is like: "  lando composer          Runs composer commands"
        const lines = stdout.split('\n');
        let inCommandsSection = false;

        for (const line of lines) {
          // Detect start of Commands section
          if (line.trim() === 'Commands:') {
            inCommandsSection = true;
            continue;
          }

          // Detect end of Commands section (Options: or Examples:)
          if (line.trim() === 'Options:' || line.trim() === 'Examples:') {
            inCommandsSection = false;
            continue;
          }

          if (!inCommandsSection) {
            continue;
          }

          // Parse command lines like "  lando composer          Runs composer commands"
          const match = line.match(/^\s+lando\s+(\S+)(?:\s+\[.*?\])?\s+(.*?)\s*$/);
          if (match) {
            const [, commandName, description] = match;
            
            // Skip core Lando commands
            if (LANDO_CORE_COMMANDS.has(commandName)) {
              continue;
            }

            tooling.push({
              name: commandName,
              description: description || undefined,
              isCustom: false,
            });
          }
        }

        outputChannel.appendLine(`Found ${tooling.length} available tooling commands from Lando`);
        resolve(tooling);
      } catch (error) {
        outputChannel.appendLine(`Error parsing Lando tooling output: ${error}`);
        resolve([]);
      }
    });

    // Set a timeout in case Lando hangs
    setTimeout(() => {
      landoProcess.kill();
      outputChannel.appendLine('Lando tooling query timed out');
      resolve([]);
    }, 10000);
  });
}

/**
 * Runs a Lando tooling command in a terminal
 * @param app - The Lando app to run the command in
 * @param command - The tooling command name
 * @param outputChannel - Output channel for logging
 * @param args - Optional arguments to pass to the command
 */
export async function runLandoToolingCommand(
  app: LandoApp,
  command: string,
  outputChannel: vscode.OutputChannel,
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
