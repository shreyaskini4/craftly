import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import extractZip from 'extract-zip'
import { downloadFile } from '../utils/download.js'
import settingsStore from './settingsStore.js'
import { saveModMetadata } from './modrinthApi.js'

/**
 * Parses and validates a modrinth.index.json manifest.
 *
 * @param {string|object} manifestInput - JSON string, file path, or object
 * @returns {object} Parsed manifest
 */
export function parseManifest(manifestInput) {
  let manifest
  if (typeof manifestInput === 'string') {
    try {
      manifest = JSON.parse(manifestInput)
    } catch {
      if (fs.existsSync(manifestInput)) {
        manifest = JSON.parse(fs.readFileSync(manifestInput, 'utf-8'))
      } else {
        throw new Error('Invalid JSON string or manifest file not found')
      }
    }
  } else if (typeof manifestInput === 'object' && manifestInput !== null) {
    manifest = manifestInput
  } else {
    throw new Error('Manifest input must be a JSON string, object, or file path')
  }

  if (!manifest || typeof manifest !== 'object') {
    throw new Error('Invalid modrinth.index.json manifest')
  }

  if (!manifest.game) {
    throw new Error('Manifest missing "game" field')
  }

  if (!manifest.name) {
    throw new Error('Manifest missing "name" field')
  }

  return {
    formatVersion: manifest.formatVersion ?? 1,
    game: manifest.game,
    versionId: manifest.versionId || '',
    name: manifest.name,
    summary: manifest.summary || '',
    files: Array.isArray(manifest.files) ? manifest.files : [],
    dependencies: manifest.dependencies && typeof manifest.dependencies === 'object' ? manifest.dependencies : {}
  }
}

/**
 * Filters files to only those supported on the server environment.
 *
 * @param {Array<object>} files - Files array from manifest
 * @returns {Array<object>} Filtered files array
 */
export function filterServerFiles(files = []) {
  if (!Array.isArray(files)) return []
  return files.filter((file) => {
    if (!file || !file.path) return false
    if (!Array.isArray(file.downloads) || file.downloads.length === 0) return false
    if (file.env && file.env.server === 'unsupported') return false
    return true
  })
}

/**
 * Validates compatibility of dependencies against server settings.
 *
 * @param {object} dependencies - Dependencies object from manifest
 * @param {object} [settings] - Server settings override
 * @returns {{ compatible: boolean, warnings: string[], warning: string }}
 */
export function validateCompatibility(dependencies = {}, settings = null) {
  const currentSettings = settings || settingsStore.getAll() || {}
  const warnings = []

  const serverVersion = currentSettings.serverVersion
  const serverType = currentSettings.serverType

  if (dependencies.minecraft && serverVersion && dependencies.minecraft !== serverVersion) {
    warnings.push(
      `Modpack Minecraft version (${dependencies.minecraft}) does not match server version (${serverVersion}).`
    )
  }

  if (dependencies['fabric-loader'] && serverType && serverType !== 'fabric') {
    warnings.push(`Modpack requires Fabric loader, but current server type is "${serverType}".`)
  } else if (dependencies.forge && serverType && serverType !== 'forge') {
    warnings.push(`Modpack requires Forge loader, but current server type is "${serverType}".`)
  } else if (dependencies.neoforge && serverType && serverType !== 'neoforge') {
    warnings.push(`Modpack requires NeoForge loader, but current server type is "${serverType}".`)
  } else if (dependencies.quilt && serverType && serverType !== 'quilt') {
    warnings.push(`Modpack requires Quilt loader, but current server type is "${serverType}".`)
  }

  return {
    compatible: warnings.length === 0,
    warnings,
    warning: warnings.join(' ')
  }
}

/**
 * Verifies file checksums (sha512 or sha1).
 *
 * @param {string} filePath - Absolute path to the file
 * @param {object} hashes - Hashes object { sha1, sha512 }
 * @returns {boolean} True if verified
 */
export function verifyHash(filePath, hashes) {
  if (!hashes || typeof hashes !== 'object') return true
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found for hash verification: ${filePath}`)
  }

  const content = fs.readFileSync(filePath)

  if (hashes.sha512) {
    const hash = crypto.createHash('sha512').update(content).digest('hex')
    if (hash.toLowerCase() !== hashes.sha512.toLowerCase()) {
      throw new Error(`SHA-512 mismatch for ${path.basename(filePath)}: expected ${hashes.sha512}, got ${hash}`)
    }
  } else if (hashes.sha1) {
    const hash = crypto.createHash('sha1').update(content).digest('hex')
    if (hash.toLowerCase() !== hashes.sha1.toLowerCase()) {
      throw new Error(`SHA-1 mismatch for ${path.basename(filePath)}: expected ${hashes.sha1}, got ${hash}`)
    }
  }

  return true
}

/**
 * Copies a directory recursively.
 *
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

/**
 * Imports a Modrinth .mrpack archive into the server directory.
 *
 * @param {string} mrpackPath - Path to .mrpack archive file
 * @param {string} [targetServerDir] - Destination server directory
 * @param {function} [onProgress] - Progress callback: ({ current, total, name, percent })
 * @returns {Promise<{ name: string, versionId: string, totalInstalled: number, files: Array<object>, warning?: string }>}
 */
export async function importMrpack(mrpackPath, targetServerDir = null, onProgress = null) {
  if (!mrpackPath || !fs.existsSync(mrpackPath)) {
    throw new Error(`Modpack file not found: ${mrpackPath}`)
  }

  const settings = settingsStore.getAll() || {}
  const serverDir = targetServerDir || settings.serverDir

  if (!serverDir) {
    throw new Error('Server directory not configured')
  }

  fs.mkdirSync(serverDir, { recursive: true })
  const metadataPath = path.join(serverDir, 'mods-metadata.json')

  // Create temporary extraction directory
  const tempDir = path.join(
    os.tmpdir(),
    `craftly-mrpack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  )
  fs.mkdirSync(tempDir, { recursive: true })

  try {
    // 1. Extract .mrpack archive
    await extractZip(mrpackPath, { dir: tempDir })

    // 2. Read and parse modrinth.index.json
    const indexPath = path.join(tempDir, 'modrinth.index.json')
    if (!fs.existsSync(indexPath)) {
      throw new Error('Invalid .mrpack archive: modrinth.index.json not found')
    }

    const manifest = parseManifest(indexPath)

    // 3. Validate compatibility with settingsStore
    const compatibility = validateCompatibility(manifest.dependencies, settings)
    if (!compatibility.compatible) {
      console.warn(`[Modpack Import Warning]: ${compatibility.warning}`)
    }

    // 4. Filter server-compatible files
    const serverFiles = filterServerFiles(manifest.files)
    const totalFiles = serverFiles.length
    const installedFiles = []
    let installedCount = 0

    // 5. Download server-compatible files
    for (let i = 0; i < totalFiles; i++) {
      const file = serverFiles[i]
      const destPath = path.join(serverDir, file.path)
      const filename = path.basename(file.path)
      const downloadUrl = file.downloads[0]

      // Download file to destination
      await downloadFile(downloadUrl, destPath)

      // Verify hashes if provided
      if (file.hashes) {
        verifyHash(destPath, file.hashes)
      }

      installedCount++
      const percent = totalFiles > 0 ? Math.round((installedCount / totalFiles) * 100) : 100

      if (onProgress && typeof onProgress === 'function') {
        onProgress({
          current: installedCount,
          total: totalFiles,
          name: filename,
          percent
        })
      }

      // Record metadata for mods
      const fileSize = file.fileSize || (fs.existsSync(destPath) ? fs.statSync(destPath).size : 0)
      const projectId = file.projectId || path.basename(file.path, path.extname(file.path))
      const title = file.title || path.basename(file.path, path.extname(file.path))

      saveModMetadata(
        {
          projectId,
          versionId: manifest.versionId || '',
          slug: projectId,
          title,
          filename,
          fileSize,
          installedFromMrpack: manifest.name,
          hashes: file.hashes || {},
          installedAt: new Date().toISOString()
        },
        metadataPath
      )

      installedFiles.push({
        path: file.path,
        filename,
        destPath,
        fileSize
      })
    }

    // 6. Copy overrides if present in archive
    const overridesDir = path.join(tempDir, 'overrides')
    if (fs.existsSync(overridesDir)) {
      copyDirRecursive(overridesDir, serverDir)
    }

    const serverOverridesDir = path.join(tempDir, 'server-overrides')
    if (fs.existsSync(serverOverridesDir)) {
      copyDirRecursive(serverOverridesDir, serverDir)
    }

    return {
      name: manifest.name,
      versionId: manifest.versionId,
      totalInstalled: installedCount,
      files: installedFiles,
      warning: compatibility.warning || undefined
    }
  } finally {
    // Clean up temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (cleanupErr) {
      console.error(`Failed to cleanup temp dir ${tempDir}:`, cleanupErr.message)
    }
  }
}

export default {
  parseManifest,
  filterServerFiles,
  validateCompatibility,
  verifyHash,
  importMrpack
}
