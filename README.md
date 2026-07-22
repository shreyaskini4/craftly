# Craftly

**Craftly** is a modern, high-performance cross-platform desktop application for managing and hosting local Minecraft servers. Built with **Electron**, **React 19**, **Vite**, and **Zustand**, Craftly pairs a dark-mode interface with server management tools.

---

## Feature Overview

### Dashboard
- **Bento Grid Layout**: Dynamic dashboard presenting key server metrics at a glance.
- **TPS & System Monitoring**: Real-time Ticks Per Second (TPS) graphs alongside process-tree CPU and RAM usage tracking.
- **Uptime Tracker**: Live timer recording total server runtime.
- **Active Player Heads**: Dynamic rendering of online player skins and heads using Minecraft avatar APIs.

### Terminal & Interactive Console
- **Live Stream Terminal**: Interactive console stream for server `stdout` and `stderr`.
- **Formatted Logs**: Color-coded line formatting for server events, warnings, errors, and system output.
- **Command History**: Command buffer navigation for quickly re-sending commands.
- **Dual Execution Modes**: Send commands directly to stdin or via RCON protocol.

### File Manager & Code Editor
- **Path-Traversal Safe Browser**: Secure file explorer isolated to the server root directory.
- **Integrated Editor**: Built-in code and configuration editor with syntax highlighting.
- **File Operations**: Create, view, edit, rename, delete, and upload server configuration files (e.g. `server.properties`, `eula.txt`, YAML configs).

### Player Management
- **Online Player List**: Real-time listing of active players with avatars and ping stats.
- **Quick Admin Actions**: One-click Kick, Ban, Op, and Deop capabilities.
- **Whitelist & Banlist**: Dedicated interfaces for managing server whitelists, banned players, and IP bans.
- **Player Activity History**: Logs join/leave events and duration per player session.

### Mods & Version Picker
- **Multi-Engine Support**: One-click server downloading and auto-configuration for **Paper**, **Fabric**, and **Vanilla**.
- **Prism-Style Version Picker**: Search, filter, and select release or snapshot Minecraft versions.
- **Modrinth Mod Browser**: Search, filter, and install mods directly from Modrinth with automated dependency resolving and version matching.

### Backups & Restoration
- **One-Click Backups**: Instant creation of `.zip` server backups.
- **Scheduled Backups**: Automated background backup routines with custom frequency and retention limits.
- **Restoration**: One-click server state restoration from existing backups.

### Logs & Crash-Report Viewer
- **GZ Log Decompression**: Seamless extraction and reading of archived `.log.gz` files.
- **Log Search & Filtering**: Fast text search and regex filtering across historical logs.
- **Crash Report Parser**: Automated identification and formatted viewing of server crash reports (`crash-reports/`).

### Scheduled Restarts & Automation
- **Custom Timers**: Flexible scheduler for automated server restarts and routine commands.
- **In-Game Warning Broadcasts**: Configurable countdown warning messages broadcast to in-game players before restart.

### Discord Webhook Integration
- **Rich Embed Notifications**: Instant Discord alerts for server start, stop, crash, and automated backups.
- **Color-Coded Statuses**: Distinct embed colors and detailed stats (player count, uptime, crash stack traces).

### Crash Auto-Restart & Safety
- **Automatic Recovery**: Automatic server restarting upon unhandled crashes.
- **Exponential Backoff & Caps**: Exponential backoff timing and retry caps to prevent infinite crash loops when configuration errors occur.

### Java Auto-Provisioning
- **Smart Java Detection**: Automatic scanning of installed system JRE/JDK paths.
- **Adoptium JRE Auto-Download**: Auto-provisions and installs the appropriate Adoptium Java version (Java 8, 17, 21, etc.) matched to the server's required Minecraft release.

### Cross-Platform Distribution
- **Multi-Platform Support**: Built for Windows, macOS, and Linux platforms.
- **Auto-Updates**: Built-in update delivery powered by `electron-updater`.

---

## Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/)
- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Charts & Visualizations**: [Recharts](https://recharts.org/)
- **Icons & UI Feedback**: [Lucide React](https://lucide.dev/), [Sonner](https://sonner.emilkowal.si/)
- **Process Monitoring**: `pidtree` & `pidusage` for process-tree resource tracking
- **Minecraft Utilities**: `minecraft-server-util`, `rcon-client`
- **Archiving & Files**: `archiver`, `extract-zip`
- **Build Tooling**: `electron-vite`, `electron-builder`

---

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18 or higher recommended) and `npm` installed.

### Setup Instructions

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/shreyaskini4/craftly.git
   cd craftly
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

### Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the app in development mode with Hot Module Replacement (HMR). |
| `npm run build` | Compiles frontend and main process assets for production. |
| `npm test` | Runs the test suite / linter checks. |
| `npm run dist` | Packages the application executable for the default host platform (Windows). |
| `npm run dist:win` | Packages the application as a Windows installer (`.exe`). |
| `npm run dist:mac` | Packages the application for macOS (`.dmg` / `.app`). |
| `npm run dist:linux` | Packages the application for Linux distributions (`.AppImage` / `.deb`). |
| `npm run dist:all` | Packages executables across Windows, macOS, and Linux targets simultaneously. |

---

## License

This project is licensed under the MIT License.
