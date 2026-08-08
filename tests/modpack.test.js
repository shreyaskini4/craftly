import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import archiver from 'archiver'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue(os.tmpdir())
  }
}))

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      constructor(opts = {}) {
        this.store = { ...(opts.defaults || {}) }
      }
      get(key) { return this.store[key] }
      set(key, val) { this.store[key] = val }
      clear() { this.store = {} }
    }
  }
})

import {
  parseManifest,
  filterServerFiles,
  validateCompatibility,
  verifyHash,
  importMrpack
} from '../src/main/services/modpackManager.js'
import * as downloadUtils from '../src/main/utils/download.js'
import settingsStore from '../src/main/services/settingsStore.js'

vi.mock('../src/main/utils/download.js', () => ({
  downloadFile: vi.fn().mockImplementation(async (url, destPath) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    fs.writeFileSync(destPath, `content-from-${url}`)
    return destPath
  })
}))

describe('modpackManager', () => {
  let testDir

  beforeEach(() => {
    testDir = path.join(
      os.tmpdir(),
      `craftly-modpack-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    fs.mkdirSync(testDir, { recursive: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true })
    } catch {
      // cleanup ignore
    }
  })

  describe('parseManifest', () => {
    it('successfully parses a valid manifest JSON object', () => {
      const input = {
        formatVersion: 1,
        game: 'minecraft',
        versionId: '1.2.3',
        name: 'Cobblemon Pack',
        summary: 'A cool pokemon modpack',
        files: [
          {
            path: 'mods/cobblemon.jar',
            hashes: { sha1: 'abc', sha512: 'def' },
            downloads: ['https://cdn.modrinth.com/cobblemon.jar']
          }
        ],
        dependencies: {
          minecraft: '1.20.1',
          'fabric-loader': '0.15.0'
        }
      }

      const result = parseManifest(input)
      expect(result.formatVersion).toBe(1)
      expect(result.game).toBe('minecraft')
      expect(result.versionId).toBe('1.2.3')
      expect(result.name).toBe('Cobblemon Pack')
      expect(result.summary).toBe('A cool pokemon modpack')
      expect(result.files).toHaveLength(1)
      expect(result.dependencies.minecraft).toBe('1.20.1')
      expect(result.dependencies['fabric-loader']).toBe('0.15.0')
    })

    it('successfully parses a valid manifest JSON string', () => {
      const jsonString = JSON.stringify({
        formatVersion: 1,
        game: 'minecraft',
        versionId: '2.0.0',
        name: 'Fabric Essentials',
        files: []
      })

      const result = parseManifest(jsonString)
      expect(result.name).toBe('Fabric Essentials')
      expect(result.versionId).toBe('2.0.0')
      expect(result.files).toEqual([])
      expect(result.dependencies).toEqual({})
    })

    it('successfully parses a manifest from a file path', () => {
      const manifestPath = path.join(testDir, 'modrinth.index.json')
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({
          formatVersion: 1,
          game: 'minecraft',
          name: 'File Based Pack',
          files: []
        })
      )

      const result = parseManifest(manifestPath)
      expect(result.name).toBe('File Based Pack')
      expect(result.game).toBe('minecraft')
    })

    it('throws when missing "game" or "name"', () => {
      expect(() => parseManifest({ name: 'No Game Pack' })).toThrow('missing "game"')
      expect(() => parseManifest({ game: 'minecraft' })).toThrow('missing "name"')
      expect(() => parseManifest('invalid json {')).toThrow()
    })
  })

  describe('filterServerFiles', () => {
    it('filters out unsupported server files and retains required/optional files', () => {
      const files = [
        {
          path: 'mods/server-and-client.jar',
          env: { client: 'required', server: 'required' },
          downloads: ['https://example.com/mod1.jar']
        },
        {
          path: 'mods/client-only-minimap.jar',
          env: { client: 'required', server: 'unsupported' },
          downloads: ['https://example.com/mod2.jar']
        },
        {
          path: 'mods/optional-server-mod.jar',
          env: { client: 'optional', server: 'optional' },
          downloads: ['https://example.com/mod3.jar']
        },
        {
          path: 'mods/default-env-mod.jar',
          downloads: ['https://example.com/mod4.jar']
        },
        {
          path: 'mods/no-downloads.jar',
          downloads: []
        }
      ]

      const filtered = filterServerFiles(files)

      expect(filtered).toHaveLength(3)
      expect(filtered.map((f) => f.path)).toEqual([
        'mods/server-and-client.jar',
        'mods/optional-server-mod.jar',
        'mods/default-env-mod.jar'
      ])
    })

    it('handles empty or non-array inputs gracefully', () => {
      expect(filterServerFiles([])).toEqual([])
      expect(filterServerFiles(null)).toEqual([])
      expect(filterServerFiles(undefined)).toEqual([])
    })
  })

  describe('validateCompatibility', () => {
    it('returns compatible when versions match', () => {
      const deps = {
        minecraft: '1.20.1',
        'fabric-loader': '0.15.0'
      }
      const settings = {
        serverVersion: '1.20.1',
        serverType: 'fabric'
      }

      const result = validateCompatibility(deps, settings)
      expect(result.compatible).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('returns warnings when Minecraft or loader version does not match', () => {
      const deps = {
        minecraft: '1.20.1',
        'fabric-loader': '0.15.0'
      }
      const settings = {
        serverVersion: '1.20.4',
        serverType: 'forge'
      }

      const result = validateCompatibility(deps, settings)
      expect(result.compatible).toBe(false)
      expect(result.warnings.length).toBeGreaterThanOrEqual(2)
      expect(result.warning).toContain('1.20.1')
      expect(result.warning).toContain('Fabric loader')
    })
  })

  describe('verifyHash', () => {
    it('verifies sha1 and sha512 hashes accurately', () => {
      const filePath = path.join(testDir, 'test-file.txt')
      const fileData = 'Hello Minecraft Server!'
      fs.writeFileSync(filePath, fileData)

      const sha1 = crypto.createHash('sha1').update(fileData).digest('hex')
      const sha512 = crypto.createHash('sha512').update(fileData).digest('hex')

      expect(verifyHash(filePath, { sha1 })).toBe(true)
      expect(verifyHash(filePath, { sha512 })).toBe(true)
      expect(verifyHash(filePath, { sha1, sha512 })).toBe(true)
    })

    it('throws error when hash mismatches', () => {
      const filePath = path.join(testDir, 'test-file.txt')
      fs.writeFileSync(filePath, 'some data')

      expect(() => verifyHash(filePath, { sha1: 'badhash' })).toThrow('SHA-1 mismatch')
      expect(() => verifyHash(filePath, { sha512: 'badhash' })).toThrow('SHA-512 mismatch')
    })
  })

  describe('importMrpack end-to-end', () => {
    // Helper to create a zip file (.mrpack)
    function createMockMrpack(archivePath, indexJson, overrides = {}) {
      return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(archivePath)
        const archive = archiver('zip')

        output.on('close', resolve)
        archive.on('error', reject)

        archive.pipe(output)
        archive.append(JSON.stringify(indexJson, null, 2), { name: 'modrinth.index.json' })

        for (const [relativePath, content] of Object.entries(overrides)) {
          archive.append(content, { name: relativePath })
        }

        archive.finalize()
      })
    }

    it('extracts mrpack, filters server files, downloads them, and records metadata', async () => {
      const mrpackPath = path.join(testDir, 'sample-pack.mrpack')
      const serverDir = path.join(testDir, 'server')
      fs.mkdirSync(serverDir, { recursive: true })

      const indexData = {
        formatVersion: 1,
        game: 'minecraft',
        versionId: '1.0.0',
        name: 'Test Server Modpack',
        files: [
          {
            path: 'mods/server-mod.jar',
            hashes: {
              sha1: crypto.createHash('sha1').update('content-from-https://cdn.modrinth.com/server-mod.jar').digest('hex')
            },
            env: { client: 'required', server: 'required' },
            downloads: ['https://cdn.modrinth.com/server-mod.jar'],
            fileSize: 1024
          },
          {
            path: 'mods/client-only.jar',
            env: { client: 'required', server: 'unsupported' },
            downloads: ['https://cdn.modrinth.com/client-only.jar']
          }
        ],
        dependencies: {
          minecraft: '1.20.1',
          'fabric-loader': '0.15.0'
        }
      }

      const overrides = {
        'overrides/config/test-config.txt': 'server_setting=true'
      }

      await createMockMrpack(mrpackPath, indexData, overrides)

      const progressUpdates = []
      const onProgress = (p) => progressUpdates.push(p)

      const result = await importMrpack(mrpackPath, serverDir, onProgress)

      expect(result.name).toBe('Test Server Modpack')
      expect(result.versionId).toBe('1.0.0')
      expect(result.totalInstalled).toBe(1)
      expect(result.files).toHaveLength(1)
      expect(result.files[0].filename).toBe('server-mod.jar')

      // Check downloaded file
      expect(downloadUtils.downloadFile).toHaveBeenCalledWith(
        'https://cdn.modrinth.com/server-mod.jar',
        path.join(serverDir, 'mods/server-mod.jar')
      )

      // Check override copied
      expect(fs.existsSync(path.join(serverDir, 'config/test-config.txt'))).toBe(true)
      expect(fs.readFileSync(path.join(serverDir, 'config/test-config.txt'), 'utf8')).toBe('server_setting=true')

      // Check metadata recorded
      const metadataPath = path.join(serverDir, 'mods-metadata.json')
      expect(fs.existsSync(metadataPath)).toBe(true)
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
      expect(metadata).toHaveLength(1)
      expect(metadata[0].filename).toBe('server-mod.jar')
      expect(metadata[0].installedFromMrpack).toBe('Test Server Modpack')

      // Check progress reporting
      expect(progressUpdates.length).toBeGreaterThanOrEqual(1)
      expect(progressUpdates[progressUpdates.length - 1].percent).toBe(100)
    })
  })
})
