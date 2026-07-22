import { EventEmitter } from 'events'
import os from 'os'
import pidusage from 'pidusage'
import pidtree from 'pidtree'
import { execFile } from 'child_process'
import { promisify } from 'util'
import serverProcess from './serverProcess.js'

const execFileAsync = promisify(execFile)

export function parseXmxToGB(xmxStr) {
  if (!xmxStr) return 4.0;
  const match = xmxStr.match(/^(\d+)([gmGM])$/);
  if (!match) return 4.0;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  return unit === 'G' ? val : val / 1024;
}

let mcUtil = null

async function loadMcUtil() {
  if (!mcUtil) mcUtil = await import('minecraft-server-util')
  return mcUtil
}

async function readWindowsProcessUsage(pids, previousCpuTimes, previousSampleAt) {
  const ids = [...new Set(pids.map(Number).filter(Number.isInteger))]
  if (ids.length === 0) return { memory: 0, cpu: 0, cpuTimes: new Map() }

  // WorkingSet64 is the process resident set shown by Windows tools. Unlike
  // pidusage's WMI backend, Get-Process also works when WMI access is denied.
  const command = `Get-Process -Id ${ids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,CPU | ConvertTo-Json -Compress`
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true })
  const parsed = stdout.trim() ? JSON.parse(stdout) : []
  const processes = Array.isArray(parsed) ? parsed : [parsed]
  const sampledAt = Date.now()
  const elapsedMs = previousSampleAt ? sampledAt - previousSampleAt : 0
  const cpuTimes = new Map()
  let memory = 0
  let cpu = 0

  for (const processInfo of processes) {
    const pid = Number(processInfo.Id)
    const cpuTimeMs = Number(processInfo.CPU) * 1000
    memory += Number(processInfo.WorkingSet64) || 0
    if (Number.isFinite(pid) && Number.isFinite(cpuTimeMs)) {
      const previousCpu = previousCpuTimes.get(pid)
      if (Number.isFinite(previousCpu) && elapsedMs > 0) {
        cpu += Math.max(0, ((cpuTimeMs - previousCpu) / elapsedMs) * 100)
      }
      cpuTimes.set(pid, cpuTimeMs)
    }
  }

  return { memory, cpu, cpuTimes, sampledAt }
}

class MonitorService extends EventEmitter {
  constructor() {
    super()
    this.interval = null
    this.pid = null
    this.monitoring = false
    this.processIds = []
    this.lastProcessTreeRead = 0
    this.useWindowsProcessFallback = false
    this.windowsCpuTimes = new Map()
    this.lastWindowsSampleAt = 0
  }

  startMonitoring(pid) {
    this.stopMonitoring()
    this.pid = pid
    this.failCount = 0
    this.processIds = [pid]
    this.lastProcessTreeRead = 0
    this.useWindowsProcessFallback = false
    this.windowsCpuTimes = new Map()
    this.lastWindowsSampleAt = 0
    
    const maxGb = parseXmxToGB(serverProcess.lastConfig?.xmx)
    const maxBytes = maxGb * 1024 * 1024 * 1024

    const poll = async () => {
      // pidusage and pidtree can be comparatively expensive on Windows. Never
      // overlap reads, and refresh the process tree only occasionally.
      if (this.monitoring || !this.pid) return
      this.monitoring = true
      try {
        if (Date.now() - this.lastProcessTreeRead > 15000) {
          try {
            const children = await pidtree(this.pid)
            this.processIds = [...new Set([this.pid, ...(children || [])].map(Number).filter(Number.isInteger))]
            this.lastProcessTreeRead = Date.now()
          } catch { /* use the server pid when child discovery fails */ }
        }

        let totalMem = 0
        let totalCpu = 0

        // Ask pidusage for the whole tree in one OS query. `memory` is RSS in
        // bytes; keeping it numeric prevents the graph from parsing a display
        // string such as "1.2/4.0 GB" back into an unreliable value.
        const sumUsage = (statsByPid) => {
          let memory = 0
          let cpu = 0
          for (const stat of Object.values(statsByPid)) {
            memory += Number(stat.memory) || 0
            cpu += Number(stat.cpu) || 0
          }
          return { memory, cpu }
        }

        let usage
        if (process.platform === 'win32' && this.useWindowsProcessFallback) {
          usage = await readWindowsProcessUsage(this.processIds, this.windowsCpuTimes, this.lastWindowsSampleAt)
          this.windowsCpuTimes = usage.cpuTimes
          this.lastWindowsSampleAt = usage.sampledAt
        } else {
          try {
            usage = sumUsage(await pidusage(this.processIds))
          } catch (error) {
            if (process.platform !== 'win32') throw error
            this.useWindowsProcessFallback = true
            usage = await readWindowsProcessUsage(this.processIds, this.windowsCpuTimes, this.lastWindowsSampleAt)
            this.windowsCpuTimes = usage.cpuTimes
            this.lastWindowsSampleAt = usage.sampledAt
          }
        }
        // A stale child PID must not make a healthy Java process look empty.
        // Retry just the Java PID in that exceptional case.
        if (usage.memory === 0 && this.processIds.length > 1 && !this.useWindowsProcessFallback) {
          usage = sumUsage({ [this.pid]: await pidusage(this.pid) })
        }
        totalMem = usage.memory
        totalCpu = usage.cpu

        if (totalMem === 0) throw new Error('No active processes found')

        const usedGb = totalMem / (1024 * 1024 * 1024)

        this.failCount = 0
        this.emit('stats', {
          // pidusage reports 100% per busy logical core. Normalise the total
          // across all cores so 100% means the entire machine is saturated.
          cpu: Math.min(100, Math.round((totalCpu / os.cpus().length) * 10) / 10),
          ram: {
            usedBytes: totalMem,
            limitBytes: maxBytes,
            used: `${usedGb.toFixed(1)}/${maxGb.toFixed(1)} GB`,
            percent: Math.round((totalMem / os.totalmem()) * 100 * 10) / 10
          },
          timestamp: Date.now()
        })
      } catch (err) {
        this.failCount++
        console.error('Monitoring query failed:', err.message)
        this.emit('monitor-error', err.message)
        if (this.failCount >= 3) {
          this.emit('monitor-unavailable', err.message)
          this.stopMonitoring()
        }
      } finally {
        this.monitoring = false
      }
    }

    // Schedule after each read rather than using setInterval. This maintains
    // one-second updates without concurrent pidusage calls under load.
    const schedulePoll = async () => {
      await poll()
      if (this.pid === pid) {
        this.interval = setTimeout(schedulePoll, 1000)
      }
    }
    schedulePoll()
  }

  stopMonitoring() {
    if (this.interval) {
      clearTimeout(this.interval)
      this.interval = null
    }
    this.pid = null
    this.processIds = []
    this.monitoring = false
    this.windowsCpuTimes.clear()
    this.lastWindowsSampleAt = 0
    pidusage.clear()
  }

  async queryServerStatus(host = 'localhost', port = 25565) {
    try {
      const mc = await loadMcUtil()
      const result = await mc.status(host, port, { timeout: 3000 })
      return {
        online: true,
        players: {
          online: result.players.online,
          max: result.players.max,
          list: (result.players.sample || []).map(p => ({
            name: p.name,
            uuid: p.id
          }))
        },
        version: result.version.name,
        motd: typeof result.motd === 'string' ? result.motd : result.motd?.clean || ''
      }
    } catch {
      return {
        online: false,
        players: { online: 0, max: 0, list: [] },
        version: '',
        motd: ''
      }
    }
  }
}

export const monitorService = new MonitorService()
export default monitorService
