import serverProcess from './serverProcess.js'
import backupManager from './backupManager.js'
import settingsStore from './settingsStore.js'

/**
 * Sends a payload to the Discord Webhook URL.
 *
 * @param {string} event - The event name ('start', 'stop', 'crash', 'backup', or 'test')
 * @param {object} embedData - The embed contents (title, description, color)
 * @param {string} [overrideUrl] - Optional URL override for testing
 * @returns {Promise<boolean>} True if successful
 */
export async function sendWebhook(event, embedData, overrideUrl = null) {
  const url = overrideUrl || settingsStore.get('discordWebhookUrl')
  if (!url) {
    return false
  }

  // Only check toggles if we are not overriding the URL (e.g. it's not a test call)
  if (!overrideUrl) {
    const toggles = settingsStore.get('discordWebhookEvents') || {}
    if (toggles[event] === false) {
      return false
    }
  }

  const payload = {
    embeds: [
      {
        title: embedData.title,
        description: embedData.description,
        color: embedData.color,
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Craftly Server Manager'
        }
      }
    ]
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      console.error(`Discord webhook failed with status: ${response.status}`)
      return false
    }

    return true
  } catch (error) {
    console.error('Error sending Discord webhook:', error)
    return false
  }
}

// Set up event listeners
serverProcess.on('started', () => {
  sendWebhook('start', {
    title: 'Server Online',
    description: 'Minecraft server is up and running.',
    color: 3066993
  })
})

serverProcess.on('stopped', () => {
  sendWebhook('stop', {
    title: 'Server Offline',
    description: 'Minecraft server has been stopped.',
    color: 15158332
  })
})

serverProcess.on('crashed', (info) => {
  if (info) {
    if (info.fatal) {
      sendWebhook('crash', {
        title: 'Server Fatal Crash',
        description: 'Minecraft server crashed repeatedly and has been suspended.',
        color: 15158332
      })
    } else {
      sendWebhook('crash', {
        title: 'Server Crash Detected',
        description: `Server crashed and is restarting in ${info.nextRetryMs / 1000} seconds... (Attempt ${info.attempt})`,
        color: 15158332
      })
    }
  }
})

backupManager.on('complete', (data) => {
  if (data) {
    const sizeMb = ((data.size || 0) / 1024 / 1024).toFixed(2)
    sendWebhook('backup', {
      title: 'Backup Completed',
      description: `Created backup: ${data.name} (${sizeMb} MB)`,
      color: 3447003
    })
  }
})
