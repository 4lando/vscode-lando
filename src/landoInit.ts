/**
 * Lando App Initialization Wizard Module
 * 
 * This module provides a GUI-based wizard for creating new Lando applications,
 * offering a user-friendly alternative to the `lando init` CLI command.
 * 
 * @module landoInit
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Represents a Lando recipe with its configuration options
 */
export interface LandoRecipe {
  /** Recipe identifier (e.g., 'drupal10', 'wordpress') */
  id: string;
  /** Display name for the recipe */
  name: string;
  /** Description of what this recipe provides */
  description: string;
  /** Icon to display (VS Code codicon) */
  icon: string;
  /** Default services included with this recipe */
  defaultServices?: string[];
  /** Available PHP versions for this recipe */
  phpVersions?: string[];
  /** Default PHP version */
  defaultPhpVersion?: string;
  /** Available web servers */
  webServers?: string[];
  /** Default web server */
  defaultWebServer?: string;
  /** Available database types */
  databases?: string[];
  /** Default database */
  defaultDatabase?: string;
  /** Category for grouping in the UI */
  category: 'cms' | 'framework' | 'stack' | 'custom';
}

/**
 * Available Lando recipes with their configurations
 */
export const LANDO_RECIPES: LandoRecipe[] = [
  // CMS Recipes
  {
    id: 'drupal11',
    name: 'Drupal 11',
    description: 'Latest Drupal with PHP 8.3+ and modern tooling',
    icon: 'globe',
    category: 'cms',
    phpVersions: ['8.3', '8.4'],
    defaultPhpVersion: '8.3',
    webServers: ['apache', 'nginx'],
    defaultWebServer: 'apache',
    databases: ['mysql:8.0', 'mariadb:11', 'postgres:16'],
    defaultDatabase: 'mysql:8.0',
  },
  {
    id: 'drupal10',
    name: 'Drupal 10',
    description: 'Drupal 10 with Composer and Drush support',
    icon: 'globe',
    category: 'cms',
    phpVersions: ['8.1', '8.2', '8.3'],
    defaultPhpVersion: '8.2',
    webServers: ['apache', 'nginx'],
    defaultWebServer: 'apache',
    databases: ['mysql:8.0', 'mariadb:10.6', 'postgres:15'],
    defaultDatabase: 'mysql:8.0',
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    description: 'WordPress with WP-CLI and common development tools',
    icon: 'edit',
    category: 'cms',
    phpVersions: ['8.0', '8.1', '8.2', '8.3'],
    defaultPhpVersion: '8.2',
    webServers: ['apache', 'nginx'],
    defaultWebServer: 'apache',
    databases: ['mysql:8.0', 'mariadb:10.6'],
    defaultDatabase: 'mysql:8.0',
  },
  {
    id: 'backdrop',
    name: 'Backdrop CMS',
    description: 'Backdrop CMS development environment',
    icon: 'globe',
    category: 'cms',
    phpVersions: ['7.4', '8.0', '8.1', '8.2'],
    defaultPhpVersion: '8.1',
    webServers: ['apache'],
    defaultWebServer: 'apache',
    databases: ['mysql:8.0', 'mariadb:10.6'],
    defaultDatabase: 'mysql:8.0',
  },
  {
    id: 'joomla',
    name: 'Joomla',
    description: 'Joomla CMS development environment',
    icon: 'globe',
    category: 'cms',
    phpVersions: ['8.0', '8.1', '8.2'],
    defaultPhpVersion: '8.1',
    webServers: ['apache'],
    defaultWebServer: 'apache',
    databases: ['mysql:8.0'],
    defaultDatabase: 'mysql:8.0',
  },

  // Framework Recipes
  {
    id: 'laravel',
    name: 'Laravel',
    description: 'Laravel with Artisan, queues, and scheduling support',
    icon: 'rocket',
    category: 'framework',
    phpVersions: ['8.1', '8.2', '8.3'],
    defaultPhpVersion: '8.2',
    webServers: ['apache', 'nginx'],
    defaultWebServer: 'nginx',
    databases: ['mysql:8.0', 'mariadb:10.6', 'postgres:15'],
    defaultDatabase: 'mysql:8.0',
  },
  {
    id: 'symfony',
    name: 'Symfony',
    description: 'Symfony framework with console and common bundles',
    icon: 'rocket',
    category: 'framework',
    phpVersions: ['8.1', '8.2', '8.3'],
    defaultPhpVersion: '8.2',
    webServers: ['apache', 'nginx'],
    defaultWebServer: 'nginx',
    databases: ['mysql:8.0', 'postgres:15'],
    defaultDatabase: 'postgres:15',
  },

  // Stack Recipes
  {
    id: 'lamp',
    name: 'LAMP Stack',
    description: 'Linux, Apache, MySQL, PHP - classic web stack',
    icon: 'server',
    category: 'stack',
    phpVersions: ['7.4', '8.0', '8.1', '8.2', '8.3'],
    defaultPhpVersion: '8.2',
    webServers: ['apache'],
    defaultWebServer: 'apache',
    databases: ['mysql:8.0', 'mysql:5.7', 'mariadb:10.6'],
    defaultDatabase: 'mysql:8.0',
  },
  {
    id: 'lemp',
    name: 'LEMP Stack',
    description: 'Linux, Nginx, MySQL, PHP - modern web stack',
    icon: 'server',
    category: 'stack',
    phpVersions: ['7.4', '8.0', '8.1', '8.2', '8.3'],
    defaultPhpVersion: '8.2',
    webServers: ['nginx'],
    defaultWebServer: 'nginx',
    databases: ['mysql:8.0', 'mariadb:10.6'],
    defaultDatabase: 'mysql:8.0',
  },
  {
    id: 'mean',
    name: 'MEAN Stack',
    description: 'MongoDB, Express, Angular, Node.js',
    icon: 'server',
    category: 'stack',
    databases: ['mongo:6'],
    defaultDatabase: 'mongo:6',
  },
  {
    id: 'node',
    name: 'Node.js',
    description: 'Node.js development environment with npm/yarn',
    icon: 'package',
    category: 'stack',
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Python development environment with pip',
    icon: 'code',
    category: 'stack',
  },
  {
    id: 'ruby',
    name: 'Ruby',
    description: 'Ruby development environment with Bundler',
    icon: 'ruby',
    category: 'stack',
  },
  {
    id: 'go',
    name: 'Go',
    description: 'Go development environment',
    icon: 'code',
    category: 'stack',
  },
  {
    id: 'dotnet',
    name: '.NET',
    description: '.NET Core development environment',
    icon: 'code',
    category: 'stack',
  },

  // Custom
  {
    id: 'custom',
    name: 'Custom (Empty)',
    description: 'Start with a minimal configuration and add services manually',
    icon: 'settings-gear',
    category: 'custom',
  },
];

/**
 * Recipe categories for grouping in the UI
 */
export const RECIPE_CATEGORIES = [
  { key: 'cms', label: 'Content Management Systems', icon: '$(globe)' },
  { key: 'framework', label: 'Frameworks', icon: '$(rocket)' },
  { key: 'stack', label: 'Development Stacks', icon: '$(server)' },
  { key: 'custom', label: 'Custom', icon: '$(settings-gear)' },
] as const;

/**
 * Configuration collected from the wizard
 */
export interface LandoInitConfig {
  /** App name */
  name: string;
  /** Selected recipe */
  recipe: string;
  /** Target directory for the .lando.yml file */
  targetDir: string;
  /** PHP version (if applicable) */
  phpVersion?: string;
  /** Web server (if applicable) */
  webServer?: string;
  /** Database (if applicable) */
  database?: string;
  /** Whether to start the app after creation */
  startAfterCreate: boolean;
}

/**
 * Generates the .lando.yml content based on configuration
 */
export function generateLandoConfig(config: LandoInitConfig): string {
  const recipe = LANDO_RECIPES.find(r => r.id === config.recipe);
  const lines: string[] = [];
  
  lines.push(`name: ${config.name}`);
  
  if (config.recipe !== 'custom') {
    lines.push(`recipe: ${config.recipe}`);
  }
  
  // Add recipe config if we have customizations
  const configOptions: string[] = [];
  
  if (config.phpVersion) {
    configOptions.push(`  php: '${config.phpVersion}'`);
  }
  
  if (config.webServer && recipe?.webServers && recipe.webServers.length > 1) {
    configOptions.push(`  via: ${config.webServer}`);
  }
  
  if (config.database) {
    configOptions.push(`  database: ${config.database}`);
  }
  
  if (configOptions.length > 0) {
    lines.push('config:');
    lines.push(...configOptions);
  }
  
  // Add helpful comments for custom recipe
  if (config.recipe === 'custom') {
    lines.push('');
    lines.push('# Add your services here:');
    lines.push('# services:');
    lines.push('#   appserver:');
    lines.push('#     type: php:8.2');
    lines.push('#     via: apache');
    lines.push('#   database:');
    lines.push('#     type: mysql:8.0');
    lines.push('');
    lines.push('# Add your tooling commands here:');
    lines.push('# tooling:');
    lines.push('#   composer:');
    lines.push('#     service: appserver');
  }
  
  return lines.join('\n') + '\n';
}

/**
 * Validates an app name for Lando compatibility
 */
export function validateAppName(name: string): string | undefined {
  if (!name || name.trim().length === 0) {
    return 'App name is required';
  }
  
  // Lando app names should be lowercase alphanumeric with dashes
  const trimmed = name.trim();
  
  if (trimmed.length > 50) {
    return 'App name must be 50 characters or less';
  }
  
  if (!/^[a-z0-9]/.test(trimmed)) {
    return 'App name must start with a lowercase letter or number';
  }
  
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(trimmed) && trimmed.length > 1) {
    return 'App name can only contain lowercase letters, numbers, and hyphens';
  }
  
  if (/--/.test(trimmed)) {
    return 'App name cannot contain consecutive hyphens';
  }
  
  return undefined; // Valid
}

/**
 * Suggests an app name based on the directory name
 */
export function suggestAppName(dirPath: string): string {
  const dirName = path.basename(dirPath);
  // Convert to lowercase, replace spaces and underscores with hyphens
  return dirName
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Runs the Lando initialization wizard
 * 
 * @param outputChannel - Optional output channel for logging
 * @returns The path to the created .lando.yml file, or undefined if cancelled
 */
export async function runInitWizard(
  outputChannel?: vscode.OutputChannel
): Promise<string | undefined> {
  // Step 1: Select target directory
  const targetDir = await selectTargetDirectory();
  if (!targetDir) {
    return undefined; // User cancelled
  }
  
  // Check if .lando.yml already exists
  const landoFilePath = path.join(targetDir, '.lando.yml');
  if (fs.existsSync(landoFilePath)) {
    const overwrite = await vscode.window.showWarningMessage(
      'A .lando.yml file already exists in this directory. Overwrite it?',
      { modal: true },
      'Overwrite',
      'Cancel'
    );
    if (overwrite !== 'Overwrite') {
      return undefined;
    }
  }
  
  // Step 2: Enter app name
  const suggestedName = suggestAppName(targetDir);
  const appName = await vscode.window.showInputBox({
    title: 'Lando App Name (Step 1/4)',
    prompt: 'Enter a name for your Lando app',
    value: suggestedName,
    placeHolder: 'my-app',
    validateInput: validateAppName,
  });
  
  if (!appName) {
    return undefined; // User cancelled
  }
  
  // Step 3: Select recipe
  const recipe = await selectRecipe();
  if (!recipe) {
    return undefined; // User cancelled
  }
  
  // Step 4: Configure recipe options (if applicable)
  const config = await configureRecipeOptions(recipe, appName, targetDir);
  if (!config) {
    return undefined; // User cancelled
  }
  
  // Step 5: Ask about starting after creation
  const startChoice = await vscode.window.showQuickPick(
    [
      {
        label: '$(debug-start) Start the app now',
        description: 'Run lando start after creating the configuration',
        start: true,
      },
      {
        label: '$(file) Just create the file',
        description: 'Create .lando.yml without starting',
        start: false,
      },
    ],
    {
      title: 'Start App? (Step 4/4)',
      placeHolder: 'Would you like to start the Lando app now?',
    }
  );
  
  if (!startChoice) {
    return undefined; // User cancelled
  }
  
  config.startAfterCreate = startChoice.start;
  
  // Generate and write the configuration
  const configContent = generateLandoConfig(config);
  
  try {
    await fs.promises.writeFile(landoFilePath, configContent, 'utf8');
    outputChannel?.appendLine(`Created Lando configuration at: ${landoFilePath}`);
    
    // Open the file in the editor
    const doc = await vscode.workspace.openTextDocument(landoFilePath);
    await vscode.window.showTextDocument(doc);
    
    vscode.window.showInformationMessage(
      `Created Lando app "${appName}" successfully!`,
      'Open Documentation'
    ).then(selection => {
      if (selection === 'Open Documentation') {
        vscode.commands.executeCommand('extension.openLandoDocumentation');
      }
    });
    
    // Start the app if requested
    if (config.startAfterCreate) {
      // Use the existing start command
      vscode.commands.executeCommand('extension.startLandoApp');
    }
    
    return landoFilePath;
  } catch (error) {
    outputChannel?.appendLine(`Error creating Lando configuration: ${error}`);
    vscode.window.showErrorMessage(`Failed to create Lando configuration: ${error}`);
    return undefined;
  }
}

/**
 * Prompts user to select a target directory for the Lando app
 */
async function selectTargetDirectory(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  
  if (!workspaceFolders || workspaceFolders.length === 0) {
    // No workspace - ask user to select a folder
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Folder for Lando App',
      title: 'Choose Directory',
    });
    
    return selected?.[0]?.fsPath;
  }
  
  if (workspaceFolders.length === 1) {
    // Single workspace - use it directly or let them pick a subfolder
    const choice = await vscode.window.showQuickPick(
      [
        {
          label: '$(folder) Use workspace root',
          description: workspaceFolders[0].uri.fsPath,
          path: workspaceFolders[0].uri.fsPath,
        },
        {
          label: '$(folder-opened) Choose a different folder...',
          description: 'Browse for a specific directory',
          path: undefined,
        },
      ],
      {
        title: 'Select Location',
        placeHolder: 'Where should the .lando.yml file be created?',
      }
    );
    
    if (!choice) {
      return undefined;
    }
    
    if (choice.path) {
      return choice.path;
    }
    
    // Let them browse
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: workspaceFolders[0].uri,
      openLabel: 'Select Folder',
      title: 'Choose Directory for Lando App',
    });
    
    return selected?.[0]?.fsPath;
  }
  
  // Multiple workspaces - let them choose
  interface FolderItem extends vscode.QuickPickItem {
    path?: string;
  }
  
  const items: FolderItem[] = workspaceFolders.map(folder => ({
    label: `$(folder) ${folder.name}`,
    description: folder.uri.fsPath,
    path: folder.uri.fsPath,
  }));
  
  items.push({
    label: '$(folder-opened) Choose a different folder...',
    description: 'Browse for a specific directory',
    path: undefined,
  });
  
  const choice = await vscode.window.showQuickPick(items, {
    title: 'Select Location',
    placeHolder: 'Where should the .lando.yml file be created?',
  });
  
  if (!choice) {
    return undefined;
  }
  
  if (choice.path) {
    return choice.path;
  }
  
  // Let them browse
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select Folder',
    title: 'Choose Directory for Lando App',
  });
  
  return selected?.[0]?.fsPath;
}

/**
 * Prompts user to select a Lando recipe
 */
async function selectRecipe(): Promise<LandoRecipe | undefined> {
  interface RecipeQuickPickItem extends vscode.QuickPickItem {
    recipe?: LandoRecipe;
  }
  
  const items: RecipeQuickPickItem[] = [];
  
  // Group recipes by category
  for (const category of RECIPE_CATEGORIES) {
    const categoryRecipes = LANDO_RECIPES.filter(r => r.category === category.key);
    if (categoryRecipes.length > 0) {
      items.push({
        label: category.label,
        kind: vscode.QuickPickItemKind.Separator,
      });
      
      for (const recipe of categoryRecipes) {
        items.push({
          label: `$(${recipe.icon}) ${recipe.name}`,
          description: recipe.id,
          detail: recipe.description,
          recipe,
        });
      }
    }
  }
  
  const selected = await vscode.window.showQuickPick(items, {
    title: 'Select Recipe (Step 2/4)',
    placeHolder: 'Choose a recipe for your Lando app',
    matchOnDescription: true,
    matchOnDetail: true,
  });
  
  return selected?.recipe;
}

/**
 * Prompts user to configure recipe-specific options
 */
async function configureRecipeOptions(
  recipe: LandoRecipe,
  appName: string,
  targetDir: string
): Promise<LandoInitConfig | undefined> {
  const config: LandoInitConfig = {
    name: appName,
    recipe: recipe.id,
    targetDir,
    startAfterCreate: false,
  };
  
  // Custom recipe has no options to configure
  if (recipe.id === 'custom') {
    return config;
  }
  
  // Collect options that need configuration
  const hasPhpOptions = recipe.phpVersions && recipe.phpVersions.length > 1;
  const hasWebServerOptions = recipe.webServers && recipe.webServers.length > 1;
  const hasDatabaseOptions = recipe.databases && recipe.databases.length > 1;
  
  // If no options to configure, return with defaults
  if (!hasPhpOptions && !hasWebServerOptions && !hasDatabaseOptions) {
    config.phpVersion = recipe.defaultPhpVersion;
    config.webServer = recipe.defaultWebServer;
    config.database = recipe.defaultDatabase;
    return config;
  }
  
  // Create a multi-step configuration
  interface ConfigOption extends vscode.QuickPickItem {
    value: string;
  }
  
  // PHP Version
  if (hasPhpOptions) {
    const phpItems: ConfigOption[] = recipe.phpVersions!.map(v => ({
      label: v === recipe.defaultPhpVersion ? `$(star) PHP ${v}` : `PHP ${v}`,
      description: v === recipe.defaultPhpVersion ? 'Recommended' : undefined,
      value: v,
    }));
    
    const phpChoice = await vscode.window.showQuickPick(phpItems, {
      title: 'PHP Version (Step 3/4)',
      placeHolder: 'Select PHP version',
    });
    
    if (!phpChoice) {
      return undefined; // User cancelled
    }
    
    config.phpVersion = phpChoice.value;
  } else {
    config.phpVersion = recipe.defaultPhpVersion;
  }
  
  // Web Server
  if (hasWebServerOptions) {
    const webItems: ConfigOption[] = recipe.webServers!.map(w => ({
      label: w === recipe.defaultWebServer ? `$(star) ${w}` : w,
      description: w === recipe.defaultWebServer ? 'Recommended' : undefined,
      value: w,
    }));
    
    const webChoice = await vscode.window.showQuickPick(webItems, {
      title: 'Web Server (Step 3/4)',
      placeHolder: 'Select web server',
    });
    
    if (!webChoice) {
      return undefined; // User cancelled
    }
    
    config.webServer = webChoice.value;
  } else {
    config.webServer = recipe.defaultWebServer;
  }
  
  // Database
  if (hasDatabaseOptions) {
    const dbItems: ConfigOption[] = recipe.databases!.map(db => ({
      label: db === recipe.defaultDatabase ? `$(star) ${db}` : db,
      description: db === recipe.defaultDatabase ? 'Recommended' : undefined,
      value: db,
    }));
    
    const dbChoice = await vscode.window.showQuickPick(dbItems, {
      title: 'Database (Step 3/4)',
      placeHolder: 'Select database',
    });
    
    if (!dbChoice) {
      return undefined; // User cancelled
    }
    
    config.database = dbChoice.value;
  } else {
    config.database = recipe.defaultDatabase;
  }
  
  return config;
}
