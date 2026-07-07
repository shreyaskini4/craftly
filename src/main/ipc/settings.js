import { ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import settingsStore from '../services/settingsStore.js'
import { detectJava, validateJavaPath } from '../utils/javaDetector.js'

export function registerSettingsIpc(mainWindow) {
  ipcMain.handle('settings:get', async () => {
    return settingsStore.getAll()
  })

  ipcMain.handle('settings:set', async (_event, key, value) => {
    settingsStore.set(key, value)
  })

  ipcMain.handle('settings:browse-java', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Java Executable',
      properties: ['openFile'],
      filters: [
        { name: 'Java Executable', extensions: ['exe'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const javaPath = result.filePaths[0]
      const isValid = await validateJavaPath(javaPath)
      if (isValid) {
        settingsStore.set('javaPath', javaPath)
        return javaPath
      } else {
        throw new Error('The selected file is not a valid Java executable')
      }
    }
    return null
  })

  ipcMain.handle('settings:browse-dir', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Server Directory',
      properties: ['openDirectory', 'createDirectory']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const dir = result.filePaths[0]
      settingsStore.set('serverDir', dir)
      
      try {
        const files = fs.readdirSync(dir)
        const jarFiles = files.filter(f => f.endsWith('.jar'))
        if (jarFiles.length > 0) {
          let selectedJar = jarFiles.find(f => f === 'server.jar' || f.includes('paper') || f.includes('forge') || f.includes('fabric'))
          if (!selectedJar) selectedJar = jarFiles[0]
          settingsStore.set('serverJar', selectedJar)
        }
      } catch (err) {
        console.error('Failed to scan for jar files:', err)
      }
      
      return dir
    }
    return null
  })

  ipcMain.handle('settings:detect-java', async () => {
    return await detectJava()
  })

  // Window controls
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })
}
