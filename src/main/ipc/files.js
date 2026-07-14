import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import settingsStore from '../services/settingsStore.js'

/**
 * Helper to prevent directory traversal and resolve safe absolute path.
 */
function safePath(relativePath) {
  const serverDir = settingsStore.get('serverDir')
  if (!serverDir) {
    throw new Error('Server directory is not configured')
  }
  const absoluteServerDir = path.resolve(serverDir)
  const absolutePath = path.resolve(path.join(absoluteServerDir, relativePath))

  // Perform a case-insensitive prefix check to verify safety
  const normServerDir = absoluteServerDir.toLowerCase()
  const normPath = absolutePath.toLowerCase()

  if (!normPath.startsWith(normServerDir)) {
    throw new Error('Access Denied: Path traversal detected')
  }

  return absolutePath
}

export function registerFilesIpc(mainWindow) {
  // List directory contents
  ipcMain.handle('files:list', async (_event, relativePath) => {
    const dirPath = safePath(relativePath)
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Directory does not exist: ${relativePath}`)
    }
    const stat = fs.statSync(dirPath)
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${relativePath}`)
    }

    const items = fs.readdirSync(dirPath)
    const result = []

    for (const name of items) {
      try {
        const fullPath = path.join(dirPath, name)
        const itemStat = fs.statSync(fullPath)
        result.push({
          name,
          type: itemStat.isDirectory() ? 'dir' : 'file',
          size: itemStat.size,
          modified: itemStat.mtime.toISOString()
        })
      } catch (err) {
        // Skip inaccessible items or broken symlinks
      }
    }

    return result
  })

  // Read file contents
  ipcMain.handle('files:read', async (_event, relativePath) => {
    const filePath = safePath(relativePath)
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${relativePath}`)
    }
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      throw new Error('Cannot read a directory as a file')
    }

    const ext = path.extname(filePath).toLowerCase()
    const safeExtensions = [
      '.properties',
      '.json',
      '.yml',
      '.yaml',
      '.txt',
      '.log',
      '.cfg',
      '.toml',
      '.conf',
      '.md',
      '.sh',
      '.bat',
      '.cmd'
    ]

    // Allow files with no extension (like EULA/custom files) or safe extensions.
    // If it has an extension and it's not in the safe list, block it.
    if (ext !== '' && !safeExtensions.includes(ext)) {
      throw new Error('Binary files cannot be viewed in-app')
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    return { content }
  })

  // Write file contents
  ipcMain.handle('files:write', async (_event, relativePath, content) => {
    const filePath = safePath(relativePath)
    const ext = path.extname(filePath).toLowerCase()
    const safeExtensions = [
      '.properties',
      '.json',
      '.yml',
      '.yaml',
      '.txt',
      '.log',
      '.cfg',
      '.toml',
      '.conf',
      '.md',
      '.sh',
      '.bat',
      '.cmd'
    ]

    if (ext !== '' && !safeExtensions.includes(ext)) {
      throw new Error('Binary files cannot be written in-app')
    }

    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  })

  // Delete file or directory recursively
  ipcMain.handle('files:delete', async (_event, relativePath) => {
    const filePath = safePath(relativePath)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Path does not exist: ${relativePath}`)
    }
    fs.rmSync(filePath, { recursive: true, force: true })
    return true
  })

  // Rename or move file / directory
  ipcMain.handle('files:rename', async (_event, oldPath, newPath) => {
    const oldFilePath = safePath(oldPath)
    const newFilePath = safePath(newPath)
    if (!fs.existsSync(oldFilePath)) {
      throw new Error(`Source path does not exist: ${oldPath}`)
    }
    fs.renameSync(oldFilePath, newFilePath)
    return true
  })

  // Create directory
  ipcMain.handle('files:create-dir', async (_event, relativePath) => {
    const dirPath = safePath(relativePath)
    fs.mkdirSync(dirPath, { recursive: true })
    return true
  })

  // Create empty file
  ipcMain.handle('files:create-file', async (_event, relativePath) => {
    const filePath = safePath(relativePath)
    fs.writeFileSync(filePath, '', 'utf-8')
    return true
  })
}
