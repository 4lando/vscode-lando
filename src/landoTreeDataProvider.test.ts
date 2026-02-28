import * as assert from "assert";
import { suite, test } from "mocha";

/**
 * Tests for the Lando TreeView Data Provider module.
 * 
 * Since LandoTreeDataProvider relies heavily on VS Code APIs, we test the
 * pure logic separately by extracting the patterns and helpers into testable functions.
 */

/**
 * Type definitions matching the types in landoTreeDataProvider.ts
 */
type LandoTreeItemType = 
  | 'app'
  | 'servicesGroup'
  | 'service'
  | 'urlsGroup'
  | 'url'
  | 'toolingGroup'
  | 'tooling'
  | 'infoGroup'
  | 'infoItem'
  | 'loading'
  | 'noApps';

interface LandoServiceUrl {
  service: string;
  url: string;
  primary: boolean;
}

interface LandoServiceInfo {
  name: string;
  type: string;
  running?: boolean;
}

interface LandoTooling {
  name: string;
  service?: string;
  cmd?: string | string[];
  description?: string;
  isCustom: boolean;
}

/**
 * Represents connection credentials for a database service
 */
interface LandoConnectionCreds {
  user?: string;
  password?: string;
  database?: string;
}

/**
 * Represents connection endpoint information
 */
interface LandoConnectionEndpoint {
  host?: string;
  port?: string;
}

/**
 * Represents a copyable info item displayed in the tree
 */
interface LandoInfoItem {
  label: string;
  value: string;
  service: string;
  category: 'connection' | 'credentials' | 'other';
  icon?: string;
}

/**
 * Extended service info from lando info command
 */
interface LandoServiceDetails {
  service: string;
  type?: string;
  urls?: string[];
  creds?: LandoConnectionCreds;
  internal_connection?: LandoConnectionEndpoint;
  external_connection?: LandoConnectionEndpoint;
  hostnames?: string[];
  running?: boolean;
}

/**
 * Core Lando commands that should be filtered out from tooling
 * Mirrors the logic in landoTreeDataProvider.ts
 */
const LANDO_CORE_COMMANDS = new Set([
  'config', 'destroy', 'exec', 'info', 'init', 'list',
  'logs', 'poweroff', 'rebuild', 'restart', 'start',
  'stop', 'update', 'version', 'share', 'ssh',
  'db-export', 'db-import'
]);

/**
 * Checks if a command is a core Lando command (not tooling)
 */
function isCoreCommand(commandName: string): boolean {
  return LANDO_CORE_COMMANDS.has(commandName);
}

/**
 * Parses lando help output to extract tooling commands
 * Mirrors the logic in landoTreeDataProvider.ts
 */
function parseToolingFromLandoOutput(stdout: string): LandoTooling[] {
  const tooling: LandoTooling[] = [];
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
      if (!LANDO_CORE_COMMANDS.has(commandName)) {
        tooling.push({
          name: commandName,
          description: description || undefined,
          isCustom: false
        });
      }
    }
  }

  return tooling;
}

/**
 * Combines custom tooling with Lando-provided tooling, with custom taking precedence
 */
function combineTooling(customTooling: LandoTooling[], landoTooling: LandoTooling[]): LandoTooling[] {
  const toolingMap = new Map<string, LandoTooling>();
  
  for (const t of customTooling) {
    toolingMap.set(t.name, t);
  }
  
  for (const t of landoTooling) {
    if (!toolingMap.has(t.name)) {
      toolingMap.set(t.name, t);
    }
  }

  return Array.from(toolingMap.values());
}

/**
 * Parses service info from lando info JSON output
 */
function parseServicesFromLandoInfo(infoArray: Array<{
  service: string;
  type?: string;
  urls?: string[];
  running?: boolean;
}>): { services: LandoServiceInfo[], urls: LandoServiceUrl[] } {
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

  return { services, urls };
}

/**
 * Parses connection info (credentials, ports) from lando info JSON output
 * Mirrors the logic in landoTreeDataProvider.ts fetchAppInfo
 */
function parseInfoFromLandoInfo(infoArray: LandoServiceDetails[]): LandoInfoItem[] {
  const infoItems: LandoInfoItem[] = [];

  for (const info of infoArray) {
    const serviceName = info.service;

    // Extract credentials for database services
    if (info.creds) {
      if (info.creds.database) {
        infoItems.push({
          label: `${serviceName}: Database`,
          value: info.creds.database,
          service: serviceName,
          category: 'credentials'
        });
      }
      if (info.creds.user) {
        infoItems.push({
          label: `${serviceName}: User`,
          value: info.creds.user,
          service: serviceName,
          category: 'credentials'
        });
      }
      if (info.creds.password) {
        infoItems.push({
          label: `${serviceName}: Password`,
          value: info.creds.password,
          service: serviceName,
          category: 'credentials'
        });
      }
    }

    // Extract external connection info
    if (info.external_connection) {
      if (info.external_connection.host) {
        infoItems.push({
          label: `${serviceName}: Host (external)`,
          value: info.external_connection.host,
          service: serviceName,
          category: 'connection'
        });
      }
      if (info.external_connection.port) {
        infoItems.push({
          label: `${serviceName}: Port (external)`,
          value: info.external_connection.port,
          service: serviceName,
          category: 'connection'
        });
      }
    }

    // Extract internal connection info
    if (info.internal_connection) {
      if (info.internal_connection.host) {
        infoItems.push({
          label: `${serviceName}: Host (internal)`,
          value: info.internal_connection.host,
          service: serviceName,
          category: 'connection'
        });
      }
      if (info.internal_connection.port) {
        infoItems.push({
          label: `${serviceName}: Port (internal)`,
          value: info.internal_connection.port,
          service: serviceName,
          category: 'connection'
        });
      }
    }
  }

  return infoItems;
}

/**
 * Gets the appropriate icon name for an info item based on its label
 * Mirrors the logic in LandoTreeItem.setupInfoItem
 */
function getIconForInfoItem(label: string): string {
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes('host')) {
    return 'server';
  } else if (lowerLabel.includes('port')) {
    return 'plug';
  } else if (lowerLabel.includes('user')) {
    return 'person';
  } else if (lowerLabel.includes('password')) {
    return 'key';
  } else if (lowerLabel.includes('database')) {
    return 'database';
  }
  return 'symbol-field';
}

/**
 * Gets the appropriate icon name for a tree item type
 */
function getIconForType(type: LandoTreeItemType): string {
  switch (type) {
    case 'app':
      return 'package';
    case 'servicesGroup':
      return 'server';
    case 'service':
      return 'circle-filled';
    case 'urlsGroup':
      return 'globe';
    case 'url':
      return 'link-external';
    case 'toolingGroup':
      return 'tools';
    case 'tooling':
      return 'terminal';
    case 'infoGroup':
      return 'database';
    case 'infoItem':
      return 'symbol-field';
    case 'loading':
      return 'loading~spin';
    case 'noApps':
      return 'info';
    default:
      return 'question';
  }
}

/**
 * Gets the status icon name based on running state
 */
function getStatusIcon(running: boolean): string {
  return running ? 'vm-running' : 'vm-outline';
}

/**
 * Gets the service status icon based on running state
 */
function getServiceStatusIcon(running: boolean): string {
  return running ? 'circle-filled' : 'circle-outline';
}

suite("LandoTreeDataProvider Test Suite", () => {
  suite("Core Command Filtering", () => {
    test("Should identify core commands", () => {
      assert.strictEqual(isCoreCommand('start'), true);
      assert.strictEqual(isCoreCommand('stop'), true);
      assert.strictEqual(isCoreCommand('restart'), true);
      assert.strictEqual(isCoreCommand('rebuild'), true);
      assert.strictEqual(isCoreCommand('destroy'), true);
      assert.strictEqual(isCoreCommand('info'), true);
      assert.strictEqual(isCoreCommand('logs'), true);
      assert.strictEqual(isCoreCommand('ssh'), true);
    });

    test("Should not identify tooling as core commands", () => {
      assert.strictEqual(isCoreCommand('drush'), false);
      assert.strictEqual(isCoreCommand('composer'), false);
      assert.strictEqual(isCoreCommand('npm'), false);
      assert.strictEqual(isCoreCommand('artisan'), false);
      assert.strictEqual(isCoreCommand('wp'), false);
      assert.strictEqual(isCoreCommand('mysql'), false);
    });
  });

  suite("Lando Output Parsing", () => {
    test("Should parse tooling commands from lando help output", () => {
      const landoOutput = `Usage: lando <command> [args] [options]

Commands:
  lando composer          Runs composer commands
  lando drush             Runs drush commands
  lando mysql             Drops into a MySQL shell on a database service
  lando php               Runs PHP commands
  lando start             Starts your app
  lando stop              Stops your app
  lando rebuild           Rebuilds your app from scratch

Options:
  --help     Shows lando or delegated command help if applicable
  --verbose  Runs with extra verbosity
`;

      const tooling = parseToolingFromLandoOutput(landoOutput);
      
      assert.strictEqual(tooling.length, 4);
      assert.ok(tooling.some(t => t.name === 'composer'));
      assert.ok(tooling.some(t => t.name === 'drush'));
      assert.ok(tooling.some(t => t.name === 'mysql'));
      assert.ok(tooling.some(t => t.name === 'php'));
      
      // Should not include core commands
      assert.ok(!tooling.some(t => t.name === 'start'));
      assert.ok(!tooling.some(t => t.name === 'stop'));
      assert.ok(!tooling.some(t => t.name === 'rebuild'));
    });

    test("Should parse command descriptions", () => {
      const landoOutput = `Commands:
  lando drush             Runs drush commands
  lando composer          Runs composer commands
`;

      const tooling = parseToolingFromLandoOutput(landoOutput);
      
      const drush = tooling.find(t => t.name === 'drush');
      assert.strictEqual(drush?.description, 'Runs drush commands');
      
      const composer = tooling.find(t => t.name === 'composer');
      assert.strictEqual(composer?.description, 'Runs composer commands');
    });

    test("Should handle empty output", () => {
      const tooling = parseToolingFromLandoOutput('');
      assert.strictEqual(tooling.length, 0);
    });

    test("Should handle output without Commands section", () => {
      const landoOutput = `Some other output
without commands section`;
      
      const tooling = parseToolingFromLandoOutput(landoOutput);
      assert.strictEqual(tooling.length, 0);
    });

    test("Should mark parsed tooling as not custom", () => {
      const landoOutput = `Commands:
  lando drush             Runs drush commands
`;

      const tooling = parseToolingFromLandoOutput(landoOutput);
      assert.strictEqual(tooling[0].isCustom, false);
    });
  });

  suite("Tooling Combination", () => {
    test("Should combine custom and Lando tooling", () => {
      const custom: LandoTooling[] = [
        { name: 'custom-script', description: 'My custom script', isCustom: true }
      ];
      const lando: LandoTooling[] = [
        { name: 'drush', description: 'Runs drush commands', isCustom: false }
      ];

      const combined = combineTooling(custom, lando);
      
      assert.strictEqual(combined.length, 2);
      assert.ok(combined.some(t => t.name === 'custom-script'));
      assert.ok(combined.some(t => t.name === 'drush'));
    });

    test("Custom tooling should override Lando tooling with same name", () => {
      const custom: LandoTooling[] = [
        { name: 'drush', description: 'My custom drush', isCustom: true }
      ];
      const lando: LandoTooling[] = [
        { name: 'drush', description: 'Runs drush commands', isCustom: false }
      ];

      const combined = combineTooling(custom, lando);
      
      assert.strictEqual(combined.length, 1);
      const drush = combined.find(t => t.name === 'drush');
      assert.strictEqual(drush?.description, 'My custom drush');
      assert.strictEqual(drush?.isCustom, true);
    });

    test("Should handle empty custom tooling", () => {
      const lando: LandoTooling[] = [
        { name: 'drush', description: 'Runs drush commands', isCustom: false },
        { name: 'composer', description: 'Runs composer commands', isCustom: false }
      ];

      const combined = combineTooling([], lando);
      
      assert.strictEqual(combined.length, 2);
    });

    test("Should handle empty Lando tooling", () => {
      const custom: LandoTooling[] = [
        { name: 'custom-script', description: 'My custom script', isCustom: true }
      ];

      const combined = combineTooling(custom, []);
      
      assert.strictEqual(combined.length, 1);
    });
  });

  suite("Service Info Parsing", () => {
    test("Should parse services from lando info output", () => {
      const infoArray = [
        { service: 'appserver', type: 'php', running: true },
        { service: 'database', type: 'mysql', running: true },
        { service: 'cache', type: 'redis', running: false }
      ];

      const { services } = parseServicesFromLandoInfo(infoArray);
      
      assert.strictEqual(services.length, 3);
      assert.strictEqual(services[0].name, 'appserver');
      assert.strictEqual(services[0].type, 'php');
      assert.strictEqual(services[0].running, true);
      assert.strictEqual(services[2].running, false);
    });

    test("Should parse URLs from lando info output", () => {
      const infoArray = [
        { 
          service: 'appserver', 
          type: 'php', 
          urls: ['https://myapp.lndo.site', 'http://myapp.lndo.site']
        },
        { service: 'database', type: 'mysql' }
      ];

      const { urls } = parseServicesFromLandoInfo(infoArray);
      
      assert.strictEqual(urls.length, 2);
      assert.strictEqual(urls[0].url, 'https://myapp.lndo.site');
      assert.strictEqual(urls[0].service, 'appserver');
      assert.strictEqual(urls[0].primary, true);
      assert.strictEqual(urls[1].primary, false);
    });

    test("Should handle missing type", () => {
      const infoArray = [
        { service: 'custom', urls: ['http://localhost:3000'] }
      ];

      const { services } = parseServicesFromLandoInfo(infoArray);
      
      assert.strictEqual(services[0].type, 'unknown');
    });

    test("Should handle empty info array", () => {
      const { services, urls } = parseServicesFromLandoInfo([]);
      
      assert.strictEqual(services.length, 0);
      assert.strictEqual(urls.length, 0);
    });
  });

  suite("Icon Selection", () => {
    test("Should return correct icons for each item type", () => {
      assert.strictEqual(getIconForType('app'), 'package');
      assert.strictEqual(getIconForType('servicesGroup'), 'server');
      assert.strictEqual(getIconForType('service'), 'circle-filled');
      assert.strictEqual(getIconForType('urlsGroup'), 'globe');
      assert.strictEqual(getIconForType('url'), 'link-external');
      assert.strictEqual(getIconForType('toolingGroup'), 'tools');
      assert.strictEqual(getIconForType('tooling'), 'terminal');
      assert.strictEqual(getIconForType('loading'), 'loading~spin');
      assert.strictEqual(getIconForType('noApps'), 'info');
    });

    test("Should return correct status icons", () => {
      assert.strictEqual(getStatusIcon(true), 'vm-running');
      assert.strictEqual(getStatusIcon(false), 'vm-outline');
    });

    test("Should return correct service status icons", () => {
      assert.strictEqual(getServiceStatusIcon(true), 'circle-filled');
      assert.strictEqual(getServiceStatusIcon(false), 'circle-outline');
    });
  });

  suite("URL Parsing", () => {
    test("Should mark first URL as primary", () => {
      const infoArray = [
        { 
          service: 'appserver', 
          type: 'php',
          urls: ['https://first.lndo.site', 'https://second.lndo.site', 'https://third.lndo.site']
        }
      ];

      const { urls } = parseServicesFromLandoInfo(infoArray);
      
      assert.strictEqual(urls[0].primary, true);
      assert.strictEqual(urls[1].primary, false);
      assert.strictEqual(urls[2].primary, false);
    });

    test("Should associate URLs with correct service", () => {
      const infoArray = [
        { service: 'appserver', urls: ['https://app.lndo.site'] },
        { service: 'mailhog', urls: ['http://mail.lndo.site'] }
      ];

      const { urls } = parseServicesFromLandoInfo(infoArray);
      
      const appUrl = urls.find(u => u.url === 'https://app.lndo.site');
      assert.strictEqual(appUrl?.service, 'appserver');
      
      const mailUrl = urls.find(u => u.url === 'http://mail.lndo.site');
      assert.strictEqual(mailUrl?.service, 'mailhog');
    });
  });

  suite("Edge Cases", () => {
    test("Should handle service with empty URLs array", () => {
      const infoArray = [
        { service: 'database', type: 'mysql', urls: [] }
      ];

      const { urls } = parseServicesFromLandoInfo(infoArray);
      assert.strictEqual(urls.length, 0);
    });

    test("Should handle malformed lando output gracefully", () => {
      const malformedOutput = `Commands:
  lando 
  lando drush Runs drush
  lando      something weird`;

      // Should not throw
      const tooling = parseToolingFromLandoOutput(malformedOutput);
      // May or may not parse correctly, but shouldn't crash
      assert.ok(Array.isArray(tooling));
    });

    test("Should handle tooling commands with brackets (aliases)", () => {
      const landoOutput = `Commands:
  lando drush [dr]        Runs drush commands
  lando composer [comp]   Runs composer commands
`;

      const tooling = parseToolingFromLandoOutput(landoOutput);
      
      assert.ok(tooling.some(t => t.name === 'drush'));
      assert.ok(tooling.some(t => t.name === 'composer'));
    });
  });

  suite("Connection Info Parsing", () => {
    test("Should parse database credentials from lando info output", () => {
      const infoArray: LandoServiceDetails[] = [
        {
          service: 'database',
          type: 'mysql',
          creds: {
            database: 'drupal10',
            user: 'drupal10',
            password: 'drupal10'
          }
        }
      ];

      const infoItems = parseInfoFromLandoInfo(infoArray);

      assert.strictEqual(infoItems.length, 3);
      assert.ok(infoItems.some(i => i.label === 'database: Database' && i.value === 'drupal10'));
      assert.ok(infoItems.some(i => i.label === 'database: User' && i.value === 'drupal10'));
      assert.ok(infoItems.some(i => i.label === 'database: Password' && i.value === 'drupal10'));
    });

    test("Should parse external connection info from lando info output", () => {
      const infoArray: LandoServiceDetails[] = [
        {
          service: 'database',
          type: 'mysql',
          external_connection: {
            host: 'localhost',
            port: '32769'
          }
        }
      ];

      const infoItems = parseInfoFromLandoInfo(infoArray);

      assert.strictEqual(infoItems.length, 2);
      assert.ok(infoItems.some(i => i.label === 'database: Host (external)' && i.value === 'localhost'));
      assert.ok(infoItems.some(i => i.label === 'database: Port (external)' && i.value === '32769'));
    });

    test("Should parse internal connection info from lando info output", () => {
      const infoArray: LandoServiceDetails[] = [
        {
          service: 'database',
          type: 'mysql',
          internal_connection: {
            host: 'database',
            port: '3306'
          }
        }
      ];

      const infoItems = parseInfoFromLandoInfo(infoArray);

      assert.strictEqual(infoItems.length, 2);
      assert.ok(infoItems.some(i => i.label === 'database: Host (internal)' && i.value === 'database'));
      assert.ok(infoItems.some(i => i.label === 'database: Port (internal)' && i.value === '3306'));
    });

    test("Should parse complete connection info for database service", () => {
      const infoArray: LandoServiceDetails[] = [
        {
          service: 'database',
          type: 'mysql:8.0',
          running: true,
          creds: {
            database: 'wordpress',
            user: 'wordpress',
            password: 'wordpress'
          },
          internal_connection: {
            host: 'database',
            port: '3306'
          },
          external_connection: {
            host: 'localhost',
            port: '49153'
          }
        }
      ];

      const infoItems = parseInfoFromLandoInfo(infoArray);

      // Should have 7 items: 3 creds + 2 external + 2 internal
      assert.strictEqual(infoItems.length, 7);
      
      // Check all categories are represented
      const credItems = infoItems.filter(i => i.category === 'credentials');
      const connItems = infoItems.filter(i => i.category === 'connection');
      assert.strictEqual(credItems.length, 3);
      assert.strictEqual(connItems.length, 4);
    });

    test("Should handle service without connection info", () => {
      const infoArray: LandoServiceDetails[] = [
        {
          service: 'appserver',
          type: 'php',
          running: true,
          urls: ['https://myapp.lndo.site']
        }
      ];

      const infoItems = parseInfoFromLandoInfo(infoArray);

      // PHP service typically doesn't have creds or connection info
      assert.strictEqual(infoItems.length, 0);
    });

    test("Should handle multiple services with connection info", () => {
      const infoArray: LandoServiceDetails[] = [
        {
          service: 'database',
          type: 'mysql',
          creds: { database: 'main', user: 'root', password: 'root' }
        },
        {
          service: 'cache',
          type: 'redis',
          internal_connection: { host: 'cache', port: '6379' }
        }
      ];

      const infoItems = parseInfoFromLandoInfo(infoArray);

      // 3 creds from database + 2 connection from cache
      assert.strictEqual(infoItems.length, 5);
      
      // Check service names are correct
      const dbItems = infoItems.filter(i => i.service === 'database');
      const cacheItems = infoItems.filter(i => i.service === 'cache');
      assert.strictEqual(dbItems.length, 3);
      assert.strictEqual(cacheItems.length, 2);
    });

    test("Should handle partial credential info", () => {
      const infoArray: LandoServiceDetails[] = [
        {
          service: 'database',
          type: 'mysql',
          creds: {
            database: 'mydb'
            // user and password missing
          }
        }
      ];

      const infoItems = parseInfoFromLandoInfo(infoArray);

      assert.strictEqual(infoItems.length, 1);
      assert.strictEqual(infoItems[0].label, 'database: Database');
      assert.strictEqual(infoItems[0].value, 'mydb');
    });

    test("Should handle empty info array", () => {
      const infoItems = parseInfoFromLandoInfo([]);
      assert.strictEqual(infoItems.length, 0);
    });
  });

  suite("Info Item Icon Selection", () => {
    test("Should return server icon for host labels", () => {
      assert.strictEqual(getIconForInfoItem('database: Host (external)'), 'server');
      assert.strictEqual(getIconForInfoItem('database: Host (internal)'), 'server');
      assert.strictEqual(getIconForInfoItem('Host'), 'server');
    });

    test("Should return plug icon for port labels", () => {
      assert.strictEqual(getIconForInfoItem('database: Port (external)'), 'plug');
      assert.strictEqual(getIconForInfoItem('database: Port (internal)'), 'plug');
      assert.strictEqual(getIconForInfoItem('Port'), 'plug');
    });

    test("Should return person icon for user labels", () => {
      assert.strictEqual(getIconForInfoItem('database: User'), 'person');
      assert.strictEqual(getIconForInfoItem('Username'), 'person');
    });

    test("Should return key icon for password labels", () => {
      assert.strictEqual(getIconForInfoItem('database: Password'), 'key');
      assert.strictEqual(getIconForInfoItem('Password'), 'key');
    });

    test("Should return database icon for database labels", () => {
      assert.strictEqual(getIconForInfoItem('database: Database'), 'database');
      assert.strictEqual(getIconForInfoItem('Database Name'), 'database');
    });

    test("Should return default icon for unknown labels", () => {
      assert.strictEqual(getIconForInfoItem('Something Else'), 'symbol-field');
      assert.strictEqual(getIconForInfoItem('Custom Field'), 'symbol-field');
    });
  });

  suite("Info Group Tree Item Type", () => {
    test("Should return correct icon for infoGroup type", () => {
      assert.strictEqual(getIconForType('infoGroup'), 'database');
    });

    test("Should return correct icon for infoItem type", () => {
      assert.strictEqual(getIconForType('infoItem'), 'symbol-field');
    });
  });
});
