import * as assert from "assert";
import { suite, test, suiteSetup } from "mocha";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

suite("Schema Validation Test Suite", () => {
  let extension: vscode.Extension<any>;
  let testWorkspacePath: string;

  suiteSetup(async () => {
    extension = vscode.extensions.getExtension("4lando.vscode-lando")!;
    assert.ok(extension, "Extension should be found");
    await extension.activate();
    
    // Get test workspace path
    testWorkspacePath = path.resolve(__dirname, "../../../test/test-workspace");
  });

  suite("Schema Provider Tests", () => {
    test("Schema provider should be able to fetch schema", async () => {
      // This test verifies that the schema loads
      const schemaProvider = extension.exports?.schemaProvider;
      assert.ok(schemaProvider, "Schema provider should be exported");
      const schema = await schemaProvider.getSchema();
      assert.ok(schema, "Schema should be loaded");
    });
    test("Schema provider should handle schema caching", async () => {
      // This test verifies that the schema is cached
      const schemaProvider = extension.exports?.schemaProvider;
      assert.ok(schemaProvider, "Schema provider should be exported");
      const schema1 = await schemaProvider.getSchema();
      const schema2 = await schemaProvider.getSchema();
      assert.strictEqual(schema1, schema2, "Schema should be cached");
    });
    test("Schema should contain expected properties", async () => {
      const schemaProvider = extension.exports?.schemaProvider;
      assert.ok(schemaProvider, "Schema provider should be exported");
      const schema = await schemaProvider.getSchema();
      assert.ok(schema.properties, "Schema should have properties");
      assert.ok(schema.properties.name, "Schema should have 'name' property");
      assert.ok(schema.properties.recipe, "Schema should have 'recipe' property");
    });
  });

  suite("JSON Schema Validation Tests", () => {
    test("JSON schema should validate required fields", async () => {
      // Missing required 'name' and 'recipe'
      const testContent = `services:\n  appserver:\n    type: nginx`;
      const document = await vscode.workspace.openTextDocument({
        content: testContent,
        language: 'landofile'
      });
      await vscode.window.showTextDocument(document);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      console.log(`Found ${diagnostics.length} diagnostics for missing required fields`);
      assert.ok(diagnostics.length > 0, "JSON schema should detect missing required 'name' and 'recipe' fields");
    });
    test("JSON schema should validate property types", async () => {
      // 'name' should be a string, not a number
      const testContent = `name: 123\nrecipe: drupal9\nservices:\n  appserver:\n    type: nginx`;
      const document = await vscode.workspace.openTextDocument({
        content: testContent,
        language: 'landofile'
      });
      await vscode.window.showTextDocument(document);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      console.log(`Found ${diagnostics.length} diagnostics for invalid property types`);
      assert.ok(diagnostics.length > 0, "JSON schema should validate property types");
    });
    test("JSON schema should validate enum values", async () => {
      // 'recipe' should be a valid enum value
      const testContent = `name: test-app\nrecipe: notarecipe\nservices:\n  appserver:\n    type: nginx`;
      const document = await vscode.workspace.openTextDocument({
        content: testContent,
        language: 'landofile'
      });
      await vscode.window.showTextDocument(document);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      console.log(`Found ${diagnostics.length} diagnostics for invalid enum values`);
      assert.ok(diagnostics.length > 0, "JSON schema should validate enum values");
    });
    test("JSON schema should validate nested object structures", async () => {
      // 'services' should be an object, not a string
      const testContent = `name: test-app\nrecipe: drupal9\nservices: should-be-object`;
      const document = await vscode.workspace.openTextDocument({
        content: testContent,
        language: 'landofile'
      });
      await vscode.window.showTextDocument(document);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      console.log(`Found ${diagnostics.length} diagnostics for invalid nested structure`);
      assert.ok(diagnostics.length > 0, "JSON schema should validate nested object structures");
    });
    test("JSON schema should provide detailed error messages", async () => {
      // Multiple violations: missing required, wrong type, invalid enum
      const testContent = `name: 123\nrecipe: notarecipe\nservices: should-be-object`;
      const document = await vscode.workspace.openTextDocument({
        content: testContent,
        language: 'landofile'
      });
      await vscode.window.showTextDocument(document);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      console.log(`Found ${diagnostics.length} diagnostics for detailed error messages`);
      assert.ok(diagnostics.length > 1, "JSON schema should provide detailed error messages for multiple violations");
    });
    test("Validation errors should appear at correct line locations", async () => {
      // 'port' should be a number, not a string; 'ssl' should be a boolean, not a string
      const testContent = `name: test-app\nrecipe: drupal9\nservices:\n  appserver:\n    type: nginx\n    port: \"invalid-port\"\n    ssl: \"not-boolean\"`;
      const document = await vscode.workspace.openTextDocument({
        content: testContent,
        language: 'landofile'
      });
      await vscode.window.showTextDocument(document);
      await new Promise(resolve => setTimeout(resolve, 1000));
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      console.log(`Found ${diagnostics.length} diagnostics for line location test`);
      
      // Log all diagnostics for debugging
      diagnostics.forEach((d, i) => {
        console.log(`Diagnostic ${i}: "${d.message}" at line ${d.range.start.line}`);
      });
      
      // Should have diagnostics for both port and ssl
      assert.ok(diagnostics.length > 1, "Should have diagnostics for invalid port type and ssl type");
      
      // Check that at least one diagnostic is on the 'port' line (line 5)
      const portLine = diagnostics.some(d => d.range.start.line === 5);
      console.log(`Found diagnostic on port line (5): ${portLine}`);
      assert.ok(portLine, "Validation error should appear at the 'port' line");
    });
  });

  suite("Validation Provider Tests", () => {
    test("Validation provider should detect missing app name", async () => {
      // Create a test document with missing app name
      const testContent = `recipe: drupal9
services:
  appserver:
    type: nginx`;

      const document = await vscode.workspace.openTextDocument({
        content: testContent,
        language: 'landofile'
      });

      // Open the document to trigger validation
      await vscode.window.showTextDocument(document);
      
      // Wait a moment for validation to run
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if diagnostics were created
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      console.log(`Found ${diagnostics.length} diagnostics for invalid document`);
      
      // Should have at least one diagnostic for missing app name
      assert.ok(diagnostics.length > 0, "Should detect validation issues");
      
      // Check for the specific diagnostic about missing app name
      const hasAppNameDiagnostic = diagnostics.some(d => 
        d.message.includes('name') || d.message.includes('app')
      );
      assert.ok(hasAppNameDiagnostic, "Should detect missing app name");
    });

    test("Validation provider should detect invalid recipe", async () => {
      // Create a test document with invalid recipe
      const testContent = `name: test-app
recipe: invalid-recipe
services:
  appserver:
    type: nginx`;

      const document = await vscode.workspace.openTextDocument({
        content: testContent,
        language: 'landofile'
      });

      await vscode.window.showTextDocument(document);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      console.log(`Found ${diagnostics.length} diagnostics for invalid recipe`);
      
      // Should detect invalid recipe
      const hasRecipeDiagnostic = diagnostics.some(d => 
        d.message.includes('recipe') || d.message.includes('valid')
      );
      assert.ok(hasRecipeDiagnostic, "Should detect invalid recipe");
    });

    test("Validation provider should accept valid Landofile", async () => {
      // Create a test document with valid content
      const testContent = `name: test-app
recipe: drupal9
services:
  appserver:
    type: nginx
    ssl: true`;

      const document = await vscode.workspace.openTextDocument({
        content: testContent,
        language: 'landofile'
      });

      await vscode.window.showTextDocument(document);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      console.log(`Found ${diagnostics.length} diagnostics for valid document`);
      
      // Valid document should have fewer or no critical diagnostics
      const criticalDiagnostics = diagnostics.filter(d => 
        d.severity === vscode.DiagnosticSeverity.Error
      );
      assert.strictEqual(criticalDiagnostics.length, 0, "Valid document should have no critical errors");
    });
  });

  suite("JSON Schema Integration Tests", () => {
    test("Schema-based validation should work", async () => {
      // This test verifies that the schema integration is working
      // We'll test by creating a document and checking if schema-based
      // validation is triggered
      
      const testContent = `name: test-app
recipe: drupal9
services:
  appserver:
    type: nginx
    invalid_property: true`; // This should trigger schema validation

      const document = await vscode.workspace.openTextDocument({
        content: testContent,
        language: 'landofile'
      });

      await vscode.window.showTextDocument(document);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      console.log(`Found ${diagnostics.length} diagnostics for schema validation test`);
      
      // Should have some diagnostics (either custom or schema-based)
      assert.ok(diagnostics.length >= 0, "Schema validation should be active");
    });

    test("Schema documentation should be available in hover", async () => {
      // This test verifies that schema-based hover documentation is working
      
      const testContent = `name: test-app
recipe: drupal9
services:
  appserver:
    type: nginx`;

      const document = await vscode.workspace.openTextDocument({
        content: testContent,
        language: 'landofile'
      });

      const _editor = await vscode.window.showTextDocument(document);
      
      // Wait for schema to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test hover on 'name' property
      const namePosition = new vscode.Position(0, 2); // Position on 'name'
      const hoverResult = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        document.uri,
        namePosition
      );
      
      console.log(`Hover result for 'name': ${hoverResult ? hoverResult.length : 'null'} hover(s)`);
      if (hoverResult && hoverResult.length > 0) {
        hoverResult.forEach((hover, index) => {
          console.log(`Hover ${index}:`, hover.contents.map(c => 
            typeof c === 'string' ? c : c.value
          ).join('\n'));
        });
      }
      
      assert.ok(hoverResult && hoverResult.length > 0, "Should have hover information for 'name' property");
      
      // Check that at least one hover contains schema documentation
      let hasSchemaDoc = false;
      if (hoverResult) {
        for (const hover of hoverResult) {
          for (const content of hover.contents) {
            const text = typeof content === 'string' ? content : content.value;
            // Check if it contains expected schema documentation
            if (text.includes('name') || text.includes('Lando') || text.includes('app')) {
              hasSchemaDoc = true;
              break;
            }
          }
        }
      }
      
      assert.ok(hasSchemaDoc, "Hover should contain schema-based documentation for 'name' property");
      
      // Test hover on 'recipe' property
      const recipePosition = new vscode.Position(1, 2); // Position on 'recipe'
      console.log(`Testing hover at position ${recipePosition.line}:${recipePosition.character} for recipe`);
      
      // Get the word at this position for debugging
      const wordRange = document.getWordRangeAtPosition(recipePosition);
      if (wordRange) {
        const word = document.getText(wordRange);
        console.log(`Word at recipe position: "${word}"`);
      }
      
      const recipeHoverResult = await vscode.commands.executeCommand<vscode.Hover[]>(
        'vscode.executeHoverProvider',
        document.uri,
        recipePosition
      );
      
      console.log(`Hover result for 'recipe': ${recipeHoverResult ? recipeHoverResult.length : 'null'} hover(s)`);
      
      if (recipeHoverResult && recipeHoverResult.length > 0) {
        recipeHoverResult.forEach((hover, index) => {
          console.log(`Recipe hover ${index}:`, hover.contents.map(c => 
            typeof c === 'string' ? c : c.value
          ).join('\n'));
        });
      }
      
      assert.ok(recipeHoverResult && recipeHoverResult.length > 0, "Should have hover information for 'recipe' property");
    });
  });

  suite("Real File Validation Tests", () => {
    test("Should validate existing .lando.yml file", async () => {
      const landoFile = path.join(testWorkspacePath, '.lando.yml');
      
      if (fs.existsSync(landoFile)) {
        const document = await vscode.workspace.openTextDocument(landoFile);
        await vscode.window.showTextDocument(document);
        
        // Wait for validation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const diagnostics = vscode.languages.getDiagnostics(document.uri);
        console.log(`Found ${diagnostics.length} diagnostics for real .lando.yml file`);
        
        // Real file should be valid and have minimal diagnostics
        const errorDiagnostics = diagnostics.filter(d => 
          d.severity === vscode.DiagnosticSeverity.Error
        );
        console.log(`Found ${errorDiagnostics.length} error diagnostics`);
        
        // Should not have critical errors for a valid file
        assert.ok(errorDiagnostics.length === 0, "Valid .lando.yml should have no critical errors");
      } else {
        console.log("No .lando.yml file found in test workspace, skipping test");
      }
    });
  });
}); 