import { useState, useEffect } from 'react'
import { Download, FolderOpen, Search, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

function SettingsPage() {
  const [settings, setSettings] = useState(null)
  const [versions, setVersions] = useState([])
  const [builds, setBuilds] = useState([])
  const [loaders, setLoaders] = useState([])
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [fetchingVersions, setFetchingVersions] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [javaInstalls, setJavaInstalls] = useState([])

  // Load settings on mount
  useEffect(() => {
    loadSettings()

    const handler = window.api.on.downloadProgress((progress) => {
      setDownloadProgress(progress.percent || 0)
    })

    return () => {
      window.api.removeListener.downloadProgress(handler)
    }
  }, [])

  const loadSettings = async () => {
    try {
      const s = await window.api.settings.get()
      setSettings(s)
    } catch (err) {
      toast.error('Failed to load settings')
    }
  }

  const updateSetting = async (key, value) => {
    try {
      await window.api.settings.set(key, value)
      setSettings(prev => ({ ...prev, [key]: value }))
    } catch (err) {
      toast.error(`Failed to save setting: ${err.message}`)
    }
  }

  const fetchVersions = async (type) => {
    setFetchingVersions(true)
    setVersions([])
    setBuilds([])
    setLoaders([])
    try {
      let result = []
      switch (type || settings?.serverType) {
        case 'vanilla':
          result = await window.api.versions.fetchVanilla()
          setVersions(result.map(v => v.id))
          break
        case 'paper':
          result = await window.api.versions.fetchPaper()
          setVersions(result)
          break
        case 'fabric':
          result = await window.api.versions.fetchFabric()
          setVersions(result.map(v => v.id))
          break
      }
      toast.success(`Found ${result.length} versions`)
    } catch (err) {
      toast.error(`Failed to fetch versions: ${err.message}`)
    }
    setFetchingVersions(false)
  }

  const fetchBuildsForVersion = async (version) => {
    try {
      if (settings?.serverType === 'paper') {
        const b = await window.api.versions.fetchPaperBuilds(version)
        setBuilds(b)
      } else if (settings?.serverType === 'fabric') {
        const l = await window.api.versions.fetchFabricLoaders(version)
        setLoaders(l.map(l => l.version))
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDownload = async () => {
    setDownloading(true)
    setDownloadProgress(0)
    try {
      const build = settings.serverType === 'paper' ? settings.serverBuild :
                     settings.serverType === 'fabric' ? settings.serverBuild : undefined
      await window.api.versions.download(settings.serverType, settings.serverVersion, build)
      toast.success('Server downloaded and EULA accepted!')
    } catch (err) {
      toast.error(`Download failed: ${err.message}`)
    }
    setDownloading(false)
  }

  const handleBrowseJava = async () => {
    try {
      const path = await window.api.settings.browseJava()
      if (path) {
        setSettings(prev => ({ ...prev, javaPath: path }))
        toast.success('Java path updated')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleBrowseDir = async () => {
    try {
      const dir = await window.api.settings.browseDir()
      if (dir) {
        setSettings(prev => ({ ...prev, serverDir: dir }))
        toast.success('Server directory updated')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDetectJava = async () => {
    try {
      const installs = await window.api.settings.detectJava()
      setJavaInstalls(installs)
      if (installs.length > 0) {
        toast.success(`Found ${installs.length} Java installation(s)`)
      } else {
        toast.error('No Java installations found')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (!settings) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" style={{ margin: '0 auto' }} />
      </div>
    )
  }


  return (
    <div className="slide-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your Minecraft server</p>
        </div>
      </div>

      <div className="flex-col">
        {/* Server Configuration */}
        <div className="settings-section">
          <h2 className="settings-title">Server Configuration</h2>

          <div className="settings-row">
            <div>
              <label className="settings-label">Server Type</label>
              <p className="settings-description">Choose your server platform</p>
            </div>
            <select
              className="select"
              value={settings.serverType}
              onChange={e => {
                updateSetting('serverType', e.target.value)
                setVersions([])
                setBuilds([])
                setLoaders([])
              }}
              style={{ width: 180 }}
            >
              <option value="vanilla">Vanilla</option>
              <option value="paper">Paper</option>
              <option value="fabric">Fabric</option>
            </select>
          </div>

          <div className="settings-row">
            <div>
              <label className="settings-label">Server Version</label>
              <p className="settings-description">{settings.serverVersion ? `Current: ${settings.serverVersion}` : 'No version selected'}</p>
            </div>
            <div className="flex gap-sm">
              <select
                className="select"
                value={settings.serverVersion}
                onChange={e => {
                  updateSetting('serverVersion', e.target.value)
                  fetchBuildsForVersion(e.target.value)
                }}
                style={{ width: 150 }}
              >
                <option value="">Select version</option>
                {versions.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <button className="btn btn-outline btn-sm btn-premium" onClick={() => fetchVersions()} disabled={fetchingVersions}>
                <RefreshCw size={14} className={fetchingVersions ? 'spin' : ''} /> Fetch
              </button>
            </div>
          </div>

          {settings.serverType === 'paper' && builds.length > 0 && (
            <div className="settings-row">
              <div>
                <label className="settings-label">Build Number</label>
                <p className="settings-description">Select a Paper build</p>
              </div>
              <select
                className="select"
                value={settings.serverBuild}
                onChange={e => updateSetting('serverBuild', e.target.value)}
                style={{ width: 150 }}
              >
                <option value="">Latest</option>
                {builds.slice(-10).reverse().map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}

          {settings.serverType === 'fabric' && loaders.length > 0 && (
            <div className="settings-row">
              <div>
                <label className="settings-label">Loader Version</label>
                <p className="settings-description">Select a Fabric loader</p>
              </div>
              <select
                className="select"
                value={settings.serverBuild}
                onChange={e => updateSetting('serverBuild', e.target.value)}
                style={{ width: 150 }}
              >
                {loaders.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}

          <div className="settings-row">
            <div>
              <label className="settings-label">Download Server</label>
              <p className="settings-description">Download the selected server jar</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <button
                className="btn btn-primary btn-sm btn-premium glow-accent"
                onClick={handleDownload}
                disabled={downloading || !settings.serverVersion}
              >
                <Download size={14} /> {downloading ? 'Downloading...' : 'Download'}
              </button>
              {downloading && (
                <div className="progress-bar w-full" style={{ width: 180, marginTop: 4 }}>
                  <div className="progress-fill animated" style={{ width: `${downloadProgress}%` }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Java Configuration */}
        <div className="settings-section">
          <h2 className="settings-title">Java Configuration</h2>

          <div className="settings-row">
            <div>
              <label className="settings-label">Java Path</label>
              <p className="settings-description" style={{ maxWidth: 350, wordBreak: 'break-all' }}>{settings.javaPath || 'No Java path set'}</p>
            </div>
            <div className="flex gap-sm">
              <button className="btn btn-outline btn-sm btn-premium" onClick={handleBrowseJava}>
                <FolderOpen size={14} /> Browse
              </button>
              <button className="btn btn-outline btn-sm btn-premium" onClick={handleDetectJava}>
                <Search size={14} /> Auto-Detect
              </button>
            </div>
          </div>

          {javaInstalls.length > 0 && (
            <div style={{ marginTop: 12, padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>Detected Java installations:</p>
              {javaInstalls.map((j, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: i > 0 ? '1px solid rgba(48,54,61,0.3)' : 'none' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-all', paddingRight: '8px' }}>{j.version} — {j.path}</span>
                  <button className="btn btn-ghost btn-sm btn-premium" onClick={() => updateSetting('javaPath', j.path)} style={{ color: 'var(--accent)' }}>
                    Use
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Memory Allocation */}
        <div className="settings-section">
          <h2 className="settings-title">Memory Allocation</h2>

          <div className="settings-row">
            <div>
              <label className="settings-label">Maximum RAM (Xmx)</label>
              <p className="settings-description">Maximum heap size for the JVM</p>
            </div>
            <select
              className="select"
              value={settings.xmx}
              onChange={e => updateSetting('xmx', e.target.value)}
              style={{ width: 120 }}
            >
              <option value="1G">1 GB</option>
              <option value="2G">2 GB</option>
              <option value="4G">4 GB</option>
              <option value="6G">6 GB</option>
              <option value="8G">8 GB</option>
              <option value="12G">12 GB</option>
              <option value="16G">16 GB</option>
            </select>
          </div>

          <div className="settings-row">
            <div>
              <label className="settings-label">Minimum RAM (Xms)</label>
              <p className="settings-description">Initial heap size for the JVM</p>
            </div>
            <select
              className="select"
              value={settings.xms}
              onChange={e => updateSetting('xms', e.target.value)}
              style={{ width: 120 }}
            >
              <option value="512M">512 MB</option>
              <option value="1G">1 GB</option>
              <option value="2G">2 GB</option>
              <option value="4G">4 GB</option>
              <option value="8G">8 GB</option>
            </select>
          </div>
        </div>

        {/* Server Directory */}
        <div className="settings-section">
          <h2 className="settings-title">Server Directory</h2>

          <div className="settings-row">
            <div>
              <label className="settings-label">Server Files Location</label>
              <p className="settings-description" style={{ maxWidth: 350, wordBreak: 'break-all' }}>{settings.serverDir}</p>
            </div>
            <button className="btn btn-outline btn-sm btn-premium" onClick={handleBrowseDir}>
              <FolderOpen size={14} /> Browse
            </button>
          </div>
        </div>

        {/* RCON Configuration */}
        <div className="settings-section">
          <h2 className="settings-title">RCON Configuration</h2>

          <div className="settings-row">
            <div>
              <label className="settings-label">Enable RCON</label>
              <p className="settings-description">Required for TPS monitoring and remote commands</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.rconEnabled || false}
                onChange={e => updateSetting('rconEnabled', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {settings.rconEnabled && (
            <>
              <div className="settings-row">
                <label className="settings-label">RCON Port</label>
                <input
                  className="input"
                  type="number"
                  value={settings.rconPort || 25575}
                  onChange={e => updateSetting('rconPort', parseInt(e.target.value))}
                  style={{ width: 120 }}
                />
              </div>

              <div className="settings-row">
                <label className="settings-label">RCON Password</label>
                <div className="flex gap-sm">
                  <input
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    value={settings.rconPassword || ''}
                    onChange={e => updateSetting('rconPassword', e.target.value)}
                    style={{ width: 200 }}
                  />
                  <button className="btn btn-ghost btn-icon btn-premium" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
