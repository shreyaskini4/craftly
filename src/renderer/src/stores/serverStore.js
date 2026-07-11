import { create } from 'zustand'

const MAX_CONSOLE_LINES = 1000
let lineIdCounter = 0
let listenersInitialized = false
let pendingLines = []
let flushTimer = null

const useServerStore = create((set, get) => ({
  status: 'offline',
  consoleLines: [],
  pid: null,
  startTime: null,

  addConsoleLine: (lineData) => {
    const id = ++lineIdCounter
    const text = typeof lineData === 'string' ? lineData : lineData.text
    const timestamp = (typeof lineData === 'object' && lineData.timestamp)
      ? new Date(lineData.timestamp).toLocaleTimeString('en-US', { hour12: false })
      : new Date().toLocaleTimeString('en-US', { hour12: false })

    let type = 'default'
    if (/\bERROR\b|\bSEVERE\b|\bFATAL\b/i.test(text)) {
      type = 'error'
    } else if (/\bWARN(ING)?\b/i.test(text)) {
      type = 'warn'
    } else if (/\bINFO\b/i.test(text)) {
      type = 'info'
    }

    const line = { id, text, type, timestamp }

    pendingLines.push(line)
    if (flushTimer) return

    flushTimer = setTimeout(() => {
      const lines = pendingLines
      pendingLines = []
      flushTimer = null
      set((state) => {
        const newLines = [...state.consoleLines, ...lines]
        if (newLines.length > MAX_CONSOLE_LINES) {
          return { consoleLines: newLines.slice(-MAX_CONSOLE_LINES) }
        }
        return { consoleLines: newLines }
      })
    }, 100)
  },

  setStatus: (status) => {
    set({ status })
    if (status === 'online') {
      set({ startTime: Date.now() })
    } else if (status === 'offline') {
      set({ startTime: null, pid: null })
    }
  },

  setPid: (pid) => set({ pid }),

  clearConsole: () => {
    pendingLines = []
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = null
    set({ consoleLines: [] })
  },

  setStartTime: (startTime) => set({ startTime }),

  initListeners: () => {
    if (listenersInitialized || !window.api) return
    listenersInitialized = true

    window.api.on.consoleLine((lineData) => {
      useServerStore.getState().addConsoleLine(lineData)
    })

    window.api.on.serverStatus((status) => {
      useServerStore.getState().setStatus(status)
    })
  }
}))

export default useServerStore
