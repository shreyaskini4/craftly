import { ipcMain } from 'electron'
import serverProcess from '../services/serverProcess.js'
import settingsStore from '../services/settingsStore.js'
import { getRequiredJavaVersion, provisionJava } from '../services/javaProvisioner.js'
import { validateJavaPath } from '../utils/javaDetector.js'
import path from 'path'
import fs from 'fs'

let lineHandler = null

/**
 * Resolves the correct Java executable for a given server directory and MC version.
 *
 * Resolution order:
 *  1. If the user has explicitly chosen a Java path via "Browse Java" (settings.javaOverride),
 *     honour it unconditionally — it's a deliberate manual override.
 *  2. If serverJavaPaths[serverDir] is set AND the binary satisfies the required Java major
 *     version, use it (avoids re-provisioning on every launch).
 *  3. Otherwise call provisionJava() which:
 *       a. Scans local 64-bit Java installs for a matching major version.
 *       b. Falls back to a cached Adoptium JRE in userData/java/<major>/.
 *       c. Downloads from Adoptium if nothing exists locally.
 *     Then persists the resolved path to serverJavaPaths[serverDir] for next time.
 */
async function resolveJavaPath(serverDir, mcVersion, mainWindow) {
  const settings = settingsStore.getAll()

  // 1. Explicit user override — skip all auto-logic
  if (settings.javaOverride) {
    console.log(`[Java] Using user override: ${settings.javaOverride}`)
    return settings.javaOverride
  }

  const requiredMajor = getRequiredJavaVersion(mcVersion)
  console.log(`[Java] MC ${mcVersion} requires Java ${requiredMajor}`)

  const serverJavaPaths = settingsStore.get('serverJavaPaths') || {}
  const storedPath = serverJavaPaths[serverDir]

  // 2. Validate stored path against required version
  if (storedPath && storedPath !== 'java') {
    try {
      const isValid = await validateJavaPath(storedPath)
      if (isValid) {
        // Quick major-version check: run java -version, parse "version X"
        const { execFile } = await import('child_process')
        const { promisify } = await import('util')
        const execFileAsync = promisify(execFile)
        try {
          // java -version prints to stderr
          const { stderr } = await execFileAsync(storedPath, ['-version'], { timeout: 5000 })
          const match = (stderr || '').match(/version "([^"]+)"/)
          if (match) {
            const versionStr = match[1]
            const parts = versionStr.split('.').map(p => parseInt(p, 10))
            const storedMajor = (parts[0] === 1) ? parts[1] : parts[0]
            if (storedMajor === requiredMajor) {
              console.log(`[Java] Stored path OK (Java ${storedMajor}): ${storedPath}`)
              return storedPath
            }
            console.log(`[Java] Stored path is Java ${storedMajor}, need ${requiredMajor} — re-provisioning`)
          }
        } catch {
          // If version check fails, fall through to re-provision
        }
      }
    } catch {
      // Stored path invalid, fall through
    }
  }

  // 3. Provision (detect local or download from Adoptium)
  console.log(`[Java] Provisioning Java ${requiredMajor} for ${serverDir}...`)
  const onProgress = (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:progress', {
        ...progress,
        majorVersion: requiredMajor
      })
    }
  }

  let resolvedPath
  try {
    resolvedPath = await provisionJava(requiredMajor, onProgress)
  } catch (err) {
    console.error(`[Java] Provisioning failed: ${err.message}`)
    // Last-ditch: use whatever was stored or system 'java' and let the JVM error surface
    resolvedPath = storedPath || settings.javaPath || 'java'
  }

  // Persist for subsequent starts
  serverJavaPaths[serverDir] = resolvedPath
  settingsStore.set('serverJavaPaths', serverJavaPaths)
  console.log(`[Java] Resolved & saved: ${resolvedPath}`)
  return resolvedPath
}

export function registerServerIpc(mainWindow) {
  serverProcess.removeAllListeners('crashed')
  serverProcess.on('crashed', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server:crash-info', info)
    }
  })

  ipcMain.handle('server:start', async () => {
    const settings = settingsStore.getAll()
    const serverDir = settings.serverDir
    const jarName = settings.serverJar || 'server.jar'
    const jarPath = path.join(serverDir, jarName)

    if (!fs.existsSync(jarPath)) {
      throw new Error(`Server jar (${jarName}) not found. Please download a server version first in Settings or import a valid server directory.`)
    }

    // Resolve the correct Java for this server's MC version — never use a blind default
    const mcVersion = settings.serverVersion || ''
    const javaPath = await resolveJavaPath(serverDir, mcVersion, mainWindow)

    const config = {
      javaPath,
      jarPath,
      xmx: settings.xmx || '4G',
      xms: settings.xms || '2G',
      serverDir,
      rconPort: settings.rconPort || 25575,
      rconPassword: settings.rconPassword || 'craftly_rcon_pass'
    }

    // Remove old listener if exists
    if (lineHandler) {
      serverProcess.removeListener('line', lineHandler)
    }

    // Forward console lines to renderer
    lineHandler = (data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('console:line', data)
      }
    }
    serverProcess.on('line', lineHandler)

    // Forward status changes
    const statusHandler = (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server:status-change', status)
      }
    }
    serverProcess.removeAllListeners('status')
    serverProcess.on('status', statusHandler)

    await serverProcess.start(config)
  })

  ipcMain.handle('server:stop', async () => {
    await serverProcess.stop()
  })

  ipcMain.handle('server:restart', async () => {
    await serverProcess.restart()
  })

  ipcMain.handle('server:send-command', async (_event, cmd) => {
    serverProcess.sendCommand(cmd)
  })

  ipcMain.handle('server:status', async () => {
    return serverProcess.getStatus()
  })
}
