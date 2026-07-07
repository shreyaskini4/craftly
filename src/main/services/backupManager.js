import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import archiver from 'archiver'
import extractZip from 'extract-zip'
import { readProperties } from '../utils/serverProperties.js'

class BackupManager extends EventEmitter {
  constructor() {
    super()
    this.autoBackupTimer = null
  }

  async createBackup(serverDir, backupsDir) {
    fs.mkdirSync(backupsDir, { recursive: true })

    // Determine world folder name from server.properties
    let levelName = 'world'
    try {
      const props = await readProperties(serverDir)
      if (props['level-name']) levelName = props['level-name']
    } catch { /* use default */ }

    const worldFolders = []
    const primaryWorld = path.join(serverDir, levelName)
    if (fs.existsSync(primaryWorld)) {
      worldFolders.push(levelName)
      // Check for nether/end dimensions
      const netherDir = path.join(serverDir, `${levelName}_nether`)
      const endDir = path.join(serverDir, `${levelName}_the_end`)
      if (fs.existsSync(netherDir)) worldFolders.push(`${levelName}_nether`)
      if (fs.existsSync(endDir)) worldFolders.push(`${levelName}_the_end`)
    }

    const worldsDir = path.join(serverDir, 'worlds')
    if (fs.existsSync(worldsDir)) {
      worldFolders.push('worlds')
    }

    if (worldFolders.length === 0) {
      throw new Error(`Neither world folder "${levelName}" nor "worlds" found in server directory`)
    }

    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '-').slice(0, 19)
    const backupName = `backup-${timestamp}.zip`
    const backupPath = path.join(backupsDir, backupName)

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(backupPath)
      const archive = archiver('zip', { zlib: { level: 6 } })

      output.on('close', () => {
        const stats = fs.statSync(backupPath)
        const result = {
          name: backupName,
          path: backupPath,
          size: stats.size,
          date: now.toISOString()
        }
        this.emit('complete', result)
        resolve(result)
      })

      archive.on('error', (err) => {
        reject(err)
      })

      archive.on('progress', (progress) => {
        this.emit('progress', {
          entries: progress.entries.processed,
          totalEntries: progress.entries.total
        })
      })

      archive.pipe(output)

      // Add world folders
      for (const folder of worldFolders) {
        const folderPath = path.join(serverDir, folder)
        if (fs.existsSync(folderPath)) {
          archive.directory(folderPath, folder)
        }
      }

      // Also back up key config files
      const configFiles = ['server.properties', 'ops.json', 'whitelist.json', 'banned-players.json', 'banned-ips.json']
      for (const file of configFiles) {
        const filePath = path.join(serverDir, file)
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: file })
        }
      }

      archive.finalize()
    })
  }

  async restoreBackup(backupPath, serverDir) {
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found')
    }

    // Extract to a temp directory first
    const tempDir = path.join(serverDir, '_restore_temp')
    fs.mkdirSync(tempDir, { recursive: true })

    try {
      await extractZip(backupPath, { dir: tempDir })

      // Find and replace world folders
      const entries = fs.readdirSync(tempDir)
      for (const entry of entries) {
        const srcPath = path.join(tempDir, entry)
        const destPath = path.join(serverDir, entry)
        const stat = fs.statSync(srcPath)

        if (stat.isDirectory()) {
          // Remove existing folder
          if (fs.existsSync(destPath)) {
            fs.rmSync(destPath, { recursive: true, force: true })
          }
          fs.renameSync(srcPath, destPath)
        } else {
          fs.copyFileSync(srcPath, destPath)
        }
      }
    } finally {
      // Clean up temp dir
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    }
  }

  async deleteBackup(backupPath) {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath)
    }
  }

  listBackups(backupsDir) {
    if (!fs.existsSync(backupsDir)) return []

    try {
      const files = fs.readdirSync(backupsDir)
      return files
        .filter(f => f.endsWith('.zip'))
        .map(f => {
          const filePath = path.join(backupsDir, f)
          const stats = fs.statSync(filePath)
          return {
            name: f,
            path: filePath,
            size: stats.size,
            date: stats.mtime.toISOString()
          }
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date))
    } catch {
      return []
    }
  }

  startAutoBackup(intervalHours, serverDir, backupsDir) {
    this.stopAutoBackup()
    const intervalMs = intervalHours * 60 * 60 * 1000
    this.autoBackupTimer = setInterval(async () => {
      try {
        await this.createBackup(serverDir, backupsDir)
        console.log('Auto-backup completed')
      } catch (err) {
        console.error('Auto-backup failed:', err.message)
      }
    }, intervalMs)
  }

  stopAutoBackup() {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer)
      this.autoBackupTimer = null
    }
  }
}

export const backupManager = new BackupManager()
export default backupManager
