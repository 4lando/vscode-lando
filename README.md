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
- **Multi-App Support**: Detects multiple Lando apps in workspace, switch between them easily
- **Status Monitoring**: Real-time status bar indicator with configurable polling interval
- **Quick Actions**: Start, stop, restart apps from the status bar menu
- **URL Access**: Open app URLs in browser or copy to clipboard
- **Environment Setup**: Easily configure PHP environment in active terminals
- **Settings Restoration**: Automatically restores original PHP settings on deactivation
- **Cross-platform**: Works on Windows, macOS, and Linux

#### 📝 **Enhanced Landofile Support**
- **Independent Language**: Custom Landofile language - no external YAML extensions required
- **File Detection**: Supports `.lando.yml` and `.lando.*.yml` files (e.g., `.lando.local.yml`)
- **Custom Icon**: Landofile files display with the Lando icon in the file explorer
- **Built-in JSON Schema**: Uses official Lando JSON schema for validation and autocomplete
- **Schema-Based Features**: Property autocomplete, value validation, and documentation from schema
- **Lando-Specific Enhancements**: Custom grammar for shell commands and Lando syntax
- **Smart YAML**: Complete YAML language implementation with bash syntax highlighting
- **IntelliSense**: Schema-driven autocompletion and error detection for Lando configuration
- **Shell Commands**: Shell commands in `build`, `run`, and `cmd` sections get proper highlighting
- **YAML References**: Ctrl+click on YAML aliases (`*recipe-path`) to jump to anchor definitions
- **Real-time Validation**: Live validation with error highlighting for missing required fields, invalid recipes, and service types

### 🔜 Planned Features
- [ ] Integrated log viewer with filtering

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
- **"Lando: Start App"** - Start the active Lando app
- **"Lando: Stop App"** - Stop the active Lando app
- **"Lando: Restart App"** - Restart the active Lando app
- **"Lando: Open App URL"** - Open the app URL in your default browser
- **"Lando: Copy App URL"** - Copy the app URL to clipboard
- **"Select Lando App"** - Choose which Lando app to use when multiple are detected
- **"Rescan for Lando Apps"** - Rescan the workspace for Lando apps
- **"Refresh Lando Status"** - Manually refresh the status bar indicator
- **"Enable Lando PHP Interpreter"** - Manually enable PHP integration
- **"Disable Lando PHP Interpreter"** - Restore original PHP settings
- **"Set PHP Environment in Terminal"** - Configure PHP alias in active terminal
- **"Check Lando Status"** - Check if your Lando app is running
- **"Refresh PHP Configuration"** - Refresh PHP settings
- **"Test PHP Wrapper"** - Test PHP integration in a new terminal

## Requirements

- **Lando**: Must be installed and available in your system PATH
- **VS Code**: Version 1.91.0 or higher

## Extension Settings

Configure the extension behavior in your VS Code settings:

```jsonc
{
  // Core settings
  "lando.appMount": "/app",         // Working directory in container
  "lando.autoStart": false,         // Auto-start Lando apps on activation
  "lando.php.enabled": true,        // Enable/disable Lando PHP interpreter
  "lando.php.service": "appserver", // Default PHP service name

  // App detection
  "lando.detection.maxDepth": 3,              // Max directory depth to search
  "lando.detection.excludeDirs": [            // Directories to exclude
    "node_modules", "vendor", ".git", "dist"
  ],

  // Status monitoring
  "lando.statusMonitoring.enabled": true,     // Enable real-time status monitoring
  "lando.statusMonitoring.interval": 10,      // Polling interval in seconds
  "lando.statusMonitoring.timeout": 10        // Status check timeout in seconds
}
```

## Known Issues

- PHP command interception only works for shell-type tasks with direct PHP commands

## Contributing

This is an open-source project. Contributions are welcome!

### Development Setup
1. Clone the repository
2. Run `npm install`
3. Open in VS Code and press `F5` to start debugging

### Testing

Run tests with `npm run test`.

**Test Structure:**
- **Unit tests** (`src/*.test.ts`): Co-located with source files, test pure logic without VS Code APIs
- **Integration tests** (`src/test/suite/*.test.ts`): Require VS Code runtime, test extension behavior

This pattern keeps unit tests discoverable alongside implementation while isolating integration tests that need the VS Code test harness.

## License

See [LICENSE](LICENSE) file for details.

---

**Enjoy seamless Lando development with Visual Studio Code!** 🎉🐳