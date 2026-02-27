/**
 * Landofile Schema Provider
 * 
 * This module handles loading and caching the Landofile JSON schema,
 * providing it to VS Code's built-in JSON schema validation capabilities.
 * 
 * @module landofileSchemaProvider
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import Ajv from 'ajv';

/**
 * The URL of the Landofile JSON schema
 */
const LANDOFILE_SCHEMA_URL = 'https://lando-community.github.io/lando-spec/landofile-spec.json';

/**
 * Interface for the cached schema
 */
interface CachedSchema {
    content: any;
    lastFetched: number;
}

/**
 * Provides JSON schema support for Landofile documents
 * 
 * This class handles:
 * - Fetching and caching the Landofile JSON schema
 * - Providing schema validation through VS Code's built-in capabilities
 * - Supporting offline usage with cached schemas
 */
export class LandofileSchemaProvider {
    private schemaCache: CachedSchema | undefined;
    private readonly CACHE_DURATION = 1000 * 60 * 60; // 1 hour
    private fetchingPromise: Promise<any> | undefined;
    
    constructor(private readonly context: vscode.ExtensionContext) {}
    
    /**
     * Gets the Landofile schema, either from cache or by fetching it
     * 
     * @returns Promise resolving to the schema object
     */
    async getSchema(): Promise<any> {
        // Check if we have a valid cached schema
        if (this.schemaCache && Date.now() - this.schemaCache.lastFetched < this.CACHE_DURATION) {
            return this.schemaCache.content;
        }
        
        // If we're already fetching, return the existing promise
        if (this.fetchingPromise) {
            return this.fetchingPromise;
        }
        
        // Fetch the schema
        this.fetchingPromise = this.fetchSchema();
        
        try {
            const schema = await this.fetchingPromise;
            return schema;
        } finally {
            this.fetchingPromise = undefined;
        }
    }
    
    /**
     * Fetches the schema from the remote URL
     * 
     * @returns Promise resolving to the schema object
     */
    private async fetchSchema(): Promise<any> {
        try {
            const response = await fetch(LANDOFILE_SCHEMA_URL);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch schema: ${response.statusText}`);
            }
            
            const schema = await response.json();
            
            // Cache the schema
            this.schemaCache = {
                content: schema,
                lastFetched: Date.now()
            };
            
            // Also save to disk for offline usage
            await this.saveSchemaToStorage(schema);
            
            return schema;
        } catch (error) {
            // Try to load from storage if fetch fails
            const storedSchema = await this.loadSchemaFromStorage();
            if (storedSchema) {
                console.warn('Failed to fetch schema, using stored version:', error);
                return storedSchema;
            }
            
            throw error;
        }
    }
    
    /**
     * Saves the schema to extension storage for offline usage
     * 
     * @param schema The schema to save
     */
    private async saveSchemaToStorage(schema: any): Promise<void> {
        try {
            await this.context.globalState.update('landofile.schema', JSON.stringify(schema));
            await this.context.globalState.update('landofile.schema.timestamp', Date.now());
        } catch (error) {
            console.error('Failed to save schema to storage:', error);
        }
    }
    
    /**
     * Loads the schema from extension storage
     * 
     * @returns The stored schema or undefined if not found
     */
    private async loadSchemaFromStorage(): Promise<any | undefined> {
        try {
            const schemaString = this.context.globalState.get<string>('landofile.schema');
            const timestamp = this.context.globalState.get<number>('landofile.schema.timestamp');
            
            if (schemaString && timestamp) {
                const schema = JSON.parse(schemaString);
                
                // Update cache
                this.schemaCache = {
                    content: schema,
                    lastFetched: timestamp
                };
                
                return schema;
            }
        } catch (error) {
            console.error('Failed to load schema from storage:', error);
        }
        
        return undefined;
    }
    
    /**
     * Clears the schema cache
     */
    clearCache(): void {
        this.schemaCache = undefined;
    }
    
    /**
     * Gets schema documentation for a specific path
     * 
     * @param path The JSON path to get documentation for (e.g., "properties.name")
     * @returns Documentation string or undefined
     */
    async getDocumentationForPath(path: string): Promise<string | undefined> {
        try {
            const schema = await this.getSchema();
            const parts = path.split('.');
            
            let current = schema;
            for (const part of parts) {
                if (!current) {break;}
                current = current[part];
            }
            
            return current?.description;
        } catch (error) {
            console.error('Failed to get documentation for path:', error);
            return undefined;
        }
    }
    
    /**
     * Validates a YAML document against the Landofile schema
     * 
     * @param document The document to validate
     * @returns Array of diagnostic issues
     */
    async validateDocument(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
        try {
            const schema = await this.getSchema();
            const text = document.getText();
            
            // Parse YAML content
            let yamlData: any;
            try {
                yamlData = yaml.load(text);
            } catch (parseError: any) {
                // Handle YAML parsing errors
                const error = parseError as Error;
                const message = error.message;
                
                // Extract line and column information from error message
                const lineMatch = message.match(/line (\d+)/);
                const columnMatch = message.match(/column (\d+)/);
                
                const line = lineMatch ? parseInt(lineMatch[1]) - 1 : 0;
                const column = columnMatch ? parseInt(columnMatch[1]) - 1 : 0;
                
                return [{
                    range: new vscode.Range(line, column, line, column + 1),
                    message: `YAML parsing error: ${message}`,
                    severity: vscode.DiagnosticSeverity.Error,
                    source: 'landofile'
                }];
            }
            
            if (!yamlData || typeof yamlData !== 'object') {
                return [{
                    range: new vscode.Range(0, 0, 0, 10),
                    message: 'Document must be a valid YAML object',
                    severity: vscode.DiagnosticSeverity.Error,
                    source: 'landofile'
                }];
            }
            
            // Use Ajv for JSON schema validation
            const ajv = new Ajv({
                allErrors: true,
                verbose: true,
                strict: false
            });
            
            // Add custom validation rules for required fields
            // Note: The official Lando schema may not enforce these as required,
            // but 'name' and 'recipe' are practically required for a valid Lando app.
            // This provides better user guidance for common Landofile configurations.
            const enhancedSchema = {
                ...schema,
                required: [...(schema.required || []), 'name', 'recipe'].filter(
                    (v, i, a) => a.indexOf(v) === i // Remove duplicates
                )
            };
            
            const validate = ajv.compile(enhancedSchema);
            const valid = validate(yamlData);
            
            if (valid) {
                return [];
            }
            
            // Convert Ajv errors to VS Code diagnostics
            const diagnostics: vscode.Diagnostic[] = [];
            
            if (validate.errors) {
                for (const error of validate.errors) {
                    const range = this.getRangeFromJsonPath(document, error.instancePath);
                    
                    if (range) {
                        const diagnostic = {
                            range: range,
                            message: this.formatAjvError(error),
                            severity: vscode.DiagnosticSeverity.Error,
                            source: 'landofile'
                        };
                        diagnostics.push(diagnostic);
                    }
                }
            }
            
            return diagnostics;
            
        } catch (error) {
            console.error('Error validating document:', error);
            return [{
                range: new vscode.Range(0, 0, 0, 10),
                message: `Validation error: ${error}`,
                severity: vscode.DiagnosticSeverity.Error,
                source: 'landofile'
            }];
        }
    }
    
    /**
     * Gets a VS Code range from a JSON path
     * 
     * @param document The document
     * @param jsonPath The JSON path (e.g., "/services/appserver/port")
     * @returns VS Code range or undefined
     */
    private getRangeFromJsonPath(document: vscode.TextDocument, jsonPath: string): vscode.Range | undefined {
        if (!jsonPath) {
            return new vscode.Range(0, 0, 0, 10);
        }
        
        const pathParts = jsonPath.split('/').filter(part => part.length > 0);
        const lines = document.getText().split('\n');
        
        // Build the current path as we scan through the lines
        // Use actual indentation tracking instead of assuming 2-space indents
        let currentPath: string[] = [];
        let currentIndent = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/^(\s*)([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
            
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
                    // Shallower level - pop path to match the target depth
                    // Calculate target depth based on indentation (assumes 2-space indent)
                    const targetDepth = Math.floor(indent / 2) + 1;
                    while (currentPath.length > targetDepth) {
                        currentPath.pop();
                    }
                    // Replace the element at the current depth
                    if (currentPath.length > 0) {
                        currentPath[currentPath.length - 1] = key;
                    } else {
                        currentPath.push(key);
                    }
                    currentIndent = indent;
                }
                
                // Check if this matches our target path
                if (this.pathMatches(pathParts, currentPath)) {
                    const startColumn = line.indexOf(key);
                    const endColumn = line.length;
                    return new vscode.Range(i, startColumn, i, endColumn);
                }
            }
        }
        
        // Fallback: try to find the property by name in the lines
        const lastPart = pathParts[pathParts.length - 1];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Look for the exact property name with proper YAML syntax
            const propertyMatch = line.match(new RegExp(`^\\s*${lastPart}\\s*:\\s*(.*)$`));
            if (propertyMatch) {
                const startColumn = line.indexOf(lastPart);
                const endColumn = line.length;
                return new vscode.Range(i, startColumn, i, endColumn);
            }
        }
        
        // Final fallback to first line
        return new vscode.Range(0, 0, 0, 10);
    }
    
    /**
     * Checks if a path matches the target path parts
     * 
     * @param targetParts The target path parts
     * @param currentPath The current path being built
     * @returns True if the paths match
     */
    private pathMatches(targetParts: string[], currentPath: string[]): boolean {
        if (targetParts.length !== currentPath.length) {
            return false;
        }
        
        for (let i = 0; i < targetParts.length; i++) {
            if (targetParts[i] !== currentPath[i]) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Parses YAML structure to understand the hierarchy and line locations
     * 
     * @param lines The lines of the YAML document
     * @returns Parsed structure with line information
     */
    private parseYamlStructure(lines: string[]): any {
        const structure: any = {};
        const stack: Array<{ key: string; line: number; indent: number }> = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }
            
            const indent = line.length - line.trimStart().length;
            const match = line.match(/^(\s*)([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
            
            if (match) {
                const key = match[2];
                const value = match[3].trim();
                
                // Pop stack items with greater or equal indentation
                while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
                    stack.pop();
                }
                
                // Add to stack
                stack.push({ key, line: i, indent });
                
                // Build the path
                const path = stack.map(item => item.key).join('.');
                
                // Store the location information
                if (!structure[path]) {
                    structure[path] = [];
                }
                structure[path].push({
                    line: i,
                    startColumn: line.indexOf(key),
                    endColumn: line.length,
                    value: value,
                    hasValue: value.length > 0
                });
            }
        }
        
        return structure;
    }
    
    /**
     * Finds the exact location of a property in the YAML structure
     * 
     * @param structure The parsed YAML structure
     * @param pathParts The JSON path parts
     * @returns Location information or undefined
     */
    private findPropertyLocation(structure: any, pathParts: string[]): { line: number; startColumn: number; endColumn: number } | undefined {
        // Try to find the exact path
        const fullPath = pathParts.join('.');
        if (structure[fullPath] && structure[fullPath].length > 0) {
            return structure[fullPath][0];
        }
        
        // Try to find partial matches
        for (const path in structure) {
            const pathParts2 = path.split('.');
            
            // Check if the last part matches
            if (pathParts2.length > 0 && pathParts2[pathParts2.length - 1] === pathParts[pathParts.length - 1]) {
                // Check if the path structure matches
                let matches = true;
                for (let i = 0; i < Math.min(pathParts.length, pathParts2.length); i++) {
                    if (pathParts[i] !== pathParts2[i]) {
                        matches = false;
                        break;
                    }
                }
                
                if (matches && structure[path].length > 0) {
                    return structure[path][0];
                }
            }
        }
        
        return undefined;
    }
    
    /**
     * Formats an Ajv error into a user-friendly message
     * 
     * @param error The Ajv error
     * @returns Formatted error message
     */
    private formatAjvError(error: any): string {
        const keyword = error.keyword;
        const dataPath = error.instancePath;
        const schemaPath = error.schemaPath;
        const params = error.params;
        const message = error.message;
        
        switch (keyword) {
            case 'required':
                return `Missing required property: ${params.missingProperty}`;
            case 'type':
                return `Property should be of type ${params.type}`;
            case 'enum':
                return `Property should be one of: ${params.allowedValues.join(', ')}`;
            case 'additionalProperties':
                return `Additional property '${params.additionalProperty}' is not allowed`;
            case 'format':
                return `Property should be a valid ${params.format}`;
            case 'pattern':
                return `Property should match pattern: ${params.pattern}`;
            case 'minimum':
            case 'maximum':
                return `Property should be ${keyword === 'minimum' ? 'at least' : 'at most'} ${params.limit}`;
            case 'minLength':
            case 'maxLength':
                return `Property should be ${keyword === 'minLength' ? 'at least' : 'at most'} ${params.limit} characters`;
            case 'minItems':
            case 'maxItems':
                return `Array should have ${keyword === 'minItems' ? 'at least' : 'at most'} ${params.limit} items`;
            default:
                return message || `Validation error: ${keyword}`;
        }
    }
} 