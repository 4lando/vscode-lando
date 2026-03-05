/**
 * Unit tests for the PHP Plugins Module
 * 
 * These tests verify the constants and structure of the PHP plugins configuration.
 * Note: Functions that require vscode APIs are tested via integration tests.
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { COMMON_PHP_PLUGINS } from './plugins';

suite('PHP Plugins', () => {
  suite('COMMON_PHP_PLUGINS', () => {
    test('should be a non-empty array', () => {
      assert.ok(Array.isArray(COMMON_PHP_PLUGINS));
      assert.ok(COMMON_PHP_PLUGINS.length > 0);
    });

    test('should contain expected plugins', () => {
      const pluginIds = COMMON_PHP_PLUGINS.map(p => p.id);
      
      // Check for well-known PHP plugins
      assert.ok(pluginIds.includes('DEVSENSE.phptools-vscode'), 'Should include PHP Tools');
      assert.ok(pluginIds.includes('bmewburn.vscode-intelephense-client'), 'Should include Intelephense');
      assert.ok(pluginIds.includes('xdebug.php-debug'), 'Should include PHP Debug');
    });

    test('should have valid plugin IDs in publisher.extension format', () => {
      for (const plugin of COMMON_PHP_PLUGINS) {
        assert.ok(
          plugin.id.includes('.'),
          `Plugin ID "${plugin.id}" should be in publisher.extension format`
        );
      }
    });

    test('should have non-empty names for all plugins', () => {
      for (const plugin of COMMON_PHP_PLUGINS) {
        assert.ok(
          plugin.name && plugin.name.length > 0,
          `Plugin "${plugin.id}" should have a non-empty name`
        );
      }
    });

    test('should have isActive initialized to false', () => {
      for (const plugin of COMMON_PHP_PLUGINS) {
        assert.strictEqual(
          plugin.isActive,
          false,
          `Plugin "${plugin.id}" should have isActive initialized to false`
        );
      }
    });

    test('should have canReload set to true', () => {
      for (const plugin of COMMON_PHP_PLUGINS) {
        assert.strictEqual(
          plugin.canReload,
          true,
          `Plugin "${plugin.id}" should have canReload set to true`
        );
      }
    });

    test('should have unique plugin IDs', () => {
      const ids = COMMON_PHP_PLUGINS.map(p => p.id);
      const uniqueIds = new Set(ids);
      assert.strictEqual(
        uniqueIds.size,
        ids.length,
        'All plugin IDs should be unique'
      );
    });

    test('should have unique plugin names', () => {
      const names = COMMON_PHP_PLUGINS.map(p => p.name);
      const uniqueNames = new Set(names);
      assert.strictEqual(
        uniqueNames.size,
        names.length,
        'All plugin names should be unique'
      );
    });
  });
});
