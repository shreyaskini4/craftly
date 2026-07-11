import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { downloadFile } from '../utils/download.js'

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { headers: { 'User-Agent': 'craftly/1.0.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('Invalid JSON response')) }
      })
      res.on('error', reject)
    }).on('error', reject)
  })
}

export async function fetchVanillaVersions() {
  const manifest = await fetchJson('https://launchermeta.mojang.com/mc/game/version_manifest.json')
  return manifest.versions.map(v => ({ id: v.id, type: v.type, releaseTime: v.releaseTime }))
}

export async function downloadVanillaServer(versionId, serverDir, onProgress) {
  const manifest = await fetchJson('https://launchermeta.mojang.com/mc/game/version_manifest.json')
  const version = manifest.versions.find(v => v.id === versionId)
  if (!version) throw new Error(`Version ${versionId} not found`)

  const versionData = await fetchJson(version.url)
  if (!versionData.downloads || !versionData.downloads.server) {
    throw new Error(`No server download available for ${versionId}`)
  }

  const serverUrl = versionData.downloads.server.url
  const destPath = path.join(serverDir, 'server.jar')
  fs.mkdirSync(serverDir, { recursive: true })
  await downloadFile(serverUrl, destPath, onProgress)
  return destPath
}

export async function fetchPaperVersions() {
  try {
    const data = await fetchJson('https://mcutils.com/api/server-jars/paper')
    if (Array.isArray(data)) {
      return data.map(d => d.version)
    }
    return []
  } catch (err) {
    console.error('Failed to fetch Paper versions:', err.message)
    return []
  }
}

export async function fetchPaperBuilds(version) {
  // mcutils abstracts away builds and always provides the latest build for a given version.
  return ['latest']
}

export async function downloadPaperServer(version, build, serverDir, onProgress) {
  // We use the mcutils download endpoint, ignoring the specific build string (since it's 'latest')
  const url = `https://mcutils.com/api/server-jars/paper/${version.toLowerCase()}/download`
  const destPath = path.join(serverDir, 'server.jar')
  fs.mkdirSync(serverDir, { recursive: true })
  
  // downloadFile now handles User-Agent spoofing and redirects natively.
  await downloadFile(url, destPath, onProgress)
  return destPath
}

export async function fetchFabricVersions() {
  try {
    const versions = await fetchJson('https://meta.fabricmc.net/v2/versions/game')
    return versions.filter(v => v.stable).map(v => ({ id: v.version, stable: v.stable }))
  } catch (err) {
    console.error('Failed to fetch Fabric versions:', err.message)
    return []
  }
}

export async function fetchFabricLoaders(gameVersion) {
  try {
    const loaders = await fetchJson(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`)
    return loaders
      .filter(l => l.loader.stable)
      .map(l => ({ version: l.loader.version, stable: l.loader.stable }))
  } catch (err) {
    console.error('Failed to fetch Fabric loaders:', err.message)
    return []
  }
}

export async function downloadFabricServer(gameVersion, loaderVersion, serverDir, onProgress) {
  if (!loaderVersion) {
    const loaders = await fetchJson('https://meta.fabricmc.net/v2/versions/loader')
    loaderVersion = loaders.find(l => l.stable)?.version || loaders[0]?.version
  }

  const installers = await fetchJson('https://meta.fabricmc.net/v2/versions/installer')
  const installerVersion = installers.find(i => i.stable)?.version || '1.0.1'
  const url = `https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loaderVersion}/${installerVersion}/server/jar`
  const destPath = path.join(serverDir, 'server.jar')
  fs.mkdirSync(serverDir, { recursive: true })
  await downloadFile(url, destPath, onProgress)
  return destPath
}

export async function acceptEula(serverDir) {
  const eulaPath = path.join(serverDir, 'eula.txt')
  fs.writeFileSync(eulaPath, '#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\neula=true\n')
}
