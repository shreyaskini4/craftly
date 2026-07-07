import { create } from 'zustand'
import { toast } from 'sonner'

const useBackupStore = create((set, get) => ({
  backups: [],
  creating: false,
  restoring: false,
  autoBackup: { enabled: false, intervalHours: 6 },
  loading: false,

  loadBackups: async () => {
    set({ loading: true })
    try {
      const backups = await window.api.backups.list()
      set({ backups: backups || [], loading: false })
    } catch (err) {
      toast.error('Failed to load backups: ' + (err.message || err))
      set({ loading: false })
    }
  },

  createBackup: async () => {
    set({ creating: true })
    try {
      await window.api.backups.create()
      toast.success('Backup created successfully')
      get().loadBackups()
    } catch (err) {
      toast.error('Failed to create backup: ' + (err.message || err))
    } finally {
      set({ creating: false })
    }
  },

  restoreBackup: async (path) => {
    set({ restoring: true })
    try {
      await window.api.backups.restore(path)
      toast.success('Backup restored successfully')
    } catch (err) {
      toast.error('Failed to restore backup: ' + (err.message || err))
    } finally {
      set({ restoring: false })
    }
  },

  deleteBackup: async (path) => {
    try {
      await window.api.backups.delete(path)
      toast.success('Backup deleted')
      get().loadBackups()
    } catch (err) {
      toast.error('Failed to delete backup: ' + (err.message || err))
    }
  },

  setAutoBackup: (config) => {
    set((state) => ({
      autoBackup: { ...state.autoBackup, ...config }
    }))
  },

  loadSchedule: async () => {
    try {
      const schedule = await window.api.backups.getSchedule()
      if (schedule) {
        set({
          autoBackup: {
            enabled: schedule.enabled ?? false,
            intervalHours: schedule.intervalHours ?? 6
          }
        })
      }
    } catch (err) {
      console.error('Failed to load backup schedule:', err)
    }
  }
}))

export default useBackupStore
