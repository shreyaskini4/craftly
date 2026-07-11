import { EventEmitter } from 'events'
import os from 'os'
import pidusage from 'pidusage'
import pidtree from 'pidtree'
import serverProcess from './serverProcess.js'

function parseXmxToGB(xmxStr) {
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

class MonitorService extends EventEmitter {
  constructor() {
    super()
    this.interval = null
    this.pid = null
  }

  startMonitoring(pid) {
    this.stopMonitoring()
    this.pid = pid
    this.failCount = 0
    
    const maxGb = parseXmxToGB(serverProcess.lastConfig?.xmx)

    this.interval = setInterval(async () => {
      try {
        let pids = [this.pid]
        try {
          const children = await pidtree(this.pid)
          if (children && children.length > 0) pids = pids.concat(children)
        } catch (e) { /* ignore */ }

        let maxMem = 0
        let maxCpu = 0

        for (const p of pids) {
          try {
            const stat = await pidusage(p)
            if (stat && stat.memory > maxMem) {
              maxMem = stat.memory
              maxCpu = stat.cpu
            }
          } catch (e) { /* ignore dead processes */ }
        }

        if (maxMem === 0) throw new Error('No active processes found')

        const usedGb = maxMem / (1024 * 1024 * 1024)

        this.failCount = 0
        this.emit('stats', {
          cpu: Math.round((maxCpu / os.cpus().length) * 10) / 10,
          ram: {
            used: `${usedGb.toFixed(1)}/${maxGb.toFixed(1)} GB`,
            percent: Math.round((maxMem / os.totalmem()) * 100 * 10) / 10
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
      }
    }, 2000)
  }

  stopMonitoring() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.pid = null
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
