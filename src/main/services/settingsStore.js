import { app } from 'electron'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import ElectronStore from 'electron-store'

const Store = ElectronStore.default || ElectronStore

/**
 * Settings persistence using electron-store.
 * Provides centralized configuration management with sensible defaults.
 */

const defaults = {
  javaPath: 'java',
  xmx: '4G',
  xms: '2G',
  serverDir: join(app.getPath('userData'), 'server'),
  backupsDir: join(app.getPath('userData'), 'backups'),
  serverType: 'vanilla',
  serverVersion: '',
  serverBuild: '',
  rconEnabled: true,
  rconPort: 25575,
  rconPassword: 'changeme',
  autoBackupEnabled: false,
  autoBackupInterval: 6,
  installedMods: []
}

const store = new Store({
  name: 'settings',
  defaults
})

/**
 * Get a single setting value.
 * @param {string} key - The setting key
 * @returns {*} The setting value
 */
export function get(key) {
  return store.get(key)
}

/**
 * Set a single setting value.
 * @param {string} key - The setting key
 * @param {*} value - The value to set
 */
export function set(key, value) {
  store.set(key, value)
}

/**
 * Get all settings as a plain object.
 * @returns {object} All settings
 */
export function getAll() {
  return store.store
}

/**
 * Reset all settings to defaults.
 */
export function reset() {
  store.clear()
}

/**
 * Ensure the server and backups directories exist.
 * Creates them recursively if they don't exist.
 */
export async function ensureDirectories() {
  const serverDir = store.get('serverDir')
  const backupsDir = store.get('backupsDir')

  try {
    await mkdir(serverDir, { recursive: true })
  } catch (err) {
    console.error(`Failed to create server directory: ${err.message}`)
  }

  try {
    await mkdir(backupsDir, { recursive: true })
  } catch (err) {
    console.error(`Failed to create backups directory: ${err.message}`)
  }
}

export default {
  get,
  set,
  getAll,
  reset,
  ensureDirectories
}
