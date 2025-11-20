/**
 * Lando Status Monitor Module
 * 
 * This module provides real-time monitoring of Lando application status.
 * It periodically polls the Lando CLI to check container running states
 * and emits events when status changes are detected.
 * 
 * @module landoStatusMonitor
 */

import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import * as util from 'util';
import { LandoApp } from './landoAppDetector';

const execAsync = util.promisify(childProcess.exec);

/**
 * Represents the running status of a Lando application
 */
export interface LandoAppStatus {
  /** The Lando app this status belongs to */
  app: LandoApp;
  /** Whether the app is currently running */
  running: boolean;
  /** Number of running containers */
  runningContainers: number;
  /** Total number of containers */
  totalContainers: number;
  /** Last time the status was checked */
  lastChecked: Date;
}

/**
 * Event data emitted when Lando app status changes
 */
export interface LandoStatusChangedEvent {
  /** The app whose status changed */
  app: LandoApp;
  /** The new status */
  status: LandoAppStatus;
  /** The previous running state */
  wasRunning: boolean;
}

/**
 * Configuration options for the status monitor
 */
interface StatusMonitorConfig {
  /** Whether status monitoring is enabled */
  enabled: boolean;
  /** Polling interval in milliseconds */
  pollingInterval: number;
  /** Timeout for lando list command in milliseconds */
  commandTimeout: number;
}

/**
 * Container information returned by lando list
 */
export interface LandoContainer {
  service: string;
  app: string;
  running: boolean;
}

/**
 * Function type for getting Lando containers (for dependency injection)
 */
export type ContainerFetcher = () => Promise<LandoContainer[]>;

/**
 * Options for creating a LandoStatusMonitor
 */
export interface LandoStatusMonitorOptions {
  /** Custom container fetcher function (for testing) */
  containerFetcher?: ContainerFetcher;
}

/**
 * Monitors the running status of Lando applications.
 * 
 * Features:
 * - Periodically polls `lando list` to check container status
 * - Emits events when app status changes (started/stopped)
 * - Configurable polling interval
 * - Efficient batch checking of all detected apps
 * 
 * @example
 * ```typescript
 * const monitor = new LandoStatusMonitor();
 * monitor.onDidChangeStatus(event => {
 *   console.log(`${event.app.name} is now ${event.status.running ? 'running' : 'stopped'}`);
 * });
 * await monitor.activate(context, outputChannel);
 * monitor.setApps(detectedApps);
 * ```
 */
export class LandoStatusMonitor implements vscode.Disposable {
  private apps: LandoApp[] = [];
  private statusMap: Map<string, LandoAppStatus> = new Map();
  private pollingTimer: ReturnType<typeof setInterval> | undefined;
  private outputChannel: vscode.OutputChannel | undefined;
  private config: StatusMonitorConfig;
  private isPolling = false;
  private disposables: vscode.Disposable[] = [];
  private containerFetcher: ContainerFetcher;

  private readonly _onDidChangeStatus = new vscode.EventEmitter<LandoStatusChangedEvent>();
  
  /**
   * Event fired when a Lando app's status changes
   */
  public readonly onDidChangeStatus = this._onDidChangeStatus.event;

  private readonly _onDidUpdateStatuses = new vscode.EventEmitter<LandoAppStatus[]>();
  
  /**
   * Event fired when statuses are updated (even if no changes)
   */
  public readonly onDidUpdateStatuses = this._onDidUpdateStatuses.event;

  constructor(options?: LandoStatusMonitorOptions) {
    this.config = this.loadConfig();
    this.containerFetcher = options?.containerFetcher ?? this.defaultContainerFetcher.bind(this);
  }

  /**
   * Loads status monitor configuration from VS Code settings
   */
  private loadConfig(): StatusMonitorConfig {
    const config = vscode.workspace.getConfiguration('lando');
    return {
      enabled: config.get('statusMonitoring.enabled', true),
      pollingInterval: config.get('statusMonitoring.interval', 10) * 1000, // Convert to ms
      commandTimeout: config.get('statusMonitoring.timeout', 10) * 1000
    };
  }

  /**
   * Activates the status monitor
   * 
   * @param context - VS Code extension context for managing subscriptions
   * @param outputChannel - Optional output channel for logging
   */
  public async activate(
    context: vscode.ExtensionContext,
    outputChannel?: vscode.OutputChannel
  ): Promise<void> {
    this.outputChannel = outputChannel;
    this.log('Activating Lando status monitor...');

    // Listen for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('lando.statusMonitoring')) {
          const wasEnabled = this.config.enabled;
          this.config = this.loadConfig();
          
          if (!wasEnabled && this.config.enabled) {
            this.startPolling();
          } else if (wasEnabled && !this.config.enabled) {
            this.stopPolling();
          } else if (this.config.enabled) {
            // Restart polling with new interval
            this.stopPolling();
            this.startPolling();
          }
        }
      })
    );

    context.subscriptions.push(this);

    if (this.config.enabled && this.apps.length > 0) {
      await this.checkAllStatuses();
      this.startPolling();
    }

    this.log('Status monitor activated');
  }

  /**
   * Sets the apps to monitor
   * 
   * @param apps - Array of Lando apps to monitor
   */
  public setApps(apps: LandoApp[]): void {
    this.apps = apps;
    
    // Remove status entries for apps that no longer exist
    const appPaths = new Set(apps.map(a => a.configPath));
    for (const [path] of this.statusMap) {
      if (!appPaths.has(path)) {
        this.statusMap.delete(path);
      }
    }

    // Start or stop polling based on whether we have apps
    if (this.config.enabled) {
      if (apps.length > 0 && !this.pollingTimer) {
        this.checkAllStatuses();
        this.startPolling();
      } else if (apps.length === 0) {
        this.stopPolling();
      }
    }
  }

  /**
   * Gets the current status for a specific app
   * 
   * @param app - The app to get status for
   * @returns The app's status or undefined if not monitored
   */
  public getStatus(app: LandoApp): LandoAppStatus | undefined {
    return this.statusMap.get(app.configPath);
  }

  /**
   * Gets all current statuses
   * 
   * @returns Array of all app statuses
   */
  public getAllStatuses(): LandoAppStatus[] {
    return Array.from(this.statusMap.values());
  }

  /**
   * Checks if a specific app is running
   * 
   * @param app - The app to check
   * @returns True if running, false otherwise
   */
  public isRunning(app: LandoApp): boolean {
    const status = this.statusMap.get(app.configPath);
    return status?.running ?? false;
  }

  /**
   * Forces an immediate status check for all apps
   * 
   * @returns Promise that resolves when check is complete
   */
  public async refresh(): Promise<void> {
    await this.checkAllStatuses();
  }

  /**
   * Starts the polling timer
   */
  private startPolling(): void {
    if (this.pollingTimer) {
      return;
    }

    this.log(`Starting status polling (interval: ${this.config.pollingInterval}ms)`);
    this.pollingTimer = setInterval(() => {
      this.checkAllStatuses();
    }, this.config.pollingInterval);
  }

  /**
   * Stops the polling timer
   */
  private stopPolling(): void {
    if (this.pollingTimer) {
      this.log('Stopping status polling');
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  /**
   * Checks the status of all monitored apps
   */
  private async checkAllStatuses(): Promise<void> {
    if (this.isPolling || this.apps.length === 0) {
      return;
    }

    this.isPolling = true;
    
    try {
      // Get all containers in a single call for efficiency
      const containers = await this.containerFetcher();
      
      const updatedStatuses: LandoAppStatus[] = [];

      for (const app of this.apps) {
        const previousStatus = this.statusMap.get(app.configPath);
        const wasRunning = previousStatus?.running ?? false;

        // Filter containers for this app
        // Normalize container app name the same way cleanName is created
        // to handle both original names (e.g., "app-one") and already-cleaned names
        const appContainers = containers.filter(c => {
          const normalizedContainerApp = c.app.toLowerCase().replace(/[-_]/g, '');
          return normalizedContainerApp === app.cleanName;
        });
        
        const runningContainers = appContainers.filter(c => c.running).length;
        const totalContainers = appContainers.length;
        const isRunning = runningContainers > 0;

        const newStatus: LandoAppStatus = {
          app,
          running: isRunning,
          runningContainers,
          totalContainers,
          lastChecked: new Date()
        };

        this.statusMap.set(app.configPath, newStatus);
        updatedStatuses.push(newStatus);

        // Emit change event if status changed
        if (wasRunning !== isRunning) {
          this.log(`Status changed for ${app.name}: ${wasRunning ? 'running' : 'stopped'} -> ${isRunning ? 'running' : 'stopped'}`);
          this._onDidChangeStatus.fire({
            app,
            status: newStatus,
            wasRunning
          });
        }
      }

      this._onDidUpdateStatuses.fire(updatedStatuses);
    } catch (error) {
      this.log(`Error checking statuses: ${error}`);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Default container fetcher that calls Lando CLI
   * 
   * @returns Promise resolving to array of container info
   */
  private async defaultContainerFetcher(): Promise<LandoContainer[]> {
    try {
      const { stdout } = await execAsync('lando list --format=json', {
        encoding: 'utf8',
        timeout: this.config.commandTimeout
      });

      const containers = JSON.parse(stdout) as LandoContainer[];
      return containers;
    } catch (error) {
      this.log(`Error getting Lando containers: ${error}`);
      return [];
    }
  }

  /**
   * Logs a message to the output channel
   */
  private log(message: string): void {
    if (this.outputChannel) {
      this.outputChannel.appendLine(`[StatusMonitor] ${message}`);
    }
  }

  /**
   * Disposes of the status monitor resources
   */
  public dispose(): void {
    this.stopPolling();
    this._onDidChangeStatus.dispose();
    this._onDidUpdateStatuses.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
