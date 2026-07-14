import { useState, useEffect, useRef } from 'react'
import { Download, FolderOpen, Search, Eye, EyeOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import ImportServerModal from '../components/common/ImportServerModal'
import useServerStore from '../stores/serverStore'
import VersionPicker from '../components/common/VersionPicker'

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
  const [provisionedJavas, setProvisionedJavas] = useState([])
  const [webhookUrl, setWebhookUrl] = useState('')
  const [webhookToggles, setWebhookToggles] = useState({
    start: true,
    stop: true,
    crash: true,
    backup: true
  })
  const [testingWebhook, setTestingWebhook] = useState(false)

  // Scheduled task states
  const [scheduledJobs, setScheduledJobs] = useState([])
  const [newJobName, setNewJobName] = useState('')
  const [newJobType, setNewJobType] = useState('restart')
  const [newJobInterval, setNewJobInterval] = useState('12')
  const [newJobWarning, setNewJobWarning] = useState('60')
  const [newJobCommand, setNewJobCommand] = useState('')

  const loadWebhookConfig = async () => {
    try {
      const config = await window.api.webhooks.getConfig()
      if (config) {
        setWebhookUrl(config.url || '')
        if (config.toggles) {
          setWebhookToggles(config.toggles)
        }
      }
    } catch (err) {
      console.error('Failed to load webhook config:', err)
    }
  }

  const handleWebhookUrlChange = async (url) => {
    setWebhookUrl(url)
    try {
      await window.api.webhooks.setConfig({ url, toggles: webhookToggles })
    } catch (err) {
      toast.error('Failed to save webhook URL')
    }
  }

  const handleWebhookToggleChange = async (key, checked) => {
    const nextToggles = { ...webhookToggles, [key]: checked }
    setWebhookToggles(nextToggles)
    try {
      await window.api.webhooks.setConfig({ url: webhookUrl, toggles: nextToggles })
    } catch (err) {
      toast.error('Failed to save webhook event settings')
    }
  }

  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      toast.error('Please enter a Discord Webhook URL first')
      return
    }
    setTestingWebhook(true)
    try {
      const success = await window.api.webhooks.test(webhookUrl)
      if (success) {
        toast.success('Test notification sent successfully!')
      } else {
        toast.error('Failed to send test notification. Check the URL and try again.')
      }
    } catch (err) {
      toast.error(`Error sending test notification: ${err.message}`)
    } finally {
      setTestingWebhook(false)
    }
  }

  const loadProvisionedJava = async () => {
    try {
      const list = await window.api.settings.listProvisionedJava()
      setProvisionedJavas(list || [])
    } catch (err) {
      console.error('Failed to list provisioned Java versions:', err)
    }
  }

  const handleDeleteProvisionedJava = async (major) => {
    try {
      await window.api.settings.deleteProvisionedJava(major)
      toast.success(`Deleted JRE ${major}`)
      await loadProvisionedJava()
      await loadSettings()
    } catch (err) {
      toast.error(`Failed to delete JRE: ${err.message}`)
    }
  }

  const loadScheduledJobs = async () => {
    try {
      const list = await window.api.scheduler.list()
      setScheduledJobs(list || [])
    } catch (err) {
      console.error('Failed to load scheduled tasks:', err)
    }
  }

  const handleAddJob = async (e) => {
    e.preventDefault()
    if (!newJobName.trim()) {
      toast.error('Please enter a task name')
      return
    }
    const intervalVal = parseFloat(newJobInterval)
    if (isNaN(intervalVal) || intervalVal <= 0) {
      toast.error('Please enter a valid interval greater than 0 hours')
      return
    }
    if (newJobType === 'command' && !newJobCommand.trim()) {
      toast.error('Please enter a command to execute')
      return
    }
    const warningVal = parseInt(newJobWarning)
    if (newJobType === 'restart' && (isNaN(warningVal) || warningVal < 0)) {
      toast.error('Warning seconds must be a positive integer or 0')
      return
    }

    try {
      await window.api.scheduler.add({
        name: newJobName.trim(),
        type: newJobType,
        intervalHours: intervalVal,
        warningSeconds: newJobType === 'restart' ? warningVal : 0,
        command: newJobType === 'command' ? newJobCommand.trim() : '',
        enabled: true
      })
      toast.success('Scheduled task added successfully!')
      setNewJobName('')
      setNewJobType('restart')
      setNewJobInterval('12')
      setNewJobWarning('60')
      setNewJobCommand('')
      loadScheduledJobs()
    } catch (err) {
      toast.error(`Failed to add task: ${err.message}`)
    }
  }

  const handleDeleteJob = async (id) => {
    try {
      await window.api.scheduler.remove(id)
      toast.success('Scheduled task removed')
      loadScheduledJobs()
    } catch (err) {
      toast.error(`Failed to remove task: ${err.message}`)
    }
  }

  const handleToggleJob = async (id, currentEnabled) => {
    try {
      await window.api.scheduler.update(id, { enabled: !currentEnabled })
      toast.success(!currentEnabled ? 'Task enabled' : 'Task disabled')
      loadScheduledJobs()
    } catch (err) {
      toast.error(`Failed to update task: ${err.message}`)
    }
  }

  // Load settings on mount
  useEffect(() => {
    loadSettings()
    loadProvisionedJava()
    loadWebhookConfig()
    loadScheduledJobs()
    
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

  // Auto-refresh next run times for active scheduled jobs
  useEffect(() => {
    const timer = setInterval(() => {
      loadScheduledJobs()
    }, 5000)
    return () => clearInterval(timer)
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
        .then(b => {
          setBuilds(b)
          if (b.length > 0 && (!isInitial || !settings.serverBuild)) {
            updateSetting('serverBuild', String(b[b.length - 1]))
          }
        })
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

  useEffect(() => {
    if (settings?.serverType) {
      fetchVersions(settings.serverType)
    }
  }, [settings?.serverType])

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
          setVersions(result)
          break
        case 'paper':
          result = await window.api.versions.fetchPaper()
          setVersions(result.reverse())
          break
        case 'fabric':
          result = await window.api.versions.fetchFabric()
          setVersions(result)
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

    setDownloading(true)
    setDownloadProgress(0)
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
        const hasCompatible = installs.some(inst => {
          const versionStr = inst.version
          let currentMajor = 0
          if (versionStr.startsWith('1.')) {
            currentMajor = parseInt(versionStr.split('.')[1]) || 0
          } else {
            currentMajor = parseInt(versionStr.split('.')[0]) || 0
          }
          if (reqJava === 8) {
            return currentMajor === 8 || currentMajor === 11
          }
          return currentMajor === reqJava
        })

        if (!hasCompatible) {
          toast.info(`No compatible Java ${reqJava} version found. Auto-provisioning JRE ${reqJava}...`)
          setDownloadProgress(0)
          await window.api.settings.provisionJava(settings.serverVersion)
          toast.success(`JRE ${reqJava} provisioned successfully!`)
          await loadProvisionedJava()
          await loadSettings()
        } else {
          // If the currently configured Java path is mismatched, let's switch to the compatible one
          const activeJava = installs.find(j => j.path === settings.javaPath)
          let activeMismatched = !activeJava
          if (activeJava) {
            let activeMajor = 0
            if (activeJava.version.startsWith('1.')) {
              activeMajor = parseInt(activeJava.version.split('.')[1]) || 0
            } else {
              activeMajor = parseInt(activeJava.version.split('.')[0]) || 0
            }
            if (reqJava === 8) {
              activeMismatched = (activeMajor !== 8 && activeMajor !== 11)
            } else {
              activeMismatched = (activeMajor !== reqJava)
            }
          }
          if (activeMismatched) {
            const compatibleInstall = installs.find(inst => {
              const versionStr = inst.version
              let currentMajor = 0
              if (versionStr.startsWith('1.')) {
                currentMajor = parseInt(versionStr.split('.')[1]) || 0
              } else {
                currentMajor = parseInt(versionStr.split('.')[0]) || 0
              }
              if (reqJava === 8) {
                return currentMajor === 8 || currentMajor === 11
              }
              return currentMajor === reqJava
            })
            if (compatibleInstall) {
              await window.api.settings.set('javaPath', compatibleInstall.path)
              setSettings(prev => ({ ...prev, javaPath: compatibleInstall.path }))
            }
          }
        }
      }

      setDownloadProgress(0)

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
              <p className="settings-description">Select Minecraft version</p>
            </div>
            <div style={{ width: 180 }}>
              <VersionPicker
                items={versions}
                value={settings.serverVersion}
                onChange={v => updateSetting('serverVersion', v)}
              />
            </div>
          </div>

          {settings.serverType === 'paper' && builds.length > 0 && (
            <div className="settings-row">
              <div>
                <label className="settings-label">Build Number</label>
                <p className="settings-description">Select a Paper build</p>
              </div>
              <div style={{ width: 180 }}>
                <VersionPicker
                  items={builds.slice().reverse()}
                  value={settings.serverBuild}
                  onChange={v => updateSetting('serverBuild', v)}
                  showFilters={false}
                />
              </div>
            </div>
          )}

          {settings.serverType === 'fabric' && loaders.length > 0 && (
            <div className="settings-row">
              <div>
                <label className="settings-label">Loader Version</label>
                <p className="settings-description">Select a Fabric loader</p>
              </div>
              <div style={{ width: 180 }}>
                <VersionPicker
                  items={loaders.map(l => ({ id: l.version, stable: l.stable }))}
                  value={settings.serverBuild}
                  onChange={v => updateSetting('serverBuild', v)}
                  showFilters={false}
                />
              </div>
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
              <p className="settings-description" style={{ maxWidth: 350, wordBreak: 'break-all' }}>
                {settings.serverJavaPaths?.[settings.serverDir] || settings.javaPath || 'java'}
              </p>
              <p className="settings-description-sub" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Active Java executable path for this server directory.
              </p>
            </div>
            <div className="flex-col gap-xs" style={{ alignItems: 'flex-end' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Advanced Override: use a specific Java installation</span>
              <div className="flex gap-sm">
                <button className="btn btn-outline btn-sm btn-premium" onClick={handleBrowseJava}>
                  <FolderOpen size={14} /> Browse
                </button>
                <button className="btn btn-outline btn-sm btn-premium" onClick={handleDetectJava}>
                  <Search size={14} /> Auto-Detect
                </button>
              </div>
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

        {/* Manage Downloaded Java Versions */}
        <div className="settings-section">
          <h2 className="settings-title">Manage Downloaded Java Versions</h2>
          <p className="settings-description" style={{ marginBottom: 12 }}>
            These are the JRE versions that have been automatically downloaded and provisioned.
          </p>

          {provisionedJavas.length === 0 ? (
            <p className="text-secondary text-sm">No auto-provisioned Java versions found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {provisionedJavas.map((j, i) => {
                let major = typeof j === 'object' ? (j.major || j.version) : j
                let label = typeof j === 'object' ? (j.label || `JRE ${j.major}`) : `JRE ${j}`
                let pathStr = typeof j === 'object' ? j.path : ''
                
                return (
                  <div 
                    key={i} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px', 
                      background: 'var(--bg-tertiary)', 
                      borderRadius: 8, 
                      border: '1px solid var(--border)' 
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                      {pathStr && (
                        <p style={{ fontSize: 11, color: 'var(--text-secondary)', wordBreak: 'break-all', marginTop: 4 }}>
                          {pathStr}
                        </p>
                      )}
                    </div>
                    <button 
                      className="btn btn-outline btn-sm" 
                      style={{ color: '#ef4444', borderColor: '#ef4444' }}
                      onClick={() => handleDeleteProvisionedJava(major)}
                    >
                      Delete
                    </button>
                  </div>
                )
              })}
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

        {/* Crash Detection & Auto-Restart */}
        <div className="settings-section">
          <h2 className="settings-title">Crash Detection & Auto-Restart</h2>

          <div className="settings-row">
            <div>
              <label className="settings-label">Auto-Restart on Crash</label>
              <p className="settings-description">Automatically restart the server if it stops unexpectedly</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoRestartOnCrash ?? true}
                onChange={e => updateSetting('autoRestartOnCrash', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-row">
            <div>
              <label className="settings-label">Max Auto-Restart Attempts</label>
              <p className="settings-description">Number of sequential restart attempts before giving up</p>
            </div>
            <input
              className="input"
              type="number"
              min="1"
              max="20"
              value={settings.autoRestartMaxRetries ?? 5}
              onChange={e => updateSetting('autoRestartMaxRetries', parseInt(e.target.value) || 5)}
              disabled={!(settings.autoRestartOnCrash ?? true)}
              style={{ width: 120 }}
            />
          </div>
        </div>

        {/* Scheduled Tasks / Automation */}
        <div className="settings-section">
          <h2 className="settings-title">Scheduled Tasks / Automation</h2>
          <p className="settings-description" style={{ marginBottom: 16 }}>
            Automate server management tasks, such as periodic restarts or executing commands.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {scheduledJobs.length === 0 ? (
              <p className="text-secondary text-sm">No scheduled tasks configured.</p>
            ) : (
              scheduledJobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 8,
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ flex: 1, marginRight: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{job.name}</span>
                      <span className={`badge ${job.enabled ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: 11 }}>
                        {job.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {job.type === 'restart'
                        ? `Restart server every ${job.intervalHours} hours${job.warningSeconds ? ` with ${job.warningSeconds}s warning` : ''}`
                        : `Run command '${job.command}' every ${job.intervalHours} hours`}
                    </p>
                    {job.enabled && job.nextRunTime && (
                      <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                        Next run: {new Date(job.nextRunTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={job.enabled}
                        onChange={() => handleToggleJob(job.id, job.enabled)}
                      />
                      <span className="toggle-slider" />
                    </label>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: '#ef4444', borderColor: '#ef4444' }}
                      onClick={() => handleDeleteJob(job.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddJob} style={{ marginTop: 20, padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add New Scheduled Task</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Task Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Daily Restart"
                  value={newJobName}
                  onChange={e => setNewJobName(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Task Type</label>
                <select
                  className="select"
                  value={newJobType}
                  onChange={e => setNewJobType(e.target.value)}
                  style={{ width: 180 }}
                >
                  <option value="restart">Restart Server</option>
                  <option value="command">Run Command</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Interval (hours)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="input"
                  placeholder="e.g. 12"
                  value={newJobInterval}
                  onChange={e => setNewJobInterval(e.target.value)}
                  style={{ width: 120 }}
                />
              </div>

              {newJobType === 'restart' && (
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Warning Countdown (s)</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    placeholder="e.g. 60"
                    value={newJobWarning}
                    onChange={e => setNewJobWarning(e.target.value)}
                    style={{ width: 120 }}
                  />
                </div>
              )}

              {newJobType === 'command' && (
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Command</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. save-all"
                    value={newJobCommand}
                    onChange={e => setNewJobCommand(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="submit" className="btn btn-primary btn-sm btn-premium glow-accent">
                  Add Task
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Discord Webhook Notifications */}
        <div className="settings-section">
          <h2 className="settings-title">Discord Webhook Notifications</h2>
          <p className="settings-description" style={{ marginBottom: 16 }}>
            Receive real-time notifications on your Discord server when status changes occur.
          </p>

          <div className="settings-row">
            <div>
              <label className="settings-label">Discord Webhook URL</label>
              <p className="settings-description">POST requests will be sent to this URL when enabled events occur</p>
            </div>
            <div className="flex gap-sm" style={{ width: '60%', justifyContent: 'flex-end' }}>
              <input
                className="input"
                type="text"
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl}
                onChange={e => handleWebhookUrlChange(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <button 
                className="btn btn-outline btn-sm btn-premium" 
                onClick={handleTestWebhook}
                disabled={testingWebhook || !webhookUrl}
              >
                {testingWebhook ? 'Sending...' : 'Send Test'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: 12 }}>
              Notification Events
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="settings-row" style={{ paddingTop: 8, paddingBottom: 8 }}>
                <div>
                  <label className="settings-label">Server Started</label>
                  <p className="settings-description-sub" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Notify when the server goes online and is ready for players
                  </p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={webhookToggles.start ?? true}
                    onChange={e => handleWebhookToggleChange('start', e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="settings-row" style={{ paddingTop: 8, paddingBottom: 8 }}>
                <div>
                  <label className="settings-label">Server Stopped</label>
                  <p className="settings-description-sub" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Notify when the server is stopped or shut down
                  </p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={webhookToggles.stop ?? true}
                    onChange={e => handleWebhookToggleChange('stop', e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="settings-row" style={{ paddingTop: 8, paddingBottom: 8 }}>
                <div>
                  <label className="settings-label">Server Crashed</label>
                  <p className="settings-description-sub" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Notify when the server crashes or fails to restart
                  </p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={webhookToggles.crash ?? true}
                    onChange={e => handleWebhookToggleChange('crash', e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="settings-row" style={{ paddingTop: 8, paddingBottom: 8 }}>
                <div>
                  <label className="settings-label">Backup Complete</label>
                  <p className="settings-description-sub" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Notify when a world/server backup has successfully finished
                  </p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={webhookToggles.backup ?? true}
                    onChange={e => handleWebhookToggleChange('backup', e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>
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
    </div>
  )
}

export default SettingsPage
