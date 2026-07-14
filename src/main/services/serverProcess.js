import { EventEmitter } from 'events'
import { spawn, execSync } from 'child_process'
import path from 'path'
import { ensureRcon } from '../utils/serverProperties.js'
import settingsStore from './settingsStore.js'

/**
 * Manages the lifecycle of a Minecraft server Java process.
 * Emits events for console output, status changes, and errors.
 *
 * Events:
 *   'line'    — { text, type: 'stdout'|'stderr', timestamp }
 *   'status'  — 'starting' | 'online' | 'stopping' | 'offline'
 *   'started' — server fully online (Done message detected)
 *   'stopped' — process exited, payload is exit code
 *   'error'   — Error object
 */
class ServerProcess extends EventEmitter {
  constructor() {
    super()
    this.process = null
    this.running = false
    this.startTime = null
    this.lastConfig = null
    this.intentionalStop = false
    this.crashCount = 0
    this.crashResetTimer = null
    this.restartTimer = null
  }

  get isRunning() {
    return this.running
  }

  get pid() {
    return this.process ? this.process.pid : null
  }

  /**
   * Starts the Minecraft server process.
   *
   * @param {object} config
   * @param {string} [config.javaPath='java'] - Path to java executable
   * @param {string} config.jarPath - Path to the server .jar file
   * @param {string} [config.xmx='4G'] - Maximum heap size
   * @param {string} [config.xms='2G'] - Initial heap size
   * @param {string} config.serverDir - Working directory for the server
   * @returns {Promise<void>}
   */
  start(config) {
    return new Promise(async (resolve, reject) => {
      if (this.running) {
        reject(new Error('Server is already running'))
        return
      }

      this.intentionalStop = false
      if (this.crashResetTimer) {
        clearTimeout(this.crashResetTimer)
        this.crashResetTimer = null
      }

      const { javaPath = 'java', jarPath, xmx = '4G', xms = '2G', serverDir, rconPort, rconPassword } = config
      this.lastConfig = config

      try {
        await ensureRcon(serverDir, rconPort, rconPassword)
      } catch (err) {
        reject(new Error(`Failed to ensure RCON: ${err.message}`))
        return
      }

      const args = [`-Xmx${xmx}`, `-Xms${xms}`, '-jar', jarPath, 'nogui']

      try {
        this.process = spawn(javaPath, args, {
          cwd: serverDir,
          env: { ...process.env },
          stdio: ['pipe', 'pipe', 'pipe']
        })
      } catch (err) {
        reject(new Error(`Failed to start server: ${err.message}`))
        return
      }

      this.running = true
      this.startTime = Date.now()
      this.emit('status', 'starting')

      this.crashResetTimer = setTimeout(() => {
        if (this.running) {
          this.crashCount = 0
        }
      }, 60000)

      let stdoutBuffer = ''
      let stderrBuffer = ''

      this.process.stdout.on('data', (data) => {
        stdoutBuffer += data.toString()
        const lines = stdoutBuffer.split('\n')
        stdoutBuffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            const lineData = {
              text: line,
              type: 'stdout',
              timestamp: new Date().toISOString()
            }
            this.emit('line', lineData)

            if (line.includes('UnsupportedClassVersionError') || line.includes('LinkageError')) {
              this.emit('status', 'offline', 'Java Compatibility Error: Unsupported Class Version')
            }

            // Detect when server is fully started
            if (line.includes('Done') && line.includes('For help')) {
              this.emit('status', 'online')
              this.emit('started')
            }
          }
        }
      })

      this.process.stderr.on('data', (data) => {
        stderrBuffer += data.toString()
        const lines = stderrBuffer.split('\n')
        stderrBuffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            this.emit('line', {
              text: line,
              type: 'stderr',
              timestamp: new Date().toISOString()
            })

            if (line.includes('UnsupportedClassVersionError') || line.includes('LinkageError')) {
              this.emit('status', 'offline', 'Java Compatibility Error: Unsupported Class Version')
            }
          }
        }
      })

      this.process.on('close', (code) => {
        this.running = false
        this.process = null

        if (!this.intentionalStop) {
          const autoRestart = settingsStore.get('autoRestartOnCrash')
          if (autoRestart === false) {
            this.emit('status', 'offline')
            this.emit('stopped', code)
          } else {
            this.crashCount++
            const maxRetries = settingsStore.get('autoRestartMaxRetries') ?? 5
            if (this.crashCount > maxRetries) {
              this.emit('status', 'offline')
              this.emit('crashed', { fatal: true, attempts: this.crashCount, message: 'Max restarts exceeded' })
              this.crashCount = 0
              this.emit('stopped', code)
            } else {
              const delay = Math.min(5000 * Math.pow(2, this.crashCount - 1), 60000)
              this.emit('status', 'crashed')
              this.emit('crashed', { fatal: false, attempt: this.crashCount, nextRetryMs: delay })
              this.restartTimer = setTimeout(() => {
                this.start(this.lastConfig).catch((err) => {
                  console.error('Auto-restart start error:', err)
                })
              }, delay)
            }
          }
        } else {
          this.emit('status', 'offline')
          this.emit('stopped', code)
        }
      })

      this.process.on('error', (err) => {
        this.running = false
        this.process = null
        this.emit('status', 'offline')
        this.emit('error', err)
        reject(err)
      })

      // Resolve immediately — the process has spawned successfully.
      // Callers listen for 'started' or 'error' events for full status.
      resolve()
    })
  }

  /**
   * Gracefully stops the server by sending the 'stop' command to stdin.
   * Falls back to SIGKILL after 10 seconds if the process hasn't exited.
   * @returns {Promise<void>}
   */
  async stop() {
    this.intentionalStop = true
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    if (this.crashResetTimer) {
      clearTimeout(this.crashResetTimer)
      this.crashResetTimer = null
    }

    if (!this.running || !this.process) {
      throw new Error('Server is not running')
    }

    this.emit('status', 'stopping')
    this.process.stdin.write('stop\n')

    return new Promise((resolve) => {
      const killTimeout = setTimeout(() => {
        if (this.process) {
          this._forceKill()
        }
        resolve()
      }, 10000)

      this.once('stopped', () => {
        clearTimeout(killTimeout)
        resolve()
      })
    })
  }

  /**
   * Restarts the server by stopping it (if running) and starting it
   * again with the last used configuration.
   * @returns {Promise<void>}
   */
  async restart() {
    this.intentionalStop = true
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    if (this.crashResetTimer) {
      clearTimeout(this.crashResetTimer)
      this.crashResetTimer = null
    }

    if (this.running) {
      await this.stop()
    }
    // Brief delay to let the OS release the port
    await new Promise((r) => setTimeout(r, 1000))

    if (this.lastConfig) {
      await this.start(this.lastConfig)
    }
  }

  /**
   * Sends a raw command string to the server's stdin.
   * @param {string} cmd - The command to send (e.g. 'say Hello')
   */
  sendCommand(cmd) {
    if (!this.running || !this.process || !this.process.stdin) {
      throw new Error('Server is not running')
    }
    this.process.stdin.write(cmd + '\n')
  }

  /**
   * Returns a snapshot of the current server status.
   * @returns {{ running: boolean, pid: number|null, uptime: number, startTime: number|null }}
   */
  getStatus() {
    return {
      running: this.running,
      pid: this.pid,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      startTime: this.startTime
    }
  }

  /**
   * Forcibly kills the server process.
   * Uses taskkill on Windows for reliable process tree termination.
   * Use only as a last resort when graceful shutdown fails.
   */
  kill() {
    this.intentionalStop = true
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    if (this.crashResetTimer) {
      clearTimeout(this.crashResetTimer)
      this.crashResetTimer = null
    }

    if (this.process) {
      this._forceKill()
      this.running = false
      this.process = null
    }
  }

  /**
   * Platform-aware force kill. On Windows, uses taskkill to kill the
   * entire process tree. On other platforms, sends SIGKILL.
   * @private
   */
  _forceKill() {
    this.intentionalStop = true
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    if (this.crashResetTimer) {
      clearTimeout(this.crashResetTimer)
      this.crashResetTimer = null
    }

    if (!this.process) return
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${this.process.pid} /T /F`, { stdio: 'ignore' })
      } else {
        this.process.kill('SIGKILL')
      }
    } catch {
      // Process may have already exited
    }
  }
}

export const serverProcess = new ServerProcess()
export default serverProcess
