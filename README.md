# Lando Extension for Visual Studio Code

Seamlessly integrate [Lando](https://lando.dev) local development environments with Visual Studio Code. Execute Lando commands, automatically configure PHP interpreters, and get intelligent `.lando.yml` file validation - all from within your editor.

> **Note**: This extension is currently in development and not yet published to the Visual Studio Code Marketplace.

## Features

### ✅ Current Features

#### 🚀 **Lando Command Execution**
- Run any Lando command directly from the Command Palette (`Ctrl+Shift+P` → "Run Lando Command")
- Integrated terminal with full color support and interactive input
- Real-time output with proper ANSI color rendering and Ctrl+C interrupt support

#### 🐘 **Automatic PHP Integration**
- **Auto-detection**: Automatically detects Lando apps on workspace open
- **Smart Startup**: Optionally auto-starts Lando apps or prompts user to start
- **PHP Interpreter**: Seamlessly configures VS Code to use PHP from Lando containers
- **Terminal Integration**: Automatically sets up PHP aliases in new terminals
- **Task Interception**: Automatically redirects PHP commands in VS Code tasks to use Lando

#### ⚙️ **Configuration & Management**
- **Status Monitoring**: Check if Lando apps are running
- **Environment Setup**: Easily configure PHP environment in active terminals
- **Settings Restoration**: Automatically restores original PHP settings on deactivation
- **Cross-platform**: Works on Windows, macOS, and Linux

#### 📝 **Enhanced Lando File Support**
- **Smart YAML**: Enhanced `.lando.yml` file editing with bash syntax highlighting
- **Schema Validation**: Automatic validation using the Lando Schema Specification
- **IntelliSense**: Autocompletion and error detection for Lando configuration
- **Shell Commands**: Shell commands in `build`, `run`, and `cmd` sections get proper highlighting

### 🔜 Planned Features
- [ ] Quick access to app URLs (copy to clipboard or open in browser)
- [ ] Integrated log viewer with filtering
- [ ] Enhanced `.lando.yml` editing with hints and autocompletion
- [ ] Multi-workspace and multi-app support

### 🚀 Future Roadmap
- Automatic Xdebug configuration
- App creation wizard (GUI for `lando init`)
- Context menu integration for common tasks
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

### Automatic PHP Integration
1. Open a workspace containing a Lando app (with `.lando.yml`)
2. The extension will automatically:
   - Detect your Lando app
   - Check if it's running (and optionally start it)
   - Configure VS Code to use PHP from the Lando container
   - Set up PHP aliases in new terminals

### Manual Commands
Access these commands via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- **"Run Lando Command"** - Execute any Lando command interactively
- **"Enable Lando PHP Interpreter"** - Manually enable PHP integration
- **"Disable Lando PHP Interpreter"** - Restore original PHP settings
- **"Set PHP Environment in Terminal"** - Configure PHP alias in active terminal
- **"Check Lando Status"** - Check if your Lando app is running
- **"Refresh PHP Configuration"** - Refresh PHP settings
- **"Test PHP Wrapper"** - Test PHP integration in a new terminal

## Requirements

- **Lando**: Must be installed and available in your system PATH
- **VS Code**: Version 1.91.0 or higher
- **Dependencies**: Red Hat YAML extension (automatically installed)

## Extension Settings

Configure the extension behavior in your VS Code settings:

```jsonc
{
  "lando.appMount": "/app",         // Working directory in container
  "lando.autoStart": false,         // Auto-start Lando apps on activation
  "lando.php.enabled": true,        // Enable/disable Lando PHP interpreter
  "lando.php.service": "appserver", // Default PHP service name
}
```

## Known Issues

- Currently supports single workspace/single Lando app setups
- PHP command interception only works for shell-type tasks with direct PHP commands

## Contributing

This is an open-source project. Contributions are welcome!

### Development Setup
1. Clone the repository
2. Run `npm install`
3. Open in VS Code and press `F5` to start debugging

### Testing
- Install the Extension Test Runner extension
- Run tests via the Testing view or `Ctrl+Cmd+; A`
- Run `npm run test` to run tests

## Release Notes

### 0.0.1 (In Development)
- ✅ Lando command execution with terminal integration
- ✅ Enhanced Landofile language with bash shell highlighting
- ✅ YAML schema validation for Lando files
- ✅ Automatic PHP interpreter configuration
- ✅ Container-based PHP execution with Docker wrappers
- ✅ Terminal auto-configuration with PHP aliases
- ✅ Task interception for PHP commands
- ✅ Lando app auto-detection and startup
- ✅ Cross-platform support (Windows, macOS, Linux)
- ✅ Comprehensive configuration options

## License

See [LICENSE](LICENSE) file for details.

---

**Enjoy seamless Lando development with Visual Studio Code!** 🎉🐳