import * as assert from "assert";
import { suite, test, suiteSetup, suiteTeardown } from "mocha";
import * as vscode from "vscode";
import * as path from "path";

/**
 * Test suite for PHP command interception via terminal environment configuration.
 * 
 * The extension intercepts PHP commands by:
 * 1. Prepending the extension's bin directory to PATH in terminal.integrated.env.*
 * 2. Setting VSCODE_LANDO_PHP_CONTAINER and VSCODE_LANDO_EXEC_CWD environment variables
 * 
 * This allows ALL terminals (including task terminals) to use the Lando PHP wrapper
 * without requiring any manual setup or task modification.
 */
suite("PHP Command Interception Test Suite", () => {
  let extension: vscode.Extension<unknown>;
  let originalEnvLinux: Record<string, string | null> | undefined;
  let originalEnvOsx: Record<string, string | null> | undefined;
  let originalEnvWindows: Record<string, string | null> | undefined;
  let hasWorkspace: boolean;

  suiteSetup(async () => {
    extension = vscode.extensions.getExtension("4lando.vscode-lando")!;
    assert.ok(extension, "Extension should be found");
    await extension.activate();
    
    // Check if we have a workspace (needed for write tests)
    hasWorkspace = vscode.workspace.workspaceFolders !== undefined && 
                   vscode.workspace.workspaceFolders.length > 0;
    
    if (hasWorkspace) {
      // Store original terminal environment settings for restoration after tests
      const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
      originalEnvLinux = terminalConfig.get<Record<string, string | null>>("env.linux");
      originalEnvOsx = terminalConfig.get<Record<string, string | null>>("env.osx");
      originalEnvWindows = terminalConfig.get<Record<string, string | null>>("env.windows");
    }
  });

  suiteTeardown(async () => {
    if (!hasWorkspace) {
      return;
    }
    
    // Restore original terminal environment settings
    try {
      const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
      await terminalConfig.update("env.linux", originalEnvLinux, vscode.ConfigurationTarget.Workspace);
      await terminalConfig.update("env.osx", originalEnvOsx, vscode.ConfigurationTarget.Workspace);
      await terminalConfig.update("env.windows", originalEnvWindows, vscode.ConfigurationTarget.Workspace);
    } catch {
      // Ignore errors during cleanup
    }
  });

  suite("Extension Bin Directory", () => {
    test("Extension should have bin directory with PHP wrapper", () => {
      const extensionPath = extension.extensionPath;
      const binPath = path.join(extensionPath, "bin");
      const phpWrapperPath = path.join(binPath, "php");
      const phpBatPath = path.join(binPath, "php.bat");
      
      const fs = require("fs");
      
      assert.ok(fs.existsSync(binPath), "bin directory should exist");
      assert.ok(fs.existsSync(phpWrapperPath), "bin/php wrapper should exist");
      assert.ok(fs.existsSync(phpBatPath), "bin/php.bat wrapper should exist");
    });

    test("Unix PHP wrapper should be executable", () => {
      const extensionPath = extension.extensionPath;
      const phpWrapperPath = path.join(extensionPath, "bin", "php");
      
      const fs = require("fs");
      const stats = fs.statSync(phpWrapperPath);
      
      // Check if file has execute permission (mode & 0o111 checks for any execute bit)
      const isExecutable = (stats.mode & 0o111) !== 0;
      assert.ok(isExecutable, "bin/php should be executable");
    });

    test("PHP wrapper scripts should have required content", () => {
      const extensionPath = extension.extensionPath;
      const fs = require("fs");
      
      // Check Unix wrapper
      const unixWrapper = fs.readFileSync(path.join(extensionPath, "bin", "php"), "utf8");
      assert.ok(unixWrapper.includes("VSCODE_LANDO_PHP_CONTAINER"), "Unix wrapper should check for container env var");
      assert.ok(unixWrapper.includes("VSCODE_LANDO_EXEC_CWD"), "Unix wrapper should check for cwd env var");
      assert.ok(unixWrapper.includes("docker exec"), "Unix wrapper should use docker exec");
      
      // Check Windows wrapper
      const winWrapper = fs.readFileSync(path.join(extensionPath, "bin", "php.bat"), "utf8");
      assert.ok(winWrapper.includes("VSCODE_LANDO_PHP_CONTAINER"), "Windows wrapper should check for container env var");
      assert.ok(winWrapper.includes("VSCODE_LANDO_EXEC_CWD"), "Windows wrapper should check for cwd env var");
      assert.ok(winWrapper.includes("docker exec"), "Windows wrapper should use docker exec");
    });
  });

  suite("Terminal Environment Configuration", () => {
    test("Should be able to read terminal environment settings", () => {
      const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
      
      // These should not throw - we're just verifying we can read them
      const envLinux = terminalConfig.get<Record<string, string | null>>("env.linux");
      const envOsx = terminalConfig.get<Record<string, string | null>>("env.osx");
      const envWindows = terminalConfig.get<Record<string, string | null>>("env.windows");
      
      // They may be undefined if not set, which is fine
      assert.ok(envLinux === undefined || typeof envLinux === "object", "env.linux should be undefined or object");
      assert.ok(envOsx === undefined || typeof envOsx === "object", "env.osx should be undefined or object");
      assert.ok(envWindows === undefined || typeof envWindows === "object", "env.windows should be undefined or object");
    });

    test("Should be able to update terminal environment settings", async function() {
      if (!hasWorkspace) {
        this.skip();
        return;
      }
      
      const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
      
      // Get current value
      const currentEnv = terminalConfig.get<Record<string, string | null>>("env.linux") || {};
      
      // Set a test value
      const testEnv = { ...currentEnv, TEST_VAR: "test_value" };
      await terminalConfig.update("env.linux", testEnv, vscode.ConfigurationTarget.Workspace);
      
      // Verify it was set
      const updatedEnv = terminalConfig.get<Record<string, string | null>>("env.linux");
      assert.strictEqual(updatedEnv?.TEST_VAR, "test_value", "Should be able to set env var");
      
      // Restore original
      await terminalConfig.update("env.linux", currentEnv, vscode.ConfigurationTarget.Workspace);
    });

    test("Terminal environment should support PATH modification", async function() {
      if (!hasWorkspace) {
        this.skip();
        return;
      }
      
      const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
      const extensionPath = extension.extensionPath;
      const binDir = path.join(extensionPath, "bin");
      
      // Get current value
      const currentEnv = terminalConfig.get<Record<string, string | null>>("env.linux") || {};
      
      // Set PATH with our bin directory prepended
      const testEnv = { 
        ...currentEnv, 
        PATH: `${binDir}:\${env:PATH}` 
      };
      await terminalConfig.update("env.linux", testEnv, vscode.ConfigurationTarget.Workspace);
      
      // Verify it was set
      const updatedEnv = terminalConfig.get<Record<string, string | null>>("env.linux");
      assert.ok(updatedEnv?.PATH?.includes(binDir), "PATH should include bin directory");
      
      // Restore original
      await terminalConfig.update("env.linux", currentEnv, vscode.ConfigurationTarget.Workspace);
    });

    test("Terminal environment should support Lando container env vars", async function() {
      if (!hasWorkspace) {
        this.skip();
        return;
      }
      
      const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
      
      // Get current value
      const currentEnv = terminalConfig.get<Record<string, string | null>>("env.linux") || {};
      
      // Set Lando env vars
      const testEnv = { 
        ...currentEnv, 
        VSCODE_LANDO_PHP_CONTAINER: "test_container_1",
        VSCODE_LANDO_EXEC_CWD: "/app"
      };
      await terminalConfig.update("env.linux", testEnv, vscode.ConfigurationTarget.Workspace);
      
      // Verify they were set
      const updatedEnv = terminalConfig.get<Record<string, string | null>>("env.linux");
      assert.strictEqual(updatedEnv?.VSCODE_LANDO_PHP_CONTAINER, "test_container_1", "Container env var should be set");
      assert.strictEqual(updatedEnv?.VSCODE_LANDO_EXEC_CWD, "/app", "CWD env var should be set");
      
      // Restore original
      await terminalConfig.update("env.linux", currentEnv, vscode.ConfigurationTarget.Workspace);
    });
  });

  suite("Environment Restoration", () => {
    test("Should be able to restore empty terminal environment", async function() {
      if (!hasWorkspace) {
        this.skip();
        return;
      }
      
      const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
      
      // Get current value
      const currentEnv = terminalConfig.get<Record<string, string | null>>("env.linux");
      
      // Set some values
      await terminalConfig.update("env.linux", { TEST: "value" }, vscode.ConfigurationTarget.Workspace);
      
      // Restore to undefined (remove the setting)
      await terminalConfig.update("env.linux", undefined, vscode.ConfigurationTarget.Workspace);
      
      // Verify it was cleared
      const clearedEnv = terminalConfig.get<Record<string, string | null>>("env.linux");
      assert.ok(clearedEnv === undefined || Object.keys(clearedEnv).length === 0, "Env should be cleared");
      
      // Restore original
      await terminalConfig.update("env.linux", currentEnv, vscode.ConfigurationTarget.Workspace);
    });

    test("Should be able to restore previous terminal environment values", async function() {
      if (!hasWorkspace) {
        this.skip();
        return;
      }
      
      const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
      
      // Set initial values
      const initialEnv = { INITIAL_VAR: "initial_value" };
      await terminalConfig.update("env.linux", initialEnv, vscode.ConfigurationTarget.Workspace);
      
      // Modify to new values
      const modifiedEnv = { MODIFIED_VAR: "modified_value" };
      await terminalConfig.update("env.linux", modifiedEnv, vscode.ConfigurationTarget.Workspace);
      
      // Verify modification
      let currentEnv = terminalConfig.get<Record<string, string | null>>("env.linux");
      assert.strictEqual(currentEnv?.MODIFIED_VAR, "modified_value", "Should have modified value");
      assert.ok(!currentEnv?.INITIAL_VAR, "Should not have initial value");
      
      // Restore initial values
      await terminalConfig.update("env.linux", initialEnv, vscode.ConfigurationTarget.Workspace);
      
      // Verify restoration
      currentEnv = terminalConfig.get<Record<string, string | null>>("env.linux");
      assert.strictEqual(currentEnv?.INITIAL_VAR, "initial_value", "Should have initial value restored");
      assert.ok(!currentEnv?.MODIFIED_VAR, "Should not have modified value");
      
      // Clean up
      await terminalConfig.update("env.linux", undefined, vscode.ConfigurationTarget.Workspace);
    });
  });

  suite("Cross-Platform Support", () => {
    test("Should support all three platforms (linux, osx, windows)", async function() {
      if (!hasWorkspace) {
        this.skip();
        return;
      }
      
      const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
      const platforms = ["linux", "osx", "windows"] as const;
      
      for (const platform of platforms) {
        const envKey = `env.${platform}` as const;
        
        // Get current value
        const currentEnv = terminalConfig.get<Record<string, string | null>>(envKey);
        
        // Set test value
        const testEnv = { [`TEST_${platform.toUpperCase()}`]: "test" };
        await terminalConfig.update(envKey, testEnv, vscode.ConfigurationTarget.Workspace);
        
        // Verify
        const updatedEnv = terminalConfig.get<Record<string, string | null>>(envKey);
        assert.ok(updatedEnv?.[`TEST_${platform.toUpperCase()}`], `Should be able to set env for ${platform}`);
        
        // Restore
        await terminalConfig.update(envKey, currentEnv, vscode.ConfigurationTarget.Workspace);
      }
    });

    test("Both wrappers should use docker exec command", () => {
      const extensionPath = extension.extensionPath;
      const fs = require("fs");
      
      // Check Unix wrapper uses docker exec
      const unixWrapper = fs.readFileSync(path.join(extensionPath, "bin", "php"), "utf8");
      assert.ok(unixWrapper.includes("docker exec"), "Unix wrapper should use docker exec");
      
      // Check Windows wrapper uses docker exec
      const winWrapper = fs.readFileSync(path.join(extensionPath, "bin", "php.bat"), "utf8");
      assert.ok(winWrapper.includes("docker exec"), "Windows wrapper should use docker exec");
    });
  });

  suite("Integration with Existing Settings", () => {
    test("Should preserve existing terminal environment variables when adding new ones", async function() {
      if (!hasWorkspace) {
        this.skip();
        return;
      }
      
      const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
      
      // Set initial custom env var
      const initialEnv = { MY_CUSTOM_VAR: "custom_value" };
      await terminalConfig.update("env.linux", initialEnv, vscode.ConfigurationTarget.Workspace);
      
      // Get the current env and add our vars (simulating what configureTerminalEnvironment does)
      const currentEnv = terminalConfig.get<Record<string, string | null>>("env.linux") || {};
      const newEnv = {
        ...currentEnv,
        VSCODE_LANDO_PHP_CONTAINER: "test_container",
        VSCODE_LANDO_EXEC_CWD: "/app"
      };
      await terminalConfig.update("env.linux", newEnv, vscode.ConfigurationTarget.Workspace);
      
      // Verify both old and new vars exist
      const updatedEnv = terminalConfig.get<Record<string, string | null>>("env.linux");
      assert.strictEqual(updatedEnv?.MY_CUSTOM_VAR, "custom_value", "Should preserve existing var");
      assert.strictEqual(updatedEnv?.VSCODE_LANDO_PHP_CONTAINER, "test_container", "Should have new var");
      
      // Clean up
      await terminalConfig.update("env.linux", undefined, vscode.ConfigurationTarget.Workspace);
    });
  });
});
