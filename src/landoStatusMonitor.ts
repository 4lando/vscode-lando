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
import {
  LandoAppState,
  LandoAppStateMachine,
  StateChangeEvent,
  isRunning as isStateRunning,
  isBusy as isStateBusy,
} from './landoAppState';

// Re-export state machine types for convenience
export {
  LandoAppState,
  StateChangeEvent,
  isRunning as isStateRunning,
  isBusy as isStateBusy,
  isStopped as isStateStopped,
  isError as isStateError,
  getStateLabel,
} from './landoAppState';

const execAsync = util.promisify(childProcess.exec);

/**
 * Represents the running status of a Lando application
 */
export interface LandoAppStatus {
  /** The Lando app this status belongs to */
  app: LandoApp;
  /** Current state of the app */
  state: LandoAppState;
  /** Number of running containers */
  runningContainers: number;
  /** Total number of containers */
  totalContainers: number;
  /** Last time the status was checked */
  lastChecked: Date;
  /** Error message when state is Error */
  errorMessage?: string;
}

/**
 * Event data emitted when Lando app status changes
 */
export interface LandoStatusChangedEvent {
  /** The app whose status changed */
  app: LandoApp;
  /** The new status */
  status: LandoAppStatus;
  /** The previous state */
  previousState: LandoAppState;
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
 * - State machine for tracking transitional states (starting, stopping, etc.)
 * 
 * @example
 * ```typescript
 * const monitor = new LandoStatusMonitor();
 * monitor.onDidChangeStatus(event => {
 *   console.log(`${event.app.name} is now ${event.status.state}`);
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
  private readonly stateMachine: LandoAppStateMachine;

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
    this.stateMachine = new LandoAppStateMachine();
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
    const newAppCleanNames = new Set(apps.map(a => a.cleanName));
    
    // Remove status/state entries for apps that no longer exist
    const appPaths = new Set(apps.map(a => a.configPath));
    for (const [path] of this.statusMap) {
      if (!appPaths.has(path)) {
        this.statusMap.delete(path);
      }
    }
    
    // Clean up state machine for removed apps
    for (const trackedAppId of this.stateMachine.getTrackedApps()) {
      if (!newAppCleanNames.has(trackedAppId)) {
        this.stateMachine.removeApp(trackedAppId);
      }
    }
    
    this.apps = apps;

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
    return status ? isStateRunning(status.state) : false;
  }

  /**
   * Checks if a specific app is busy (in a transitional state)
   * 
   * @param app - The app to check
   * @returns True if busy, false otherwise
   */
  public isBusy(app: LandoApp): boolean {
    const status = this.statusMap.get(app.configPath);
    return status ? isStateBusy(status.state) : false;
  }

  /**
   * Gets the current state for an app
   * 
   * @param app - The app to get state for
   * @returns The app's state
   */
  public getState(app: LandoApp): LandoAppState {
    const status = this.statusMap.get(app.configPath);
    return status?.state ?? LandoAppState.Unknown;
  }

  /**
   * Checks if a state transition is valid for an app
   * 
   * @param app - The app to check
   * @param toState - The target state
   * @returns True if the transition is valid
   */
  public canTransition(app: LandoApp, toState: LandoAppState): boolean {
    return this.stateMachine.canTransition(app.cleanName, toState);
  }

  /**
   * Mark an app as starting (call before running start command)
   * 
   * @param app - The app being started
   * @returns True if transition succeeded
   */
  public markStarting(app: LandoApp): boolean {
    const success = this.stateMachine.markStarting(app.cleanName);
    if (success) {
      this.updateStatusFromStateMachine(app);
    }
    return success;
  }

  /**
   * Mark an app as stopping (call before running stop command)
   * 
   * @param app - The app being stopped
   * @returns True if transition succeeded
   */
  public markStopping(app: LandoApp): boolean {
    const success = this.stateMachine.markStopping(app.cleanName);
    if (success) {
      this.updateStatusFromStateMachine(app);
    }
    return success;
  }

  /**
   * Mark an app as rebuilding (call before running rebuild command)
   * 
   * @param app - The app being rebuilt
   * @returns True if transition succeeded
   */
  public markRebuilding(app: LandoApp): boolean {
    const success = this.stateMachine.markRebuilding(app.cleanName);
    if (success) {
      this.updateStatusFromStateMachine(app);
    }
    return success;
  }

  /**
   * Mark an app as being destroyed (call before running destroy command)
   * 
   * @param app - The app being destroyed
   * @returns True if transition succeeded
   */
  public markDestroying(app: LandoApp): boolean {
    const success = this.stateMachine.markDestroying(app.cleanName);
    if (success) {
      this.updateStatusFromStateMachine(app);
    }
    return success;
  }

  /**
   * Mark an app as having an error
   * 
   * @param app - The app that errored
   * @param message - Error message
   * @returns True if transition succeeded
   */
  public markError(app: LandoApp, message: string): boolean {
    const success = this.stateMachine.markError(app.cleanName, message);
    if (success) {
      this.updateStatusFromStateMachine(app);
    }
    return success;
  }

  /**
   * Updates the status map from the state machine's current state
   */
  private updateStatusFromStateMachine(app: LandoApp): void {
    const stateInfo = this.stateMachine.getState(app.cleanName);
    const existingStatus = this.statusMap.get(app.configPath);
    const previousState = existingStatus?.state ?? LandoAppState.Unknown;
    
    const newStatus: LandoAppStatus = {
      app,
      state: stateInfo.state,
      runningContainers: existingStatus?.runningContainers ?? 0,
      totalContainers: existingStatus?.totalContainers ?? 0,
      lastChecked: new Date(),
      errorMessage: stateInfo.errorMessage,
    };
    
    this.statusMap.set(app.configPath, newStatus);
    
    // Fire events
    if (previousState !== stateInfo.state) {
      this._onDidChangeStatus.fire({
        app,
        status: newStatus,
        previousState,
      });
    }
    this._onDidUpdateStatuses.fire(this.getAllStatuses());
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
        const previousState = this.stateMachine.getState(app.cleanName).state;

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

        // Update state machine with poll results
        // This handles transitional states (Starting -> Running, Stopping -> Stopped, etc.)
        this.stateMachine.updateFromPoll(app.cleanName, isRunning);
        const currentStateInfo = this.stateMachine.getState(app.cleanName);

        const newStatus: LandoAppStatus = {
          app,
          state: currentStateInfo.state,
          runningContainers,
          totalContainers,
          lastChecked: new Date(),
          errorMessage: currentStateInfo.errorMessage,
        };

        this.statusMap.set(app.configPath, newStatus);
        updatedStatuses.push(newStatus);

        // Emit change event if state changed
        if (previousState !== currentStateInfo.state) {
          this.log(`State changed for ${app.name}: ${previousState} -> ${currentStateInfo.state}`);
          this._onDidChangeStatus.fire({
            app,
            status: newStatus,
            previousState,
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
    this.stateMachine.dispose();
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
