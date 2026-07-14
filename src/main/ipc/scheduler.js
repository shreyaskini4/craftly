import { ipcMain } from 'electron'
import crypto from 'crypto'
import settingsStore from '../services/settingsStore.js'
import schedulerService from '../services/schedulerService.js'

export function registerSchedulerIpc(_mainWindow) {
  ipcMain.handle('scheduler:list', async () => {
    const jobs = settingsStore.get('scheduledJobs') || []
    return jobs.map((job) => ({
      ...job,
      nextRunTime: schedulerService.getNextRunTime(job.id)
    }))
  })

  ipcMain.handle('scheduler:add', async (_event, jobData) => {
    const jobs = settingsStore.get('scheduledJobs') || []
    const newJob = {
      id: crypto.randomUUID(),
      name: jobData.name || 'Unnamed Task',
      type: jobData.type || 'restart',
      intervalHours: parseFloat(jobData.intervalHours) || 12,
      command: jobData.command || '',
      warningSeconds: jobData.warningSeconds !== undefined ? parseInt(jobData.warningSeconds) : 60,
      enabled: jobData.enabled !== undefined ? !!jobData.enabled : true
    }
    jobs.push(newJob)
    settingsStore.set('scheduledJobs', jobs)
    schedulerService.startJob(newJob)
    return newJob
  })

  ipcMain.handle('scheduler:update', async (_event, id, updatedConfig) => {
    const jobs = settingsStore.get('scheduledJobs') || []
    const index = jobs.findIndex((j) => j.id === id)
    if (index === -1) {
      throw new Error(`Job with ID ${id} not found`)
    }
    const existingJob = jobs[index]
    const updatedJob = {
      ...existingJob,
      ...updatedConfig,
      id // Ensure ID cannot be changed
    }

    if (updatedJob.intervalHours !== undefined) {
      updatedJob.intervalHours = parseFloat(updatedJob.intervalHours) || 12
    }
    if (updatedJob.warningSeconds !== undefined) {
      updatedJob.warningSeconds = parseInt(updatedJob.warningSeconds) || 0
    }
    if (updatedJob.enabled !== undefined) {
      updatedJob.enabled = !!updatedJob.enabled
    }

    jobs[index] = updatedJob
    settingsStore.set('scheduledJobs', jobs)

    // Restart/apply job in scheduler
    schedulerService.startJob(updatedJob)

    return updatedJob
  })

  ipcMain.handle('scheduler:remove', async (_event, id) => {
    const jobs = settingsStore.get('scheduledJobs') || []
    const filteredJobs = jobs.filter((j) => j.id !== id)
    settingsStore.set('scheduledJobs', filteredJobs)
    schedulerService.stopJob(id)
    return true
  })
}
