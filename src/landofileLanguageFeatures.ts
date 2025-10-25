/**
 * Landofile Language Features
 * 
 * This module provides enhanced language features for Landofile files,
 * implementing YAML functionality with Lando-specific features and
 * JSON schema-based validation, completion, and hover support.
 * 
 * @module landofileLanguageFeatures
 */

import * as vscode from "vscode";
import { LandofileSchemaProvider } from "./landofileSchemaProvider";

/**
 * Lando-specific completion items that complement the JSON schema
 */
const LANDO_ENHANCED_COMPLETION_ITEMS: vscode.CompletionItem[] = [
  // Common Lando service types for autocomplete
  {
    label: "nginx",
    kind: vscode.CompletionItemKind.Value,
    detail: "Nginx web server",
    documentation: "Nginx web server service for Lando applications"
  },
  {
    label: "apache",
    kind: vscode.CompletionItemKind.Value,
    detail: "Apache web server",
    documentation: "Apache web server service for Lando applications"
  },
  {
    label: "php",
    kind: vscode.CompletionItemKind.Value,
    detail: "PHP service",
    documentation: "PHP service for Lando applications"
  },
  {
    label: "mysql",
    kind: vscode.CompletionItemKind.Value,
    detail: "MySQL database",
    documentation: "MySQL database service for Lando applications"
  },
  {
    label: "mariadb",
    kind: vscode.CompletionItemKind.Value,
    detail: "MariaDB database",
    documentation: "MariaDB database service for Lando applications"
  },
  {
    label: "postgres",
    kind: vscode.CompletionItemKind.Value,
    detail: "PostgreSQL database",
    documentation: "PostgreSQL database service for Lando applications"
  },
  {
    label: "redis",
    kind: vscode.CompletionItemKind.Value,
    detail: "Redis cache",
    documentation: "Redis cache service for Lando applications"
  },
  {
    label: "memcached",
    kind: vscode.CompletionItemKind.Value,
    detail: "Memcached cache",
    documentation: "Memcached cache service for Lando applications"
  },
  {
    label: "solr",
    kind: vscode.CompletionItemKind.Value,
    detail: "Solr search",
    documentation: "Solr search service for Lando applications"
  },
  {
    label: "elasticsearch",
    kind: vscode.CompletionItemKind.Value,
    detail: "Elasticsearch",
    documentation: "Elasticsearch service for Lando applications"
  },
  {
    label: "node",
    kind: vscode.CompletionItemKind.Value,
    detail: "Node.js service",
    documentation: "Node.js service for Lando applications"
  },
  {
    label: "python",
    kind: vscode.CompletionItemKind.Value,
    detail: "Python service",
    documentation: "Python service for Lando applications"
  },
  {
    label: "ruby",
    kind: vscode.CompletionItemKind.Value,
    detail: "Ruby service",
    documentation: "Ruby service for Lando applications"
  },
  {
    label: "java",
    kind: vscode.CompletionItemKind.Value,
    detail: "Java service",
    documentation: "Java service for Lando applications"
  },
  {
    label: "go",
    kind: vscode.CompletionItemKind.Value,
    detail: "Go service",
    documentation: "Go service for Lando applications"
  }
];

/**
 * Common Lando recipes for autocomplete
 */
const LANDO_RECIPES: vscode.CompletionItem[] = [
  { label: "acquia", kind: vscode.CompletionItemKind.Value, detail: "Acquia recipe" },
  { label: "backdrop", kind: vscode.CompletionItemKind.Value, detail: "Backdrop CMS recipe" },
  { label: "drupal10", kind: vscode.CompletionItemKind.Value, detail: "Drupal 10 recipe" },
  { label: "drupal11", kind: vscode.CompletionItemKind.Value, detail: "Drupal 11 recipe" },
  { label: "drupal6", kind: vscode.CompletionItemKind.Value, detail: "Drupal 6 recipe" },
  { label: "drupal7", kind: vscode.CompletionItemKind.Value, detail: "Drupal 7 recipe" },
  { label: "drupal8", kind: vscode.CompletionItemKind.Value, detail: "Drupal 8 recipe" },
  { label: "drupal9", kind: vscode.CompletionItemKind.Value, detail: "Drupal 9 recipe" },
  { label: "joomla", kind: vscode.CompletionItemKind.Value, detail: "Joomla recipe" },
  { label: "lagoon", kind: vscode.CompletionItemKind.Value, detail: "Lagoon recipe" },
  { label: "lamp", kind: vscode.CompletionItemKind.Value, detail: "LAMP stack recipe" },
  { label: "laravel", kind: vscode.CompletionItemKind.Value, detail: "Laravel recipe" },
  { label: "lemp", kind: vscode.CompletionItemKind.Value, detail: "LEMP stack recipe" },
  { label: "mean", kind: vscode.CompletionItemKind.Value, detail: "MEAN stack recipe" },
  { label: "pantheon", kind: vscode.CompletionItemKind.Value, detail: "Pantheon recipe" },
  { label: "platformsh", kind: vscode.CompletionItemKind.Value, detail: "Platform.sh recipe" },
  { label: "symfony", kind: vscode.CompletionItemKind.Value, detail: "Symfony recipe" },
  { label: "wordpress", kind: vscode.CompletionItemKind.Value, detail: "WordPress recipe" },
];

/**
 * Landofile completion provider that provides schema-based and Lando-specific completions
 */
export class LandofileCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private schemaProvider: LandofileSchemaProvider) {}
  
  /**
   * Provides completion items based on the current context
   * 
   * @param document The document being edited
   * @param position The cursor position
   * @param token Cancellation token
   * @param context Completion context
   * @returns Completion items or completion list
   */
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): Promise<vscode.CompletionItem[] | vscode.CompletionList | null | undefined> {
    const line = document.lineAt(position.line).text;
    const linePrefix = line.substring(0, position.character);
    
    let completions: vscode.CompletionItem[] = [];

    // Check if we're in a recipe field - provide recipe suggestions
    if (linePrefix.includes('recipe:')) {
      completions = LANDO_RECIPES;
    }
    
    // Check if we're in a service type field - provide service type suggestions
    else if (linePrefix.includes('type:')) {
      completions = LANDO_ENHANCED_COMPLETION_ITEMS;
    }
    
    // Get schema-based completions
    else {
      completions = await this.getSchemaBasedCompletions(document, position);
    }

    return new vscode.CompletionList(completions, false);
  }
  
  /**
   * Gets completion items based on the JSON schema
   * 
   * @param document The document being edited
   * @param position The cursor position
   * @returns Array of completion items
   */
  private async getSchemaBasedCompletions(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionItem[]> {
    try {
      const schema = await this.schemaProvider.getSchema();
      const currentPath = this.getCurrentPath(document, position);
      
      // Get properties at the current path from the schema
      const properties = this.getPropertiesAtPath(schema, currentPath);
      
      return Object.entries(properties).map(([key, value]: [string, any]) => {
        const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Property);
        
        if (value.description) {
          item.documentation = new vscode.MarkdownString(value.description);
        }
        
        if (value.default !== undefined) {
          item.detail = `Default: ${JSON.stringify(value.default)}`;
        }
        
        return item;
      });
    } catch (error) {
      console.error('Error getting schema-based completions:', error);
      return [];
    }
  }
  
  /**
   * Determines the current path in the YAML document by tracking indentation levels
   * 
   * @param document The document
   * @param position The position
   * @returns The path as an array of keys
   */
  private getCurrentPath(document: vscode.TextDocument, position: vscode.Position): string[] {
    const path: string[] = [];
    let currentIndent = Infinity; // Start with high value to accept any indentation
    
    // Look backwards from the current position to find parent keys
    // Only include keys with strictly decreasing indentation (they are parents)
    for (let i = position.line; i >= 0; i--) {
      const line = document.lineAt(i).text;
      const match = line.match(/^(\s*)([a-zA-Z0-9_-]+):/);
      
      if (match) {
        const indent = match[1].length;
        const key = match[2];
        
        // Only include this key if it has less indentation than what we've seen
        // (meaning it's a parent of the keys we've already collected)
        if (indent < currentIndent) {
          path.unshift(key);
          currentIndent = indent;
          
          // If we've reached root level (no indentation), we're done
          if (indent === 0) {
            break;
          }
        }
      }
    }
    
    return path;
  }
  
  /**
   * Gets schema properties at a specific path
   * 
   * @param schema The JSON schema
   * @param path The path to navigate to
   * @returns The properties object at that path
   */
  private getPropertiesAtPath(schema: any, path: string[]): any {
    let current = schema;
    
    for (const segment of path) {
      if (current.properties && current.properties[segment]) {
        current = current.properties[segment];
      } else if (current.additionalProperties) {
        current = current.additionalProperties;
      } else {
        return {};
      }
    }
    
    return current.properties || {};
  }
}

/**
 * Landofile hover provider that provides enhanced documentation
 */
export class LandofileHoverProvider implements vscode.HoverProvider {
  private flattenedSchema: Map<string, any> = new Map();
  
  constructor(private schemaProvider: LandofileSchemaProvider) {
    // Initialize flattened schema immediately
    this.initializeFlattenedSchema();
  }
  
  /**
   * Initializes the flattened schema for efficient lookup
   */
  private async initializeFlattenedSchema() {
    try {
      const schema = await this.schemaProvider.getSchema();
      this.flattenSchema(schema);
    } catch (error) {
      console.error('Error initializing flattened schema:', error);
    }
  }
  
  /**
   * Flattens the JSON schema into a map of paths to schema definitions
   * Based on the 4lando editor implementation
   */
  private flattenSchema(schema: any, prefix = '', visited = new Set<any>(), rootSchema: any = null) {
    if (!schema || visited.has(schema)) {
      return;
    }
    visited.add(schema);
    
    // Store root schema on first call
    const effectiveRootSchema = rootSchema || schema;
    
    // Handle $ref resolution first
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/', '').split('/');
      let refSchema = effectiveRootSchema;
      
      for (const part of refPath) {
        if (!refSchema[part]) {
          return;
        }
        refSchema = refSchema[part];
      }
      
      // Merge properties from the referenced schema
      const merged = {
        ...refSchema,
        ...schema,
        description: schema.description || refSchema.description,
      };
      Object.assign(schema, merged);
    }
    
    // Handle pattern properties
    if (schema.patternProperties) {
      for (const [pattern, value] of Object.entries(schema.patternProperties)) {
        const wildcardPath = prefix ? `${prefix}/*` : '*';
        this.flattenedSchema.set(wildcardPath, {
          description: (value as any).description || '',
          type: (value as any).type || '',
          pattern,
          oneOf: (value as any).oneOf || [],
          anyOf: (value as any).anyOf || [],
          additionalProperties: (value as any).additionalProperties,
          deprecated: (value as any).deprecated,
        });
        
        this.flattenSchema(value, wildcardPath, visited, effectiveRootSchema);
      }
    }
    
    // Handle oneOf schemas
    if (schema.oneOf) {
      schema.oneOf.forEach((subSchema: any, index: number) => {
        const oneOfPath = `${prefix}#${index}`;
        this.flattenSchema(subSchema, oneOfPath, visited, effectiveRootSchema);
      });
    }
    
    // Handle regular properties
    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        const path = prefix ? `${prefix}/${key}` : key;
        this.flattenedSchema.set(path, {
          description: (value as any).description || '',
          type: (value as any).type || '',
          enum: (value as any).enum || [],
          examples: (value as any).examples || [],
          default: (value as any).default,
          oneOf: (value as any).oneOf || [],
          anyOf: (value as any).anyOf || [],
          additionalProperties: (value as any).additionalProperties,
          deprecated: (value as any).deprecated,
        });
        
        // Continue flattening nested schemas
        this.flattenSchema(value, path, visited, effectiveRootSchema);
      }
    } else if (prefix && !schema.patternProperties) {
      // Handle non-object schemas
      this.flattenedSchema.set(prefix, {
        description: schema.description || '',
        type: schema.type || '',
        enum: schema.enum || [],
        examples: schema.examples || [],
        default: schema.default,
        oneOf: schema.oneOf || [],
        anyOf: schema.anyOf || [],
        additionalProperties: schema.additionalProperties,
        deprecated: schema.deprecated,
      });
    }
    
    // Process $defs
    if (schema.$defs) {
      for (const [key, value] of Object.entries(schema.$defs)) {
        const defsPath = `$defs/${key}`;
        this.flattenSchema(value, defsPath, visited, effectiveRootSchema);
      }
    }
    
    // Process oneOf/anyOf variants
    const variants = schema.oneOf || schema.anyOf;
    if (variants?.length) {
      for (const [index, variant] of variants.entries()) {
        const variantPath = `${prefix}#${index}`;
        
        const variantInfo = {
          description: variant.description || '',
          type: variant.type || '',
          pattern: variant.pattern || '',
          const: variant.const,
          deprecated: variant.deprecated,
        };
        
        this.flattenedSchema.set(variantPath, variantInfo);
        this.flattenSchema(variant, variantPath, visited, effectiveRootSchema);
      }
    }
  }
  
  /**
   * Gets the current path in the YAML document
   * Based on the 4lando editor implementation for accurate path detection
   */
  private getCurrentPath(document: vscode.TextDocument, position: vscode.Position): string {
    const lines = document.getText().split('\n');
    let currentPath: string[] = [];
    let currentIndent = 0;

    // Process all lines up to the current position to build the path
    for (let i = 0; i < position.line; i++) {
      const line = lines[i];
      const match = line.match(/^(\s*)([a-zA-Z0-9_-]+):/);

      if (match) {
        const [, indentStr, key] = match;
        const indent = indentStr.length;

        // Update current path based on indentation
        if (indent === 0) {
          // Root level - reset path
          currentPath = [key];
          currentIndent = 0;
        } else if (indent > currentIndent) {
          // Deeper level - add to path
          currentPath.push(key);
          currentIndent = indent;
        } else if (indent === currentIndent) {
          // Same level - replace last element
          currentPath[currentPath.length - 1] = key;
        } else {
          // Shallower level - pop path until we find the right level, then add
          while (currentPath.length > 1 && currentIndent > indent) {
            currentPath.pop();
            // Estimate the new current indent (we go back one level)
            currentIndent = indent;
          }
          currentPath[currentPath.length - 1] = key;
          currentIndent = indent;
        }
      }
    }

    return currentPath.join('/');
  }
  
  /**
   * Provides hover information for the current position
   * 
   * @param document The document
   * @param position The cursor position
   * @param token Cancellation token
   * @returns Hover information or undefined
   */
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | undefined> {
    const wordRange = document.getWordRangeAtPosition(position);
    
    if (wordRange) {
      const word = document.getText(wordRange);
      
      // Remove trailing colon if present
      let cleanWord = word;
      if (word.endsWith(':')) {
        cleanWord = word.slice(0, -1);
      }
      
      // Check for Lando-specific items
      const allItems = [...LANDO_ENHANCED_COMPLETION_ITEMS, ...LANDO_RECIPES];
      const item = allItems.find(item => item.label === word);
      
      if (item && item.documentation) {
        return new vscode.Hover([
          `**${item.label}**`,
          item.detail || '',
          item.documentation
        ]);
      }
      
      // Try to get schema-based documentation using flattened schema
      const schemaDoc = await this.getSchemaDocumentation(document, position, cleanWord);
      if (schemaDoc) {
        return new vscode.Hover(schemaDoc);
      }
    }
    
    return undefined;
  }
  
  /**
   * Gets documentation from the flattened JSON schema
   * 
   * @param document The document
   * @param position The position
   * @param word The word at the position
   * @returns Markdown string with documentation or undefined
   */
  private async getSchemaDocumentation(
    document: vscode.TextDocument,
    position: vscode.Position,
    word: string
  ): Promise<vscode.MarkdownString | undefined> {
    try {
      // Ensure flattened schema is initialized
      if (this.flattenedSchema.size === 0) {
        await this.initializeFlattenedSchema();
      }
      
      // Get the current path in the document
      const currentPath = this.getCurrentPath(document, position);
      
      // Generate possible schema paths to try
      const possiblePaths = this.generatePossiblePaths(currentPath, word);
      
      // Try each possible path
      for (const schemaPath of possiblePaths) {
        const schemaDef = this.flattenedSchema.get(schemaPath);
        if (schemaDef) {
          return this.formatSchemaDocumentation(word, schemaDef);
        }
      }
      
      return undefined;
    } catch (error) {
      console.error('Error getting schema documentation:', error);
      return undefined;
    }
  }
  
  /**
   * Generates possible schema paths to try for lookup
   * Based on the 4lando editor implementation
   */
  private generatePossiblePaths(currentPath: string, word: string): string[] {
    const paths: string[] = [];
    
    // Try the full path first
    if (currentPath) {
      paths.push(`${currentPath}/${word}`);
    }
    
    // Try just the word (for root-level properties)
    paths.push(word);
    
    // Try with wildcard patterns for pattern properties
    if (currentPath) {
      paths.push(`${currentPath}/*`);
    }
    paths.push('*');
    
    // Try parent paths
    const pathParts = currentPath.split('/');
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const parentPath = pathParts.slice(0, i).join('/');
      if (parentPath) {
        paths.push(`${parentPath}/${word}`);
      }
    }
    
    return paths;
  }
  
  /**
   * Formats schema documentation into markdown
   * 
   * @param propertyName The property name
   * @param schemaDef The schema definition
   * @returns Formatted markdown string
   */
  private formatSchemaDocumentation(propertyName: string, schemaDef: any): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString();
    
    // Add deprecation warning if deprecated
    if (schemaDef.deprecated) {
      markdown.appendMarkdown(`⚠️ **Deprecated:** ${typeof schemaDef.deprecated === 'string' ? schemaDef.deprecated : 'This property is deprecated and may be removed in a future version.'}\n\n`);
    }
    
    markdown.appendMarkdown(`**${propertyName}**`);
    
    if (schemaDef.type) {
      markdown.appendMarkdown(` *(${schemaDef.type})*`);
    }
    
    if (schemaDef.description) {
      markdown.appendMarkdown(`\n\n${schemaDef.description}`);
    }
    
    if (schemaDef.default !== undefined) {
      markdown.appendMarkdown(`\n\n**Default:** \`${JSON.stringify(schemaDef.default)}\``);
    }
    
    if (schemaDef.enum && schemaDef.enum.length > 0) {
      markdown.appendMarkdown(`\n\n**Allowed values:** ${schemaDef.enum.map((v: any) => `\`${v}\``).join(', ')}`);
    }
    
    if (schemaDef.examples && schemaDef.examples.length > 0) {
      markdown.appendMarkdown(`\n\n**Examples:**\n\`\`\`yaml\n${schemaDef.examples.map((ex: any) => JSON.stringify(ex)).join('\n')}\n\`\`\``);
    }
    
    return markdown;
  }
}

/**
 * Landofile validation provider that provides custom validation
 */
export class LandofileValidationProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  
  constructor(private schemaProvider: LandofileSchemaProvider) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('landofile');
  }
  
  /**
   * Validates Landofile content and provides diagnostics
   * This complements the schema-based validation with Lando-specific rules
   */
  async validateDocument(document: vscode.TextDocument): Promise<void> {
    console.log('LandofileValidationProvider.validateDocument called for:', document.uri.fsPath);
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const lines = text.split('\n');
    
      // Build a set of valid recipe names from LANDO_RECIPES for efficient lookup
      const validRecipeNames = new Set(LANDO_RECIPES.map(r => r.label as string));
      
      // Check for common Lando-specific issues
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i;
        
        // Check for recipe line and validate the recipe name
        const recipeMatch = line.match(/^\s*recipe:\s*(.+?)\s*(?:#.*)?$/);
        if (recipeMatch) {
          const recipeName = recipeMatch[1].trim();
          // Remove quotes if present
          const cleanRecipeName = recipeName.replace(/^['"]|['"]$/g, '');
          
          // Only warn if the recipe name is definitely not valid (not in known list and not a custom/unknown recipe)
          // Since Lando supports custom recipes, we only warn for obviously problematic values
          if (cleanRecipeName && !validRecipeNames.has(cleanRecipeName) && !/^[a-z][a-z0-9_-]*$/.test(cleanRecipeName)) {
            diagnostics.push({
              range: new vscode.Range(lineNumber, 0, lineNumber, line.length),
              message: `Recipe name '${cleanRecipeName}' may be invalid. Common recipes: ${Array.from(validRecipeNames).slice(0, 5).join(', ')}...`,
              severity: vscode.DiagnosticSeverity.Warning
            });
          }
        }
      }
    
    console.log('Custom validation diagnostics:', diagnostics.length);
    
    // Perform schema-based validation
    const schemaDiagnostics = await this.schemaProvider.validateDocument(document);
    console.log('Schema validation diagnostics:', schemaDiagnostics.length);
    diagnostics.push(...schemaDiagnostics);
    
    console.log('Total diagnostics to set:', diagnostics.length);
    this.diagnosticCollection.set(document.uri, diagnostics);
  }
  
  /**
   * Clears diagnostics for a document
   */
  clearDiagnostics(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }
  
  /**
   * Disposes the diagnostic collection
   */
  dispose(): void {
    this.diagnosticCollection.dispose();
  }
}

/**
 * Activates Landofile language features
 * @param context The VS Code extension context
 */
export function activateLandofileLanguageFeatures(context: vscode.ExtensionContext): LandofileSchemaProvider {
  // Create schema provider
  const schemaProvider = new LandofileSchemaProvider(context);
  
  // Register completion provider for landofile language
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    { language: 'landofile' },
    new LandofileCompletionProvider(schemaProvider),
    ':', ' ', '\n'
  );
  
  // Register hover provider for enhanced documentation
  const hoverProvider = vscode.languages.registerHoverProvider(
    { language: 'landofile' },
    new LandofileHoverProvider(schemaProvider)
  );
  
  // Create validation provider for Lando-specific validation
  const validationProvider = new LandofileValidationProvider(schemaProvider);
  
  // Listen for document changes to validate
  const changeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
    if (event.document.languageId === 'landofile') {
      await validationProvider.validateDocument(event.document);
    }
  });
  
  // Listen for document open to validate
  const openListener = vscode.workspace.onDidOpenTextDocument(async (document) => {
    if (document.languageId === 'landofile') {
      await validationProvider.validateDocument(document);
    }
  });
  
  // Listen for document close to clear diagnostics
  const closeListener = vscode.workspace.onDidCloseTextDocument((document) => {
    if (document.languageId === 'landofile') {
      validationProvider.clearDiagnostics(document.uri);
    }
  });
  
  // Validate currently open Landofile documents
  vscode.workspace.textDocuments.forEach(async document => {
    if (document.languageId === 'landofile') {
      await validationProvider.validateDocument(document);
    }
  });
  
  // Add disposables to context
  context.subscriptions.push(
    completionProvider,
    hoverProvider,
    changeListener,
    openListener,
    closeListener,
    validationProvider
  );
  return schemaProvider;
} 