import { ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import settingsStore from '../services/settingsStore.js'
import { detectJava, validateJavaPath } from '../utils/javaDetector.js'
import { readProperties, writeProperties } from '../utils/serverProperties.js'

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
      const dirPath = result.filePaths[0]
      let jars = []
      let hasEula = false
      let hasProperties = false
      let hasWorld = false
      let inferredType = 'vanilla'
      
      try {
        const files = fs.readdirSync(dirPath)
        jars = files.filter(f => f.endsWith('.jar'))
        
        hasEula = fs.existsSync(path.join(dirPath, 'eula.txt'))
        hasProperties = fs.existsSync(path.join(dirPath, 'server.properties'))
        hasWorld = fs.existsSync(path.join(dirPath, 'world', 'level.dat'))
        
        if (jars.some(f => f.toLowerCase().includes('paper'))) {
          inferredType = 'paper'
        } else if (jars.some(f => f.toLowerCase().includes('forge'))) {
          inferredType = 'forge'
        } else if (jars.some(f => f.toLowerCase().includes('fabric'))) {
          inferredType = 'fabric'
        }
      } catch (err) {
        console.error('Failed to scan directory:', err)
      }
      
      return { dirPath, jars, hasEula, hasProperties, hasWorld, inferredType }
    }
    return null
  })

  ipcMain.handle('settings:import-server', async (_event, data) => {
    const { dirPath, jarFile, serverType } = data
    if (dirPath) settingsStore.set('serverDir', dirPath)
    if (jarFile) settingsStore.set('serverJar', jarFile)
    if (serverType) settingsStore.set('serverType', serverType)
    return true
  })

  ipcMain.handle('settings:detect-java', async () => {
    return await detectJava()
  })

  ipcMain.handle('settings:check-dir-empty', async (_event, dirPath) => {
    try {
      if (!fs.existsSync(dirPath)) {
        return true
      }
      const files = fs.readdirSync(dirPath)
      return files.length === 0
    } catch (err) {
      console.error('Failed to check directory:', err)
      return false
    }
  })

  ipcMain.handle('properties:read', async () => {
    const serverDir = settingsStore.get('serverDir')
    if (!serverDir) throw new Error('Server directory not set')
    return await readProperties(serverDir)
  })

  ipcMain.handle('properties:write', async (_event, props) => {
    const serverDir = settingsStore.get('serverDir')
    if (!serverDir) throw new Error('Server directory not set')
    return await writeProperties(serverDir, props)
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
