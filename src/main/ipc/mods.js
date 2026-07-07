import { ipcMain } from 'electron'
import * as modrinthApi from '../services/modrinthApi.js'
import settingsStore from '../services/settingsStore.js'
import path from 'path'

export function registerModsIpc(mainWindow) {
  ipcMain.handle('mods:search', async (_event, query, filters) => {
    return await modrinthApi.searchMods({
      query: query || '',
      gameVersion: filters?.gameVersion || '',
      loader: filters?.loader || '',
      offset: filters?.offset || 0,
      limit: filters?.limit || 20,
      sortBy: filters?.sortBy || 'relevance'
    })
  })

  ipcMain.handle('mods:install', async (_event, projectId, versionId) => {
    const settings = settingsStore.getAll()
    const modsDir = path.join(settings.serverDir, 'mods')
    const metadataPath = path.join(settings.serverDir, 'mods-metadata.json')

    // Get version details - if no versionId, fetch latest compatible version
    let version
    if (versionId) {
      version = await modrinthApi.getVersion(versionId)
    } else {
      const versions = await modrinthApi.getProjectVersions(projectId, {
        gameVersion: settings.serverVersion,
        loader: settings.serverType === 'paper' ? 'paper' : settings.serverType
      })
      if (!versions || versions.length === 0) {
        throw new Error('No compatible version found for this mod')
      }
      version = versions[0]
    }
    const primaryFile = version.files.find(f => f.primary) || version.files[0]

    if (!primaryFile) throw new Error('No downloadable file found for this version')

    // Download main mod
    await modrinthApi.downloadMod(primaryFile.url, primaryFile.filename, modsDir)

    // Get project info for metadata
    const project = await modrinthApi.getProject(projectId)

    // Save metadata
    modrinthApi.saveModMetadata({
      projectId,
      versionId: version.id,
      slug: project.slug,
      title: project.title,
      description: project.description,
      iconUrl: project.icon_url,
      filename: primaryFile.filename,
      versionNumber: version.version_number,
      gameVersions: version.game_versions,
      loaders: version.loaders,
      fileSize: primaryFile.size,
      installedAt: new Date().toISOString()
    }, metadataPath)

    // Resolve and install dependencies
    try {
      const deps = await modrinthApi.resolveDependencies(
        version,
        settings.serverVersion,
        settings.serverType === 'paper' ? 'paper' : settings.serverType
      )
      for (const dep of deps) {
        await modrinthApi.downloadMod(dep.url, dep.filename, modsDir)
        const depProject = await modrinthApi.getProject(dep.projectId)
        modrinthApi.saveModMetadata({
          projectId: dep.projectId,
          versionId: dep.versionId,
          slug: depProject.slug,
          title: depProject.title,
          description: depProject.description,
          iconUrl: depProject.icon_url,
          filename: dep.filename,
          isDependency: true,
          installedAt: new Date().toISOString()
        }, metadataPath)
      }
    } catch (err) {
      console.error('Dependency resolution failed:', err.message)
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:progress', { percent: 100, done: true })
    }
  })

  ipcMain.handle('mods:uninstall', async (_event, filename) => {
    const settings = settingsStore.getAll()
    const modsDir = path.join(settings.serverDir, 'mods')
    const metadataPath = path.join(settings.serverDir, 'mods-metadata.json')
    modrinthApi.removeMod(filename, modsDir, metadataPath)
  })

  ipcMain.handle('mods:installed', async () => {
    const settings = settingsStore.getAll()
    const modsDir = path.join(settings.serverDir, 'mods')
    const metadataPath = path.join(settings.serverDir, 'mods-metadata.json')
    return modrinthApi.getInstalledMods(modsDir, metadataPath)
  })

  ipcMain.handle('mods:check-updates', async () => {
    const settings = settingsStore.getAll()
    const metadataPath = path.join(settings.serverDir, 'mods-metadata.json')
    const installed = modrinthApi.getInstalledMods(
      path.join(settings.serverDir, 'mods'),
      metadataPath
    )

    const updates = []
    for (const mod of installed) {
      try {
        const versions = await modrinthApi.getProjectVersions(mod.projectId, {
          gameVersion: settings.serverVersion,
          loader: settings.serverType
        })
        if (versions.length > 0 && versions[0].id !== mod.versionId) {
          updates.push({
            ...mod,
            latestVersionId: versions[0].id,
            latestVersionNumber: versions[0].version_number
          })
        }
      } catch { /* skip */ }
    }
    return updates
  })
}
