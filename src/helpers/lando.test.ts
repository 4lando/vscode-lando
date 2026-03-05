/**
 * Unit tests for the Lando Helper Module
 * 
 * These tests verify the constants and pure logic in the Lando helper module.
 * Note: Functions that require child_process or vscode APIs are tested via integration tests.
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { LANDO_CORE_COMMANDS } from './lando';

suite('Lando Helper', () => {
  suite('LANDO_CORE_COMMANDS', () => {
    test('should be a Set', () => {
      assert.ok(LANDO_CORE_COMMANDS instanceof Set);
    });

    test('should contain core lifecycle commands', () => {
      assert.ok(LANDO_CORE_COMMANDS.has('start'));
      assert.ok(LANDO_CORE_COMMANDS.has('stop'));
      assert.ok(LANDO_CORE_COMMANDS.has('restart'));
      assert.ok(LANDO_CORE_COMMANDS.has('rebuild'));
      assert.ok(LANDO_CORE_COMMANDS.has('destroy'));
      assert.ok(LANDO_CORE_COMMANDS.has('poweroff'));
    });

    test('should contain informational commands', () => {
      assert.ok(LANDO_CORE_COMMANDS.has('config'));
      assert.ok(LANDO_CORE_COMMANDS.has('info'));
      assert.ok(LANDO_CORE_COMMANDS.has('list'));
      assert.ok(LANDO_CORE_COMMANDS.has('logs'));
      assert.ok(LANDO_CORE_COMMANDS.has('version'));
    });

    test('should contain other core commands', () => {
      assert.ok(LANDO_CORE_COMMANDS.has('init'));
      assert.ok(LANDO_CORE_COMMANDS.has('exec'));
      assert.ok(LANDO_CORE_COMMANDS.has('ssh'));
      assert.ok(LANDO_CORE_COMMANDS.has('share'));
      assert.ok(LANDO_CORE_COMMANDS.has('update'));
    });

    test('should contain database commands', () => {
      assert.ok(LANDO_CORE_COMMANDS.has('db-export'));
      assert.ok(LANDO_CORE_COMMANDS.has('db-import'));
    });

    test('should not contain common tooling commands', () => {
      // These are tooling commands that should NOT be in core commands
      assert.ok(!LANDO_CORE_COMMANDS.has('composer'));
      assert.ok(!LANDO_CORE_COMMANDS.has('npm'));
      assert.ok(!LANDO_CORE_COMMANDS.has('php'));
      assert.ok(!LANDO_CORE_COMMANDS.has('drush'));
      assert.ok(!LANDO_CORE_COMMANDS.has('wp'));
      assert.ok(!LANDO_CORE_COMMANDS.has('artisan'));
    });

    test('should have expected number of core commands', () => {
      // Verify we have the expected core commands count
      // This helps catch accidental additions or removals
      assert.strictEqual(LANDO_CORE_COMMANDS.size, 18);
    });
  });
});
