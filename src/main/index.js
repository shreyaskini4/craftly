import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import serverProcess from './services/serverProcess.js'
import settingsStore from './services/settingsStore.js'
import { registerServerIpc } from './ipc/server.js'
import { registerVersionsIpc } from './ipc/versions.js'
import { registerModsIpc } from './ipc/mods.js'
import { registerBackupsIpc } from './ipc/backups.js'
import { registerMonitoringIpc } from './ipc/monitoring.js'
import { registerSettingsIpc } from './ipc/settings.js'

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0d1117',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0d1117',
      symbolColor: '#8b949e',
      height: 36
    },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: join(__dirname, '../preload/index.js')
    },
    show: false
  })

  // Show window when ready to prevent visual flash
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Register all IPC handlers
  registerServerIpc(mainWindow)
  registerVersionsIpc(mainWindow)
  registerModsIpc(mainWindow)
  registerBackupsIpc(mainWindow)
  registerMonitoringIpc(mainWindow)
  registerSettingsIpc(mainWindow)

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Ensure directories exist
  settingsStore.ensureDirectories()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up server process on quit
app.on('will-quit', () => {
  if (serverProcess.isRunning) {
    serverProcess.kill()
  }
})

app.on('before-quit', () => {
  if (serverProcess.isRunning) {
    serverProcess.kill()
  }
})
