import serverProcess from './serverProcess.js'
import settingsStore from './settingsStore.js'

/**
 * Manages scheduled tasks like automatic restarts and scheduled command execution.
 */
class SchedulerService {
  constructor() {
    // Maps job.id to { interval, timeouts: [], nextRunTime, job }
    this.activeTimers = new Map()
  }

  /**
   * Starts a scheduled job. Clears any existing timers for the same job first.
   * @param {object} job
   */
  startJob(job) {
    this.stopJob(job.id)

    if (!job.enabled) {
      return
    }

    const intervalMs = job.intervalHours * 60 * 60 * 1000
    const nextRunTime = Date.now() + intervalMs

    const activeEntry = {
      interval: null,
      timeouts: [],
      nextRunTime,
      job
    }
    this.activeTimers.set(job.id, activeEntry)

    const runTask = () => {
      // Update nextRunTime for the next cycle
      activeEntry.nextRunTime = Date.now() + intervalMs

      if (job.type === 'restart') {
        const warningSeconds = job.warningSeconds || 0
        if (warningSeconds <= 0) {
          try {
            if (serverProcess.isRunning) {
              serverProcess.restart()
            }
          } catch (err) {
            console.error(`[Scheduler] Failed to execute scheduled restart for job ${job.id}:`, err)
          }
        } else {
          // Send initial warning
          try {
            if (serverProcess.isRunning) {
              serverProcess.sendCommand(`say Server restarting in ${warningSeconds} seconds...`)
            }
          } catch (err) {
            console.error(`[Scheduler] Failed to send warning for job ${job.id}:`, err)
          }

          // Clear previous run's warning timeouts if any (normally empty)
          activeEntry.timeouts.forEach(t => clearTimeout(t))
          activeEntry.timeouts = []

          // Checkpoints
          if (warningSeconds > 60) {
            const t60 = setTimeout(() => {
              try {
                if (serverProcess.isRunning) {
                  serverProcess.sendCommand('say Server restarting in 60 seconds...')
                }
              } catch (err) {
                console.error(err)
              }
            }, (warningSeconds - 60) * 1000)
            activeEntry.timeouts.push(t60)
          }

          if (warningSeconds > 30) {
            const t30 = setTimeout(() => {
              try {
                if (serverProcess.isRunning) {
                  serverProcess.sendCommand('say Server restarting in 30 seconds...')
                }
              } catch (err) {
                console.error(err)
              }
            }, (warningSeconds - 30) * 1000)
            activeEntry.timeouts.push(t30)
          }

          if (warningSeconds > 10) {
            const t10 = setTimeout(() => {
              try {
                if (serverProcess.isRunning) {
                  serverProcess.sendCommand('say Server restarting in 10 seconds...')
                }
              } catch (err) {
                console.error(err)
              }
            }, (warningSeconds - 10) * 1000)
            activeEntry.timeouts.push(t10)
          }

          const tRestart = setTimeout(() => {
            try {
              if (serverProcess.isRunning) {
                serverProcess.restart()
              }
            } catch (err) {
              console.error(`[Scheduler] Failed to restart server for job ${job.id}:`, err)
            }
            activeEntry.timeouts = []
          }, warningSeconds * 1000)
          activeEntry.timeouts.push(tRestart)
        }
      } else if (job.type === 'command') {
        try {
          if (serverProcess.isRunning && job.command) {
            serverProcess.sendCommand(job.command)
          }
        } catch (err) {
          console.error(`[Scheduler] Failed to run command for job ${job.id}:`, err)
        }
      }
    }

    activeEntry.interval = setInterval(runTask, intervalMs)
  }

  /**
   * Stops and clears all active timers for a job.
   * @param {string} id
   */
  stopJob(id) {
    const active = this.activeTimers.get(id)
    if (active) {
      if (active.interval) {
        clearInterval(active.interval)
      }
      if (active.timeouts) {
        active.timeouts.forEach(t => clearTimeout(t))
      }
      this.activeTimers.delete(id)
    }
  }

  /**
   * Returns the calculated next run timestamp for an active job ID, or null.
   * @param {string} id
   * @returns {number|null}
   */
  getNextRunTime(id) {
    const active = this.activeTimers.get(id)
    return active ? active.nextRunTime : null
  }

  /**
   * Initializes all enabled jobs from settings store.
   */
  initAllJobs() {
    const jobs = settingsStore.get('scheduledJobs') || []
    for (const job of jobs) {
      this.startJob(job)
    }
  }
}

export const schedulerService = new SchedulerService()
export default schedulerService
