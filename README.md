# Lando Extension for Visual Studio Code

Seamlessly integrate [Lando](https://lando.dev) local development environments with Visual Studio Code. Execute Lando commands directly from your editor with integrated terminal support and intelligent `.lando.yml` file validation.

> **Note**: This extension is currently in development and not yet published to the Visual Studio Code Marketplace.

## Features

### ✅ Current Features
- **🚀 Command Execution**: Run any Lando command directly from the Command Palette (`Ctrl+Shift+P` → "Run Lando Command")
- **💻 Integrated Terminal**: Execute Lando commands in a dedicated VS Code terminal with full color support and interactive input
- **📝 YAML Schema Validation**: Automatic syntax validation and IntelliSense for `.lando.yml` and `.lando.*.yml` files
- **⚡ Real-time Output**: Live command output with proper ANSI color rendering and Ctrl+C interrupt support

### 🔜 Planned Features (Initial Release)
- [ ] Automatic Lando app detection in workspace
- [ ] App status monitoring and quick start/stop/restart actions
- [ ] Quick access to app URLs (copy to clipboard or open in browser)
- [ ] Integrated log viewer with filtering
- [ ] Enhanced `.lando.yml` editing with hints and autocompletion
- []

### 🚀 Future Roadmap
- Automatic Xdebug configuration
- Remote PHP interpreter integration
- App creation wizard (GUI for `lando init`)
- Context menu integration for common tasks
- Multi-workspace and multi-app support
- Integration with hosting platforms (Pantheon, Acquia, etc.)

## Installation

**From Source** (Development):
1. Clone this repository
2. Run `npm install` to install dependencies
3. Press `F5` to launch the Extension Development Host
4. Test the extension in the new VS Code window

**From Marketplace** (Coming Soon):
- Search for "Lando" in the VS Code Extensions view

## Usage

### Running Lando Commands
1. Open a workspace containing a Lando app (with `.lando.yml`)
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Type "Run Lando Command" and select it
4. Enter your Lando command (e.g., `start`, `stop`, `rebuild`, `ssh`)
5. View the output in the integrated terminal

### YAML File Support
The extension automatically provides schema validation for:
- `.lando.yml`
- `.lando.*.yml` (e.g., `.lando.local.yml`)

IntelliSense and validation are powered by the the community maintained [Lando Schema Specification](https://github.com/4lando/lando-spec).

## Requirements

- **Lando**: Must be installed and available in your system PATH
- **VS Code**: Version 1.91.0 or higher
- **Dependencies**: Red Hat YAML extension (automatically installed)

## Extension Settings

This extension contributes the following settings:

- Automatic YAML schema configuration for Lando files
- Integration with the Red Hat YAML extension for enhanced editing experience

## Known Issues

- Currently supports single workspace/single Lando app setups
- Multi-workspace support is planned for future releases

## Contributing

This is an open-source project. Contributions are welcome!

### Development Setup
1. Clone the repository
2. Run `npm install`
3. Open in VS Code and press `F5` to start debugging

### Testing
- Install the Extension Test Runner extension
- Run tests via the Testing view or `Ctrl+Cmd+; A`

## Release Notes

### 0.0.1 (In Development)
- Initial development release
- Basic Lando command execution
- Terminal integration with color support
- YAML schema validation for Lando files

## License

See [LICENSE](LICENSE) file for details.

---

**Enjoy using Lando with Visual Studio Code!** 🎉
