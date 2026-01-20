import * as assert from "assert";
import { suite, test } from "mocha";
import * as yaml from "js-yaml";

/**
 * Tests for the Lando App Detector module.
 * 
 * Since LandoAppDetector relies heavily on VS Code APIs, we test the
 * pure parsing logic separately by extracting the regex patterns and
 * parsing logic into testable functions.
 */

/**
 * Interface matching the LandoTooling from landoAppDetector.ts
 */
interface LandoTooling {
  name: string;
  service?: string;
  cmd?: string | string[];
  description?: string;
  dir?: string;
  env?: Record<string, string>;
  user?: string;
  isCustom: boolean;
}

/**
 * Pattern matching for Lando config files
 * Mirrors the logic in landoAppDetector.ts
 */
function isLandoFile(filename: string): boolean {
  return /^\.lando(\..+)?\.yml$/.test(filename);
}

/**
 * Pattern matching for excluded directories
 * Mirrors the logic in landoAppDetector.ts
 */
function shouldExcludeDir(dirname: string, excludeDirs: string[]): boolean {
  return excludeDirs.includes(dirname) || dirname.startsWith(".");
}

/**
 * Extracts the app name from Lando config content
 */
function extractAppName(content: string): string | null {
  const nameMatch = content.match(/^name:\s*['"]?([^'"#\n]+)['"]?/m);
  return nameMatch ? nameMatch[1].trim() : null;
}

/**
 * Creates a clean app name by removing dashes/underscores and lowercasing
 */
function cleanAppName(name: string): string {
  return name.replace(/[-_]/g, "").toLowerCase();
}

/**
 * Extracts the recipe from Lando config content
 */
function extractRecipe(content: string): string | null {
  const recipeMatch = content.match(/^recipe:\s*['"]?([^'"#\n]+)['"]?/m);
  return recipeMatch ? recipeMatch[1].trim() : null;
}

/**
 * Extracts service names from Lando config content
 */
function extractServices(content: string): string[] | undefined {
  const servicesMatch = content.match(/^services:\s*\n((?:\s+[a-zA-Z0-9_-]+:.*\n?)+)/m);
  if (!servicesMatch) {
    return undefined;
  }
  const servicesBlock = servicesMatch[1];
  const serviceMatches = servicesBlock.matchAll(/^\s{2}([a-zA-Z0-9_-]+):/gm);
  return Array.from(serviceMatches, m => m[1]);
}

/**
 * Parses tooling cmd which can be a string or array
 * Mirrors the logic in landoAppDetector.ts
 */
function parseToolingCmd(cmd: unknown): string | string[] | undefined {
  if (typeof cmd === 'string') {
    return cmd;
  }
  if (Array.isArray(cmd)) {
    return cmd.filter(c => typeof c === 'string') as string[];
  }
  return undefined;
}

/**
 * Parses tooling environment variables
 * Mirrors the logic in landoAppDetector.ts
 */
function parseToolingEnv(env: unknown): Record<string, string> | undefined {
  if (!env || typeof env !== 'object') {
    return undefined;
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Extracts tooling definitions from Lando config content
 * Mirrors the logic in landoAppDetector.ts
 */
function extractTooling(content: string): LandoTooling[] | undefined {
  try {
    const config = yaml.load(content) as Record<string, unknown> | null;
    if (!config || typeof config !== 'object') {
      return undefined;
    }

    const toolingConfig = config.tooling;
    if (!toolingConfig || typeof toolingConfig !== 'object') {
      return undefined;
    }

    const toolingObj = toolingConfig as Record<string, unknown>;
    const tooling: LandoTooling[] = [];

    for (const [name, definition] of Object.entries(toolingObj)) {
      if (definition === null || definition === undefined) {
        continue;
      }

      // Handle simple string definitions (e.g., "drush: drush")
      if (typeof definition === 'string') {
        tooling.push({
          name,
          cmd: definition,
          isCustom: true
        });
        continue;
      }

      // Handle object definitions
      if (typeof definition === 'object') {
        const def = definition as Record<string, unknown>;
        tooling.push({
          name,
          service: typeof def.service === 'string' ? def.service : undefined,
          cmd: parseToolingCmd(def.cmd),
          description: typeof def.description === 'string' ? def.description : undefined,
          dir: typeof def.dir === 'string' ? def.dir : undefined,
          env: parseToolingEnv(def.env),
          user: typeof def.user === 'string' ? def.user : undefined,
          isCustom: true
        });
      }
    }

    return tooling.length > 0 ? tooling : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Creates mock Lando-provided tooling for testing combined tooling logic.
 * In the actual extension, this data comes from querying `lando` directly.
 */
function createMockLandoTooling(): LandoTooling[] {
  return [
    { name: 'php', description: 'Runs php commands', isCustom: false },
    { name: 'composer', description: 'Runs composer commands', isCustom: false },
    { name: 'drush', description: 'Runs drush commands', isCustom: false },
    { name: 'mysql', description: 'Drops into a MySQL shell', isCustom: false },
  ];
}

suite("LandoAppDetector Test Suite", () => {
  suite("isLandoFile Pattern Matching", () => {
    test("Should match .lando.yml", () => {
      assert.strictEqual(isLandoFile(".lando.yml"), true);
    });

    test("Should match .lando.local.yml", () => {
      assert.strictEqual(isLandoFile(".lando.local.yml"), true);
    });

    test("Should match .lando.dev.yml", () => {
      assert.strictEqual(isLandoFile(".lando.dev.yml"), true);
    });

    test("Should match .lando.prod.yml", () => {
      assert.strictEqual(isLandoFile(".lando.prod.yml"), true);
    });

    test("Should match .lando.custom-config.yml", () => {
      assert.strictEqual(isLandoFile(".lando.custom-config.yml"), true);
    });

    test("Should not match lando.yml (missing leading dot)", () => {
      assert.strictEqual(isLandoFile("lando.yml"), false);
    });

    test("Should not match .lando.yaml (wrong extension)", () => {
      assert.strictEqual(isLandoFile(".lando.yaml"), false);
    });

    test("Should not match docker-compose.yml", () => {
      assert.strictEqual(isLandoFile("docker-compose.yml"), false);
    });

    test("Should not match package.json", () => {
      assert.strictEqual(isLandoFile("package.json"), false);
    });

    test("Should not match .yml alone", () => {
      assert.strictEqual(isLandoFile(".yml"), false);
    });
  });

  suite("shouldExcludeDir Directory Filtering", () => {
    const defaultExcludeDirs = [
      "node_modules",
      "vendor",
      ".git",
      "dist",
      "build",
      "out",
      ".cache",
      "coverage"
    ];

    test("Should exclude node_modules", () => {
      assert.strictEqual(shouldExcludeDir("node_modules", defaultExcludeDirs), true);
    });

    test("Should exclude vendor", () => {
      assert.strictEqual(shouldExcludeDir("vendor", defaultExcludeDirs), true);
    });

    test("Should exclude .git", () => {
      assert.strictEqual(shouldExcludeDir(".git", defaultExcludeDirs), true);
    });

    test("Should exclude directories starting with dot", () => {
      assert.strictEqual(shouldExcludeDir(".hidden", defaultExcludeDirs), true);
      assert.strictEqual(shouldExcludeDir(".cache", defaultExcludeDirs), true);
      assert.strictEqual(shouldExcludeDir(".vscode", defaultExcludeDirs), true);
    });

    test("Should not exclude src directory", () => {
      assert.strictEqual(shouldExcludeDir("src", defaultExcludeDirs), false);
    });

    test("Should not exclude web directory", () => {
      assert.strictEqual(shouldExcludeDir("web", defaultExcludeDirs), false);
    });

    test("Should not exclude sites directory", () => {
      assert.strictEqual(shouldExcludeDir("sites", defaultExcludeDirs), false);
    });

    test("Should respect custom exclude list", () => {
      const customExclude = ["custom-dir", "another-dir"];
      assert.strictEqual(shouldExcludeDir("custom-dir", customExclude), true);
      assert.strictEqual(shouldExcludeDir("node_modules", customExclude), false);
    });
  });

  suite("extractAppName Parsing", () => {
    test("Should extract simple app name", () => {
      const content = `name: myapp
recipe: drupal10`;
      assert.strictEqual(extractAppName(content), "myapp");
    });

    test("Should extract app name with dashes", () => {
      const content = `name: my-awesome-app
recipe: drupal10`;
      assert.strictEqual(extractAppName(content), "my-awesome-app");
    });

    test("Should extract app name with underscores", () => {
      const content = `name: my_awesome_app
recipe: wordpress`;
      assert.strictEqual(extractAppName(content), "my_awesome_app");
    });

    test("Should extract quoted app name (double quotes)", () => {
      const content = `name: "my-app"
recipe: lamp`;
      assert.strictEqual(extractAppName(content), "my-app");
    });

    test("Should extract quoted app name (single quotes)", () => {
      const content = `name: 'my-app'
recipe: lamp`;
      assert.strictEqual(extractAppName(content), "my-app");
    });

    test("Should handle name with trailing spaces", () => {
      const content = `name: myapp   
recipe: drupal10`;
      assert.strictEqual(extractAppName(content), "myapp");
    });

    test("Should handle name with inline comment", () => {
      const content = `name: myapp # This is my app
recipe: drupal10`;
      assert.strictEqual(extractAppName(content), "myapp");
    });

    test("Should return null for missing name", () => {
      const content = `recipe: drupal10
services:
  appserver:
    type: php`;
      assert.strictEqual(extractAppName(content), null);
    });

    test("Should handle name not at the start of the file", () => {
      const content = `# My Lando config
recipe: drupal10
name: myapp`;
      assert.strictEqual(extractAppName(content), "myapp");
    });
  });

  suite("cleanAppName Normalization", () => {
    test("Should remove dashes", () => {
      assert.strictEqual(cleanAppName("my-app"), "myapp");
    });

    test("Should remove underscores", () => {
      assert.strictEqual(cleanAppName("my_app"), "myapp");
    });

    test("Should remove multiple dashes and underscores", () => {
      assert.strictEqual(cleanAppName("my-awesome_app-name"), "myawesomeappname");
    });

    test("Should lowercase the name", () => {
      assert.strictEqual(cleanAppName("MyApp"), "myapp");
    });

    test("Should handle mixed case with special chars", () => {
      assert.strictEqual(cleanAppName("My-Awesome_APP"), "myawesomeapp");
    });

    test("Should handle name with no special chars", () => {
      assert.strictEqual(cleanAppName("myapp"), "myapp");
    });
  });

  suite("extractRecipe Parsing", () => {
    test("Should extract drupal10 recipe", () => {
      const content = `name: myapp
recipe: drupal10`;
      assert.strictEqual(extractRecipe(content), "drupal10");
    });

    test("Should extract wordpress recipe", () => {
      const content = `name: myapp
recipe: wordpress`;
      assert.strictEqual(extractRecipe(content), "wordpress");
    });

    test("Should extract lamp recipe", () => {
      const content = `name: myapp
recipe: lamp`;
      assert.strictEqual(extractRecipe(content), "lamp");
    });

    test("Should extract quoted recipe", () => {
      const content = `name: myapp
recipe: "drupal10"`;
      assert.strictEqual(extractRecipe(content), "drupal10");
    });

    test("Should return null for missing recipe", () => {
      const content = `name: myapp
services:
  appserver:
    type: php`;
      assert.strictEqual(extractRecipe(content), null);
    });

    test("Should handle recipe with inline comment", () => {
      const content = `name: myapp
recipe: drupal10 # Latest Drupal`;
      assert.strictEqual(extractRecipe(content), "drupal10");
    });
  });

  suite("extractServices Parsing", () => {
    test("Should extract single service", () => {
      const content = `name: myapp
recipe: lamp
services:
  appserver:
    type: php`;
      const services = extractServices(content);
      assert.deepStrictEqual(services, ["appserver"]);
    });

    test("Should extract multiple services", () => {
      const content = `name: myapp
recipe: drupal10
services:
  appserver:
    type: php
  database:
    type: mysql
  cache:
    type: redis`;
      const services = extractServices(content);
      assert.deepStrictEqual(services, ["appserver", "database", "cache"]);
    });

    test("Should extract services with dashes in name", () => {
      const content = `name: myapp
recipe: lamp
services:
  my-appserver:
    type: php
  my-database:
    type: mysql`;
      const services = extractServices(content);
      assert.deepStrictEqual(services, ["my-appserver", "my-database"]);
    });

    test("Should extract services with underscores in name", () => {
      const content = `name: myapp
recipe: lamp
services:
  app_server:
    type: php
  data_base:
    type: mysql`;
      const services = extractServices(content);
      assert.deepStrictEqual(services, ["app_server", "data_base"]);
    });

    test("Should return undefined when no services section", () => {
      const content = `name: myapp
recipe: lamp`;
      const services = extractServices(content);
      assert.strictEqual(services, undefined);
    });

    test("Should handle empty services section", () => {
      const content = `name: myapp
recipe: lamp
services:
tooling:`;
      const services = extractServices(content);
      // When services section exists but is empty or followed by another key
      // at the same indentation level, the regex won't match service definitions
      assert.strictEqual(services, undefined);
    });

    test("Should not include nested properties as services", () => {
      // Note: The regex stops capturing at lines that don't match the pattern
      // `\s+[a-zA-Z0-9_-]+:.*`, so sequence items like `- composer install` 
      // break the capture. This is a known limitation of the simple regex approach.
      const content = `name: myapp
recipe: lamp
services:
  appserver:
    type: php
  database:
    type: mysql`;
      const services = extractServices(content);
      // Should only get top-level service names, not nested properties
      assert.deepStrictEqual(services, ["appserver", "database"]);
    });
  });

  suite("Complete Config Parsing", () => {
    test("Should parse a complete Lando config", () => {
      // Note: Services with sequence items (like build: - ...) break the capture
      // Use services without sequences for reliable parsing
      const content = `name: my-drupal-site
recipe: drupal10
config:
  webroot: web
  php: '8.2'
services:
  appserver:
    type: php:8.2
  database:
    type: mysql
  cache:
    type: redis
tooling:
  drush:
    service: appserver`;

      const name = extractAppName(content);
      const cleanName = name ? cleanAppName(name) : null;
      const recipe = extractRecipe(content);
      const services = extractServices(content);

      assert.strictEqual(name, "my-drupal-site");
      assert.strictEqual(cleanName, "mydrupalsite");
      assert.strictEqual(recipe, "drupal10");
      assert.deepStrictEqual(services, ["appserver", "database", "cache"]);
    });

    test("Should parse a minimal Lando config", () => {
      const content = `name: myapp
recipe: lamp`;

      const name = extractAppName(content);
      const recipe = extractRecipe(content);
      const services = extractServices(content);

      assert.strictEqual(name, "myapp");
      assert.strictEqual(recipe, "lamp");
      assert.strictEqual(services, undefined);
    });

    test("Should parse a WordPress config", () => {
      const content = `name: my-wordpress-site
recipe: wordpress
config:
  webroot: .
  php: '8.1'
services:
  appserver:
    type: php:8.1-apache
  database:
    type: mariadb
tooling:
  wp:
    service: appserver`;

      const name = extractAppName(content);
      const cleanName = name ? cleanAppName(name) : null;
      const recipe = extractRecipe(content);
      const services = extractServices(content);

      assert.strictEqual(name, "my-wordpress-site");
      assert.strictEqual(cleanName, "mywordpresssite");
      assert.strictEqual(recipe, "wordpress");
      assert.deepStrictEqual(services, ["appserver", "database"]);
    });
  });

  suite("Edge Cases", () => {
    test("Should handle YAML with leading whitespace", () => {
      // This shouldn't happen in valid YAML but let's be resilient
      const content = `  name: myapp
recipe: lamp`;
      // The regex uses ^ anchor with /m flag, so this won't match
      assert.strictEqual(extractAppName(content), null);
    });

    test("Should handle empty content", () => {
      assert.strictEqual(extractAppName(""), null);
      assert.strictEqual(extractRecipe(""), null);
      assert.strictEqual(extractServices(""), undefined);
    });

    test("Should handle content with only comments", () => {
      const content = `# This is a comment
# Another comment`;
      assert.strictEqual(extractAppName(content), null);
      assert.strictEqual(extractRecipe(content), null);
    });

    test("Should handle multi-line strings in YAML", () => {
      // Name should still be extractable even with complex YAML
      const content = `name: myapp
recipe: lamp
services:
  appserver:
    build: |
      #!/bin/bash
      composer install
      npm install`;
      
      assert.strictEqual(extractAppName(content), "myapp");
      assert.strictEqual(extractRecipe(content), "lamp");
    });

    test("Should handle service names with numbers", () => {
      const content = `name: myapp
recipe: lamp
services:
  node16:
    type: node:16
  php81:
    type: php:8.1`;
      const services = extractServices(content);
      assert.deepStrictEqual(services, ["node16", "php81"]);
    });
  });

  suite("extractTooling Parsing", () => {
    test("Should extract simple string tooling definitions", () => {
      const content = `name: myapp
recipe: lamp
tooling:
  phpunit: vendor/bin/phpunit`;
      const tooling = extractTooling(content);
      assert.ok(tooling);
      assert.strictEqual(tooling.length, 1);
      assert.strictEqual(tooling[0].name, "phpunit");
      assert.strictEqual(tooling[0].cmd, "vendor/bin/phpunit");
      assert.strictEqual(tooling[0].isCustom, true);
    });

    test("Should extract tooling with service definition", () => {
      const content = `name: myapp
recipe: drupal10
tooling:
  drush:
    service: appserver
    cmd: drush`;
      const tooling = extractTooling(content);
      assert.ok(tooling);
      assert.strictEqual(tooling.length, 1);
      assert.strictEqual(tooling[0].name, "drush");
      assert.strictEqual(tooling[0].service, "appserver");
      assert.strictEqual(tooling[0].cmd, "drush");
    });

    test("Should extract tooling with description", () => {
      const content = `name: myapp
recipe: lamp
tooling:
  composer:
    service: appserver
    cmd: composer
    description: Run Composer commands`;
      const tooling = extractTooling(content);
      assert.ok(tooling);
      assert.strictEqual(tooling[0].description, "Run Composer commands");
    });

    test("Should extract tooling with array cmd", () => {
      const content = `name: myapp
recipe: lamp
tooling:
  test:
    service: appserver
    cmd:
      - php
      - vendor/bin/phpunit`;
      const tooling = extractTooling(content);
      assert.ok(tooling);
      assert.deepStrictEqual(tooling[0].cmd, ["php", "vendor/bin/phpunit"]);
    });

    test("Should extract tooling with environment variables", () => {
      const content = `name: myapp
recipe: lamp
tooling:
  node:
    service: node
    cmd: node
    env:
      NODE_ENV: development
      DEBUG: "true"`;
      const tooling = extractTooling(content);
      assert.ok(tooling);
      assert.deepStrictEqual(tooling[0].env, {
        NODE_ENV: "development",
        DEBUG: "true"
      });
    });

    test("Should extract tooling with dir and user", () => {
      const content = `name: myapp
recipe: lamp
tooling:
  gulp:
    service: node
    cmd: gulp
    dir: /app/frontend
    user: node`;
      const tooling = extractTooling(content);
      assert.ok(tooling);
      assert.strictEqual(tooling[0].dir, "/app/frontend");
      assert.strictEqual(tooling[0].user, "node");
    });

    test("Should extract multiple tooling commands", () => {
      const content = `name: myapp
recipe: drupal10
tooling:
  drush:
    service: appserver
    cmd: drush
  composer:
    service: appserver
    cmd: composer
  phpunit:
    service: appserver
    cmd: vendor/bin/phpunit`;
      const tooling = extractTooling(content);
      assert.ok(tooling);
      assert.strictEqual(tooling.length, 3);
      assert.strictEqual(tooling[0].name, "drush");
      assert.strictEqual(tooling[1].name, "composer");
      assert.strictEqual(tooling[2].name, "phpunit");
    });

    test("Should return undefined when no tooling section", () => {
      const content = `name: myapp
recipe: lamp
services:
  appserver:
    type: php`;
      const tooling = extractTooling(content);
      assert.strictEqual(tooling, undefined);
    });

    test("Should handle empty tooling section", () => {
      const content = `name: myapp
recipe: lamp
tooling:
services:
  appserver:
    type: php`;
      const tooling = extractTooling(content);
      assert.strictEqual(tooling, undefined);
    });

    test("Should handle mixed simple and complex tooling definitions", () => {
      const content = `name: myapp
recipe: lamp
tooling:
  phpunit: vendor/bin/phpunit
  drush:
    service: appserver
    cmd: drush
    description: Run Drush commands`;
      const tooling = extractTooling(content);
      assert.ok(tooling);
      assert.strictEqual(tooling.length, 2);
      // Simple definition
      assert.strictEqual(tooling[0].name, "phpunit");
      assert.strictEqual(tooling[0].cmd, "vendor/bin/phpunit");
      assert.strictEqual(tooling[0].service, undefined);
      // Complex definition
      assert.strictEqual(tooling[1].name, "drush");
      assert.strictEqual(tooling[1].service, "appserver");
      assert.strictEqual(tooling[1].description, "Run Drush commands");
    });

    test("Should handle null tooling entries gracefully", () => {
      const content = `name: myapp
recipe: lamp
tooling:
  drush:
    service: appserver
  empty_tool: ~`;
      const tooling = extractTooling(content);
      assert.ok(tooling);
      // Should only have drush, empty_tool is null (~)
      assert.strictEqual(tooling.length, 1);
      assert.strictEqual(tooling[0].name, "drush");
    });
  });

  suite("Combined Tooling Logic", () => {
    test("Should combine custom tooling with Lando-provided tooling", () => {
      const content = `name: myapp
recipe: drupal10
tooling:
  phpunit:
    service: appserver
    cmd: vendor/bin/phpunit`;
      
      const customTooling = extractTooling(content) || [];
      // In the actual extension, this comes from querying `lando` directly
      const landoTooling = createMockLandoTooling();
      
      // Combine: custom takes precedence
      const customNames = new Set(customTooling.map((t: LandoTooling) => t.name));
      const combined = [
        ...customTooling,
        ...landoTooling.filter((t: LandoTooling) => !customNames.has(t.name))
      ];
      
      const names = combined.map((t: LandoTooling) => t.name);
      assert.ok(names.includes("phpunit"), "Should include custom phpunit");
      assert.ok(names.includes("drush"), "Should include Lando-provided drush");
      assert.ok(names.includes("composer"), "Should include Lando-provided composer");
    });

    test("Custom tooling should override Lando-provided tooling with same name", () => {
      const content = `name: myapp
recipe: drupal10
tooling:
  drush:
    service: appserver
    cmd: /custom/path/drush
    description: Custom Drush`;
      
      const customTooling = extractTooling(content) || [];
      // In the actual extension, this comes from querying `lando` directly
      const landoTooling = createMockLandoTooling();
      
      // Combine: custom takes precedence
      const customNames = new Set(customTooling.map((t: LandoTooling) => t.name));
      const combined = [
        ...customTooling,
        ...landoTooling.filter((t: LandoTooling) => !customNames.has(t.name))
      ];
      
      // Should only have one drush entry
      const drushEntries = combined.filter((t: LandoTooling) => t.name === "drush");
      assert.strictEqual(drushEntries.length, 1, "Should have exactly one drush entry");
      assert.strictEqual(drushEntries[0].cmd, "/custom/path/drush", "Should use custom drush command");
      assert.strictEqual(drushEntries[0].description, "Custom Drush", "Should use custom description");
      assert.strictEqual(drushEntries[0].isCustom, true, "Should be marked as custom");
    });

    test("Lando-provided tooling should be marked as isCustom: false", () => {
      const landoTooling = createMockLandoTooling();
      for (const tool of landoTooling) {
        assert.strictEqual(tool.isCustom, false, `${tool.name} should have isCustom: false`);
      }
    });
  });
});
