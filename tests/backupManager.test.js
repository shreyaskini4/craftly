import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdir, rm, writeFile, readFile, readdir } from 'fs/promises'
import { join } from 'path'
import os from 'os'
import fs from 'fs'
import backupManager from '../src/main/services/backupManager.js'

describe('backupManager', () => {
  let testDir
  let serverDir
  let backupsDir

  beforeEach(async () => {
    testDir = join(os.tmpdir(), `craftly-test-backups-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    serverDir = join(testDir, 'server')
    backupsDir = join(testDir, 'backups')
    await mkdir(serverDir, { recursive: true })
    await mkdir(backupsDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('createBackup', () => {
    it('returns skipped when there are no world or config files', async () => {
      const result = await backupManager.createBackup(serverDir, backupsDir)
      expect(result.name).toBe('skipped')
      expect(result.path).toBeNull()
    })

    it('creates a backup with default prefix backup-', async () => {
      // Create server config file
      await writeFile(join(serverDir, 'server.properties'), 'level-name=world\nserver-port=25565', 'utf8')
      const worldDir = join(serverDir, 'world')
      await mkdir(worldDir, { recursive: true })
      await writeFile(join(worldDir, 'level.dat'), 'dummy level data', 'utf8')

      const result = await backupManager.createBackup(serverDir, backupsDir)
      expect(result.name).toMatch(/^backup-.*\.zip$/)
      expect(fs.existsSync(result.path)).toBe(true)
    })

    it('creates a backup with custom prefix pre-restore-safety-', async () => {
      await writeFile(join(serverDir, 'server.properties'), 'level-name=world\n', 'utf8')
      const worldDir = join(serverDir, 'world')
      await mkdir(worldDir, { recursive: true })
      await writeFile(join(worldDir, 'level.dat'), 'world file', 'utf8')

      const result = await backupManager.createBackup(serverDir, backupsDir, 'pre-restore-safety')
      expect(result.name).toMatch(/^pre-restore-safety-.*\.zip$/)
      expect(fs.existsSync(result.path)).toBe(true)
    })
  })

  describe('restoreBackup & pre-restore safety', () => {
    it('restores backup correctly over existing files', async () => {
      // Setup original state
      await writeFile(join(serverDir, 'server.properties'), 'motd=Original Server', 'utf8')
      const worldDir = join(serverDir, 'world')
      await mkdir(worldDir, { recursive: true })
      await writeFile(join(worldDir, 'level.dat'), 'v1', 'utf8')

      // Create backup
      const backupResult = await backupManager.createBackup(serverDir, backupsDir)

      // Modify server files (simulating user changes or corruption)
      await writeFile(join(serverDir, 'server.properties'), 'motd=Modified Server', 'utf8')
      await writeFile(join(worldDir, 'level.dat'), 'v2', 'utf8')

      // Pre-restore safety backup simulation: create safety backup before restore
      const safetyBackup = await backupManager.createBackup(serverDir, backupsDir, 'pre-restore-safety')
      expect(safetyBackup.name).toMatch(/^pre-restore-safety-.*\.zip$/)

      // Perform restore
      await backupManager.restoreBackup(backupResult.path, serverDir)

      // Check restored content
      const restoredProps = await readFile(join(serverDir, 'server.properties'), 'utf8')
      expect(restoredProps).toBe('motd=Original Server')
      const restoredLevel = await readFile(join(worldDir, 'level.dat'), 'utf8')
      expect(restoredLevel).toBe('v1')

      // Verify listBackups returns both safety backup and original backup
      const backups = backupManager.listBackups(backupsDir)
      expect(backups.length).toBe(2)
    })
  })
})
