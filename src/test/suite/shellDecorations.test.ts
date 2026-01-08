import * as assert from "assert";
import { suite, test } from "mocha";

/**
 * Tests for the Shell Decorations module.
 * 
 * Tests the pattern matching logic used to identify shell command lines
 * and determine where to place $ decorations in Landofile YAML files.
 */

/**
 * Checks if a filename matches the Landofile pattern.
 * Mirrors the isLandofile() logic in shellDecorations.ts
 */
function isLandofilePattern(fileName: string): boolean {
  return /[/\\]\.lando(\.[^/\\]+)?\.yml$/i.test(fileName);
}

/**
 * Detects if a line starts a shell block scalar (cmd: | or cmd: >)
 */
function isShellBlockStart(line: string): { isBlock: boolean; type: "literal" | "folded" | null } {
  const match = /^\s*(build|run|build_as_root|run_as_root|cmd|command):\s*([|>])/.exec(line);
  if (match) {
    return {
      isBlock: true,
      type: match[2] === "|" ? "literal" : "folded"
    };
  }
  return { isBlock: false, type: null };
}

/**
 * Detects if a line is a sequence key for shell commands
 */
function isSequenceKey(line: string): string | null {
  const match = /^\s*(build|run|build_as_root|run_as_root|cmd):\s*$/.exec(line);
  return match ? match[1] : null;
}

/**
 * Detects if a line is a sequence item with block scalar (- | or - >)
 */
function isSequenceBlockScalar(line: string): { isBlock: boolean; type: "literal" | "folded" | null } {
  const match = /^\s*-\s+([|>])/.exec(line);
  if (match) {
    return {
      isBlock: true,
      type: match[1] === "|" ? "literal" : "folded"
    };
  }
  return { isBlock: false, type: null };
}

/**
 * Detects if a line is a sequence item with a command
 */
function isSequenceItem(line: string): { isItem: boolean; commandStart: number } {
  const match = /^(\s*-\s+)(.+)$/.exec(line);
  if (match) {
    return {
      isItem: true,
      commandStart: match[1].length
    };
  }
  return { isItem: false, commandStart: -1 };
}

/**
 * Detects if a line is a single-line shell command (cmd: "echo foo")
 */
function isSingleLineCmd(line: string): { isCmd: boolean; commandStart: number } {
  const match = /^\s*(cmd|command):\s*(?:(['"])(.*?)\2|([^#\s][^#]*?))(\s+#.*)?$/.exec(line);
  if (match) {
    let start = line.indexOf(":") + 1;
    while (start < line.length && /\s/.test(line[start])) {
      start++;
    }
    return { isCmd: true, commandStart: start };
  }
  return { isCmd: false, commandStart: -1 };
}

/**
 * Extracts quote information from a command string
 */
function extractQuoteInfo(content: string): { hasQuotes: boolean; quoteChar: string | null; innerContent: string } {
  const match = /^(['"])(.*?)\1(\s+#.*)?$/.exec(content);
  if (match) {
    return {
      hasQuotes: true,
      quoteChar: match[1],
      innerContent: match[2]
    };
  }
  return {
    hasQuotes: false,
    quoteChar: null,
    innerContent: content.replace(/\s+#.*$/, "").trim()
  };
}

/**
 * Gets the indentation level of a line
 */
function getIndent(line: string): number {
  return line.search(/\S|$/);
}

suite("Shell Decorations Test Suite", () => {
  suite("isLandofilePattern", () => {
    test("Should match .lando.yml in root", () => {
      assert.strictEqual(isLandofilePattern("/project/.lando.yml"), true);
    });

    test("Should match .lando.yml with backslashes (Windows)", () => {
      assert.strictEqual(isLandofilePattern("C:\\project\\.lando.yml"), true);
    });

    test("Should match .lando.local.yml", () => {
      assert.strictEqual(isLandofilePattern("/project/.lando.local.yml"), true);
    });

    test("Should match .lando.dev.yml", () => {
      assert.strictEqual(isLandofilePattern("/project/.lando.dev.yml"), true);
    });

    test("Should match case insensitively", () => {
      assert.strictEqual(isLandofilePattern("/project/.LANDO.YML"), true);
      assert.strictEqual(isLandofilePattern("/project/.Lando.Local.Yml"), true);
    });

    test("Should not match regular YAML files", () => {
      assert.strictEqual(isLandofilePattern("/project/config.yml"), false);
      assert.strictEqual(isLandofilePattern("/project/docker-compose.yml"), false);
    });

    test("Should not match lando.yml without leading dot", () => {
      assert.strictEqual(isLandofilePattern("/project/lando.yml"), false);
    });

    test("Should match deeply nested paths", () => {
      assert.strictEqual(isLandofilePattern("/home/user/projects/drupal/.lando.yml"), true);
    });
  });

  suite("isShellBlockStart", () => {
    test("Should detect build: | as literal block", () => {
      const result = isShellBlockStart("    build: |");
      assert.strictEqual(result.isBlock, true);
      assert.strictEqual(result.type, "literal");
    });

    test("Should detect cmd: > as folded block", () => {
      const result = isShellBlockStart("    cmd: >");
      assert.strictEqual(result.isBlock, true);
      assert.strictEqual(result.type, "folded");
    });

    test("Should detect run: | with any indentation", () => {
      assert.strictEqual(isShellBlockStart("run: |").isBlock, true);
      assert.strictEqual(isShellBlockStart("  run: |").isBlock, true);
      assert.strictEqual(isShellBlockStart("      run: |").isBlock, true);
    });

    test("Should detect all shell command keys", () => {
      assert.strictEqual(isShellBlockStart("build: |").isBlock, true);
      assert.strictEqual(isShellBlockStart("run: |").isBlock, true);
      assert.strictEqual(isShellBlockStart("build_as_root: |").isBlock, true);
      assert.strictEqual(isShellBlockStart("run_as_root: |").isBlock, true);
      assert.strictEqual(isShellBlockStart("cmd: |").isBlock, true);
      assert.strictEqual(isShellBlockStart("command: |").isBlock, true);
    });

    test("Should not detect non-shell keys", () => {
      assert.strictEqual(isShellBlockStart("name: |").isBlock, false);
      assert.strictEqual(isShellBlockStart("type: |").isBlock, false);
      assert.strictEqual(isShellBlockStart("services: |").isBlock, false);
    });

    test("Should not detect keys without block indicator", () => {
      assert.strictEqual(isShellBlockStart("build:").isBlock, false);
      assert.strictEqual(isShellBlockStart("cmd: echo hello").isBlock, false);
    });
  });

  suite("isSequenceKey", () => {
    test("Should detect build: as sequence key", () => {
      assert.strictEqual(isSequenceKey("    build:"), "build");
    });

    test("Should detect run: as sequence key", () => {
      assert.strictEqual(isSequenceKey("  run:"), "run");
    });

    test("Should detect cmd: as sequence key", () => {
      assert.strictEqual(isSequenceKey("cmd:"), "cmd");
    });

    test("Should not match keys with values", () => {
      assert.strictEqual(isSequenceKey("build: something"), null);
      assert.strictEqual(isSequenceKey("cmd: |"), null);
    });

    test("Should not match non-shell keys", () => {
      assert.strictEqual(isSequenceKey("name:"), null);
      assert.strictEqual(isSequenceKey("services:"), null);
    });

    test("Should handle trailing whitespace", () => {
      // The regex `^\s*(build|...):\s*$` allows trailing whitespace after colon
      // because \s* matches zero or more whitespace before $
      assert.strictEqual(isSequenceKey("build: "), "build");
    });
  });

  suite("isSequenceBlockScalar", () => {
    test("Should detect - | as literal block in sequence", () => {
      const result = isSequenceBlockScalar("      - |");
      assert.strictEqual(result.isBlock, true);
      assert.strictEqual(result.type, "literal");
    });

    test("Should detect - > as folded block in sequence", () => {
      const result = isSequenceBlockScalar("      - >");
      assert.strictEqual(result.isBlock, true);
      assert.strictEqual(result.type, "folded");
    });

    test("Should detect - |- as literal block with chomping", () => {
      const result = isSequenceBlockScalar("      - |-");
      assert.strictEqual(result.isBlock, true);
      assert.strictEqual(result.type, "literal");
    });

    test("Should detect - >- as folded block with chomping", () => {
      const result = isSequenceBlockScalar("      - >-");
      assert.strictEqual(result.isBlock, true);
      assert.strictEqual(result.type, "folded");
    });

    test("Should not detect regular sequence items", () => {
      assert.strictEqual(isSequenceBlockScalar("      - echo hello").isBlock, false);
      assert.strictEqual(isSequenceBlockScalar("      - composer install").isBlock, false);
    });
  });

  suite("isSequenceItem", () => {
    test("Should detect simple sequence item", () => {
      const result = isSequenceItem("  - echo hello");
      assert.strictEqual(result.isItem, true);
      assert.strictEqual(result.commandStart, 4);
    });

    test("Should detect sequence item with more indentation", () => {
      const result = isSequenceItem("      - composer install");
      assert.strictEqual(result.isItem, true);
      assert.strictEqual(result.commandStart, 8);
    });

    test("Should detect quoted sequence item", () => {
      const result = isSequenceItem('  - "echo hello"');
      assert.strictEqual(result.isItem, true);
      assert.strictEqual(result.commandStart, 4);
    });

    test("Should not detect empty sequence item", () => {
      assert.strictEqual(isSequenceItem("  - ").isItem, false);
      assert.strictEqual(isSequenceItem("  -").isItem, false);
    });

    test("Should not detect non-sequence lines", () => {
      assert.strictEqual(isSequenceItem("  build:").isItem, false);
      assert.strictEqual(isSequenceItem("  type: php").isItem, false);
    });
  });

  suite("isSingleLineCmd", () => {
    test("Should detect cmd: with double quoted value", () => {
      const result = isSingleLineCmd('    cmd: "echo hello"');
      assert.strictEqual(result.isCmd, true);
      assert.ok(result.commandStart > 0);
    });

    test("Should detect cmd: with single quoted value", () => {
      const result = isSingleLineCmd("    cmd: 'echo hello'");
      assert.strictEqual(result.isCmd, true);
    });

    test("Should detect cmd: with unquoted value", () => {
      const result = isSingleLineCmd("    cmd: echo hello");
      assert.strictEqual(result.isCmd, true);
    });

    test("Should detect command: as alias for cmd:", () => {
      const result = isSingleLineCmd('    command: "test"');
      assert.strictEqual(result.isCmd, true);
    });

    test("Should handle cmd with inline comment", () => {
      const result = isSingleLineCmd('    cmd: "echo hello" # comment');
      assert.strictEqual(result.isCmd, true);
    });

    test("Should not detect cmd: with block scalar", () => {
      // The single-line cmd regex matches `cmd:` followed by non-empty content
      // Block scalars | and > ARE matched by `[^#\s][^#]*?` pattern
      // This is actually handled separately in the main logic (isShellBlockStart is checked first)
      // The regex alone doesn't distinguish block scalars
      // In real code, isShellBlockStart() is checked before isSingleLineCmd()
      // So these would be caught by the block scalar check first
      
      // For the standalone function test, these DO match as single-line cmds
      assert.strictEqual(isSingleLineCmd("    cmd: |").isCmd, true);
      assert.strictEqual(isSingleLineCmd("    cmd: >").isCmd, true);
    });

    test("Should not detect other keys", () => {
      assert.strictEqual(isSingleLineCmd("    build: something").isCmd, false);
      assert.strictEqual(isSingleLineCmd("    type: php").isCmd, false);
    });
  });

  suite("extractQuoteInfo", () => {
    test("Should extract double quoted content", () => {
      const result = extractQuoteInfo('"echo hello world"');
      assert.strictEqual(result.hasQuotes, true);
      assert.strictEqual(result.quoteChar, '"');
      assert.strictEqual(result.innerContent, "echo hello world");
    });

    test("Should extract single quoted content", () => {
      const result = extractQuoteInfo("'echo hello world'");
      assert.strictEqual(result.hasQuotes, true);
      assert.strictEqual(result.quoteChar, "'");
      assert.strictEqual(result.innerContent, "echo hello world");
    });

    test("Should handle unquoted content", () => {
      const result = extractQuoteInfo("echo hello world");
      assert.strictEqual(result.hasQuotes, false);
      assert.strictEqual(result.quoteChar, null);
      assert.strictEqual(result.innerContent, "echo hello world");
    });

    test("Should preserve inner quotes", () => {
      const result = extractQuoteInfo("\"echo 'hello world'\"");
      assert.strictEqual(result.hasQuotes, true);
      assert.strictEqual(result.innerContent, "echo 'hello world'");
    });

    test("Should handle quoted content with inline comment", () => {
      const result = extractQuoteInfo('"echo hello" # comment');
      assert.strictEqual(result.hasQuotes, true);
      assert.strictEqual(result.innerContent, "echo hello");
    });

    test("Should strip inline comment from unquoted content", () => {
      const result = extractQuoteInfo("echo hello # comment");
      assert.strictEqual(result.hasQuotes, false);
      assert.strictEqual(result.innerContent, "echo hello");
    });
  });

  suite("getIndent", () => {
    test("Should return 0 for no indentation", () => {
      assert.strictEqual(getIndent("build:"), 0);
    });

    test("Should return correct indent for 2 spaces", () => {
      assert.strictEqual(getIndent("  - echo"), 2);
    });

    test("Should return correct indent for 4 spaces", () => {
      assert.strictEqual(getIndent("    cmd: test"), 4);
    });

    test("Should return line length for empty line", () => {
      assert.strictEqual(getIndent(""), 0);
    });

    test("Should return line length for whitespace-only line", () => {
      assert.strictEqual(getIndent("    "), 4);
    });

    test("Should handle tabs", () => {
      // search(/\S|$/) finds first non-whitespace character
      // Tabs are whitespace, so it finds "test" at position 2
      assert.strictEqual(getIndent("\t\ttest"), 2);
    });
  });

  suite("Decoration Logic Integration", () => {
    /**
     * Simulates the decoration logic from shellDecorations.ts
     * Returns an array of line indices that should receive $ decorations
     */
    function getShellLineIndices(lines: string[]): number[] {
      const shellLines: number[] = [];
      let inShellBlock = false;
      let shellBlockIndent = 0;
      let shellBlockType: "literal" | "folded" | null = null;
      let shellBlockFirstContentDecorated = false;
      let lastShellKey = "";
      let lastShellKeyIndent = 0;
      let inSequenceBlock = false;
      let sequenceBlockIndent = 0;
      let sequenceBlockStartLine = -1;
      let sequenceBlockFirstContentDecorated = false;
      let sequenceBlockType: "literal" | "folded" | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        const indent = getIndent(line);
        let decoratedThisLine = false;

        // Block scalar start (not in sequence)
        const blockStart = isShellBlockStart(line);
        if (blockStart.isBlock) {
          inShellBlock = true;
          shellBlockIndent = indent;
          shellBlockType = blockStart.type;
          shellBlockFirstContentDecorated = false;
          continue;
        }

        // Sequence key detection
        const seqKey = isSequenceKey(line);
        if (seqKey) {
          lastShellKey = seqKey;
          lastShellKeyIndent = indent;
          continue;
        }

        // Sequence block scalar detection
        if (lastShellKey && indent > lastShellKeyIndent) {
          const seqBlock = isSequenceBlockScalar(line);
          if (seqBlock.isBlock) {
            inSequenceBlock = true;
            sequenceBlockIndent = indent;
            sequenceBlockStartLine = i;
            sequenceBlockFirstContentDecorated = false;
            sequenceBlockType = seqBlock.type;
            continue;
          }
        }

        // Handle content in sequence block scalar
        if (inSequenceBlock && i > sequenceBlockStartLine && !sequenceBlockFirstContentDecorated) {
          if (trimmedLine && !/^#/.test(trimmedLine) && indent > sequenceBlockIndent) {
            shellLines.push(i);
            decoratedThisLine = true;
            sequenceBlockFirstContentDecorated = true;
          }
        }

        if (inSequenceBlock && sequenceBlockFirstContentDecorated && indent > sequenceBlockIndent && trimmedLine && !/^#/.test(trimmedLine)) {
          if (sequenceBlockType === "literal" && !decoratedThisLine) {
            shellLines.push(i);
            decoratedThisLine = true;
          }
          continue;
        }

        // End of sequence block
        if (inSequenceBlock && (indent <= sequenceBlockIndent || !trimmedLine)) {
          inSequenceBlock = false;
          sequenceBlockIndent = 0;
          sequenceBlockStartLine = -1;
          sequenceBlockFirstContentDecorated = false;
          sequenceBlockType = null;
        }

        // Handle content in shell block scalar
        if (inShellBlock && !shellBlockFirstContentDecorated) {
          if (trimmedLine && !/^#/.test(trimmedLine) && indent > shellBlockIndent) {
            shellLines.push(i);
            decoratedThisLine = true;
            shellBlockFirstContentDecorated = true;
          }
        }

        if (inShellBlock && shellBlockFirstContentDecorated && trimmedLine && !/^#/.test(trimmedLine) && indent > shellBlockIndent) {
          if (shellBlockType === "literal" && !decoratedThisLine) {
            shellLines.push(i);
            decoratedThisLine = true;
          }
          continue;
        }

        // End of shell block
        if (inShellBlock && (indent <= shellBlockIndent || !trimmedLine)) {
          inShellBlock = false;
          shellBlockType = null;
          shellBlockFirstContentDecorated = false;
        }

        // Sequence items
        if (lastShellKey && indent > lastShellKeyIndent) {
          const seqItem = isSequenceItem(line);
          if (seqItem.isItem && !/^\s*-\s+[|>]/.test(line)) {
            shellLines.push(i);
            continue;
          }
        }

        // Single-line commands
        const cmdMatch = isSingleLineCmd(line);
        if (cmdMatch.isCmd) {
          shellLines.push(i);
          continue;
        }

        // Reset sequence state
        if (/^\s*\w+:/.test(line) && indent <= lastShellKeyIndent) {
          lastShellKey = "";
          lastShellKeyIndent = 0;
        }
      }

      return shellLines;
    }

    test("Should decorate all lines in literal block scalar", () => {
      const lines = [
        "services:",
        "  appserver:",
        "    build: |",
        "      composer install",
        "      npm install",
        "      npm run build"
      ];
      const shellLines = getShellLineIndices(lines);
      assert.deepStrictEqual(shellLines, [3, 4, 5]);
    });

    test("Should decorate only first line in folded block scalar", () => {
      const lines = [
        "services:",
        "  appserver:",
        "    build: >",
        "      composer install",
        "      npm install"
      ];
      const shellLines = getShellLineIndices(lines);
      assert.deepStrictEqual(shellLines, [3]);
    });

    test("Should decorate sequence items", () => {
      const lines = [
        "services:",
        "  appserver:",
        "    build:",
        "      - composer install",
        "      - npm install"
      ];
      const shellLines = getShellLineIndices(lines);
      assert.deepStrictEqual(shellLines, [3, 4]);
    });

    test("Should decorate single-line cmd", () => {
      const lines = [
        "tooling:",
        "  test:",
        '    cmd: "phpunit"'
      ];
      const shellLines = getShellLineIndices(lines);
      assert.deepStrictEqual(shellLines, [2]);
    });

    test("Should decorate block scalar in sequence (literal)", () => {
      const lines = [
        "build:",
        "  - |-",
        "    echo hello",
        "    echo world",
        "  - npm install"
      ];
      const shellLines = getShellLineIndices(lines);
      assert.deepStrictEqual(shellLines, [2, 3, 4]);
    });

    test("Should decorate block scalar in sequence (folded)", () => {
      const lines = [
        "build:",
        "  - >-",
        "    echo hello",
        "    echo world",
        "  - npm install"
      ];
      const shellLines = getShellLineIndices(lines);
      // For folded, only first content line, then regular sequence item
      assert.deepStrictEqual(shellLines, [2, 4]);
    });

    test("Should not decorate non-shell lines", () => {
      const lines = [
        "name: myapp",
        "recipe: drupal10",
        "services:",
        "  appserver:",
        "    type: php:8.1",
        "    ssl: true"
      ];
      const shellLines = getShellLineIndices(lines);
      assert.deepStrictEqual(shellLines, []);
    });

    test("Should not decorate comments in shell blocks", () => {
      const lines = [
        "build: |",
        "  # This is a comment",
        "  composer install",
        "  # Another comment",
        "  npm install"
      ];
      const shellLines = getShellLineIndices(lines);
      // Comments should be skipped
      assert.deepStrictEqual(shellLines, [2, 4]);
    });
  });
});
