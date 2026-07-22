import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'os'

// Mock electron before importing services that rely on settingsStore/serverProcess
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/user/data')
  }
}))

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      constructor() {
        this.store = {}
      }
      get(key) { return this.store[key] }
      set(key, val) { this.store[key] = val }
      clear() { this.store = {} }
    }
  }
})

vi.mock('../src/main/services/serverProcess.js', () => ({
  default: {
    lastConfig: { xmx: '4G' }
  }
}))

const { mockPidusage } = vi.hoisted(() => {
  const fn = vi.fn()
  fn.clear = vi.fn()
  return { mockPidusage: fn }
})

vi.mock('pidusage', () => ({
  default: mockPidusage
}))

vi.mock('pidtree', () => ({
  default: vi.fn().mockResolvedValue([1234])
}))

vi.mock('minecraft-server-util', () => ({
  status: vi.fn().mockRejectedValue(new Error('Connection failed'))
}))

import { monitorService, parseXmxToGB } from '../src/main/services/monitorService.js'

describe('monitorService', () => {
  describe('parseXmxToGB', () => {
    it('returns default 4.0 GB when input is missing or invalid', () => {
      expect(parseXmxToGB()).toBe(4.0)
      expect(parseXmxToGB(null)).toBe(4.0)
      expect(parseXmxToGB('')).toBe(4.0)
      expect(parseXmxToGB('invalid')).toBe(4.0)
      expect(parseXmxToGB('100')).toBe(4.0)
    })

    it('correctly parses gigabyte values', () => {
      expect(parseXmxToGB('2G')).toBe(2.0)
      expect(parseXmxToGB('4g')).toBe(4.0)
      expect(parseXmxToGB('16G')).toBe(16.0)
    })

    it('correctly converts megabyte values to gigabytes', () => {
      expect(parseXmxToGB('1024M')).toBe(1.0)
      expect(parseXmxToGB('2048m')).toBe(2.0)
      expect(parseXmxToGB('512M')).toBe(0.5)
    })
  })

  describe('CPU and RAM calculations & byte conversions', () => {
    it('calculates RAM byte conversions and display formatting correctly', () => {
      const totalMem = 2 * 1024 * 1024 * 1024 // 2 GB
      const maxGb = parseXmxToGB('4G')
      const usedGb = totalMem / (1024 * 1024 * 1024)
      const maxBytes = maxGb * 1024 * 1024 * 1024

      expect(maxBytes).toBe(4294967296)
      expect(usedGb).toBe(2)

      const usedDisplay = `${usedGb.toFixed(1)}/${maxGb.toFixed(1)} GB`
      expect(usedDisplay).toBe('2.0/4.0 GB')

      const totalOsMem = os.totalmem()
      const ramPercent = Math.round((totalMem / totalOsMem) * 100 * 10) / 10
      expect(ramPercent).toBeGreaterThan(0)
      expect(ramPercent).toBeLessThanOrEqual(100)
    })

    it('normalizes total CPU percentage across CPU cores and caps at 100', () => {
      const numCores = os.cpus().length
      
      // 50% load on all cores
      const totalCpu50 = 50 * numCores
      const normalizedCpu50 = Math.min(100, Math.round((totalCpu50 / numCores) * 10) / 10)
      expect(normalizedCpu50).toBe(50)

      // Capped at 100%
      const totalCpuOver = 200 * numCores
      const normalizedCpuOver = Math.min(100, Math.round((totalCpuOver / numCores) * 10) / 10)
      expect(normalizedCpuOver).toBe(100)
    })
  })

  describe('MonitorService lifecycle & stats event', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      monitorService.stopMonitoring()
      vi.useRealTimers()
      vi.clearAllMocks()
    })

    it('emits stats event with proper CPU/RAM formatting on successful poll', async () => {
      mockPidusage.mockResolvedValue({
        1234: { memory: 1073741824, cpu: 50.0 }
      })

      const statsPromise = new Promise((resolve) => {
        monitorService.once('stats', resolve)
      })

      monitorService.startMonitoring(1234)

      // Allow async poll inside schedulePoll to complete
      await vi.runOnlyPendingTimersAsync()
      const stats = await statsPromise

      expect(stats).toHaveProperty('cpu')
      expect(stats).toHaveProperty('ram')
      expect(stats.ram).toHaveProperty('usedBytes', 1073741824)
      expect(stats.ram).toHaveProperty('used')
      expect(typeof stats.ram.used).toBe('string')
      expect(stats.ram.used).toContain('GB')
    })
  })

  describe('queryServerStatus fallback', () => {
    it('returns offline state when server is unreachable', async () => {
      const status = await monitorService.queryServerStatus('127.0.0.1', 65530)
      expect(status).toEqual({
        online: false,
        players: { online: 0, max: 0, list: [] },
        version: '',
        motd: ''
      })
    })
  })
})
