import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rm, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import os from 'os'
import {
  readProperties,
  writeProperties,
  getProperty,
  setProperty,
  ensureRcon
} from '../src/main/utils/serverProperties.js'

describe('serverProperties', () => {
  let testDir

  beforeEach(async () => {
    testDir = join(os.tmpdir(), `craftly-test-props-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('missing file handling', () => {
    it('returns an empty object when server.properties does not exist', async () => {
      const props = await readProperties(testDir)
      expect(props).toEqual({})
    })

    it('creates server.properties when writing to a non-existent file', async () => {
      await writeProperties(testDir, { 'server-port': '25565', 'pvp': 'true' })
      const content = await readFile(join(testDir, 'server.properties'), 'utf8')
      expect(content).toContain('server-port=25565')
      expect(content).toContain('pvp=true')
    })
  })

  describe('readProperties', () => {
    it('parses key-value pairs and ignores comments and empty lines', async () => {
      const sampleFileContent = [
        '# Minecraft server properties',
        '# Wed Jul 22 2026',
        '',
        'server-port=25565',
        'gamemode=survival',
        'motd=A Minecraft Server',
        '# boolean flags',
        'pvp=true',
        'online-mode=false'
      ].join('\n')

      await writeFile(join(testDir, 'server.properties'), sampleFileContent, 'utf8')

      const props = await readProperties(testDir)
      expect(props).toEqual({
        'server-port': '25565',
        'gamemode': 'survival',
        'motd': 'A Minecraft Server',
        'pvp': 'true',
        'online-mode': 'false'
      })
    })

    it('handles values containing equal signs correctly', async () => {
      await writeFile(join(testDir, 'server.properties'), 'motd=Hello=World=123\n', 'utf8')
      const props = await readProperties(testDir)
      expect(props['motd']).toBe('Hello=World=123')
    })
  })

  describe('comment preservation & line updates', () => {
    it('preserves existing comments and line order when updating properties', async () => {
      const original = [
        '# Header comment',
        'server-port=25565',
        '# Section comment',
        'max-players=20',
        'pvp=true'
      ].join('\n')

      await writeFile(join(testDir, 'server.properties'), original, 'utf8')

      await writeProperties(testDir, {
        'server-port': '25565',
        'max-players': '50',
        'pvp': 'true',
        'view-distance': '10' // new key
      })

      const updatedContent = await readFile(join(testDir, 'server.properties'), 'utf8')
      const lines = updatedContent.split('\n')

      expect(lines[0]).toBe('# Header comment')
      expect(lines[1]).toBe('server-port=25565')
      expect(lines[2]).toBe('# Section comment')
      expect(lines[3]).toBe('max-players=50')
      expect(lines[4]).toBe('pvp=true')
      expect(lines[5]).toBe('view-distance=10')
    })
  })

  describe('getProperty and setProperty', () => {
    it('gets a single property value', async () => {
      await writeFile(join(testDir, 'server.properties'), 'difficulty=easy\n', 'utf8')
      const val = await getProperty(testDir, 'difficulty')
      expect(val).toBe('easy')
    })

    it('returns undefined for non-existent property', async () => {
      await writeFile(join(testDir, 'server.properties'), 'difficulty=easy\n', 'utf8')
      const val = await getProperty(testDir, 'non-existent')
      expect(val).toBeUndefined()
    })

    it('sets a single property creating file if missing', async () => {
      await setProperty(testDir, 'level-name', 'world')
      const val = await getProperty(testDir, 'level-name')
      expect(val).toBe('world')
    })

    it('updates a property in an existing file', async () => {
      await writeFile(join(testDir, 'server.properties'), 'level-name=world\n', 'utf8')
      await setProperty(testDir, 'level-name', 'my_custom_world')
      const val = await getProperty(testDir, 'level-name')
      expect(val).toBe('my_custom_world')
    })
  })

  describe('ensureRcon', () => {
    it('configures RCON settings in server.properties', async () => {
      await ensureRcon(testDir, 25575, 'secretpass')
      const props = await readProperties(testDir)

      expect(props['enable-rcon']).toBe('true')
      expect(props['rcon.port']).toBe('25575')
      expect(props['rcon.password']).toBe('secretpass')
    })
  })

  describe('round-trip parsing', () => {
    it('preserves all data through read-modify-write-read cycle', async () => {
      const initialProps = {
        'server-port': '25565',
        'gamemode': 'creative',
        'enable-command-block': 'true',
        'motd': 'Craftly Server'
      }

      await writeProperties(testDir, initialProps)
      const read1 = await readProperties(testDir)
      expect(read1).toEqual(initialProps)

      read1['gamemode'] = 'survival'
      read1['max-players'] = '100'
      await writeProperties(testDir, read1)

      const read2 = await readProperties(testDir)
      expect(read2).toEqual({
        'server-port': '25565',
        'gamemode': 'survival',
        'enable-command-block': 'true',
        'motd': 'Craftly Server',
        'max-players': '100'
      })
    })
  })
})
