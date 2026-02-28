/**
 * YAML Reference Provider
 * 
 * This module provides go-to-definition support for YAML anchors and aliases,
 * enabling ctrl+click navigation between anchor definitions (&anchor) and
 * their references (*alias).
 * 
 * @module yamlReferenceProvider
 */

import * as vscode from 'vscode';

/**
 * Represents a YAML anchor definition
 */
interface YamlAnchor {
    name: string;
    location: vscode.Location;
}

/**
 * Provides go-to-definition support for YAML references
 * 
 * This provider enables navigation between:
 * - Anchor definitions (&anchor) 
 * - Alias references (*alias)
 * - YAML merge keys (<<: *alias)
 * 
 * When a user ctrl+clicks on an alias, they will be taken to the
 * corresponding anchor definition.
 */
export class YamlReferenceProvider implements vscode.DefinitionProvider, vscode.ReferenceProvider, vscode.HoverProvider {
    
    /**
     * Provides the definition location for a YAML alias
     * 
     * @param document The document containing the alias
     * @param position The position of the alias
     * @param token Cancellation token
     * @returns The location of the anchor definition or undefined
     */
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Location | vscode.Location[] | vscode.LocationLink[] | undefined> {
        
        const alias = this.getAliasAtPosition(document, position);
        if (!alias) {
            return undefined;
        }
        
        const anchor = this.findAnchorDefinition(document, alias);
        if (anchor) {
            return anchor.location;
        }
        
        return undefined;
    }
    
    /**
     * Provides all references to a YAML anchor
     * 
     * @param document The document containing the anchor
     * @param position The position of the anchor
     * @param context Reference context
     * @param token Cancellation token
     * @returns Array of locations where the anchor is referenced
     */
    async provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.ReferenceContext,
        _token: vscode.CancellationToken
    ): Promise<vscode.Location[] | undefined> {
        
        const anchorName = this.getAnchorAtPosition(document, position);
        if (!anchorName) {
            return undefined;
        }
        
        const references: vscode.Location[] = [];
        
        // Include the definition if requested
        if (context.includeDeclaration) {
            const anchor = this.findAnchorDefinition(document, anchorName);
            if (anchor) {
                references.push(anchor.location);
            }
        }
        
        // Find all alias references
        const aliases = this.findAliasReferences(document, anchorName);
        references.push(...aliases);
        
        return references.length > 0 ? references : undefined;
    }
    
    /**
     * Provides hover information for YAML anchors and aliases
     * 
     * @param document The document
     * @param position The position to hover
     * @param token Cancellation token
     * @returns Hover information or undefined
     */
    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        
        const alias = this.getAliasAtPosition(document, position);
        if (alias) {
            const anchor = this.findAnchorDefinition(document, alias);
            if (anchor) {
                const contents = new vscode.MarkdownString();
                contents.appendMarkdown(`**YAML Alias:** \`*${alias}\`\n\n`);
                contents.appendMarkdown(`References anchor \`&${anchor.name}\``);
                return new vscode.Hover(contents);
            }
        }
        
        const anchorName = this.getAnchorAtPosition(document, position);
        if (anchorName) {
            const references = this.findAliasReferences(document, anchorName);
            const contents = new vscode.MarkdownString();
            contents.appendMarkdown(`**YAML Anchor:** \`&${anchorName}\`\n\n`);
            contents.appendMarkdown(`Referenced ${references.length} time(s) in this document`);
            return new vscode.Hover(contents);
        }
        
        return undefined;
    }
    
    /**
     * Gets the alias name at the given position
     * 
     * @param document The document
     * @param position The position to check
     * @returns The alias name or undefined
     */
    private getAliasAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
        const line = document.lineAt(position);
        const text = line.text;
        
        // Regular expression to match YAML aliases
        const aliasRegex = /\*([a-zA-Z0-9_\-]+)/g;
        
        let match;
        while ((match = aliasRegex.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            
            if (position.character >= start && position.character <= end) {
                return match[1];
            }
        }
        
        return undefined;
    }
    
    /**
     * Gets the anchor name at the given position
     * 
     * @param document The document
     * @param position The position to check
     * @returns The anchor name or undefined
     */
    private getAnchorAtPosition(document: vscode.TextDocument, position: vscode.Position): string | undefined {
        const line = document.lineAt(position);
        const text = line.text;
        
        // Regular expression to match YAML anchors
        const anchorRegex = /&([a-zA-Z0-9_\-]+)/g;
        
        let match;
        while ((match = anchorRegex.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            
            if (position.character >= start && position.character <= end) {
                return match[1];
            }
        }
        
        return undefined;
    }
    
    /**
     * Finds the anchor definition in the document
     * 
     * @param document The document to search
     * @param anchorName The name of the anchor to find
     * @returns The anchor information or undefined
     */
    private findAnchorDefinition(document: vscode.TextDocument, anchorName: string): YamlAnchor | undefined {
        const anchorRegex = new RegExp(`&${anchorName}\\b`);
        
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const match = line.text.match(anchorRegex);
            
            if (match && match.index !== undefined) {
                const position = new vscode.Position(i, match.index);
                const range = new vscode.Range(
                    position,
                    position.translate(0, match[0].length)
                );
                
                return {
                    name: anchorName,
                    location: new vscode.Location(document.uri, range)
                };
            }
        }
        
        return undefined;
    }
    
    /**
     * Finds all alias references to an anchor
     * 
     * @param document The document to search
     * @param anchorName The name of the anchor
     * @returns Array of locations where the anchor is referenced
     */
    private findAliasReferences(document: vscode.TextDocument, anchorName: string): vscode.Location[] {
        const references: vscode.Location[] = [];
        const aliasRegex = new RegExp(`\\*${anchorName}\\b`, 'g');
        
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            let match;
            
            // Reset lastIndex before each new line to ensure we search from the start
            // This prevents issues when the regex's lastIndex might be non-zero from previous iterations
            aliasRegex.lastIndex = 0;
            
            while ((match = aliasRegex.exec(line.text)) !== null) {
                const position = new vscode.Position(i, match.index);
                const range = new vscode.Range(
                    position,
                    position.translate(0, match[0].length)
                );
                
                references.push(new vscode.Location(document.uri, range));
            }
        }
        
        return references;
    }
}

/**
 * Registers the YAML reference provider
 * 
 * @param context The extension context
 */
export function registerYamlReferenceProvider(context: vscode.ExtensionContext): void {
    const provider = new YamlReferenceProvider();
    
    // Register for landofile language
    const landofileSelector: vscode.DocumentSelector = { 
        language: 'landofile',
        pattern: '**/.lando*.yml'
    };
    
    // Register definition provider
    const definitionDisposable = vscode.languages.registerDefinitionProvider(
        landofileSelector,
        provider
    );
    
    // Register reference provider
    const referenceDisposable = vscode.languages.registerReferenceProvider(
        landofileSelector,
        provider
    );
    
    // Register hover provider
    const hoverDisposable = vscode.languages.registerHoverProvider(
        landofileSelector,
        provider
    );
    
    context.subscriptions.push(
        definitionDisposable,
        referenceDisposable,
        hoverDisposable
    );
} 