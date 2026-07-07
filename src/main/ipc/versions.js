import { ipcMain } from 'electron'
import * as versionManager from '../services/versionManager.js'
import settingsStore from '../services/settingsStore.js'

export function registerVersionsIpc(mainWindow) {
  ipcMain.handle('versions:fetch-vanilla', async () => {
    return await versionManager.fetchVanillaVersions()
  })

  ipcMain.handle('versions:fetch-paper', async () => {
    return await versionManager.fetchPaperVersions()
  })

  ipcMain.handle('versions:fetch-paper-builds', async (_event, version) => {
    return await versionManager.fetchPaperBuilds(version)
  })

  ipcMain.handle('versions:fetch-fabric', async () => {
    return await versionManager.fetchFabricVersions()
  })

  ipcMain.handle('versions:fetch-fabric-loaders', async (_event, gameVersion) => {
    return await versionManager.fetchFabricLoaders(gameVersion)
  })

  ipcMain.handle('versions:download', async (_event, type, version, build) => {
    const serverDir = settingsStore.get('serverDir')

    const onProgress = (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download:progress', progress)
      }
    }

    switch (type) {
      case 'vanilla':
        await versionManager.downloadVanillaServer(version, serverDir, onProgress)
        break
      case 'paper':
        await versionManager.downloadPaperServer(version, build, serverDir, onProgress)
        break
      case 'fabric':
        await versionManager.downloadFabricServer(version, build, serverDir, onProgress)
        break
      default:
        throw new Error(`Unknown server type: ${type}`)
    }

    // Save version info to settings
    settingsStore.set('serverType', type)
    settingsStore.set('serverVersion', version)
    if (build) settingsStore.set('serverBuild', String(build))

    // Auto-accept EULA
    await versionManager.acceptEula(serverDir)
  })

  ipcMain.handle('versions:accept-eula', async () => {
    const serverDir = settingsStore.get('serverDir')
    await versionManager.acceptEula(serverDir)
  })
}
