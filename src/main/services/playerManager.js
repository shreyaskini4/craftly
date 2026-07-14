import ElectronStore from 'electron-store'
import serverProcess from './serverProcess.js'
import settingsStore from './settingsStore.js'
import fs from 'fs'
import path from 'path'

const Store = ElectronStore.default || ElectronStore
const store = new Store({
  name: 'player-history',
  defaults: {
    history: []
  }
})

const joinRegex = /:\s+([a-zA-Z0-9_]{2,16})\s+joined the game/
const leaveRegex = /:\s+([a-zA-Z0-9_]{2,16})\s+left the game/

serverProcess.on('line', (data) => {
  if (!data || !data.text) return
  const text = data.text

  let match = text.match(joinRegex)
  if (match) {
    const name = match[1]
    addHistoryEntry(name, 'joined')
    return
  }

  match = text.match(leaveRegex)
  if (match) {
    const name = match[1]
    addHistoryEntry(name, 'left')
    return
  }
})

function addHistoryEntry(name, action) {
  try {
    let history = store.get('history') || []
    const entry = {
      name,
      action,
      timestamp: new Date().toISOString()
    }
    history.push(entry)
    if (history.length > 500) {
      history = history.slice(history.length - 500)
    }
    store.set('history', history)
  } catch (err) {
    console.error('Error writing player history:', err)
  }
}

export function getHistory() {
  return store.get('history') || []
}

export function getOps() {
  const serverDir = settingsStore.get('serverDir')
  if (!serverDir) return []
  const filePath = path.join(serverDir, 'ops.json')
  if (!fs.existsSync(filePath)) return []
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data) || []
  } catch (err) {
    console.error('Error reading ops.json:', err)
    return []
  }
}

export function getWhitelist() {
  const serverDir = settingsStore.get('serverDir')
  if (!serverDir) return []
  const filePath = path.join(serverDir, 'whitelist.json')
  if (!fs.existsSync(filePath)) return []
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data) || []
  } catch (err) {
    console.error('Error reading whitelist.json:', err)
    return []
  }
}

export function getBannedPlayers() {
  const serverDir = settingsStore.get('serverDir')
  if (!serverDir) return []
  const filePath = path.join(serverDir, 'banned-players.json')
  if (!fs.existsSync(filePath)) return []
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data) || []
  } catch (err) {
    console.error('Error reading banned-players.json:', err)
    return []
  }
}

export default {
  getHistory,
  getOps,
  getWhitelist,
  getBannedPlayers
}
