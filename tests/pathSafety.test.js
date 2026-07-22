import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'
import os from 'os'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/user/data')
  }
}))

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      constructor() {
        this.store = {}
      }
      get(key) { return this.store[key] }
      set(key, val) { this.store[key] = val }
      clear() { this.store = {} }
    }
  }
})

import settingsStore from '../src/main/services/settingsStore.js'
import { safePath } from '../src/main/ipc/files.js'

describe('safePath path safety', () => {
  const baseDir = path.resolve(os.tmpdir(), 'mc-servers')
  const serverDir = path.join(baseDir, 'my-server')

  beforeEach(() => {
    settingsStore.set('serverDir', serverDir)
  })

  it('allows exact root match ("" or ".")', () => {
    const rootPath1 = safePath('')
    expect(rootPath1.toLowerCase()).toBe(serverDir.toLowerCase())

    const rootPath2 = safePath('.')
    expect(rootPath2.toLowerCase()).toBe(serverDir.toLowerCase())
  })

  it('allows nested paths (e.g. server.properties, config/plugin.json)', () => {
    const file1 = safePath('server.properties')
    expect(file1.toLowerCase()).toBe(path.join(serverDir, 'server.properties').toLowerCase())

    const file2 = safePath('config/plugin.json')
    expect(file2.toLowerCase()).toBe(path.join(serverDir, 'config', 'plugin.json').toLowerCase())
  })

  it('rejects sibling directory matching serverDir prefix (e.g. ../my-server-old)', () => {
    expect(() => safePath('../my-server-old')).toThrow('Access Denied: Path traversal detected')
    expect(() => safePath('../my-server-old/file.txt')).toThrow('Access Denied: Path traversal detected')
  })

  it('rejects parent directory traversal (e.g. ../ or ../../)', () => {
    expect(() => safePath('../')).toThrow('Access Denied: Path traversal detected')
    expect(() => safePath('../../secret.txt')).toThrow('Access Denied: Path traversal detected')
  })

  it('throws error when server directory is not configured', () => {
    settingsStore.set('serverDir', null)
    expect(() => safePath('server.properties')).toThrow('Server directory is not configured')
  })
})
