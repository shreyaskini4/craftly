# Craftly

Craftly is a modern, cross-platform desktop application built with Electron, React, and Vite that allows you to easily manage and host local Minecraft servers. Designed with a premium, Prism Launcher-inspired dark-mode interface, it brings all the power of server administration into an intuitive and user-friendly GUI.

## Features

- **One-Click Server Installation**: Download and setup Vanilla, Paper, or Fabric servers with just a click.
- **CDN-Resilient Downloads**: Server downloads employ bot-bypass headers and exponential backoff retry mechanisms to reliably fetch JARs even through Cloudflare-fronted CDNs.
- **Prism-style Version Picker**: Search, filter, and pin the latest or snapshot versions with a smooth and responsive UI during server creation.
- **Dynamic Mod Management**: Browse, search (with dynamic Modrinth API autofill), and install mods directly from Modrinth without leaving the app.
- **Accurate Real-time Monitoring**: Tracks your server's true RAM and CPU usage by scanning the process tree (isolating the actual Java child process), alongside live TPS (Ticks Per Second) charts and RCON integration.
- **Intelligent Server Importer**: Already have a server? Simply select its folder, and Craftly will automatically detect your `.jar` file and import it for seamless management.
- **Built-in Console**: View your server's live console output and send commands remotely through an interactive terminal interface.
- **Automated Backups**: Easily create and restore `.zip` backups of your server worlds directly from the GUI.
- **Settings & Configuration**: Configure Java paths, allocate minimum/maximum RAM (Xms/Xmx), and manage RCON properties visually.

## Tech Stack
- **Electron**: For the native desktop environment.
- **React**: For the dynamic and reactive user interface.
- **Vite & electron-vite**: For lightning-fast bundling and HMR.
- **Zustand**: For lightweight state management.
- **Recharts**: For dynamic, real-time performance graphs.
- **pidtree & pidusage**: For highly accurate child-process tree memory monitoring.
- **CSS Modules**: For premium, restrained dark-mode styling with native-feeling elevations.

## Getting Started

### Development
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the app in development mode.

### Building
To package the app into an executable for Windows:
```bash
npm run build
npm run dist
```
This will generate the `.exe` setup file in the `dist/` directory.
