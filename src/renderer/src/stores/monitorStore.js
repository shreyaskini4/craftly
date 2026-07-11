import { create } from 'zustand'

const MAX_HISTORY = 60
let listenersInitialized = false

const useMonitorStore = create((set) => ({
  cpuHistory: [],
  ramHistory: [],
  currentCpu: 0,
  currentRam: { used: '—', usedBytes: null, limitBytes: null, percent: 0 },
  players: { online: 0, max: 0, list: [] },
  tps: null,
  serverInfo: { version: '', motd: '' },
  monitorError: null,

  updateStats: (stats) => {
    if (!stats || !Number.isFinite(stats.cpu) || !Number.isFinite(stats.ram?.usedBytes)) return
    set((state) => {
      const timestamp = Number.isFinite(stats.timestamp) ? stats.timestamp : Date.now()
      const now = new Date(timestamp).toLocaleTimeString('en-US', { hour12: false })
      const ramGb = stats.ram.usedBytes / (1024 * 1024 * 1024)
      return {
        cpuHistory: [...state.cpuHistory, { time: now, value: stats.cpu, timestamp }].slice(-MAX_HISTORY),
        ramHistory: [...state.ramHistory, { time: now, value: ramGb, timestamp }].slice(-MAX_HISTORY),
        currentCpu: stats.cpu,
        currentRam: stats.ram,
        monitorError: null
      }
    })
  },

  updateServerStatus: (status) => {
    set({
      players: status.players,
      tps: status.tps !== undefined ? status.tps : null,
      serverInfo: { version: status.version, motd: status.motd }
    })
  },

  setMonitorError: (msg) => set({ monitorError: msg }),

  resetMonitor: () =>
    set({
      cpuHistory: [], ramHistory: [], currentCpu: 0,
      currentRam: { used: '—', usedBytes: null, limitBytes: null, percent: 0 },
      players: { online: 0, max: 0, list: [] },
      tps: null, serverInfo: { version: '', motd: '' }, monitorError: null
    }),

  initListeners: () => {
    if (listenersInitialized || !window.api) return
    listenersInitialized = true
    window.api.on.monitorStats((stats) => useMonitorStore.getState().updateStats(stats))
    window.api.on.monitorServerStatus((status) => useMonitorStore.getState().updateServerStatus(status))
    window.api.on.monitorError((msg) => useMonitorStore.getState().setMonitorError(msg))
  }
}))

export default useMonitorStore
