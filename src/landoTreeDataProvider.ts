/**
 * Lando TreeView Provider Module
 * 
 * This module provides a TreeView sidebar for VS Code that displays Lando apps,
 * their services, URLs, and tooling commands in a persistent, navigable tree structure.
 * 
 * @module landoTreeDataProvider
 */

import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import { LandoApp, LandoAppDetector, LandoTooling } from './landoAppDetector';
import { LandoStatusMonitor, LandoAppStatus } from './landoStatusMonitor';

/**
 * Types of tree items that can be displayed
 */
export type LandoTreeItemType = 
  | 'app'
  | 'servicesGroup'
  | 'service'
  | 'urlsGroup'
  | 'url'
  | 'toolingGroup'
  | 'tooling'
  | 'loading'
  | 'noApps';

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
 * Represents a Lando service with runtime information
 */
interface LandoServiceInfo {
  /** The service name */
  name: string;
  /** The service type (e.g., 'php', 'mysql') */
  type: string;
  /** Whether the service is running */
  running?: boolean;
}

/**
 * Custom TreeItem for Lando elements
 */
export class LandoTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: LandoTreeItemType,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly app?: LandoApp,
    public readonly data?: unknown
  ) {
    super(label, collapsibleState);
    this.contextValue = type;
    this.setupItem();
  }

  /**
   * Sets up item-specific properties (icon, command, etc.)
   */
  private setupItem(): void {
    switch (this.type) {
      case 'app':
        this.setupAppItem();
        break;
      case 'servicesGroup':
        this.iconPath = new vscode.ThemeIcon('server');
        this.description = 'Services';
        break;
      case 'service':
        this.setupServiceItem();
        break;
      case 'urlsGroup':
        this.iconPath = new vscode.ThemeIcon('globe');
        this.description = 'URLs';
        break;
      case 'url':
        this.setupUrlItem();
        break;
      case 'toolingGroup':
        this.iconPath = new vscode.ThemeIcon('tools');
        this.description = 'Tooling';
        break;
      case 'tooling':
        this.setupToolingItem();
        break;
      case 'loading':
        this.iconPath = new vscode.ThemeIcon('loading~spin');
        break;
      case 'noApps':
        this.iconPath = new vscode.ThemeIcon('info');
        this.description = 'No Lando apps found';
        break;
    }
  }

  /**
   * Sets up an app tree item
   */
  private setupAppItem(): void {
    if (!this.app) {
      return;
    }

    // Icon will be set based on status later
    this.iconPath = new vscode.ThemeIcon('package');
    this.description = this.app.recipe || 'custom';
    this.tooltip = new vscode.MarkdownString(
      `**${this.app.name}**\n\n` +
      `Recipe: ${this.app.recipe || 'custom'}\n\n` +
      `Path: \`${this.app.rootPath}\``
    );
  }

  /**
   * Sets up a service tree item
   */
  private setupServiceItem(): void {
    const service = this.data as LandoServiceInfo;
    if (!service) {
      return;
    }

    this.iconPath = new vscode.ThemeIcon(
      service.running ? 'circle-filled' : 'circle-outline',
      service.running 
        ? new vscode.ThemeColor('testing.iconPassed')
        : new vscode.ThemeColor('testing.iconSkipped')
    );
    this.description = service.type;
    this.tooltip = `${service.name} (${service.type})${service.running ? ' - Running' : ' - Stopped'}`;
  }

  /**
   * Sets up a URL tree item
   */
  private setupUrlItem(): void {
    const urlData = this.data as LandoServiceUrl;
    if (!urlData) {
      return;
    }

    this.iconPath = new vscode.ThemeIcon('link-external');
    this.description = urlData.service;
    this.tooltip = `Open ${urlData.url} in browser`;
    this.command = {
      command: 'lando.openUrlDirect',
      title: 'Open URL',
      arguments: [urlData.url]
    };
  }

  /**
   * Sets up a tooling tree item
   */
  private setupToolingItem(): void {
    const tooling = this.data as LandoTooling;
    if (!tooling) {
      return;
    }

    this.iconPath = new vscode.ThemeIcon('terminal');
    this.description = tooling.description || tooling.service;
    this.tooltip = tooling.description 
      ? `${tooling.name}: ${tooling.description}`
      : `Run lando ${tooling.name}`;
    this.command = {
      command: 'lando.runToolingDirect',
      title: 'Run Tooling',
      arguments: [this.app, tooling.name]
    };
  }

  /**
   * Updates the app status icon
   */
  public updateStatus(status: LandoAppStatus | undefined): void {
    if (this.type !== 'app') {
      return;
    }

    const isRunning = status?.running ?? false;
    this.iconPath = new vscode.ThemeIcon(
      isRunning ? 'vm-running' : 'vm-outline',
      isRunning 
        ? new vscode.ThemeColor('testing.iconPassed')
        : new vscode.ThemeColor('testing.iconSkipped')
    );

    if (status) {
      const statusText = isRunning ? 'Running' : 'Stopped';
      this.tooltip = new vscode.MarkdownString(
        `**${this.app?.name}**\n\n` +
        `Status: ${statusText} (${status.runningContainers}/${status.totalContainers} containers)\n\n` +
        `Recipe: ${this.app?.recipe || 'custom'}\n\n` +
        `Path: \`${this.app?.rootPath}\``
      );
    }
  }
}

/**
 * Provides tree data for the Lando Explorer sidebar.
 * 
 * The tree structure is:
 * - App 1
 *   - Services
 *     - appserver (php)
 *     - database (mysql)
 *   - URLs
 *     - https://myapp.lndo.site
 *   - Tooling
 *     - composer
 *     - drush
 * - App 2
 *   ...
 */
export class LandoTreeDataProvider implements vscode.TreeDataProvider<LandoTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<LandoTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private appDetector: LandoAppDetector | undefined;
  private statusMonitor: LandoStatusMonitor | undefined;
  private outputChannel: vscode.OutputChannel | undefined;
  
  // Cache for services and URLs (fetched via lando info)
  private servicesCache: Map<string, LandoServiceInfo[]> = new Map();
  private urlsCache: Map<string, LandoServiceUrl[]> = new Map();
  private fetchingInfo: Set<string> = new Set();

  constructor() {}

  /**
   * Activates the TreeView provider
   */
  public activate(
    context: vscode.ExtensionContext,
    appDetector: LandoAppDetector,
    statusMonitor: LandoStatusMonitor,
    outputChannel?: vscode.OutputChannel
  ): vscode.TreeView<LandoTreeItem> {
    this.appDetector = appDetector;
    this.statusMonitor = statusMonitor;
    this.outputChannel = outputChannel;

    // Create the TreeView
    const treeView = vscode.window.createTreeView('landoExplorer', {
      treeDataProvider: this,
      showCollapseAll: true
    });

    // Register commands for tree actions
    this.registerCommands(context);

    // Listen for app changes
    appDetector.onDidChangeApps(() => {
      this.clearCaches();
      this._onDidChangeTreeData.fire();
    });

    // Listen for status changes
    statusMonitor.onDidUpdateStatuses(() => {
      this._onDidChangeTreeData.fire();
    });

    context.subscriptions.push(treeView);
    this.log('Lando TreeView activated');

    return treeView;
  }

  /**
   * Registers commands used by the TreeView
   */
  private registerCommands(context: vscode.ExtensionContext): void {
    // Direct URL opening (bypasses the Quick Pick)
    context.subscriptions.push(
      vscode.commands.registerCommand('lando.openUrlDirect', (url: string) => {
        vscode.env.openExternal(vscode.Uri.parse(url));
      })
    );

    // Direct tooling command (runs without argument prompt for simple commands)
    context.subscriptions.push(
      vscode.commands.registerCommand('lando.runToolingDirect', async (app: LandoApp, command: string) => {
        // Ask for arguments
        const args = await vscode.window.showInputBox({
          prompt: `Arguments for 'lando ${command}'`,
          placeHolder: 'Enter arguments (optional)'
        });

        if (args === undefined) {
          return; // User cancelled
        }

        const terminalName = `Lando: ${command}`;
        const existingTerminal = vscode.window.terminals.find(t => t.name === terminalName);
        const terminal = existingTerminal || vscode.window.createTerminal({
          name: terminalName,
          cwd: app.rootPath
        });

        const fullCommand = args.trim() ? `lando ${command} ${args.trim()}` : `lando ${command}`;
        terminal.sendText(fullCommand);
        terminal.show();
      })
    );

    // Refresh TreeView
    context.subscriptions.push(
      vscode.commands.registerCommand('lando.refreshExplorer', () => {
        this.clearCaches();
        this._onDidChangeTreeData.fire();
      })
    );

    // Tree item actions - these run lando commands directly on the clicked app
    context.subscriptions.push(
      vscode.commands.registerCommand('lando.treeStartApp', async (item: LandoTreeItem) => {
        if (!item.app) {
          return;
        }
        const app = item.app;
        const terminal = vscode.window.createTerminal({
          name: `Lando: ${app.name}`,
          cwd: app.rootPath
        });
        terminal.sendText('lando start');
        terminal.show();
        this.log(`Starting ${app.name} from TreeView`);
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('lando.treeStopApp', async (item: LandoTreeItem) => {
        if (!item.app) {
          return;
        }
        const app = item.app;
        const terminal = vscode.window.createTerminal({
          name: `Lando: ${app.name}`,
          cwd: app.rootPath
        });
        terminal.sendText('lando stop');
        terminal.show();
        this.log(`Stopping ${app.name} from TreeView`);
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('lando.treeRestartApp', async (item: LandoTreeItem) => {
        if (!item.app) {
          return;
        }
        const app = item.app;
        const terminal = vscode.window.createTerminal({
          name: `Lando: ${app.name}`,
          cwd: app.rootPath
        });
        terminal.sendText('lando restart');
        terminal.show();
        this.log(`Restarting ${app.name} from TreeView`);
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('lando.treeOpenTerminal', async (item: LandoTreeItem) => {
        if (!item.app) {
          return;
        }
        const app = item.app;
        // Get available services from cache or fetch them
        let services = this.servicesCache.get(app.configPath);
        if (!services || services.length === 0) {
          await this.fetchAppInfo(app);
          services = this.servicesCache.get(app.configPath);
        }

        if (!services || services.length === 0) {
          // Fall back to default service
          const terminal = vscode.window.createTerminal({
            name: `Lando: ${app.name} (ssh)`,
            cwd: app.rootPath
          });
          terminal.sendText('lando ssh');
          terminal.show();
          return;
        }

        // If there's only one service, connect directly
        if (services.length === 1) {
          const terminal = vscode.window.createTerminal({
            name: `Lando: ${app.name} (${services[0].name})`,
            cwd: app.rootPath
          });
          terminal.sendText(`lando ssh -s ${services[0].name}`);
          terminal.show();
          return;
        }

        // Multiple services - show quick pick
        const items = services.map(s => ({
          label: s.name,
          description: s.type,
          service: s.name
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a service to connect to'
        });

        if (selected) {
          const terminal = vscode.window.createTerminal({
            name: `Lando: ${app.name} (${selected.service})`,
            cwd: app.rootPath
          });
          terminal.sendText(`lando ssh -s ${selected.service}`);
          terminal.show();
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('lando.treeCopyUrl', async (item: LandoTreeItem) => {
        if (item.type === 'url') {
          const urlData = item.data as LandoServiceUrl;
          await vscode.env.clipboard.writeText(urlData.url);
          vscode.window.showInformationMessage(`Copied: ${urlData.url}`);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('lando.treeOpenSshService', async (item: LandoTreeItem) => {
        if (item.type === 'service' && item.app) {
          const service = item.data as LandoServiceInfo;
          const terminal = vscode.window.createTerminal({
            name: `Lando: ${item.app.name} (${service.name})`,
            cwd: item.app.rootPath
          });
          terminal.sendText(`lando ssh -s ${service.name}`);
          terminal.show();
        }
      })
    );
  }

  /**
   * Gets tree item for display
   */
  getTreeItem(element: LandoTreeItem): vscode.TreeItem {
    // Update status for app items
    if (element.type === 'app' && element.app && this.statusMonitor) {
      const status = this.statusMonitor.getStatus(element.app);
      element.updateStatus(status);
    }
    return element;
  }

  /**
   * Gets children for a tree element
   */
  async getChildren(element?: LandoTreeItem): Promise<LandoTreeItem[]> {
    if (!this.appDetector) {
      return [];
    }

    // Root level: show apps
    if (!element) {
      return this.getAppItems();
    }

    // App level: show groups (Services, URLs, Tooling)
    if (element.type === 'app' && element.app) {
      return this.getAppChildren(element.app);
    }

    // Services group: show services
    if (element.type === 'servicesGroup' && element.app) {
      return this.getServiceItems(element.app);
    }

    // URLs group: show URLs
    if (element.type === 'urlsGroup' && element.app) {
      return this.getUrlItems(element.app);
    }

    // Tooling group: show tooling commands
    if (element.type === 'toolingGroup' && element.app) {
      return this.getToolingItems(element.app);
    }

    return [];
  }

  /**
   * Gets the parent of a tree item (required for reveal functionality)
   */
  getParent(element: LandoTreeItem): LandoTreeItem | undefined {
    // For simplicity, we don't track parent relationships
    // This is optional and mainly used for reveal() functionality
    return undefined;
  }

  /**
   * Gets app items for the root level
   */
  private getAppItems(): LandoTreeItem[] {
    const apps = this.appDetector?.getApps() ?? [];

    if (apps.length === 0) {
      return [
        new LandoTreeItem(
          'No Lando apps detected',
          'noApps',
          vscode.TreeItemCollapsibleState.None
        )
      ];
    }

    return apps.map(app => {
      const item = new LandoTreeItem(
        app.name,
        'app',
        vscode.TreeItemCollapsibleState.Expanded,
        app
      );

      // Update status
      if (this.statusMonitor) {
        const status = this.statusMonitor.getStatus(app);
        item.updateStatus(status);
      }

      return item;
    });
  }

  /**
   * Gets children groups for an app
   */
  private getAppChildren(app: LandoApp): LandoTreeItem[] {
    const children: LandoTreeItem[] = [];

    // Services group
    children.push(new LandoTreeItem(
      'Services',
      'servicesGroup',
      vscode.TreeItemCollapsibleState.Collapsed,
      app
    ));

    // URLs group (only show if app is running)
    const status = this.statusMonitor?.getStatus(app);
    if (status?.running) {
      children.push(new LandoTreeItem(
        'URLs',
        'urlsGroup',
        vscode.TreeItemCollapsibleState.Collapsed,
        app
      ));
    }

    // Tooling group
    children.push(new LandoTreeItem(
      'Tooling',
      'toolingGroup',
      vscode.TreeItemCollapsibleState.Collapsed,
      app
    ));

    return children;
  }

  /**
   * Gets service items for an app
   */
  private async getServiceItems(app: LandoApp): Promise<LandoTreeItem[]> {
    // Check cache first
    let services = this.servicesCache.get(app.configPath);
    
    if (!services) {
      // Fetch services from lando info
      await this.fetchAppInfo(app);
      services = this.servicesCache.get(app.configPath);
    }

    if (!services || services.length === 0) {
      // Show services from config file if lando info failed
      const configServices = app.services || [];
      return configServices.map(name => new LandoTreeItem(
        name,
        'service',
        vscode.TreeItemCollapsibleState.None,
        app,
        { name, type: 'unknown', running: false } as LandoServiceInfo
      ));
    }

    return services.map(service => new LandoTreeItem(
      service.name,
      'service',
      vscode.TreeItemCollapsibleState.None,
      app,
      service
    ));
  }

  /**
   * Gets URL items for an app
   */
  private async getUrlItems(app: LandoApp): Promise<LandoTreeItem[]> {
    // Check cache first
    let urls = this.urlsCache.get(app.configPath);
    
    if (!urls) {
      await this.fetchAppInfo(app);
      urls = this.urlsCache.get(app.configPath);
    }

    if (!urls || urls.length === 0) {
      return [new LandoTreeItem(
        'No URLs available',
        'loading',
        vscode.TreeItemCollapsibleState.None,
        app
      )];
    }

    return urls.map(url => new LandoTreeItem(
      url.url,
      'url',
      vscode.TreeItemCollapsibleState.None,
      app,
      url
    ));
  }

  /**
   * Gets tooling items for an app
   */
  private async getToolingItems(app: LandoApp): Promise<LandoTreeItem[]> {
    // Use tooling from config if available
    const configTooling = app.tooling || [];
    
    // Also try to get available tooling from lando CLI
    const availableTooling = await this.fetchAvailableTooling(app);
    
    // Combine and dedupe
    const toolingMap = new Map<string, LandoTooling>();
    
    for (const t of configTooling) {
      toolingMap.set(t.name, t);
    }
    
    for (const t of availableTooling) {
      if (!toolingMap.has(t.name)) {
        toolingMap.set(t.name, t);
      }
    }

    const tooling = Array.from(toolingMap.values());
    
    if (tooling.length === 0) {
      return [new LandoTreeItem(
        'No tooling commands',
        'loading',
        vscode.TreeItemCollapsibleState.None,
        app
      )];
    }

    return tooling.map(t => new LandoTreeItem(
      t.name,
      'tooling',
      vscode.TreeItemCollapsibleState.None,
      app,
      t
    ));
  }

  /**
   * Fetches app info (services and URLs) from lando info command.
   * Uses async spawn to avoid blocking the VS Code UI thread.
   */
  private async fetchAppInfo(app: LandoApp): Promise<void> {
    if (this.fetchingInfo.has(app.configPath)) {
      return; // Already fetching
    }

    this.fetchingInfo.add(app.configPath);

    return new Promise((resolve) => {
      const landoProcess = childProcess.spawn('lando', ['info', '--format=json'], {
        cwd: app.rootPath,
        stdio: 'pipe'
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
        this.log(`Error spawning lando info for ${app.name}: ${error}`);
        this.servicesCache.set(app.configPath, []);
        this.urlsCache.set(app.configPath, []);
        this.fetchingInfo.delete(app.configPath);
        resolve();
      });

      landoProcess.on('close', (code) => {
        try {
          if (code !== 0 || !stdout) {
            this.log(`lando info failed for ${app.name}: exit code ${code}, stderr: ${stderr}`);
            this.servicesCache.set(app.configPath, []);
            this.urlsCache.set(app.configPath, []);
            this.fetchingInfo.delete(app.configPath);
            resolve();
            return;
          }

          const infoArray = JSON.parse(stdout) as Array<{
            service: string;
            type?: string;
            urls?: string[];
            running?: boolean;
          }>;

          const services: LandoServiceInfo[] = [];
          const urls: LandoServiceUrl[] = [];

          for (const info of infoArray) {
            services.push({
              name: info.service,
              type: info.type || 'unknown',
              running: info.running
            });

            if (info.urls) {
              for (let i = 0; i < info.urls.length; i++) {
                urls.push({
                  service: info.service,
                  url: info.urls[i],
                  primary: i === 0
                });
              }
            }
          }

          this.servicesCache.set(app.configPath, services);
          this.urlsCache.set(app.configPath, urls);
          
          this.log(`Fetched info for ${app.name}: ${services.length} services, ${urls.length} URLs`);
        } catch (error) {
          this.log(`Error parsing lando info for ${app.name}: ${error}`);
          this.servicesCache.set(app.configPath, []);
          this.urlsCache.set(app.configPath, []);
        } finally {
          this.fetchingInfo.delete(app.configPath);
          resolve();
        }
      });

      // Timeout to prevent hanging
      setTimeout(() => {
        if (this.fetchingInfo.has(app.configPath)) {
          this.log(`lando info timed out for ${app.name}`);
          landoProcess.kill();
          this.servicesCache.set(app.configPath, []);
          this.urlsCache.set(app.configPath, []);
          this.fetchingInfo.delete(app.configPath);
          resolve();
        }
      }, 15000);
    });
  }

  /**
   * Fetches available tooling commands from Lando CLI
   */
  private async fetchAvailableTooling(app: LandoApp): Promise<LandoTooling[]> {
    return new Promise((resolve) => {
      const tooling: LandoTooling[] = [];
      
      const landoProcess = childProcess.spawn('lando', [], {
        cwd: app.rootPath,
        stdio: 'pipe'
      });

      let stdout = '';

      landoProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      landoProcess.on('error', () => {
        resolve([]);
      });

      landoProcess.on('close', (code) => {
        if (code !== 0 && !stdout) {
          resolve([]);
          return;
        }

        try {
          // Parse the output to extract commands
          const coreCommands = new Set([
            'config', 'destroy', 'exec', 'info', 'init', 'list',
            'logs', 'poweroff', 'rebuild', 'restart', 'start',
            'stop', 'update', 'version', 'share', 'ssh',
            'db-export', 'db-import'
          ]);

          const lines = stdout.split('\n');
          let inCommandsSection = false;

          for (const line of lines) {
            if (line.trim() === 'Commands:') {
              inCommandsSection = true;
              continue;
            }
            if (line.trim() === 'Options:' || line.trim() === 'Examples:') {
              inCommandsSection = false;
              continue;
            }
            if (!inCommandsSection) {
              continue;
            }

            const match = line.match(/^\s+lando\s+(\S+)(?:\s+\[.*?\])?\s+(.*?)\s*$/);
            if (match) {
              const [, commandName, description] = match;
              if (!coreCommands.has(commandName)) {
                tooling.push({
                  name: commandName,
                  description: description || undefined,
                  isCustom: false
                });
              }
            }
          }
          resolve(tooling);
        } catch {
          resolve([]);
        }
      });

      // Timeout
      setTimeout(() => {
        landoProcess.kill();
        resolve([]);
      }, 10000);
    });
  }

  /**
   * Clears all caches
   */
  private clearCaches(): void {
    this.servicesCache.clear();
    this.urlsCache.clear();
    this.fetchingInfo.clear();
  }

  /**
   * Refreshes the tree
   */
  public refresh(): void {
    this.clearCaches();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Logs a message to the output channel
   */
  private log(message: string): void {
    this.outputChannel?.appendLine(`[TreeView] ${message}`);
  }
}
