/**
 * Documentation Commands
 * 
 * This module registers the Lando documentation command.
 * 
 * @module commands/documentation
 */

import * as vscode from "vscode";
import { LandoApp } from "../landoAppDetector";
import { 
  LANDO_DOCUMENTATION, 
  DOCUMENTATION_CATEGORIES,
  getContextAwareDocumentation,
} from "../landoDocumentation";

/**
 * Opens Lando documentation with context-aware suggestions
 * Shows a Quick Pick with categorized documentation links
 * @param activeLandoApp - The currently active Lando app (for context-aware suggestions)
 * @param outputChannel - Output channel for logging
 */
export async function openLandoDocumentation(
  activeLandoApp: LandoApp | undefined,
  outputChannel: vscode.OutputChannel
): Promise<void> {
  interface DocQuickPickItem extends vscode.QuickPickItem {
    url?: string;
    category?: string;
  }

  const items: DocQuickPickItem[] = [];

  // Add context-aware suggestions at the top if an app is active
  const contextDocs = getContextAwareDocumentation(activeLandoApp);
  if (contextDocs.length > 0) {
    items.push({
      label: 'Relevant to Your App',
      kind: vscode.QuickPickItemKind.Separator
    });
    for (const doc of contextDocs) {
      items.push({
        label: `${doc.icon || '$(book)'} ${doc.label}`,
        description: doc.description,
        url: doc.url,
        category: doc.category
      });
    }
  }

  // Group remaining docs by category (using imported DOCUMENTATION_CATEGORIES)
  for (const cat of DOCUMENTATION_CATEGORIES) {
    const catDocs = LANDO_DOCUMENTATION.filter(d => d.category === cat.key);
    if (catDocs.length > 0) {
      items.push({
        label: `${cat.icon} ${cat.label}`,
        kind: vscode.QuickPickItemKind.Separator
      });
      for (const doc of catDocs) {
        // Skip if already added in context section
        if (contextDocs.some(cd => cd.url === doc.url)) {
          continue;
        }
        items.push({
          label: `${doc.icon || '$(book)'} ${doc.label}`,
          description: doc.description,
          url: doc.url,
          category: doc.category
        });
      }
    }
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Search Lando documentation...',
    title: 'Lando Documentation',
    matchOnDescription: true
  });

  if (selected?.url) {
    await vscode.env.openExternal(vscode.Uri.parse(selected.url));
    outputChannel.appendLine(`Opened documentation: ${selected.url}`);
  }
}

/**
 * Registers documentation-related commands
 * @param context - The extension context
 * @param getActiveApp - Function to get the currently active Lando app
 * @param outputChannel - Output channel for logging
 */
export function registerDocumentationCommands(
  context: vscode.ExtensionContext,
  getActiveApp: () => LandoApp | undefined,
  outputChannel: vscode.OutputChannel
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.openLandoDocumentation', async () => {
      await openLandoDocumentation(getActiveApp(), outputChannel);
    })
  );
}
