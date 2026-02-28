# Lando Extension for Visual Studio Code

Seamlessly integrate [Lando](https://lando.dev) local development environments with Visual Studio Code. Execute Lando commands, automatically configure PHP interpreters, and get intelligent `.lando.yml` file validation - all from within your editor.

> **Note**: This extension is currently in development and not yet published to the Visual Studio Code Marketplace.

## Features

### ✅ Current Features

#### 🗂️ **Lando Explorer Sidebar**
- **Activity Bar Integration**: Lando icon in the VS Code Activity Bar for instant access
- **Visual App Management**: See all your Lando apps at a glance with running/stopped status indicators
- **Hierarchical Tree View**:
  - **Apps**: Root-level display of all detected Lando apps with status icons
  - **Services**: Expandable list of services with type-specific icons and running state
    - Visual icons identify service types at a glance: database, web server, cache, mail, search, and more
    - Color-coded status: green for running, gray for stopped
    - Hover for detailed tooltip with service category and status
  - **URLs**: Clickable URLs that open directly in your browser (shown when app is running)
  - **Info**: Database connection details (host, port, user, password) with one-click copy
  - **Tooling**: One-click access to tooling commands (drush, composer, npm, artisan, etc.)
- **Connection Info at a Glance**: See database credentials and connection details without touching the CLI
  - External connection info (host/port for connecting from your host machine)
  - Internal connection info (for container-to-container connections)
  - Database credentials (user, password, database name)
  - **One-Click Connection Strings**: Ready-to-use database URLs (e.g., `mysql://user:pass@localhost:32769/db`) - click to copy and paste directly into DBeaver, TablePlus, or your application config
  - Click any info item to copy its value to clipboard
- **Service Actions**: Right-click on services to SSH in or view logs for that specific service
- **Inline Actions**: Hover over items to see action buttons (Start, Stop, SSH, Copy URL, Copy Info)
- **Context Menus**: Right-click for full action menus on apps, services, URLs, and info items
- **Real-time Updates**: Status automatically refreshes when apps start or stop

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
- **Tooling Commands**: Run detected tooling (drush, composer, artisan, wp-cli, etc.) from Quick Pick
- **URL Access**: Open app URLs in browser or copy to clipboard
- **Environment Setup**: Easily configure PHP environment in active terminals
- **Settings Restoration**: Automatically restores original PHP settings on deactivation
- **Cross-platform**: Works on Windows, macOS, and Linux

#### 🖱️ **Context Menu Integration**
- **Right-Click Actions**: Access Lando commands directly from context menus
- **Explorer Context Menu**: Right-click on files/folders in the explorer to see Lando options
- **Editor Context Menu**: Right-click in `.lando.yml` files for quick access to commands
- **Smart Visibility**: Menu items adapt based on app state (shows "Start" when stopped, "Stop" when running)
- **Organized Submenu**: All commands grouped under a clean "Lando" submenu
- **SSH Terminal**: Open a terminal directly connected to any Lando service
- **View Service Logs**: Right-click a service in the tree view to view its logs in a terminal
- **Copy Connection Info**: One-click copy for database credentials and connection details
- **Rebuild Command**: Rebuild your Lando app with a confirmation dialog

#### 📚 **Documentation Access**
- **Quick Access**: Open Lando documentation directly from VS Code (`Ctrl+Shift+P` → "Lando: Open Documentation")
- **Categorized Docs**: Browse documentation organized by Getting Started, Configuration, Recipes, Services, and Troubleshooting
- **Context-Aware**: Shows relevant docs based on your active app's recipe and services
- **40+ Links**: Comprehensive coverage including all recipes, services, and common troubleshooting topics

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
- [ ] Integrated log viewer panel with filtering and search

### 🚀 Future Roadmap
- Automatic Xdebug configuration
- App creation wizard (GUI for `lando init`)
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
- **"Lando: Rebuild App"** - Rebuild the active Lando app (destroys and recreates containers)
- **"Lando: Open App URL"** - Open the app URL in your default browser
- **"Lando: Copy App URL"** - Copy the app URL to clipboard
- **"Lando: Open Terminal (SSH)"** - Open a terminal connected to a Lando service
- **"Lando: View Logs"** - View logs from Lando services
- **"Lando: Run Tooling Command"** - Run tooling commands (drush, composer, npm, etc.)
- **"Select Lando App"** - Choose which Lando app to use when multiple are detected
- **"Rescan for Lando Apps"** - Rescan the workspace for Lando apps
- **"Refresh Lando Status"** - Manually refresh the status bar indicator
- **"Enable Lando PHP Interpreter"** - Manually enable PHP integration
- **"Disable Lando PHP Interpreter"** - Restore original PHP settings
- **"Set PHP Environment in Terminal"** - Configure PHP alias in active terminal
- **"Check Lando Status"** - Check if your Lando app is running
- **"Refresh PHP Configuration"** - Refresh PHP settings
- **"Test PHP Wrapper"** - Test PHP integration in a new terminal
- **"Lando: Open Documentation"** - Browse categorized Lando docs with context-aware suggestions

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