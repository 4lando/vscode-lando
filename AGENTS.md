# AGENTS.md

This file is yours to edit. It exists to describe common mistakes and confusion points that you encounter as you work in this project. If you ever encounter something in this project that surprises you, please alert the developer working with you and update this AGENTS.md file to help prevent similar confusion in the future.

## Project Overview

This is a Visual Studio Code extension that provides deep integration for the [Lando](https://lando.dev) local development tool.

## 6. Documentation & Testing Requirements

- **Always update documentation and tests when making changes**

- **Do not write tests that could be handled by the type checker.**

- **Unit tests** (`src/*.test.ts`): Co-located with source files. These test pure logic and do NOT require VS Code APIs. Place these next to the module they test (e.g., `src/landoDocumentation.test.ts` tests `src/landoDocumentation.ts`).
-   **Integration tests** (`src/test/suite/*.test.ts`): Require VS Code runtime. These test extension behavior, command registration, and VS Code API interactions. Place these in the `src/test/suite/` directory.
