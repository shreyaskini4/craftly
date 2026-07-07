import { create } from 'zustand'

const MAX_HISTORY = 150
let listenersInitialized = false

const useMonitorStore = create((set) => ({
  cpuHistory: [],
  ramHistory: [],
  currentCpu: 0,
  currentRam: { used: 0, total: 0, percent: 0 },
  players: { online: 0, max: 0, list: [] },
  tps: null,
  serverInfo: { version: '', motd: '' },

  updateStats: (stats) => {
    set((state) => {
      const now = new Date().toLocaleTimeString('en-US', { hour12: false })

      const cpuEntry = { time: now, value: stats.cpu ?? state.currentCpu }
      const ramEntry = { time: now, value: stats.ram?.used ?? state.currentRam.used }

      const newCpuHistory = [...state.cpuHistory, cpuEntry].slice(-MAX_HISTORY)
      const newRamHistory = [...state.ramHistory, ramEntry].slice(-MAX_HISTORY)

      return {
        cpuHistory: newCpuHistory,
        ramHistory: newRamHistory,
        currentCpu: stats.cpu ?? state.currentCpu,
        currentRam: stats.ram ?? state.currentRam,
        players: stats.players ?? state.players,
        tps: stats.tps !== undefined ? stats.tps : state.tps,
        serverInfo: stats.serverInfo ?? state.serverInfo
      }
    })
  },

  setPlayers: (players) => set({ players }),

  setTps: (tps) => set({ tps }),

  resetMonitor: () =>
    set({
      cpuHistory: [],
      ramHistory: [],
      currentCpu: 0,
      currentRam: { used: 0, total: 0, percent: 0 },
      players: { online: 0, max: 0, list: [] },
      tps: null,
      serverInfo: { version: '', motd: '' }
    }),

  fetchStats: () => {
    setInterval(async () => {
      try {
        if (window.api && window.api.server) {
          const status = await window.api.server.getStatus()
          // Optionally update state if needed, but primarily catching errors
        }
      } catch (err) {
        console.error('Error fetching server status:', err)
      }
    }, 5000)
  },

  initListeners: () => {
    if (listenersInitialized || !window.api) return
    listenersInitialized = true

    window.api.on.monitorStats((stats) => {
      useMonitorStore.getState().updateStats(stats)
    })
    
    useMonitorStore.getState().fetchStats()
  }
}))

export default useMonitorStore
