import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { downloadFile } from '../utils/download.js'

const BASE_URL = 'https://api.modrinth.com/v2'
const USER_AGENT = 'craftly/1.0.0'

function fetchJson(urlPath) {
  const url = urlPath.startsWith('http') ? urlPath : `${BASE_URL}${urlPath}`
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('Invalid JSON')) }
      })
      res.on('error', reject)
    }).on('error', reject)
  })
}

export async function searchMods({ query = '', gameVersion, loader, offset = 0, limit = 20, sortBy = 'relevance' }) {
  const facets = [['project_type:mod']]
  if (gameVersion) facets.push([`versions:${gameVersion}`])
  if (loader) facets.push([`categories:${loader}`])

  const params = new URLSearchParams({
    query,
    offset: String(offset),
    limit: String(limit),
    index: sortBy,
    facets: JSON.stringify(facets)
  })

  const data = await fetchJson(`/search?${params.toString()}`)
  return {
    hits: data.hits || [],
    totalHits: data.total_hits || 0,
    offset: data.offset || 0,
    limit: data.limit || 20
  }
}

export async function getProject(idOrSlug) {
  return fetchJson(`/project/${encodeURIComponent(idOrSlug)}`)
}

export async function getProjectVersions(idOrSlug, { gameVersion, loader } = {}) {
  const params = new URLSearchParams()
  if (gameVersion) params.set('game_versions', JSON.stringify([gameVersion]))
  if (loader) params.set('loaders', JSON.stringify([loader]))
  const qs = params.toString()
  return fetchJson(`/project/${encodeURIComponent(idOrSlug)}/version${qs ? '?' + qs : ''}`)
}

export async function getVersion(versionId) {
  return fetchJson(`/version/${versionId}`)
}

export async function downloadMod(fileUrl, filename, modsDir) {
  fs.mkdirSync(modsDir, { recursive: true })
  const destPath = path.join(modsDir, filename)
  await downloadFile(fileUrl, destPath)
  return destPath
}

export async function resolveDependencies(version, gameVersion, loader, resolved = new Set()) {
  const deps = []
  if (!version.dependencies) return deps

  for (const dep of version.dependencies) {
    if (dep.dependency_type !== 'required') continue
    const projectId = dep.project_id
    if (!projectId || resolved.has(projectId)) continue
    resolved.add(projectId)

    try {
      let depVersion
      if (dep.version_id) {
        depVersion = await getVersion(dep.version_id)
      } else {
        const versions = await getProjectVersions(projectId, { gameVersion, loader })
        depVersion = versions[0]
      }

      if (depVersion && depVersion.files && depVersion.files.length > 0) {
        const primaryFile = depVersion.files.find(f => f.primary) || depVersion.files[0]
        deps.push({
          projectId,
          versionId: depVersion.id,
          filename: primaryFile.filename,
          url: primaryFile.url
        })
        const subDeps = await resolveDependencies(depVersion, gameVersion, loader, resolved)
        deps.push(...subDeps)
      }
    } catch (err) {
      console.error(`Failed to resolve dependency ${projectId}:`, err.message)
    }
  }
  return deps
}

export function getInstalledMods(modsDir, metadataPath) {
  try {
    if (!fs.existsSync(metadataPath)) return []
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    return metadata.filter(mod => {
      const filePath = path.join(modsDir, mod.filename)
      return fs.existsSync(filePath)
    })
  } catch {
    return []
  }
}

export function saveModMetadata(mod, metadataPath) {
  let metadata = []
  try {
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    }
  } catch { /* start fresh */ }

  const existing = metadata.findIndex(m => m.projectId === mod.projectId)
  if (existing >= 0) {
    metadata[existing] = mod
  } else {
    metadata.push(mod)
  }

  fs.mkdirSync(path.dirname(metadataPath), { recursive: true })
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
}

export function removeMod(filename, modsDir, metadataPath) {
  const filePath = path.join(modsDir, filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }

  try {
    if (fs.existsSync(metadataPath)) {
      let metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
      metadata = metadata.filter(m => m.filename !== filename)
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
    }
  } catch { /* ignore */ }
}
