import { ipcMain } from 'electron'
import settingsStore from '../services/settingsStore.js'
import { sendWebhook } from '../services/webhookService.js'

export function registerWebhooksIpc(_mainWindow) {
  ipcMain.handle('webhooks:test', async (_event, url) => {
    // Sends a test embed to the specified URL to check if it's working
    // Color: Purple `10181046` (#9b59b6)
    return await sendWebhook('test', {
      title: 'Test Notification',
      description: 'This is a test notification from Craftly!',
      color: 10181046
    }, url)
  })

  ipcMain.handle('webhooks:get-config', async () => {
    return {
      url: settingsStore.get('discordWebhookUrl'),
      toggles: settingsStore.get('discordWebhookEvents')
    }
  })

  ipcMain.handle('webhooks:set-config', async (_event, data) => {
    if (data) {
      if (data.url !== undefined) {
        settingsStore.set('discordWebhookUrl', data.url)
      }
      if (data.toggles !== undefined) {
        settingsStore.set('discordWebhookEvents', data.toggles)
      }
    }
    return true
  })
}
