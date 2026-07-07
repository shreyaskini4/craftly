import { ipcMain } from 'electron'
import serverProcess from '../services/serverProcess.js'
import settingsStore from '../services/settingsStore.js'
import path from 'path'
import fs from 'fs'

let lineHandler = null

export function registerServerIpc(mainWindow) {
  ipcMain.handle('server:start', async () => {
    const settings = settingsStore.getAll()
    const serverDir = settings.serverDir
    const jarName = settings.serverJar || 'server.jar'
    const jarPath = path.join(serverDir, jarName)

    if (!fs.existsSync(jarPath)) {
      throw new Error(`Server jar (${jarName}) not found. Please download a server version first in Settings or import a valid server directory.`)
    }

    const config = {
      javaPath: settings.javaPath || 'java',
      jarPath,
      xmx: settings.xmx || '4G',
      xms: settings.xms || '2G',
      serverDir
    }

    // Remove old listener if exists
    if (lineHandler) {
      serverProcess.removeListener('line', lineHandler)
    }

    // Forward console lines to renderer
    lineHandler = (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('console:line', data)
      }
    }
    serverProcess.on('line', lineHandler)

    // Forward status changes
    const statusHandler = (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server:status-change', status)
      }
    }
    serverProcess.removeAllListeners('status')
    serverProcess.on('status', statusHandler)

    await serverProcess.start(config)
  })

  ipcMain.handle('server:stop', async () => {
    await serverProcess.stop()
  })

  ipcMain.handle('server:restart', async () => {
    await serverProcess.restart()
  })

  ipcMain.handle('server:send-command', async (_event, cmd) => {
    serverProcess.sendCommand(cmd)
  })

  ipcMain.handle('server:status', async () => {
    return serverProcess.getStatus()
  })
}
