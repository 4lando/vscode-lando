/**
 * Lando App Detection Module
 * 
 * This module provides automatic detection and monitoring of Lando applications
 * within VS Code workspaces. It scans workspace folders for .lando.yml files,
 * watches for changes, and provides an interface for managing detected apps.
 * 
 * @module landoAppDetector
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Represents a detected Lando application
 */
export interface LandoApp {
  /** The name of the Lando app (from the 'name' field in .lando.yml) */
  name: string;
  /** Cleaned app name (no dashes/underscores, lowercase) for container naming */
  cleanName: string;
  /** Full path to the .lando.yml file */
  configPath: string;
  /** Directory containing the .lando.yml file */
  rootPath: string;
  /** The workspace folder this app belongs to */
  workspaceFolder: vscode.WorkspaceFolder;
  /** The recipe type (e.g., 'drupal10', 'wordpress', 'lamp') */
  recipe?: string;
  /** Services defined in the config */
  services?: string[];
}

/**
 * Event data emitted when Lando apps change
 */
export interface LandoAppsChangedEvent {
  /** All currently detected apps */
  apps: LandoApp[];
  /** Apps that were added */
  added: LandoApp[];
  /** Apps that were removed */
  removed: LandoApp[];
}

/**
 * Configuration options for the detector
 */
interface DetectorConfig {
  /** Maximum depth to search for .lando.yml files (default: 3) */
  maxDepth: number;
  /** Directories to exclude from search */
  excludeDirs: string[];
}

/**
 * Detects and monitors Lando applications in VS Code workspaces.
 * 
 * Features:
 * - Scans all workspace folders for .lando.yml files
 * - Supports nested Lando apps (configurable depth)
 * - Watches for file system changes (create/delete/modify)
 * - Emits events when apps are added or removed
 * 
 * @example
 * ```typescript
 * const detector = new LandoAppDetector();
 * detector.onDidChangeApps(event => {
 *   console.log(`Found ${event.apps.length} Lando apps`);
 * });
 * await detector.activate(context);
 * ```
 */
export class LandoAppDetector implements vscode.Disposable {
  private apps: Map<string, LandoApp> = new Map();
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private workspaceFolderWatcher: vscode.Disposable | undefined;
  private outputChannel: vscode.OutputChannel | undefined;
  private config: DetectorConfig;

  private readonly _onDidChangeApps = new vscode.EventEmitter<LandoAppsChangedEvent>();
  
  /**
   * Event fired when Lando apps are detected, added, or removed
   */
  public readonly onDidChangeApps = this._onDidChangeApps.event;

  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Loads detector configuration from VS Code settings
   */
  private loadConfig(): DetectorConfig {
    const config = vscode.workspace.getConfiguration('lando');
    return {
      maxDepth: config.get('detection.maxDepth', 3),
      excludeDirs: config.get('detection.excludeDirs', [
        'node_modules',
        'vendor',
        '.git',
        'dist',
        'build',
        'out',
        '.cache',
        'coverage'
      ])
    };
  }

  /**
   * Activates the Lando app detector
   * 
   * @param context - VS Code extension context for managing subscriptions
   * @param outputChannel - Optional output channel for logging
   */
  public async activate(
    context: vscode.ExtensionContext,
    outputChannel?: vscode.OutputChannel
  ): Promise<void> {
    this.outputChannel = outputChannel;
    this.log('Activating Lando app detector...');

    // Initial scan of all workspace folders
    await this.scanAllWorkspaces();

    // Set up file watcher for .lando.yml files
    this.setupFileWatcher(context);

    // Watch for workspace folder changes
    this.setupWorkspaceFolderWatcher(context);

    // Listen for configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('lando.detection')) {
          this.config = this.loadConfig();
          this.scanAllWorkspaces();
        }
      })
    );

    context.subscriptions.push(this);
    this.log(`Detector activated. Found ${this.apps.size} Lando app(s).`);
  }

  /**
   * Sets up the file system watcher for .lando.yml files
   */
  private setupFileWatcher(context: vscode.ExtensionContext): void {
    // Watch for .lando.yml and .lando.*.yml files
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      '**/.lando{,.*}.yml',
      false, // Don't ignore creates
      false, // Don't ignore changes
      false  // Don't ignore deletes
    );

    this.fileWatcher.onDidCreate(uri => this.handleFileCreate(uri));
    this.fileWatcher.onDidChange(uri => this.handleFileChange(uri));
    this.fileWatcher.onDidDelete(uri => this.handleFileDelete(uri));

    context.subscriptions.push(this.fileWatcher);
  }

  /**
   * Sets up the workspace folder change watcher
   */
  private setupWorkspaceFolderWatcher(context: vscode.ExtensionContext): void {
    this.workspaceFolderWatcher = vscode.workspace.onDidChangeWorkspaceFolders(
      async event => {
        // Scan newly added folders
        for (const folder of event.added) {
          await this.scanWorkspaceFolder(folder);
        }

        // Remove apps from removed folders
        for (const folder of event.removed) {
          this.removeAppsInFolder(folder);
        }
      }
    );

    context.subscriptions.push(this.workspaceFolderWatcher);
  }

  /**
   * Scans all workspace folders for Lando apps
   */
  private async scanAllWorkspaces(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this.log('No workspace folders to scan');
      return;
    }

    const previousApps = new Map(this.apps);
    this.apps.clear();

    for (const folder of workspaceFolders) {
      await this.scanWorkspaceFolder(folder);
    }

    // Calculate changes
    const added: LandoApp[] = [];
    const removed: LandoApp[] = [];

    for (const [path, app] of this.apps) {
      if (!previousApps.has(path)) {
        added.push(app);
      }
    }

    for (const [path, app] of previousApps) {
      if (!this.apps.has(path)) {
        removed.push(app);
      }
    }

    if (added.length > 0 || removed.length > 0) {
      this._onDidChangeApps.fire({
        apps: Array.from(this.apps.values()),
        added,
        removed
      });
    }
  }

  /**
   * Scans a single workspace folder for Lando apps
   */
  private async scanWorkspaceFolder(folder: vscode.WorkspaceFolder): Promise<void> {
    this.log(`Scanning workspace folder: ${folder.uri.fsPath}`);
    await this.scanDirectory(folder.uri.fsPath, folder, 0);
  }

  /**
   * Recursively scans a directory for .lando.yml files
   */
  private async scanDirectory(
    dirPath: string,
    workspaceFolder: vscode.WorkspaceFolder,
    depth: number
  ): Promise<void> {
    if (depth > this.config.maxDepth) {
      return;
    }

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile() && this.isLandoFile(entry.name)) {
          await this.parseAndAddApp(fullPath, workspaceFolder);
        } else if (entry.isDirectory() && !this.shouldExcludeDir(entry.name)) {
          await this.scanDirectory(fullPath, workspaceFolder, depth + 1);
        }
      }
    } catch (error) {
      this.log(`Error scanning directory ${dirPath}: ${error}`);
    }
  }

  /**
   * Checks if a filename matches the Lando config pattern
   */
  private isLandoFile(filename: string): boolean {
    return /^\.lando(\..+)?\.yml$/.test(filename);
  }

  /**
   * Checks if a directory should be excluded from scanning
   */
  private shouldExcludeDir(dirname: string): boolean {
    return this.config.excludeDirs.includes(dirname) || dirname.startsWith('.');
  }

  /**
   * Parses a .lando.yml file and adds it to the detected apps
   */
  private async parseAndAddApp(
    configPath: string,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<LandoApp | undefined> {
    try {
      const content = await fs.promises.readFile(configPath, 'utf8');
      const app = this.parseLandoConfig(content, configPath, workspaceFolder);
      
      if (app) {
        this.apps.set(configPath, app);
        this.log(`Detected Lando app: ${app.name} at ${configPath}`);
        return app;
      }
    } catch (error) {
      this.log(`Error parsing ${configPath}: ${error}`);
    }
    return undefined;
  }

  /**
   * Parses Lando configuration content
   */
  private parseLandoConfig(
    content: string,
    configPath: string,
    workspaceFolder: vscode.WorkspaceFolder
  ): LandoApp | null {
    // Extract app name
    const nameMatch = content.match(/^name:\s*['"]?([^'"#\n]+)['"]?/m);
    if (!nameMatch) {
      this.log(`No name found in ${configPath}`);
      return null;
    }

    const name = nameMatch[1].trim();
    const cleanName = name.replace(/[-_]/g, '').toLowerCase();

    // Extract recipe (optional)
    const recipeMatch = content.match(/^recipe:\s*['"]?([^'"#\n]+)['"]?/m);
    const recipe = recipeMatch ? recipeMatch[1].trim() : undefined;

    // Extract services (optional)
    const servicesMatch = content.match(/^services:\s*\n((?:\s+[a-zA-Z0-9_-]+:.*\n?)+)/m);
    let services: string[] | undefined;
    if (servicesMatch) {
      const servicesBlock = servicesMatch[1];
      const serviceMatches = servicesBlock.matchAll(/^\s{2}([a-zA-Z0-9_-]+):/gm);
      services = Array.from(serviceMatches, m => m[1]);
    }

    return {
      name,
      cleanName,
      configPath,
      rootPath: path.dirname(configPath),
      workspaceFolder,
      recipe,
      services
    };
  }

  /**
   * Handles creation of a new .lando.yml file
   */
  private async handleFileCreate(uri: vscode.Uri): Promise<void> {
    this.log(`Lando config created: ${uri.fsPath}`);
    
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return;
    }

    const app = await this.parseAndAddApp(uri.fsPath, workspaceFolder);
    if (app) {
      this._onDidChangeApps.fire({
        apps: Array.from(this.apps.values()),
        added: [app],
        removed: []
      });
    }
  }

  /**
   * Handles changes to a .lando.yml file
   */
  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    this.log(`Lando config changed: ${uri.fsPath}`);
    
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return;
    }

    // Remove old entry and re-parse
    const oldApp = this.apps.get(uri.fsPath);
    this.apps.delete(uri.fsPath);

    const newApp = await this.parseAndAddApp(uri.fsPath, workspaceFolder);
    
    if (oldApp || newApp) {
      this._onDidChangeApps.fire({
        apps: Array.from(this.apps.values()),
        added: newApp ? [newApp] : [],
        removed: oldApp ? [oldApp] : []
      });
    }
  }

  /**
   * Handles deletion of a .lando.yml file
   */
  private handleFileDelete(uri: vscode.Uri): void {
    this.log(`Lando config deleted: ${uri.fsPath}`);
    
    const app = this.apps.get(uri.fsPath);
    if (app) {
      this.apps.delete(uri.fsPath);
      this._onDidChangeApps.fire({
        apps: Array.from(this.apps.values()),
        added: [],
        removed: [app]
      });
    }
  }

  /**
   * Removes all apps belonging to a workspace folder
   */
  private removeAppsInFolder(folder: vscode.WorkspaceFolder): void {
    const removed: LandoApp[] = [];
    
    for (const [path, app] of this.apps) {
      if (app.workspaceFolder === folder) {
        removed.push(app);
        this.apps.delete(path);
      }
    }

    if (removed.length > 0) {
      this._onDidChangeApps.fire({
        apps: Array.from(this.apps.values()),
        added: [],
        removed
      });
    }
  }

  /**
   * Gets all detected Lando apps
   */
  public getApps(): LandoApp[] {
    return Array.from(this.apps.values());
  }

  /**
   * Gets the Lando app at a specific path
   */
  public getAppByPath(configPath: string): LandoApp | undefined {
    return this.apps.get(configPath);
  }

  /**
   * Gets the Lando app containing a file
   */
  public getAppForFile(filePath: string): LandoApp | undefined {
    let bestMatch: LandoApp | undefined;
    let bestMatchLength = 0;

    for (const app of this.apps.values()) {
      if (filePath.startsWith(app.rootPath) && app.rootPath.length > bestMatchLength) {
        bestMatch = app;
        bestMatchLength = app.rootPath.length;
      }
    }

    return bestMatch;
  }

  /**
   * Gets the primary Lando app for a workspace folder
   * Returns the app at the root of the folder, or the first found
   */
  public getPrimaryApp(folder?: vscode.WorkspaceFolder): LandoApp | undefined {
    const targetFolder = folder || vscode.workspace.workspaceFolders?.[0];
    if (!targetFolder) {
      return undefined;
    }

    // First, try to find an app at the root of the workspace folder
    for (const app of this.apps.values()) {
      if (app.workspaceFolder === targetFolder && 
          app.rootPath === targetFolder.uri.fsPath) {
        return app;
      }
    }

    // Otherwise, return the first app in this folder
    for (const app of this.apps.values()) {
      if (app.workspaceFolder === targetFolder) {
        return app;
      }
    }

    return undefined;
  }

  /**
   * Checks if any Lando apps were detected
   */
  public hasApps(): boolean {
    return this.apps.size > 0;
  }

  /**
   * Gets the count of detected apps
   */
  public getAppCount(): number {
    return this.apps.size;
  }

  /**
   * Forces a rescan of all workspaces
   */
  public async rescan(): Promise<void> {
    this.log('Rescanning all workspaces...');
    await this.scanAllWorkspaces();
  }

  /**
   * Logs a message to the output channel
   */
  private log(message: string): void {
    this.outputChannel?.appendLine(`[AppDetector] ${message}`);
  }

  /**
   * Disposes of the detector resources
   */
  public dispose(): void {
    this._onDidChangeApps.dispose();
    this.fileWatcher?.dispose();
    this.workspaceFolderWatcher?.dispose();
  }
}
