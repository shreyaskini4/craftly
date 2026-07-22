import { ipcMain, shell } from 'electron'
import backupManager from '../services/backupManager.js'
import serverProcess from '../services/serverProcess.js'
import settingsStore from '../services/settingsStore.js'

export function registerBackupsIpc(mainWindow) {
  ipcMain.handle('backups:create', async () => {
    const settings = settingsStore.getAll()

    backupManager.removeAllListeners('progress')
    backupManager.on('progress', (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backup:progress', progress)
      }
    })

    return await backupManager.createBackup(settings.serverDir, settings.backupsDir)
  })

  ipcMain.handle('backups:restore', async (_event, backupPath) => {
    if (serverProcess.isRunning) {
      throw new Error('Cannot restore backup while the server is running. Please stop the server first.')
    }
    const settings = settingsStore.getAll()

    try {
      await backupManager.createBackup(settings.serverDir, settings.backupsDir, 'pre-restore-safety')
    } catch (err) {
      console.warn('Failed to create pre-restore safety backup:', err)
    }

    await backupManager.restoreBackup(backupPath, settings.serverDir)
  })

  ipcMain.handle('backups:delete', async (_event, backupPath) => {
    await backupManager.deleteBackup(backupPath)
  })

  ipcMain.handle('backups:list', async () => {
    const settings = settingsStore.getAll()
    return backupManager.listBackups(settings.backupsDir)
  })

  ipcMain.handle('backups:set-schedule', async (_event, hours) => {
    const settings = settingsStore.getAll()
    if (hours > 0) {
      backupManager.startAutoBackup(hours, settings.serverDir, settings.backupsDir)
      settingsStore.set('autoBackupEnabled', true)
      settingsStore.set('autoBackupInterval', hours)
    } else {
      backupManager.stopAutoBackup()
      settingsStore.set('autoBackupEnabled', false)
    }
  })

  ipcMain.handle('backups:get-schedule', async () => {
    return {
      enabled: settingsStore.get('autoBackupEnabled'),
      intervalHours: settingsStore.get('autoBackupInterval')
    }
  })

  ipcMain.handle('backups:open-folder', async () => {
    const settings = settingsStore.getAll()
    const backupsDir = settings.backupsDir
    await shell.openPath(backupsDir)
  })
}
