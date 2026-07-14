import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import settingsStore from '../services/settingsStore.js'

function safeLogPath(filename) {
  const serverDir = settingsStore.get('serverDir')
  if (!serverDir) {
    throw new Error('Server directory is not configured')
  }
  const logsDir = path.resolve(serverDir, 'logs')
  const absolutePath = path.resolve(logsDir, filename)
  const normLogsDir = logsDir.toLowerCase() + (logsDir.endsWith(path.sep) ? '' : path.sep)
  const normPath = absolutePath.toLowerCase()
  if (!normPath.startsWith(normLogsDir) && normPath !== logsDir.toLowerCase()) {
    throw new Error('Access Denied: Path traversal detected')
  }
  return absolutePath
}

function safeCrashPath(filename) {
  const serverDir = settingsStore.get('serverDir')
  if (!serverDir) {
    throw new Error('Server directory is not configured')
  }
  const crashDir = path.resolve(serverDir, 'crash-reports')
  const absolutePath = path.resolve(crashDir, filename)
  const normCrashDir = crashDir.toLowerCase() + (crashDir.endsWith(path.sep) ? '' : path.sep)
  const normPath = absolutePath.toLowerCase()
  if (!normPath.startsWith(normCrashDir) && normPath !== crashDir.toLowerCase()) {
    throw new Error('Access Denied: Path traversal detected')
  }
  return absolutePath
}

export function registerLogsIpc(mainWindow) {
  ipcMain.handle('logs:list-logs', async () => {
    const serverDir = settingsStore.get('serverDir')
    if (!serverDir) return []
    const logsDir = path.join(serverDir, 'logs')
    if (!fs.existsSync(logsDir)) return []
    try {
      const files = fs.readdirSync(logsDir)
      const list = []
      for (const name of files) {
        if (name.endsWith('.log') || name.endsWith('.log.gz')) {
          const fullPath = path.join(logsDir, name)
          const stat = fs.statSync(fullPath)
          if (stat.isFile()) {
            list.push({
              name,
              size: stat.size,
              date: stat.mtime.toISOString()
            })
          }
        }
      }
      return list.sort((a, b) => new Date(b.date) - new Date(a.date))
    } catch (err) {
      console.error('Failed to list logs:', err)
      return []
    }
  })

  ipcMain.handle('logs:list-crash-reports', async () => {
    const serverDir = settingsStore.get('serverDir')
    if (!serverDir) return []
    const crashDir = path.join(serverDir, 'crash-reports')
    if (!fs.existsSync(crashDir)) return []
    try {
      const files = fs.readdirSync(crashDir)
      const list = []
      for (const name of files) {
        if (name.endsWith('.txt')) {
          const fullPath = path.join(crashDir, name)
          const stat = fs.statSync(fullPath)
          if (stat.isFile()) {
            list.push({
              name,
              size: stat.size,
              date: stat.mtime.toISOString()
            })
          }
        }
      }
      return list.sort((a, b) => new Date(b.date) - new Date(a.date))
    } catch (err) {
      console.error('Failed to list crash reports:', err)
      return []
    }
  })

  ipcMain.handle('logs:read-log', async (_event, filename) => {
    const filePath = safeLogPath(filename)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Log file not found: ${filename}`)
    }
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      throw new Error(`Cannot read a directory: ${filename}`)
    }

    if (filename.endsWith('.gz')) {
      const buffer = fs.readFileSync(filePath)
      return zlib.gunzipSync(buffer).toString('utf-8')
    } else {
      return fs.readFileSync(filePath, 'utf-8')
    }
  })

  ipcMain.handle('logs:read-crash-report', async (_event, filename) => {
    const filePath = safeCrashPath(filename)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Crash report file not found: ${filename}`)
    }
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      throw new Error(`Cannot read a directory: ${filename}`)
    }
    return fs.readFileSync(filePath, 'utf-8')
  })
}
