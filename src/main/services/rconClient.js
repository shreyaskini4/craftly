import settingsStore from './settingsStore'

class RconManager {
  constructor() {
    this.client = null
    this.connected = false
    this.config = null
  }

  get isConnected() {
    return this.connected
  }

  async connect(host = 'localhost', port = 25575, password = '') {
    try {
      const { Rcon } = await import('rcon-client')
      this.client = await Rcon.connect({ host, port, password, timeout: 5000 })
      this.connected = true
      this.config = { host, port, password }

      this.client.on('end', () => {
        this.connected = false
      })

      return true
    } catch (err) {
      this.connected = false
      console.error('RCON connection failed:', err.message)
      return false
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.end()
      } catch { /* ignore */ }
      this.client = null
      this.connected = false
    }
  }

  async sendCommand(command) {
    if (!this.connected || !this.client) {
      throw new Error('RCON not connected')
    }
    try {
      const response = await this.client.send(command)
      return response
    } catch (err) {
      this.connected = false
      throw err
    }
  }

  async getTps() {
    try {
      const serverType = settingsStore.get('serverType')
      if (serverType !== 'paper') {
        return {
          tps1m: 'N/A',
          tps5m: 'N/A',
          tps15m: 'N/A',
          error: 'TPS monitoring requires a Paper server'
        }
      }

      const response = await this.sendCommand('tps')
      // Paper/Spigot format: §aTPS from last 1m, 5m, 15m: §a*20.0, §a*20.0, §a*20.0
      const cleaned = response.replace(/§[0-9a-fk-or]/g, '').replace(/\*/g, '')
      const numbers = cleaned.match(/[\d.]+/g)
      if (numbers && numbers.length >= 3) {
        return {
          tps1m: parseFloat(numbers[numbers.length - 3]),
          tps5m: parseFloat(numbers[numbers.length - 2]),
          tps15m: parseFloat(numbers[numbers.length - 1])
        }
      }
      return null
    } catch {
      return null
    }
  }

  async getPlayerList() {
    try {
      const response = await this.sendCommand('list')
      // Format: "There are X of a max of Y players online: player1, player2"
      const match = response.match(/:\s*(.+)$/)
      if (match && match[1].trim()) {
        return match[1].split(',').map(p => p.trim()).filter(Boolean)
      }
      return []
    } catch {
      return []
    }
  }
}

export const rconManager = new RconManager()
export default rconManager
