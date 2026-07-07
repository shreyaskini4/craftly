import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { downloadFile } from '../utils/download.js'

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { headers: { 'User-Agent': 'mc-server-gui/1.0.0' } }, (res) => {
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
  return manifest.versions
    .filter(v => v.type === 'release')
    .map(v => ({ id: v.id, type: v.type, releaseTime: v.releaseTime }))
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
    const data = await fetchJson('https://api.papermc.io/v2/projects/paper')
    return data.versions || []
  } catch (err) {
    console.error('Failed to fetch Paper versions:', err.message)
    return []
  }
}

export async function fetchPaperBuilds(version) {
  try {
    const data = await fetchJson(`https://api.papermc.io/v2/projects/paper/versions/${version}`)
    return data.builds || []
  } catch (err) {
    console.error('Failed to fetch Paper builds:', err.message)
    return []
  }
}

export async function downloadPaperServer(version, build, serverDir, onProgress) {
  const filename = `paper-${version}-${build}.jar`
  const url = `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${build}/downloads/${filename}`
  const destPath = path.join(serverDir, 'server.jar')
  fs.mkdirSync(serverDir, { recursive: true })
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
