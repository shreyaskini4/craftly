import { ipcMain } from 'electron'
import monitorService from '../services/monitorService.js'
import rconManager from '../services/rconClient.js'
import serverProcess from '../services/serverProcess.js'
import settingsStore from '../services/settingsStore.js'

let statusInterval = null
let statusPollInFlight = false

export function registerMonitoringIpc(mainWindow) {
  // Start monitoring when server starts
  serverProcess.on('started', () => {
    const pid = serverProcess.pid
    if (pid) {
      monitorService.removeAllListeners('stats')
      monitorService.removeAllListeners('monitor-error')
      monitorService.removeAllListeners('monitor-unavailable')

      monitorService.on('stats', (stats) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('monitoring:stats', stats)
        }
      })
      monitorService.on('monitor-error', (msg) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('monitoring:error', `Monitoring read failed: ${msg}`)
        }
      })
      monitorService.on('monitor-unavailable', (msg) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('monitoring:error', `Monitoring stopped: ${msg}`)
        }
      })

      monitorService.startMonitoring(pid)

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
  const poll = async () => {
    if (statusPollInFlight || !serverProcess.isRunning) return
    statusPollInFlight = true
    try {
      const serverStatus = await monitorService.queryServerStatus()
      let tps = null
      if (rconManager.isConnected) {
        tps = await rconManager.getTps()
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('monitoring:server-status', { ...serverStatus, tps })
      }
    } catch { /* ignore polling errors */
    } finally {
      statusPollInFlight = false
    }
  }
  poll()
  statusInterval = setInterval(poll, 10000)
}

function stopStatusPolling() {
  if (statusInterval) {
    clearInterval(statusInterval)
    statusInterval = null
  }
  statusPollInFlight = false
}
