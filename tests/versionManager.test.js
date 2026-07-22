import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { mkdir, rm, readFile } from 'fs/promises'
import * as versionManager from '../src/main/services/versionManager.js'
import * as downloadUtils from '../src/main/utils/download.js'
import https from 'https'
import http from 'http'

vi.mock('../src/main/utils/download.js', () => ({
  downloadFile: vi.fn().mockResolvedValue('/fake/server.jar')
}))

describe('versionManager', () => {
  let testDir

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `craftly-version-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(testDir, { recursive: true })
    vi.clearAllMocks()
  })

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error
    }
  })

  // Helper to mock http/https get calls for fetchJson inside versionManager
  function mockHttpsGet(urlResponseMap) {
    const spy = vi.spyOn(https, 'get').mockImplementation((url, options, callback) => {
      if (typeof options === 'function') {
        callback = options
      }
      const req = new EventEmitter()
      const res = new EventEmitter()
      res.statusCode = 200
      res.headers = {}

      const targetUrl = typeof url === 'string' ? url : url.href
      const matchedContent = urlResponseMap[targetUrl]

      process.nextTick(() => {
        if (matchedContent !== undefined) {
          callback(res)
          res.emit('data', JSON.stringify(matchedContent))
          res.emit('end')
        } else {
          res.statusCode = 404
          callback(res)
          res.emit('end')
        }
      })

      return req
    })
    return spy
  }

  describe('Vanilla versions & downloads', () => {
    it('fetchVanillaVersions returns list of available versions', async () => {
      const manifestMock = {
        versions: [
          { id: '1.20.4', type: 'release', releaseTime: '2023-12-07T13:00:00+00:00' },
          { id: '1.20.3', type: 'release', releaseTime: '2023-12-05T13:00:00+00:00' }
        ]
      }

      const spy = mockHttpsGet({
        'https://launchermeta.mojang.com/mc/game/version_manifest.json': manifestMock
      })

      const versions = await versionManager.fetchVanillaVersions()

      expect(versions).toHaveLength(2)
      expect(versions[0]).toEqual({
        id: '1.20.4',
        type: 'release',
        releaseTime: '2023-12-07T13:00:00+00:00'
      })
      spy.mockRestore()
    })

    it('downloadVanillaServer resolves URL and triggers downloadFile', async () => {
      const manifestMock = {
        versions: [
          {
            id: '1.20.4',
            type: 'release',
            url: 'https://piston-meta.mojang.com/v1/packages/1.20.4.json'
          }
        ]
      }
      const versionMetaMock = {
        downloads: {
          server: {
            url: 'https://piston-data.mojang.com/v1/objects/samplehash/server.jar'
          }
        }
      }

      const spy = mockHttpsGet({
        'https://launchermeta.mojang.com/mc/game/version_manifest.json': manifestMock,
        'https://piston-meta.mojang.com/v1/packages/1.20.4.json': versionMetaMock
      })

      const dest = await versionManager.downloadVanillaServer('1.20.4', testDir)

      expect(downloadUtils.downloadFile).toHaveBeenCalledWith(
        'https://piston-data.mojang.com/v1/objects/samplehash/server.jar',
        path.join(testDir, 'server.jar'),
        undefined
      )
      expect(dest).toBe(path.join(testDir, 'server.jar'))
      spy.mockRestore()
    })

    it('downloadVanillaServer throws error when version is not found', async () => {
      const spy = mockHttpsGet({
        'https://launchermeta.mojang.com/mc/game/version_manifest.json': { versions: [] }
      })

      await expect(versionManager.downloadVanillaServer('9.9.9', testDir)).rejects.toThrow(
        'Version 9.9.9 not found'
      )
      spy.mockRestore()
    })
  })

  describe('Paper versions, builds & downloads', () => {
    it('fetchPaperVersions fetches versions from mcutils API', async () => {
      const mockData = [
        { version: '1.20.4' },
        { version: '1.20.2' }
      ]

      const spy = mockHttpsGet({
        'https://mcutils.com/api/server-jars/paper': mockData
      })

      const versions = await versionManager.fetchPaperVersions()
      expect(versions).toEqual(['1.20.4', '1.20.2'])
      spy.mockRestore()
    })

    it('fetchPaperBuilds returns latest build', async () => {
      const builds = await versionManager.fetchPaperBuilds('1.20.4')
      expect(builds).toEqual(['latest'])
    })

    it('downloadPaperServer constructs download URL and calls downloadFile', async () => {
      const dest = await versionManager.downloadPaperServer('1.20.4', 'latest', testDir)

      const expectedUrl = 'https://mcutils.com/api/server-jars/paper/1.20.4/download'
      expect(downloadUtils.downloadFile).toHaveBeenCalledWith(
        expectedUrl,
        path.join(testDir, 'server.jar'),
        undefined
      )
      expect(dest).toBe(path.join(testDir, 'server.jar'))
    })
  })

  describe('Fabric versions, loaders & downloads', () => {
    it('fetchFabricVersions fetches and filters stable game versions', async () => {
      const mockVersions = [
        { version: '1.20.4', stable: true },
        { version: '24w09a', stable: false }
      ]

      const spy = mockHttpsGet({
        'https://meta.fabricmc.net/v2/versions/game': mockVersions
      })

      const versions = await versionManager.fetchFabricVersions()
      expect(versions).toEqual([{ id: '1.20.4', stable: true }])
      spy.mockRestore()
    })

    it('fetchFabricLoaders fetches stable loaders for game version', async () => {
      const mockLoaders = [
        { loader: { version: '0.15.7', stable: true } },
        { loader: { version: '0.15.6-beta', stable: false } }
      ]

      const spy = mockHttpsGet({
        'https://meta.fabricmc.net/v2/versions/loader/1.20.4': mockLoaders
      })

      const loaders = await versionManager.fetchFabricLoaders('1.20.4')
      expect(loaders).toEqual([{ version: '0.15.7', stable: true }])
      spy.mockRestore()
    })

    it('downloadFabricServer constructs download URL using provided loader and fetched installer', async () => {
      const mockInstallers = [
        { version: '1.0.0', stable: true }
      ]

      const spy = mockHttpsGet({
        'https://meta.fabricmc.net/v2/versions/installer': mockInstallers
      })

      const dest = await versionManager.downloadFabricServer('1.20.4', '0.15.7', testDir)

      const expectedUrl = 'https://meta.fabricmc.net/v2/versions/loader/1.20.4/0.15.7/1.0.0/server/jar'
      expect(downloadUtils.downloadFile).toHaveBeenCalledWith(
        expectedUrl,
        path.join(testDir, 'server.jar'),
        undefined
      )
      expect(dest).toBe(path.join(testDir, 'server.jar'))
      spy.mockRestore()
    })
  })

  describe('acceptEula', () => {
    it('creates eula.txt with eula=true in server directory', async () => {
      await versionManager.acceptEula(testDir)
      const eulaPath = path.join(testDir, 'eula.txt')
      const content = await readFile(eulaPath, 'utf8')
      expect(content).toContain('eula=true')
    })
  })
})
