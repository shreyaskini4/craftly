import { ipcMain } from 'electron'
import rconManager from '../services/rconClient.js'
import settingsStore from '../services/settingsStore.js'
import playerManager from '../services/playerManager.js'

function ensureRconConnected() {
  if (!rconManager.connected) {
    throw new Error('RCON is not connected. The server must be running to perform this action.')
  }
}

export function registerPlayersIpc(mainWindow) {
  ipcMain.handle('players:kick', async (_event, name, reason) => {
    ensureRconConnected()
    const command = reason ? `kick ${name} ${reason}` : `kick ${name}`
    return await rconManager.sendCommand(command)
  })

  ipcMain.handle('players:ban', async (_event, name, reason) => {
    ensureRconConnected()
    const command = reason ? `ban ${name} ${reason}` : `ban ${name}`
    return await rconManager.sendCommand(command)
  })

  ipcMain.handle('players:unban', async (_event, name) => {
    ensureRconConnected()
    return await rconManager.sendCommand(`pardon ${name}`)
  })

  ipcMain.handle('players:op', async (_event, name) => {
    ensureRconConnected()
    return await rconManager.sendCommand(`op ${name}`)
  })

  ipcMain.handle('players:deop', async (_event, name) => {
    ensureRconConnected()
    return await rconManager.sendCommand(`deop ${name}`)
  })

  ipcMain.handle('players:whitelist-add', async (_event, name) => {
    ensureRconConnected()
    return await rconManager.sendCommand(`whitelist add ${name}`)
  })

  ipcMain.handle('players:whitelist-remove', async (_event, name) => {
    ensureRconConnected()
    return await rconManager.sendCommand(`whitelist remove ${name}`)
  })

  ipcMain.handle('players:get-state', async () => {
    return {
      ops: playerManager.getOps(),
      whitelist: playerManager.getWhitelist(),
      banned: playerManager.getBannedPlayers()
    }
  })

  ipcMain.handle('players:get-history', async () => {
    return playerManager.getHistory()
  })
}
