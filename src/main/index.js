import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import serverProcess from './services/serverProcess.js'
import settingsStore from './services/settingsStore.js'
import { registerServerIpc } from './ipc/server.js'
import { registerVersionsIpc } from './ipc/versions.js'
import { registerModsIpc } from './ipc/mods.js'
import { registerBackupsIpc } from './ipc/backups.js'
import { registerMonitoringIpc } from './ipc/monitoring.js'
import { registerSettingsIpc } from './ipc/settings.js'
import { registerFilesIpc } from './ipc/files.js'
import { registerWebhooksIpc } from './ipc/webhooks.js'
import { registerPlayersIpc } from './ipc/players.js'
import { registerSchedulerIpc } from './ipc/scheduler.js'
import { registerLogsIpc } from './ipc/logs.js'
import schedulerService from './services/schedulerService.js'
import './services/webhookService.js'
import './services/playerManager.js'

let mainWindow = null

// Configure autoUpdater if app is packaged
if (app.isPackaged) {
  autoUpdater.logger = console

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available:', info)
  })

  autoUpdater.on('error', (err) => {
    console.error('Error in auto-updater:', err)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info)
    dialog.showMessageBox(mainWindow || null, {
      type: 'question',
      buttons: ['Restart & Update', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update Available',
      message: 'A new version of Craftly has been downloaded. Would you like to restart and apply the update now?'
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#111111',
    icon: join(__dirname, '../../build/icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#111111',
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
  registerFilesIpc(mainWindow)
  registerWebhooksIpc(mainWindow)
  registerPlayersIpc(mainWindow)
  registerSchedulerIpc(mainWindow)
  registerLogsIpc(mainWindow)

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

  // Initialize all jobs on startup
  schedulerService.initAllJobs()

  createWindow()

  // Check for updates on launch when packaged
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify()
  }

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
