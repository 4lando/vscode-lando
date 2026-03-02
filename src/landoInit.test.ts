/**
 * Unit tests for Lando App Initialization Wizard
 * 
 * Tests the pure functions that don't require VS Code APIs.
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import {
  LANDO_RECIPES,
  RECIPE_CATEGORIES,
  validateAppName,
  suggestAppName,
  generateLandoConfig,
  LandoInitConfig,
} from './landoInit';

suite('Lando App Initialization Wizard', () => {
  suite('LANDO_RECIPES', () => {
    test('should have recipes for all major CMS platforms', () => {
      const cmsRecipes = LANDO_RECIPES.filter(r => r.category === 'cms');
      const cmsIds = cmsRecipes.map(r => r.id);
      
      assert.ok(cmsIds.includes('drupal10'), 'Should have Drupal 10');
      assert.ok(cmsIds.includes('drupal11'), 'Should have Drupal 11');
      assert.ok(cmsIds.includes('wordpress'), 'Should have WordPress');
    });

    test('should have recipes for major frameworks', () => {
      const frameworkRecipes = LANDO_RECIPES.filter(r => r.category === 'framework');
      const frameworkIds = frameworkRecipes.map(r => r.id);
      
      assert.ok(frameworkIds.includes('laravel'), 'Should have Laravel');
      assert.ok(frameworkIds.includes('symfony'), 'Should have Symfony');
    });

    test('should have stack recipes', () => {
      const stackRecipes = LANDO_RECIPES.filter(r => r.category === 'stack');
      const stackIds = stackRecipes.map(r => r.id);
      
      assert.ok(stackIds.includes('lamp'), 'Should have LAMP');
      assert.ok(stackIds.includes('lemp'), 'Should have LEMP');
      assert.ok(stackIds.includes('node'), 'Should have Node.js');
    });

    test('should have a custom recipe option', () => {
      const customRecipe = LANDO_RECIPES.find(r => r.id === 'custom');
      assert.ok(customRecipe, 'Should have custom recipe');
      assert.strictEqual(customRecipe?.category, 'custom');
    });

    test('all recipes should have required fields', () => {
      for (const recipe of LANDO_RECIPES) {
        assert.ok(recipe.id, `Recipe should have id: ${JSON.stringify(recipe)}`);
        assert.ok(recipe.name, `Recipe ${recipe.id} should have name`);
        assert.ok(recipe.description, `Recipe ${recipe.id} should have description`);
        assert.ok(recipe.icon, `Recipe ${recipe.id} should have icon`);
        assert.ok(recipe.category, `Recipe ${recipe.id} should have category`);
      }
    });
  });

  suite('RECIPE_CATEGORIES', () => {
    test('should have all expected categories', () => {
      const categoryKeys = RECIPE_CATEGORIES.map(c => c.key);
      
      assert.ok(categoryKeys.includes('cms'), 'Should have CMS category');
      assert.ok(categoryKeys.includes('framework'), 'Should have Framework category');
      assert.ok(categoryKeys.includes('stack'), 'Should have Stack category');
      assert.ok(categoryKeys.includes('custom'), 'Should have Custom category');
    });

    test('all categories should have required fields', () => {
      for (const category of RECIPE_CATEGORIES) {
        assert.ok(category.key, 'Category should have key');
        assert.ok(category.label, 'Category should have label');
        assert.ok(category.icon, 'Category should have icon');
      }
    });
  });

  suite('validateAppName', () => {
    test('should accept valid app names', () => {
      assert.strictEqual(validateAppName('my-app'), undefined);
      assert.strictEqual(validateAppName('myapp'), undefined);
      assert.strictEqual(validateAppName('my-cool-app'), undefined);
      assert.strictEqual(validateAppName('app123'), undefined);
      assert.strictEqual(validateAppName('123app'), undefined);
      assert.strictEqual(validateAppName('a'), undefined);
    });

    test('should reject empty names', () => {
      assert.ok(validateAppName(''), 'Empty string should be invalid');
      assert.ok(validateAppName('   '), 'Whitespace only should be invalid');
    });

    test('should reject names that are too long', () => {
      const longName = 'a'.repeat(51);
      assert.ok(validateAppName(longName), 'Name longer than 50 chars should be invalid');
    });

    test('should reject names with invalid characters', () => {
      assert.ok(validateAppName('My-App'), 'Uppercase should be invalid');
      assert.ok(validateAppName('my_app'), 'Underscore should be invalid');
      assert.ok(validateAppName('my app'), 'Space should be invalid');
      assert.ok(validateAppName('my.app'), 'Dot should be invalid');
    });

    test('should reject names starting with invalid characters', () => {
      assert.ok(validateAppName('-myapp'), 'Starting with hyphen should be invalid');
    });

    test('should reject names with consecutive hyphens', () => {
      assert.ok(validateAppName('my--app'), 'Consecutive hyphens should be invalid');
    });
  });

  suite('suggestAppName', () => {
    test('should convert directory names to valid app names', () => {
      assert.strictEqual(suggestAppName('/path/to/my-project'), 'my-project');
      assert.strictEqual(suggestAppName('/path/to/MyProject'), 'myproject');
      assert.strictEqual(suggestAppName('/path/to/my_project'), 'my-project');
      assert.strictEqual(suggestAppName('/path/to/My Project'), 'my-project');
    });

    test('should handle special characters', () => {
      assert.strictEqual(suggestAppName('/path/to/project@2.0'), 'project20');
      assert.strictEqual(suggestAppName('/path/to/my.project'), 'myproject');
    });

    test('should handle edge cases', () => {
      assert.strictEqual(suggestAppName('/path/to/___project___'), 'project');
      assert.strictEqual(suggestAppName('/path/to/---project---'), 'project');
    });
  });

  suite('generateLandoConfig', () => {
    test('should generate basic config for custom recipe', () => {
      const config: LandoInitConfig = {
        name: 'my-app',
        recipe: 'custom',
        targetDir: '/path/to/app',
        startAfterCreate: false,
      };

      const result = generateLandoConfig(config);
      
      assert.ok(result.includes('name: my-app'), 'Should include app name');
      assert.ok(!result.includes('recipe:'), 'Custom recipe should not include recipe line');
      assert.ok(result.includes('# Add your services here'), 'Custom should have helpful comments');
    });

    test('should generate config for LAMP stack with defaults', () => {
      const config: LandoInitConfig = {
        name: 'my-lamp-app',
        recipe: 'lamp',
        targetDir: '/path/to/app',
        phpVersion: '8.2',
        database: 'mysql:8.0',
        startAfterCreate: false,
      };

      const result = generateLandoConfig(config);
      
      assert.ok(result.includes('name: my-lamp-app'), 'Should include app name');
      assert.ok(result.includes('recipe: lamp'), 'Should include recipe');
      assert.ok(result.includes("php: '8.2'"), 'Should include PHP version');
      assert.ok(result.includes('database: mysql:8.0'), 'Should include database');
    });

    test('should generate config for Drupal with web server option', () => {
      const config: LandoInitConfig = {
        name: 'drupal-site',
        recipe: 'drupal10',
        targetDir: '/path/to/app',
        phpVersion: '8.2',
        webServer: 'nginx',
        database: 'mysql:8.0',
        startAfterCreate: false,
      };

      const result = generateLandoConfig(config);
      
      assert.ok(result.includes('name: drupal-site'), 'Should include app name');
      assert.ok(result.includes('recipe: drupal10'), 'Should include recipe');
      assert.ok(result.includes("php: '8.2'"), 'Should include PHP version');
      assert.ok(result.includes('via: nginx'), 'Should include web server');
    });

    test('should generate minimal config when no options provided', () => {
      const config: LandoInitConfig = {
        name: 'simple-app',
        recipe: 'node',
        targetDir: '/path/to/app',
        startAfterCreate: false,
      };

      const result = generateLandoConfig(config);
      
      assert.ok(result.includes('name: simple-app'), 'Should include app name');
      assert.ok(result.includes('recipe: node'), 'Should include recipe');
      // Should not have config section if no options
      const lines = result.split('\n').filter(l => l.trim());
      assert.strictEqual(lines.length, 2, 'Should only have name and recipe');
    });

    test('should end with newline', () => {
      const config: LandoInitConfig = {
        name: 'test-app',
        recipe: 'lamp',
        targetDir: '/path/to/app',
        startAfterCreate: false,
      };

      const result = generateLandoConfig(config);
      
      assert.ok(result.endsWith('\n'), 'Config should end with newline');
    });
  });
});
