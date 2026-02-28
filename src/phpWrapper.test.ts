/**
 * Unit tests for PHP wrapper scripts.
 * 
 * These tests verify the behavior of the bin/php and bin/php.bat wrapper scripts
 * that intercept PHP commands and redirect them to Lando containers.
 */

import * as assert from "assert";
import { suite, test } from "mocha";
import * as path from "path";
import * as fs from "fs";
import { spawnSync } from "child_process";

// Get the project root directory (relative to out/phpWrapper.test.js)
const projectRoot = path.resolve(__dirname, "..");
const binDir = path.join(projectRoot, "bin");
const phpWrapper = path.join(binDir, "php");
const phpBatWrapper = path.join(binDir, "php.bat");

suite("PHP Wrapper Script Tests", () => {
  suite("Script Existence and Permissions", () => {
    test("bin/php should exist", () => {
      assert.ok(fs.existsSync(phpWrapper), "bin/php should exist");
    });

    test("bin/php.bat should exist", () => {
      assert.ok(fs.existsSync(phpBatWrapper), "bin/php.bat should exist");
    });

    test("bin/php should be executable on Unix", function() {
      if (process.platform === "win32") {
        this.skip();
        return;
      }
      
      const stats = fs.statSync(phpWrapper);
      const isExecutable = (stats.mode & 0o111) !== 0;
      assert.ok(isExecutable, "bin/php should be executable");
    });

    test("bin/php should be a valid bash script", function() {
      if (process.platform === "win32") {
        this.skip();
        return;
      }
      
      const content = fs.readFileSync(phpWrapper, "utf8");
      assert.ok(content.startsWith("#!/bin/bash"), "Should have bash shebang");
    });

    test("bin/php.bat should be a valid batch script", () => {
      const content = fs.readFileSync(phpBatWrapper, "utf8");
      assert.ok(content.startsWith("@echo off"), "Should start with @echo off");
    });
  });

  suite("Script Content Validation", () => {
    test("Unix wrapper should check for VSCODE_LANDO_PHP_CONTAINER", () => {
      const content = fs.readFileSync(phpWrapper, "utf8");
      assert.ok(
        content.includes('if [ -z "$VSCODE_LANDO_PHP_CONTAINER" ]'),
        "Should check for empty VSCODE_LANDO_PHP_CONTAINER"
      );
    });

    test("Unix wrapper should check for VSCODE_LANDO_EXEC_CWD", () => {
      const content = fs.readFileSync(phpWrapper, "utf8");
      assert.ok(
        content.includes('if [ -z "$VSCODE_LANDO_EXEC_CWD" ]'),
        "Should check for empty VSCODE_LANDO_EXEC_CWD"
      );
    });

    test("Unix wrapper should use docker exec with -w flag", () => {
      const content = fs.readFileSync(phpWrapper, "utf8");
      assert.ok(
        content.includes("docker exec -i -w"),
        "Should use docker exec with -w flag for working directory"
      );
    });

    test("Unix wrapper should pass arguments correctly using $@", () => {
      const content = fs.readFileSync(phpWrapper, "utf8");
      assert.ok(
        content.includes('"$@"'),
        'Should use "$@" to pass arguments with proper quoting'
      );
    });

    test("Windows wrapper should check for VSCODE_LANDO_PHP_CONTAINER", () => {
      const content = fs.readFileSync(phpBatWrapper, "utf8");
      assert.ok(
        content.includes('if "%VSCODE_LANDO_PHP_CONTAINER%"==""'),
        "Should check for empty VSCODE_LANDO_PHP_CONTAINER"
      );
    });

    test("Windows wrapper should check for VSCODE_LANDO_EXEC_CWD", () => {
      const content = fs.readFileSync(phpBatWrapper, "utf8");
      assert.ok(
        content.includes('if "%VSCODE_LANDO_EXEC_CWD%"==""'),
        "Should check for empty VSCODE_LANDO_EXEC_CWD"
      );
    });

    test("Windows wrapper should use docker exec with -w flag", () => {
      const content = fs.readFileSync(phpBatWrapper, "utf8");
      assert.ok(
        content.includes("docker exec -i -w"),
        "Should use docker exec with -w flag for working directory"
      );
    });

    test("Both wrappers should output errors to stderr", () => {
      const unixContent = fs.readFileSync(phpWrapper, "utf8");
      const winContent = fs.readFileSync(phpBatWrapper, "utf8");
      
      assert.ok(
        unixContent.includes(">&2"),
        "Unix wrapper should redirect error messages to stderr"
      );
      assert.ok(
        winContent.includes(">&2"),
        "Windows wrapper should redirect error messages to stderr"
      );
    });

    test("Both wrappers should exit with error code 1 on missing env vars", () => {
      const unixContent = fs.readFileSync(phpWrapper, "utf8");
      const winContent = fs.readFileSync(phpBatWrapper, "utf8");
      
      assert.ok(
        unixContent.includes("exit 1"),
        "Unix wrapper should exit with code 1 on error"
      );
      assert.ok(
        winContent.includes("exit /b 1"),
        "Windows wrapper should exit with code 1 on error"
      );
    });
  });

  suite("Script Execution (Unix only)", () => {
    test("Should fail with error when VSCODE_LANDO_PHP_CONTAINER is not set", function() {
      if (process.platform === "win32") {
        this.skip();
        return;
      }
      
      const result = spawnSync(phpWrapper, ["-v"], {
        env: {
          ...process.env,
          VSCODE_LANDO_PHP_CONTAINER: "",
          VSCODE_LANDO_EXEC_CWD: "/app"
        },
        encoding: "utf8"
      });
      
      assert.notStrictEqual(result.status, 0, "Should exit with non-zero status");
      assert.ok(
        result.stderr.includes("VSCODE_LANDO_PHP_CONTAINER"),
        "Should mention missing VSCODE_LANDO_PHP_CONTAINER in error"
      );
    });

    test("Should fail with error when VSCODE_LANDO_EXEC_CWD is not set", function() {
      if (process.platform === "win32") {
        this.skip();
        return;
      }
      
      const result = spawnSync(phpWrapper, ["-v"], {
        env: {
          ...process.env,
          VSCODE_LANDO_PHP_CONTAINER: "some_container",
          VSCODE_LANDO_EXEC_CWD: ""
        },
        encoding: "utf8"
      });
      
      assert.notStrictEqual(result.status, 0, "Should exit with non-zero status");
      assert.ok(
        result.stderr.includes("VSCODE_LANDO_EXEC_CWD"),
        "Should mention missing VSCODE_LANDO_EXEC_CWD in error"
      );
    });

    test("Should fail when both env vars are not set", function() {
      if (process.platform === "win32") {
        this.skip();
        return;
      }
      
      const result = spawnSync(phpWrapper, ["-v"], {
        env: {
          PATH: process.env.PATH
        },
        encoding: "utf8"
      });
      
      assert.notStrictEqual(result.status, 0, "Should exit with non-zero status");
    });
  });

  suite("PATH-based Interception", () => {
    test("Bin directory should be addable to PATH", () => {
      // Verify the bin directory exists and contains our wrapper
      assert.ok(fs.existsSync(binDir), "bin directory should exist");
      assert.ok(fs.existsSync(phpWrapper), "php wrapper should exist in bin");
      
      // Verify path can be constructed correctly
      const newPath = `${binDir}:${process.env.PATH}`;
      assert.ok(newPath.startsWith(binDir), "PATH should be prependable");
    });

    test("PHP wrapper path should be absolute", () => {
      assert.ok(path.isAbsolute(phpWrapper), "php wrapper path should be absolute");
      assert.ok(path.isAbsolute(binDir), "bin directory path should be absolute");
    });
  });
});

suite("Docker Command Construction", () => {
  test("Unix wrapper should construct correct docker command", () => {
    const content = fs.readFileSync(phpWrapper, "utf8");
    
    // Should use docker exec with these flags:
    // -i: interactive (keeps stdin open)
    // -w: working directory
    assert.ok(content.includes("docker exec -i -w"), "Should use docker exec -i -w");
    
    // Should reference the container and working directory env vars
    assert.ok(content.includes("$VSCODE_LANDO_EXEC_CWD"), "Should use VSCODE_LANDO_EXEC_CWD");
    assert.ok(content.includes("$VSCODE_LANDO_PHP_CONTAINER"), "Should use VSCODE_LANDO_PHP_CONTAINER");
    
    // Should invoke php with the passed arguments
    assert.ok(content.includes("php"), "Should invoke php command");
  });

  test("Windows wrapper should construct correct docker command", () => {
    const content = fs.readFileSync(phpBatWrapper, "utf8");
    
    // Should use docker exec with these flags
    assert.ok(content.includes("docker exec -i -w"), "Should use docker exec -i -w");
    
    // Should reference the container and working directory env vars
    assert.ok(content.includes("%VSCODE_LANDO_EXEC_CWD%"), "Should use VSCODE_LANDO_EXEC_CWD");
    assert.ok(content.includes("%VSCODE_LANDO_PHP_CONTAINER%"), "Should use VSCODE_LANDO_PHP_CONTAINER");
    
    // Should invoke php with the passed arguments
    assert.ok(content.includes("php %*"), "Should invoke php with all arguments");
  });
});
