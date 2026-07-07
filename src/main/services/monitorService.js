import { EventEmitter } from 'events'
import os from 'os'

let si = null
let mcUtil = null

async function loadSi() {
  if (!si) si = await import('systeminformation')
  return si.default || si
}

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

    this.interval = setInterval(async () => {
      try {
        const sysinfo = await loadSi()
        const procs = await sysinfo.processes()
        const proc = procs.list.find(p => p.pid === this.pid)

        if (proc) {
          this.emit('stats', {
            cpu: Math.round(proc.cpu * 10) / 10,
            ram: {
              used: Math.round(proc.memRss / 1024), // MB
              percent: Math.round((proc.memRss * 1024) / os.totalmem() * 100 * 10) / 10
            },
            timestamp: Date.now()
          })
        }
      } catch (err) {
        console.error('Monitoring query failed:', err.message)
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
