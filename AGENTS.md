# AI Agent Onboarding: VS Code Lando Extension

This document provides essential context for AI agents working on this project. Read this to understand the project's architecture, goals, and development workflow.

## 1. Project Overview & Goal

This is a Visual Studio Code extension that provides deep integration for the [Lando](https://lando.dev) local development tool.

**Your Primary Goal:** Maintain and enhance the extension. This includes fixing bugs, adding new functionality, and improving existing code. Always ensure your changes are well-tested, adhere to the project's coding standards, and contribute to a seamless user experience for developers using Lando.

## 2. Key Architectural Components

The extension has its own custom language support for Lando, independent of other YAML extensions. Understanding these files is key to working on this project.

-   `src/extension.ts`: **Main Entry Point.** Handles extension activation, command registration, and orchestrates all features. This is where the core Lando integration logic (like starting apps and configuring PHP) lives.
-   `src/landofileLanguageFeatures.ts`: **Lando-Specific Language Features.** Provides rich, schema-driven intelligence for `.lando.yml` files, including autocomplete, hover-over documentation, and real-time validation.
-   `src/landofileSchemaProvider.ts`: **Schema Manager.** Fetches, caches, and provides the official Lando JSON schema that powers the language features in the file above. It includes offline support.
-   `src/yamlReferenceProvider.ts`: **YAML Navigation.** Enables "Go to Definition" functionality for YAML anchors (`&anchor`) and aliases (`*alias`), making `.lando.yml` files easier to navigate.
-   `src/shellDecorations.ts`: **UI/UX Enhancement.** Adds the `$` prefix decoration to shell commands within `.lando.yml` files to improve readability and provide a terminal-like feel.
-   `src/landoTreeDataProvider.ts`: **Lando Explorer Sidebar.** Provides the TreeView data provider for the Activity Bar sidebar, displaying apps, services, URLs, and tooling commands in a hierarchical tree structure.
-   `syntaxes/landofile.tmLanguage.json`: **Syntax Highlighting.** The TextMate grammar file that defines the syntax highlighting for the custom `landofile` language.
-   `package.json`: **Manifest File.** Defines the extension's commands, configuration options, language definitions, and dependencies. Changes here are required to expose new features to the user.

## 3. Development Workflow & Commands

Use these commands to build, lint, and test your changes.

-   **Build**: `npm run build`
    -   Compiles TypeScript to JavaScript and places it in the `out/` directory.
-   **Watch**: `npm run watch`
    -   Runs the compiler in watch mode for active development.
-   **Lint**: `npm run lint`
    -   Runs ESLint to check for code quality and style issues in the `src/` directory.
-   **Test**: `npm run test`
    -   Runs the linter and build, then executes the test suite. **Run this after any code change.**

## 4. Testing Structure

This project follows a specific pattern for organizing tests:

-   **Unit tests** (`src/*.test.ts`): Co-located with source files. These test pure logic and do NOT require VS Code APIs. Place these next to the module they test (e.g., `src/landoDocumentation.test.ts` tests `src/landoDocumentation.ts`).
-   **Integration tests** (`src/test/suite/*.test.ts`): Require VS Code runtime. These test extension behavior, command registration, and VS Code API interactions. Place these in the `src/test/suite/` directory.

**When adding tests:**
1. If testing pure logic (data structures, utility functions, parsing) → create a co-located unit test file
2. If testing VS Code integration (commands, UI, extension activation) → add to `src/test/suite/`
3. If a feature has both → split tests between co-located unit tests and integration tests

## 5. Agent Guidelines & Best Practices

-   **Leverage Your Tools:** Be resourceful. Use your available tools and CLI commands (`ls`, `grep`, `find`, `curl`, `node -e`, `npx`, `docker`, etc.) to explore the codebase, gather context, and troubleshoot issues. Don't be afraid to experiment with commands to overcome challenges.
-   **Manipulate Files with Tools:** For file system operations like moving, renaming, or deleting files, use shell commands like `mv`, `cp`, or `rm` instead of reading and writing file content manually.
-   **Verify Your Work:** After making any code changes, **always** run the linter (`npm run lint`) and tests (`npm run test`) to ensure your changes are valid and have not introduced regressions.
-   **Understand First:** Before modifying code, read the relevant files listed in the architecture section to understand their purpose and how they interact.
-   **Follow Conventions:** Maintain the existing code style, naming conventions, and architectural patterns.
-   **Document Your Code:** Add JSDoc comments to new functions, classes, and complex logic to explain the *why*, not just the *what*.
-   **Update the Manifest:** When adding or changing user-facing features, remember to update `package.json` to reflect new commands, settings, or activation events.

## 6. Documentation & Testing Requirements

**Always update documentation and tests when making changes:**

### README.md Updates
-   When adding new user-facing features, update `README.md` to document them.
-   When modifying existing features in ways that change user behavior, update the relevant README sections.
-   Keep the "Current Features" section accurate and comprehensive.
-   Update configuration examples if settings change.

### Test Requirements
-   **All new features must have tests.** This is non-negotiable.
-   Follow the testing structure in Section 4:
    -   Pure logic (no VS Code APIs) → co-located unit test (`src/*.test.ts`)
    -   VS Code integration → integration test (`src/test/suite/*.test.ts`)
-   When fixing bugs, add a test that reproduces the bug first, then fix it.
-   When modifying existing functionality, update related tests to reflect the changes.
-   Run `npm run test` before considering any task complete.
