/**
 * Shared types for the Lando VS Code extension
 * 
 * This module contains interfaces and types used across multiple modules.
 * 
 * @module types
 */

import * as vscode from "vscode";
import { LandoApp, LandoAppDetector } from "./landoAppDetector";
import { LandoStatusMonitor } from "./landoStatusMonitor";

/**
 * Configuration extracted from a Lando app for backward compatibility
 */
export interface LandoConfig {
  appName: string;
  cleanAppName: string;
  phpContainer: string;
  phpService: string;
}

/**
 * Represents a URL exposed by a Lando service
 */
export interface LandoServiceUrl {
  /** The service name (e.g., 'appserver', 'database') */
  service: string;
  /** The full URL */
  url: string;
  /** Whether this is the primary URL for the service */
  primary: boolean;
}

/**
 * Represents a Lando service
 */
export interface LandoService {
  /** The service name (e.g., 'appserver', 'database') */
  name: string;
  /** The service type (e.g., 'php', 'mysql') */
  type: string;
}

/**
 * Storage for original PHP settings to restore on deactivation
 */
export interface OriginalPhpSettings {
  executablePath?: string;
  validateExecutablePath?: string;
  debugExecutablePath?: string;
  path?: string;
  binDir?: string;
  // Terminal environment settings for each platform
  terminalEnvLinux?: Record<string, string | null> | undefined;
  terminalEnvOsx?: Record<string, string | null> | undefined;
  terminalEnvWindows?: Record<string, string | null> | undefined;
}

/**
 * Interface for PHP plugin information
 */
export interface PhpPlugin {
  id: string;
  name: string;
  isActive: boolean;
  canReload: boolean;
}

/**
 * Dependencies passed to command registration functions
 */
export interface CommandDependencies {
  /** Output channel for logging */
  outputChannel: vscode.OutputChannel;
  /** Function to get the currently active Lando app */
  getActiveApp: () => LandoApp | undefined;
  /** Function to set the active Lando app */
  setActiveApp: (app: LandoApp | undefined) => void;
  /** The Lando status monitor instance */
  statusMonitor: LandoStatusMonitor;
  /** The Lando app detector instance */
  appDetector: LandoAppDetector;
}

/**
 * Converts a LandoApp to LandoConfig for backward compatibility
 */
export function convertAppToConfig(app: LandoApp): LandoConfig {
  const phpService = vscode.workspace.getConfiguration("lando").get("php.service", "appserver");
  return {
    appName: app.name,
    cleanAppName: app.cleanName,
    phpService,
    phpContainer: `${app.cleanName}_${phpService}_1`
  };
}
