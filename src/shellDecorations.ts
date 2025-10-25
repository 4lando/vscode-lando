/**
 * Shell Decorations for Embedded Commands in Landofile
 *
 * This module provides logic for decorating embedded shell commands in YAML files (e.g., .lando.yml) in VS Code.
 *
 * Expected Behavior:
 *
 * 1. Literal Block Scalars (| or |-):
 *    - Each line in the block is treated as a separate shell command.
 *    - A single '$' is rendered at the start of each non-empty, non-comment line.
 *
 * 2. Folded Block Scalars (> or >-):
 *    - The entire block is treated as a single shell command (YAML folds these lines).
 *    - Only the first non-empty, non-comment line after the indicator receives a '$'.
 *
 * 3. Block Scalars Embedded in Sequences:
 *    - For literal block scalars in a sequence, each line in the block gets a '$'.
 *    - For folded block scalars in a sequence, only the first content line gets a '$'.
 *
 * 4. Single-Line Commands (quoted or unquoted):
 *    - A single '$' is rendered at the start of the value.
 *
 * The logic ensures that decorations are visually and semantically correct for shell command blocks in YAML.
 */

import * as vscode from "vscode";

/**
 * Provides shell command decorations for Landofile files, especially for Lando command blocks.
 * Handles block scalars (literal and folded), sequences, and single-line commands.
 */
export class ShellDecorationProvider {
  private shellDecorationType: vscode.TextEditorDecorationType;
  private quoteDecorationType: vscode.TextEditorDecorationType;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    // Shell decoration type for adding a `$` to the start of each line in a shell command
    this.shellDecorationType = vscode.window.createTextEditorDecorationType({
      before: {
        contentText: "$",
        color: new vscode.ThemeColor("editorHint.foreground"),
        margin: "0 0.5em 0 0",
      },
    });
    // Quote decoration type for making outer quotes less prominent in single-line shell commands
    this.quoteDecorationType = vscode.window.createTextEditorDecorationType({
      color: new vscode.ThemeColor("editorHint.foreground"),
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
    this.registerDecorationProvider();
  }

  /**
   * Registers listeners for YAML document changes and editor focus to update shell decorations.
   */
  private registerDecorationProvider(): void {
    // Register for landofile filenames
    const documentSelectors: vscode.DocumentSelector[] = [
      {
        language: "landofile",
        pattern: "**/.lando*.yml",
      }
    ];

    // Register CodeLens providers for both languages
    documentSelectors.forEach(selector => {
      const provider = vscode.languages.registerCodeLensProvider(
        selector,
        new ShellCodeLensProvider()
      );
      this.disposables.push(provider);
    });

    // Listen for document changes
    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if ((event.document.languageId === "yaml" || event.document.languageId === "landofile") && 
          event.document.fileName.includes('.lando.')) {
        this.updateDecorations(event.document);
      }
    });
    this.disposables.push(changeListener);

    // Listen for editor changes
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && (editor.document.languageId === "yaml" || editor.document.languageId === "landofile") && 
          editor.document.fileName.includes('.lando.')) {
        this.updateDecorations(editor.document);
      }
    });
    this.disposables.push(editorChangeListener);

    // Apply decorations to currently visible editors
    vscode.window.visibleTextEditors.forEach(editor => {
      if ((editor.document.languageId === "yaml" || editor.document.languageId === "landofile") && 
          editor.document.fileName.includes('.lando.')) {
        this.updateDecorations(editor.document);
      }
    });
  }

  /**
   * Applies quote decorations to the outer quotes of a shell command.
   * 
   * @param line The line containing the command
   * @param lineIndex The line index for creating ranges
   * @param contentStart The starting position of the command content
   * @param content The command content to analyze
   * @param quoteDecorations Array to add quote decorations to
   */
  private applyQuoteDecorations(
    line: string,
    lineIndex: number,
    contentStart: number,
    content: string,
    quoteDecorations: vscode.DecorationOptions[]
  ): void {
    // Check if the content is quoted (starts and ends with the same quote)
    const quoteMatch = content.match(/^(['"])(.*?)\1(\s+#.*)?$/);
    if (quoteMatch) {
      const quoteChar = quoteMatch[1];
      const quotedContent = quoteMatch[2];
      
      // Find the opening quote position
      const openQuoteIdx = contentStart + content.indexOf(quoteChar);
      if (openQuoteIdx !== -1) {
        // Find the closing quote position
        const closeQuoteIdx = openQuoteIdx + 1 + quotedContent.length;
        
        // Apply quote decoration to the opening quote
        quoteDecorations.push({
          range: new vscode.Range(lineIndex, openQuoteIdx, lineIndex, openQuoteIdx + 1),
        });
        
        // Apply quote decoration to the closing quote
        quoteDecorations.push({
          range: new vscode.Range(lineIndex, closeQuoteIdx, lineIndex, closeQuoteIdx + 1),
        });
      }
    }
  }

  /**
   * Updates shell command decorations in the given YAML document.
   *
   * Handles the following cases:
   * - Literal block scalars (| or |-): '$' at the start of each logical line.
   * - Folded block scalars (> or >-): '$' only at the first logical line.
   * - Block scalars in sequences: same rules as above, per sequence item.
   * - Single-line commands: '$' at the start of the value.
   * - Single-line quoted commands: '$' at the start, outer quotes made less prominent.
   * - Sequence items: '$' at the start, outer quotes made less prominent if quoted.
   *
   * The logic tracks state for block scalars and sequences to ensure correct decoration placement.
   * Quote decoration is applied only to the outermost quotes of single-line commands and sequence items.
   */
  private updateDecorations(document: vscode.TextDocument): void {
    const editor = vscode.window.visibleTextEditors.find(e => e.document === document);
    if (!editor) {
      return;
    }
    const lines = document.getText().split('\n');
    const shellDecorations: vscode.DecorationOptions[] = [];
    const quoteDecorations: vscode.DecorationOptions[] = [];
    // State for top-level (non-sequence) block scalars
    let inShellBlock = false;
    let shellBlockIndent = 0;
    let shellBlockType: 'literal' | 'folded' | null = null;
    let shellBlockFirstContentDecorated = false;
    // State for sequence handling
    let lastShellKeyIndent = 0;
    let lastShellKey = '';
    let inSequenceBlock = false;
    let sequenceBlockIndent = 0;
    let sequenceBlockStartLine = -1;
    let sequenceBlockFirstContentDecorated = false;
    let sequenceBlockType: 'literal' | 'folded' | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      const indent = line.search(/\S|$/);
      let decoratedThisLine = false;
      
      // --- Block Scalar (not in sequence) ---
      // Detect start of a shell block (block scalar, not in sequence)
      if (/^\s*(build|run|build_as_root|run_as_root|cmd|command):\s*([|>])/.test(line)) {
        inShellBlock = true;
        shellBlockIndent = indent;
        shellBlockType = line.includes('|') ? 'literal' : 'folded';
        shellBlockFirstContentDecorated = false;
        continue;
      }
      
      // --- Sequence Handling ---
      // Detect start of a sequence of shell commands
      const sequenceKeyMatch = line.match(/^\s*(build|run|build_as_root|run_as_root|cmd):\s*$/);
      if (sequenceKeyMatch) {
        lastShellKey = sequenceKeyMatch[1];
        lastShellKeyIndent = indent;
        continue;
      }
      // Detect start of a sequence item with block scalar (e.g., - | or - >)
      if (lastShellKey && indent > lastShellKeyIndent && /^\s*-\s+([|>])/.test(line)) {
        inSequenceBlock = true;
        sequenceBlockIndent = indent;
        sequenceBlockStartLine = i;
        sequenceBlockFirstContentDecorated = false;
        sequenceBlockType = line.includes('|') ? 'literal' : 'folded';
        continue;
      }
      // Handle first content line after block scalar indicator in sequence
      if (inSequenceBlock && i > sequenceBlockStartLine && !sequenceBlockFirstContentDecorated) {
        if (trimmedLine && !/^#/.test(trimmedLine) && indent > sequenceBlockIndent) {
          // For both literal and folded block scalars in sequence, decorate the first content line
          const firstChar = line.search(/\S|$/);
          if (firstChar < line.length) {
            shellDecorations.push({
              range: new vscode.Range(i, firstChar, i, firstChar),
            });
            decoratedThisLine = true;
            sequenceBlockFirstContentDecorated = true;
          }
        }
        // Don't continue here, so we can decorate further lines below if needed
      }
      // Continue decorating lines in sequence block scalar (after first content line)
      if (inSequenceBlock && sequenceBlockFirstContentDecorated && indent > sequenceBlockIndent && trimmedLine && !/^#/.test(trimmedLine)) {
        if (sequenceBlockType === 'literal' && !decoratedThisLine) {
          // For literal block scalars, decorate every line (but only once per line)
          const firstChar = line.search(/\S|$/);
          if (firstChar < line.length) {
            shellDecorations.push({
              range: new vscode.Range(i, firstChar, i, firstChar),
            });
            decoratedThisLine = true;
          }
        }
        // For folded block scalars, do not decorate further lines
        continue;
      }
      // End of sequence block: next line with less or equal indent, or empty
      if (inSequenceBlock && (indent <= sequenceBlockIndent || !trimmedLine)) {
        inSequenceBlock = false;
        sequenceBlockIndent = 0;
        sequenceBlockStartLine = -1;
        sequenceBlockFirstContentDecorated = false;
        sequenceBlockType = null;
      }
      
      // --- Block Scalar (not in sequence) continued ---
      // Handle first content line after block scalar indicator (not in sequence)
      if (inShellBlock && !shellBlockFirstContentDecorated) {
        if (trimmedLine && !/^#/.test(trimmedLine) && indent > shellBlockIndent) {
          // For both literal and folded block scalars, decorate the first content line
          const firstChar = line.search(/\S|$/);
          if (firstChar < line.length) {
            shellDecorations.push({
              range: new vscode.Range(i, firstChar, i, firstChar),
            });
            decoratedThisLine = true;
            shellBlockFirstContentDecorated = true;
          }
        }
        // Don't continue here, so we can decorate further lines below if needed
      }
      // Continue decorating lines in shell block scalar (after first content line)
      if (inShellBlock && shellBlockFirstContentDecorated && trimmedLine && !/^#/.test(trimmedLine) && indent > shellBlockIndent) {
        if (shellBlockType === 'literal' && !decoratedThisLine) {
          // For literal block scalars, decorate every line (but only once per line)
          const firstChar = line.search(/\S|$/);
          if (firstChar < line.length) {
            shellDecorations.push({
              range: new vscode.Range(i, firstChar, i, firstChar),
            });
            decoratedThisLine = true;
          }
        }
        // For folded block scalars, do not decorate further lines
        continue;
      }
      // End of shell block: next line with less or equal indent, or empty
      if (inShellBlock && (indent <= shellBlockIndent || !trimmedLine)) {
        inShellBlock = false;
        shellBlockType = null;
        shellBlockFirstContentDecorated = false;
      }
      
      // --- Single-line and sequence item commands ---
      // Decorate YAML sequence items under build/run/cmd (e.g. - echo foo)
      if (lastShellKey && indent > lastShellKeyIndent && /^\s*-\s+.+/.test(line)) {
        // Skip if this is a block scalar (already handled above)
        if (!/^\s*-\s+[|>]/.test(line)) {
          // Place decoration after the dash and any following whitespace
          const match = line.match(/^(\s*-\s+)(.+)$/);
          if (match) {
            const dashEnd = match[1].length;
            shellDecorations.push({
              range: new vscode.Range(i, dashEnd, i, dashEnd),
            });
            
            // Handle quote decoration for quoted sequence items
            const sequenceContent = match[2].trim();
            this.applyQuoteDecorations(line, i, dashEnd, sequenceContent, quoteDecorations);
          }
        }
        continue;
      }
      // Decorate single-line shell command (cmd: "echo foo" or cmd: 'echo foo')
      const singleLineCmdMatch = line.match(/^\s*(cmd|command):\s*(?:(['"])(.*?)\2|([^#\s][^#]*?))(\s+#.*)?$/);
      if (singleLineCmdMatch) {
        let shellStart = line.indexOf(':') + 1;
        while (shellStart < line.length && /\s/.test(line[shellStart])) {
          shellStart++;
        }
        if (shellStart < line.length) {
          shellDecorations.push({
            range: new vscode.Range(i, shellStart, i, shellStart),
          });
        }
        
        // Handle quote decoration for quoted commands
        // Extract the command content after the colon and whitespace
        const commandContent = line.substring(shellStart).trim();
        this.applyQuoteDecorations(line, i, shellStart, commandContent, quoteDecorations);
        continue;
      }
      // Reset sequence state if a new key is encountered
      if (/^\s*\w+:/.test(line) && indent <= lastShellKeyIndent) {
        lastShellKey = '';
        lastShellKeyIndent = 0;
      }
    }
    editor.setDecorations(this.shellDecorationType, shellDecorations);
    editor.setDecorations(this.quoteDecorationType, quoteDecorations);
  }

  /**
   * Disposes of all decorations and listeners registered by this provider.
   */
  dispose(): void {
    this.shellDecorationType.dispose();
    this.quoteDecorationType.dispose();
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
  }
}

/**
 * Dummy CodeLensProvider to satisfy VS Code API requirements for document selector.
 */
class ShellCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    return [];
  }
}

/**
 * Activates shell decorations for the extension.
 * @param context The VS Code extension context
 * @returns The ShellDecorationProvider instance
 */
export function activateShellDecorations(context: vscode.ExtensionContext): ShellDecorationProvider {
  const provider = new ShellDecorationProvider();
  context.subscriptions.push(provider);
  return provider;
} 