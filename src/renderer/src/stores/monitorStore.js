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
  monitorError: null,

  updateStats: (stats) => {
    set((state) => {
      const now = new Date().toLocaleTimeString('en-US', { hour12: false })
      return {
        cpuHistory: [...state.cpuHistory, { time: now, value: stats.cpu }].slice(-MAX_HISTORY),
        ramHistory: [...state.ramHistory, { time: now, value: stats.ram.used }].slice(-MAX_HISTORY),
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
      currentRam: { used: 0, total: 0, percent: 0 },
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
