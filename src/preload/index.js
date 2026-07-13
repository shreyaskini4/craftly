import { contextBridge, ipcRenderer } from 'electron'

// Expose protected API to the renderer process
contextBridge.exposeInMainWorld('api', {
  // ─── Server Control ───────────────────────────────────────────────
  server: {
    start: () => ipcRenderer.invoke('server:start'),
    stop: () => ipcRenderer.invoke('server:stop'),
    restart: () => ipcRenderer.invoke('server:restart'),
    sendCommand: (cmd) => ipcRenderer.invoke('server:send-command', cmd),
    getStatus: () => ipcRenderer.invoke('server:status')
  },

  // ─── Version Manager ──────────────────────────────────────────────
  versions: {
    fetchVanilla: () => ipcRenderer.invoke('versions:fetch-vanilla'),
    fetchPaper: () => ipcRenderer.invoke('versions:fetch-paper'),
    fetchPaperBuilds: (version) => ipcRenderer.invoke('versions:fetch-paper-builds', version),
    fetchFabric: () => ipcRenderer.invoke('versions:fetch-fabric'),
    fetchFabricLoaders: (gameVersion) => ipcRenderer.invoke('versions:fetch-fabric-loaders', gameVersion),
    download: (type, version, build) => ipcRenderer.invoke('versions:download', type, version, build),
    acceptEula: () => ipcRenderer.invoke('versions:accept-eula')
  },

  // ─── Mod Management ───────────────────────────────────────────────
  mods: {
    search: (query, filters) => ipcRenderer.invoke('mods:search', query, filters),
    install: (projectId, versionId) => ipcRenderer.invoke('mods:install', projectId, versionId),
    uninstall: (filename) => ipcRenderer.invoke('mods:uninstall', filename),
    getInstalled: () => ipcRenderer.invoke('mods:installed'),
    checkUpdates: () => ipcRenderer.invoke('mods:check-updates')
  },

  // ─── Backup Management ────────────────────────────────────────────
  backups: {
    create: () => ipcRenderer.invoke('backups:create'),
    restore: (backupPath) => ipcRenderer.invoke('backups:restore', backupPath),
    delete: (backupPath) => ipcRenderer.invoke('backups:delete', backupPath),
    list: () => ipcRenderer.invoke('backups:list'),
    setSchedule: (hours) => ipcRenderer.invoke('backups:set-schedule', hours),
    getSchedule: () => ipcRenderer.invoke('backups:get-schedule'),
    openFolder: () => ipcRenderer.invoke('backups:open-folder')
  },

  // ─── Settings ─────────────────────────────────────────────────────
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    browseJava: () => ipcRenderer.invoke('settings:browse-java'),
    scanDir: () => ipcRenderer.invoke('settings:browse-dir'),
    importServer: (data) => ipcRenderer.invoke('settings:import-server', data),
    detectJava: () => ipcRenderer.invoke('settings:detect-java'),
    checkDirEmpty: (dirPath) => ipcRenderer.invoke('settings:check-dir-empty', dirPath),
    provisionJava: (version) => ipcRenderer.invoke('settings:provision-java', version),
    listProvisionedJava: () => ipcRenderer.invoke('settings:list-provisioned-java'),
    deleteProvisionedJava: (version) => ipcRenderer.invoke('settings:delete-provisioned-java', version)
  },

  // ─── Properties ───────────────────────────────────────────────────
  properties: {
    read: () => ipcRenderer.invoke('properties:read'),
    write: (props) => ipcRenderer.invoke('properties:write', props)
  },

  // ─── Event Listeners (main → renderer push channels) ──────────────
  on: {
    consoleLine: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('console:line', handler)
      return handler
    },
    serverStatus: (callback) => {
      const handler = (_event, status) => callback(status)
      ipcRenderer.on('server:status-change', handler)
      return handler
    },
    monitorStats: (callback) => {
      const handler = (_event, stats) => callback(stats)
      ipcRenderer.on('monitoring:stats', handler)
      return handler
    },
    monitorServerStatus: (callback) => {
      const handler = (_event, status) => callback(status)
      ipcRenderer.on('monitoring:server-status', handler)
      return handler
    },
    monitorError: (callback) => {
      const handler = (_event, msg) => callback(msg)
      ipcRenderer.on('monitoring:error', handler)
      return handler
    },
    downloadProgress: (callback) => {
      const handler = (_event, progress) => callback(progress)
      ipcRenderer.on('download:progress', handler)
      return handler
    },
    backupProgress: (callback) => {
      const handler = (_event, progress) => callback(progress)
      ipcRenderer.on('backup:progress', handler)
      return handler
    }
  },

  // ─── Remove Listeners (cleanup) ───────────────────────────────────
  removeListener: {
    consoleLine: (handler) => {
      if (handler) {
        ipcRenderer.removeListener('console:line', handler)
      } else {
        ipcRenderer.removeAllListeners('console:line')
      }
    },
    serverStatus: (handler) => {
      if (handler) {
        ipcRenderer.removeListener('server:status-change', handler)
      } else {
        ipcRenderer.removeAllListeners('server:status-change')
      }
    },
    monitorStats: (handler) => {
      if (handler) {
        ipcRenderer.removeListener('monitoring:stats', handler)
      } else {
        ipcRenderer.removeAllListeners('monitoring:stats')
      }
    },
    monitorServerStatus: (handler) => {
      if (handler) {
        ipcRenderer.removeListener('monitoring:server-status', handler)
      } else {
        ipcRenderer.removeAllListeners('monitoring:server-status')
      }
    },
    monitorError: (handler) => {
      if (handler) {
        ipcRenderer.removeListener('monitoring:error', handler)
      } else {
        ipcRenderer.removeAllListeners('monitoring:error')
      }
    },
    downloadProgress: (handler) => {
      if (handler) {
        ipcRenderer.removeListener('download:progress', handler)
      } else {
        ipcRenderer.removeAllListeners('download:progress')
      }
    },
    backupProgress: (handler) => {
      if (handler) {
        ipcRenderer.removeListener('backup:progress', handler)
      } else {
        ipcRenderer.removeAllListeners('backup:progress')
      }
    }
  },

  // ─── Window Controls ──────────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close')
  }
})
