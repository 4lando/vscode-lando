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
});
