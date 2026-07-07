import { useState, useEffect, useRef } from 'react'
import { Download, FolderOpen, Search, Eye, EyeOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import ImportServerModal from '../components/common/ImportServerModal'
import ServerPropertiesModal from '../components/common/ServerPropertiesModal'
import useServerStore from '../stores/serverStore'

function SettingsPage() {
  const serverStatus = useServerStore(state => state.status)
  const [settings, setSettings] = useState(null)
  const [versions, setVersions] = useState([])
  const [builds, setBuilds] = useState([])
  const [loaders, setLoaders] = useState([])
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [fetchingVersions, setFetchingVersions] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [javaInstalls, setJavaInstalls] = useState([])
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isPropertiesModalOpen, setIsPropertiesModalOpen] = useState(false)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
    
    window.api.settings.detectJava()
      .then(setJavaInstalls)
      .catch(console.error)

    const handler = window.api.on.downloadProgress((progress) => {
      setDownloadProgress(progress.percent || 0)
    })

    return () => {
      window.api.removeListener.downloadProgress(handler)
    }
  }, [])

  const isMountedRef = useRef(false)
  useEffect(() => {
    if (!isMountedRef.current) {
      if (settings) isMountedRef.current = true
      return
    }
    updateSetting('serverBuild', '')
  }, [settings?.serverType, settings?.serverVersion])

  const isInitialFetchRef = useRef(true)
  useEffect(() => {
    if (!settings?.serverVersion) return

    const isInitial = isInitialFetchRef.current
    if (settings) isInitialFetchRef.current = false

    if (settings.serverType === 'paper') {
      window.api.versions.fetchPaperBuilds(settings.serverVersion)
        .then(b => setBuilds(b))
        .catch(err => toast.error(err.message))
    } else if (settings.serverType === 'fabric') {
      window.api.versions.fetchFabricLoaders(settings.serverVersion)
        .then(l => {
          setLoaders(l)
          if (l.length > 0 && !isInitial) {
            updateSetting('serverBuild', l[0].version)
          }
        })
        .catch(err => toast.error(err.message))
    }
  }, [settings?.serverType, settings?.serverVersion])

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


  const handleDownload = async () => {
    if (serverStatus !== 'offline') {
      toast.error('You cannot download or upgrade a server while it is running. Please stop the server first.')
      return
    }

    if ((settings.serverType === 'paper' || settings.serverType === 'fabric') && !settings.serverBuild) {
      toast.error('Please select a build/loader version.')
      return
    }

    try {
      if (settings.serverVersion) {
        const parts = settings.serverVersion.split('.').map(Number)
        const minor = parts[1] || 0
        const patch = parts[2] || 0

        let reqJava = 8
        if (minor >= 21 || (minor === 20 && patch >= 5)) {
          reqJava = 21
        } else if (minor >= 17) {
          reqJava = 17
        }

        const installs = await window.api.settings.detectJava()
        const selectedJava = installs.find(j => j.path === settings.javaPath)
        
        if (selectedJava) {
          let currentMajor = 0
          if (selectedJava.version.startsWith('1.')) {
            currentMajor = parseInt(selectedJava.version.split('.')[1])
          } else {
            currentMajor = parseInt(selectedJava.version.split('.')[0])
          }

          let mismatch = false
          if (reqJava === 8) {
            mismatch = (currentMajor !== 8 && currentMajor !== 11)
          } else {
            mismatch = (currentMajor !== reqJava)
          }

          if (mismatch) {
            const proceed = window.confirm(`Warning: Minecraft ${settings.serverVersion} requires Java ${reqJava}. You have Java ${currentMajor}. The server may crash. Download anyway?`)
            if (!proceed) {
              return
            }
          }
        }
      }
    } catch (err) {
      console.error('Java check failed:', err)
    }

    setDownloading(true)
    setDownloadProgress(0)
    try {
      if (settings.serverJar) {
        toast.info('Creating backup before upgrade...')
        await window.api.backups.create()
        toast.success('Backup created.')
      }

      const build = settings.serverType === 'paper' ? settings.serverBuild :
                     settings.serverType === 'fabric' ? settings.serverBuild : undefined
      await window.api.versions.download(settings.serverType, settings.serverVersion, build)
      toast.success(settings.serverJar ? 'Server upgraded and EULA accepted!' : 'Server downloaded and EULA accepted!')
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

  const handleImportSuccess = () => {
    loadSettings()
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

  const parseRamToMb = (val) => {
    if (!val) return 0
    const str = val.toString().toUpperCase().trim()
    const num = parseFloat(str)
    if (isNaN(num)) return 0
    if (str.includes('G')) return num * 1024
    if (str.includes('M')) return num
    return 0
  }

  const selectedJava = settings ? javaInstalls.find(j => j.path === settings.javaPath) : null
  const is32Bit = selectedJava?.arch === '32-bit'
  const isOverRamLimit = settings && (parseRamToMb(settings.xmx) > 1536 || parseRamToMb(settings.xms) > 1536)
  const showRamWarning = is32Bit && isOverRamLimit

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
                value={settings.serverBuild || ''}
                onChange={e => updateSetting('serverBuild', e.target.value)}
                style={{ width: 150 }}
              >
                <option value="">Select a loader...</option>
                {loaders.map(l => <option key={l.version} value={l.version}>{l.version}</option>)}
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
                <Download size={14} /> {downloading ? 'Downloading...' : (settings.serverJar ? 'Upgrade Server' : 'Download')}
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
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-all', paddingRight: '8px' }}>Java {j.version} ({j.arch || 'unknown'}) — {j.path}</span>
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

          {showRamWarning && (
            <div style={{ marginTop: 12, padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>Warning: 32-bit Java cannot safely allocate more than ~1.5GB of RAM. The server will likely crash.</span>
            </div>
          )}
        </div>

        {/* Server Directory */}
        <div className="settings-section">
          <h2 className="settings-title">Server Directory</h2>

          <div className="settings-row">
            <div>
              <label className="settings-label">Server Files Location</label>
              <p className="settings-description" style={{ maxWidth: 350, wordBreak: 'break-all' }}>{settings.serverDir || 'Not configured'}</p>
            </div>
            <button className="btn btn-outline btn-sm btn-premium" onClick={() => setIsImportModalOpen(true)}>
              <FolderOpen size={14} /> Import Server
            </button>
          </div>
        </div>

        {/* Server Properties */}
        <div className="settings-section">
          <h2 className="settings-title">Server Properties</h2>

          <div className="settings-row">
            <div>
              <label className="settings-label">Edit server.properties</label>
              <p className="settings-description">Modify settings like MOTD and max players</p>
            </div>
            <button className="btn btn-outline btn-sm btn-premium" onClick={() => setIsPropertiesModalOpen(true)}>
              Edit Properties
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

        {/* App Settings */}
        <div className="settings-section">
          <h2 className="settings-title">App Settings</h2>

          <div className="settings-row">
            <div>
              <label className="settings-label">Switch / Reconfigure Server</label>
              <p className="settings-description">Go back to the welcome screen to set up a different server</p>
            </div>
            <button 
              className="btn btn-outline btn-sm btn-premium" 
              onClick={async () => {
                await window.api.settings.set('onboardingComplete', false)
                window.location.reload()
              }}
            >
              Switch / Reconfigure Server
            </button>
          </div>
        </div>
      </div>

      <ImportServerModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      <ServerPropertiesModal
        isOpen={isPropertiesModalOpen}
        onClose={() => setIsPropertiesModalOpen(false)}
      />
    </div>
  )
}

export default SettingsPage
