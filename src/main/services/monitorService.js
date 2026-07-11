import { EventEmitter } from 'events'
import os from 'os'
import pidusage from 'pidusage'

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

    this.interval = setInterval(async () => {
      try {
        const stats = await pidusage(this.pid)
        this.failCount = 0
        this.emit('stats', {
          cpu: Math.round((stats.cpu / os.cpus().length) * 10) / 10,
          ram: {
            used: Math.round(stats.memory / 1024 / 1024),
            percent: Math.round((stats.memory / os.totalmem()) * 100 * 10) / 10
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
