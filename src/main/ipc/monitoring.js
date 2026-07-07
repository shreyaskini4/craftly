import { ipcMain } from 'electron'
import monitorService from '../services/monitorService.js'
import rconManager from '../services/rconClient.js'
import serverProcess from '../services/serverProcess.js'
import settingsStore from '../services/settingsStore.js'

let statusInterval = null

export function registerMonitoringIpc(mainWindow) {
  // Start monitoring when server starts
  serverProcess.on('started', () => {
    const pid = serverProcess.pid
    if (pid) {
      monitorService.startMonitoring(pid)

      // Forward stats to renderer
      monitorService.removeAllListeners('stats')
      monitorService.on('stats', (stats) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('monitoring:stats', stats)
        }
      })

      // Start polling server status and TPS
      startStatusPolling(mainWindow)

      // Try to connect RCON after a delay
      setTimeout(async () => {
        const settings = settingsStore.getAll()
        if (settings.rconEnabled) {
          try {
            const connected = await rconManager.connect('localhost', settings.rconPort, settings.rconPassword)
            if (!connected) {
              console.error('RCON Auth failed')
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('monitoring:error', 'RCON Connection Failed')
              }
            }
          } catch (err) {
            console.error('RCON Auth failed', err)
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('monitoring:error', 'RCON Connection Failed')
            }
          }
        }
      }, 10000)
    }
  })

  // Stop monitoring when server stops
  serverProcess.on('stopped', () => {
    monitorService.stopMonitoring()
    stopStatusPolling()
    rconManager.disconnect()
  })

  ipcMain.handle('monitoring:get-stats', async () => {
    const serverStatus = await monitorService.queryServerStatus()
    let tps = null
    if (rconManager.isConnected) {
      tps = await rconManager.getTps()
    }
    return { serverStatus, tps }
  })
}

function startStatusPolling(mainWindow) {
  stopStatusPolling()
  statusInterval = setInterval(async () => {
    try {
      const serverStatus = await monitorService.queryServerStatus()
      let tps = null
      if (rconManager.isConnected) {
        tps = await rconManager.getTps()
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('monitoring:stats', {
          ...serverStatus,
          tps,
          type: 'server-status'
        })
      }
    } catch { /* ignore polling errors */ }
  }, 5000)
}

function stopStatusPolling() {
  if (statusInterval) {
    clearInterval(statusInterval)
    statusInterval = null
  }
}
