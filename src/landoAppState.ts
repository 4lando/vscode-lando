/**
 * Lando App State Machine Module
 *
 * This module provides a finite state machine for managing Lando application states.
 * It tracks transitional states (starting, stopping, etc.) and enforces valid
 * state transitions to prevent conflicting operations.
 *
 * @module landoAppState
 */

import * as vscode from "vscode";

/**
 * Possible states for a Lando application
 */
export enum LandoAppState {
  /** Initial state before first status check */
  Unknown = "unknown",
  /** All containers are stopped */
  Stopped = "stopped",
  /** lando start command is in progress */
  Starting = "starting",
  /** At least one container is running */
  Running = "running",
  /** lando stop command is in progress */
  Stopping = "stopping",
  /** lando rebuild command is in progress */
  Rebuilding = "rebuilding",
  /** lando destroy command is in progress */
  Destroying = "destroying",
  /** A command failed (transient state, cleared on next poll) */
  Error = "error",
}

/**
 * Information about an app's current state
 */
export interface LandoAppStateInfo {
  /** Current state */
  state: LandoAppState;
  /** Error message when state is Error */
  errorMessage?: string;
  /** State before entering Error state (for recovery) */
  previousState?: LandoAppState;
  /** When this state was entered */
  timestamp: Date;
}

/**
 * Event emitted when app state changes
 */
export interface StateChangeEvent {
  /** App identifier (cleanName) */
  appId: string;
  /** Previous state */
  previousState: LandoAppState;
  /** New state */
  newState: LandoAppState;
  /** Error message if transitioning to Error state */
  errorMessage?: string;
}

/**
 * Valid state transitions map.
 * Key is the "from" state, value is array of valid "to" states.
 */
const VALID_TRANSITIONS: Record<LandoAppState, LandoAppState[]> = {
  [LandoAppState.Unknown]: [
    LandoAppState.Stopped,
    LandoAppState.Running,
    LandoAppState.Starting, // User may start before first poll
    LandoAppState.Error,
  ],
  [LandoAppState.Stopped]: [
    LandoAppState.Starting,
    LandoAppState.Running, // Poll detects external start
    LandoAppState.Error,
  ],
  [LandoAppState.Starting]: [
    LandoAppState.Running,
    LandoAppState.Stopped, // Poll shows still stopped (start failed externally)
    LandoAppState.Error,
  ],
  [LandoAppState.Running]: [
    LandoAppState.Stopping,
    LandoAppState.Rebuilding,
    LandoAppState.Destroying,
    LandoAppState.Stopped, // Poll detects external stop
    LandoAppState.Error,
  ],
  [LandoAppState.Stopping]: [
    LandoAppState.Stopped,
    LandoAppState.Running, // Poll shows still running (stop failed externally)
    LandoAppState.Error,
  ],
  [LandoAppState.Rebuilding]: [
    LandoAppState.Running,
    LandoAppState.Stopped, // Rebuild can result in stopped state on failure
    LandoAppState.Error,
  ],
  [LandoAppState.Destroying]: [
    LandoAppState.Stopped,
    LandoAppState.Running, // Poll shows still running (destroy failed externally)
    LandoAppState.Error,
  ],
  [LandoAppState.Error]: [
    // Error is transient - can go to any terminal state on next poll
    LandoAppState.Stopped,
    LandoAppState.Running,
    // Can also retry operations from error state
    LandoAppState.Starting,
    LandoAppState.Stopping,
    LandoAppState.Rebuilding,
    LandoAppState.Destroying,
  ],
};

/**
 * States that indicate the app is busy with an operation
 */
export const BUSY_STATES: readonly LandoAppState[] = [
  LandoAppState.Starting,
  LandoAppState.Stopping,
  LandoAppState.Rebuilding,
  LandoAppState.Destroying,
];

/**
 * Check if an app is in a running state
 */
export function isRunning(state: LandoAppState): boolean {
  return state === LandoAppState.Running;
}

/**
 * Check if an app is busy with an operation
 */
export function isBusy(state: LandoAppState): boolean {
  return BUSY_STATES.includes(state);
}

/**
 * Check if an app is in a stopped state
 */
export function isStopped(state: LandoAppState): boolean {
  return state === LandoAppState.Stopped;
}

/**
 * Check if an app is in an error state
 */
export function isError(state: LandoAppState): boolean {
  return state === LandoAppState.Error;
}

/**
 * Get a human-readable label for a state
 */
export function getStateLabel(state: LandoAppState): string {
  switch (state) {
    case LandoAppState.Unknown:
      return "Unknown";
    case LandoAppState.Stopped:
      return "Stopped";
    case LandoAppState.Starting:
      return "Starting...";
    case LandoAppState.Running:
      return "Running";
    case LandoAppState.Stopping:
      return "Stopping...";
    case LandoAppState.Rebuilding:
      return "Rebuilding...";
    case LandoAppState.Destroying:
      return "Destroying...";
    case LandoAppState.Error:
      return "Error";
  }
}

/**
 * Manages state transitions for Lando applications.
 *
 * Features:
 * - Enforces valid state transitions
 * - Tracks per-app state with timestamps
 * - Emits events on state changes
 * - Provides helpers for marking transitional states
 *
 * @example
 * ```typescript
 * const stateMachine = new LandoAppStateMachine();
 * stateMachine.onDidChangeState(event => {
 *   console.log(`${event.appId}: ${event.previousState} -> ${event.newState}`);
 * });
 *
 * stateMachine.markStarting('myapp');
 * // ... after command completes ...
 * stateMachine.updateFromPoll('myapp', true); // Now running
 * ```
 */
export class LandoAppStateMachine implements vscode.Disposable {
  private stateMap: Map<string, LandoAppStateInfo> = new Map();

  private readonly _onDidChangeState =
    new vscode.EventEmitter<StateChangeEvent>();

  /**
   * Event fired when any app's state changes
   */
  readonly onDidChangeState: vscode.Event<StateChangeEvent> =
    this._onDidChangeState.event;

  /**
   * Get the current state info for an app
   * @param appId - The app identifier (cleanName)
   * @returns State info, or Unknown state if not tracked
   */
  getState(appId: string): LandoAppStateInfo {
    return (
      this.stateMap.get(appId) ?? {
        state: LandoAppState.Unknown,
        timestamp: new Date(),
      }
    );
  }

  /**
   * Check if a transition from current state to target state is valid
   * @param appId - The app identifier
   * @param toState - The target state
   * @returns true if the transition is valid
   */
  canTransition(appId: string, toState: LandoAppState): boolean {
    const current = this.getState(appId);
    return VALID_TRANSITIONS[current.state]?.includes(toState) ?? false;
  }

  /**
   * Attempt to transition an app to a new state
   * @param appId - The app identifier
   * @param newState - The target state
   * @param errorMessage - Optional error message (for Error state)
   * @returns true if transition succeeded, false if invalid
   */
  transition(
    appId: string,
    newState: LandoAppState,
    errorMessage?: string
  ): boolean {
    const current = this.getState(appId);

    // Same state - no transition needed
    if (current.state === newState) {
      return true;
    }

    // Check if transition is valid
    if (!this.canTransition(appId, newState)) {
      return false;
    }

    const previousState = current.state;

    // Build new state info
    const newInfo: LandoAppStateInfo = {
      state: newState,
      timestamp: new Date(),
    };

    // Track error details
    if (newState === LandoAppState.Error) {
      newInfo.errorMessage = errorMessage;
      newInfo.previousState = previousState;
    }

    this.stateMap.set(appId, newInfo);

    // Emit change event
    this._onDidChangeState.fire({
      appId,
      previousState,
      newState,
      errorMessage,
    });

    return true;
  }

  /**
   * Mark an app as starting (used before running start command)
   * @param appId - The app identifier
   * @returns true if transition succeeded
   */
  markStarting(appId: string): boolean {
    return this.transition(appId, LandoAppState.Starting);
  }

  /**
   * Mark an app as stopping (used before running stop command)
   * @param appId - The app identifier
   * @returns true if transition succeeded
   */
  markStopping(appId: string): boolean {
    return this.transition(appId, LandoAppState.Stopping);
  }

  /**
   * Mark an app as rebuilding (used before running rebuild command)
   * @param appId - The app identifier
   * @returns true if transition succeeded
   */
  markRebuilding(appId: string): boolean {
    return this.transition(appId, LandoAppState.Rebuilding);
  }

  /**
   * Mark an app as being destroyed (used before running destroy command)
   * @param appId - The app identifier
   * @returns true if transition succeeded
   */
  markDestroying(appId: string): boolean {
    return this.transition(appId, LandoAppState.Destroying);
  }

  /**
   * Mark an app as having an error
   * @param appId - The app identifier
   * @param message - Error message
   * @returns true if transition succeeded
   */
  markError(appId: string, message: string): boolean {
    return this.transition(appId, LandoAppState.Error, message);
  }

  /**
   * Update state based on poll results.
   * This is the primary way state is updated after the initial transition.
   * Handles clearing Error states and updating from transitional states.
   *
   * @param appId - The app identifier
   * @param isRunning - Whether containers are running (from poll)
   */
  updateFromPoll(appId: string, isRunning: boolean): void {
    const targetState = isRunning
      ? LandoAppState.Running
      : LandoAppState.Stopped;
    const current = this.getState(appId);

    // If already in the target terminal state, nothing to do
    if (current.state === targetState) {
      return;
    }

    // Try to transition - this handles all the validation
    // For transitional states (Starting -> Running, Stopping -> Stopped, etc.)
    // the transition will succeed based on VALID_TRANSITIONS
    this.transition(appId, targetState);
  }

  /**
   * Remove tracking for an app (e.g., when app is removed from workspace)
   * @param appId - The app identifier
   */
  removeApp(appId: string): void {
    this.stateMap.delete(appId);
  }

  /**
   * Clear all tracked state
   */
  clear(): void {
    this.stateMap.clear();
  }

  /**
   * Get all tracked app IDs
   */
  getTrackedApps(): string[] {
    return Array.from(this.stateMap.keys());
  }

  dispose(): void {
    this._onDidChangeState.dispose();
    this.stateMap.clear();
  }
}
