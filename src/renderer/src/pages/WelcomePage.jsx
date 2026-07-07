import { useState, useEffect } from 'react'
import { FolderOpen, Search, Download, CheckCircle, Plus, UploadCloud, ChevronRight, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import ImportServerModal from '../components/common/ImportServerModal'

function WelcomePage({ onComplete }) {
  const [mode, setMode] = useState(null)
  const [step, setStep] = useState(1)
  const [dirPath, setDirPath] = useState('')
  const [javaPath, setJavaPath] = useState('')
  const [javaInstalls, setJavaInstalls] = useState([])
  const [versions, setVersions] = useState([])
  const [serverType, setServerType] = useState('vanilla')
  const [serverVersion, setServerVersion] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)

  useEffect(() => {
    const handler = window.api.on.downloadProgress((progress) => {
      setDownloadProgress(progress.percent || 0)
    })
    return () => {
      window.api.removeListener.downloadProgress(handler)
    }
  }, [])

  const handleCreateNew = () => {
    setMode('new')
    setStep(1)
  }

  const handleImport = () => {
    setMode('import')
  }

  const handleBrowseDir = async () => {
    try {
      const result = await window.api.settings.scanDir()
      if (result && result.dirPath) {
        const isEmpty = await window.api.settings.checkDirEmpty(result.dirPath)
        if (!isEmpty) {
          toast.error('Directory is not empty. Please select an empty folder for a new server.')
          return
        }
        setDirPath(result.dirPath)
        await window.api.settings.set('serverDir', result.dirPath)
        setStep(2)
      }
    } catch (err) {
      toast.error(err.message || 'Failed to select directory')
    }
  }

  const handleDetectJava = async () => {
    try {
      const installs = await window.api.settings.detectJava()
      setJavaInstalls(installs)
      if (installs.length > 0) {
        setJavaPath(installs[0].path)
        toast.success(`Found ${installs.length} Java installation(s)`)
      } else {
        toast.error('No Java installations found')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleBrowseJava = async () => {
    try {
      const path = await window.api.settings.browseJava()
      if (path) {
        setJavaPath(path)
        toast.success('Java path selected')
      }
    } catch (err) {
      toast.error(err.message)
    }
  }

  const confirmJava = async () => {
    if (!javaPath) {
      toast.error('Please select or detect a Java executable first.')
      return
    }
    await window.api.settings.set('javaPath', javaPath)
    setStep(3)
  }

  const fetchVersions = async (type) => {
    setServerType(type)
    setVersions([])
    setServerVersion('')
    try {
      let result = []
      if (type === 'vanilla') {
        result = await window.api.versions.fetchVanilla()
        setVersions(result.map(v => v.id))
      } else if (type === 'paper') {
        result = await window.api.versions.fetchPaper()
        setVersions(result)
      } else if (type === 'fabric') {
        result = await window.api.versions.fetchFabric()
        setVersions(result.map(v => v.id))
      }
    } catch (err) {
      toast.error(`Failed to fetch versions: ${err.message}`)
    }
  }

  useEffect(() => {
    if (step === 3 && versions.length === 0) {
      fetchVersions('vanilla')
    }
  }, [step])

  const handleDownloadAndFinish = async () => {
    if (!serverVersion) {
      toast.error('Please select a version')
      return
    }
    setDownloading(true)
    setDownloadProgress(0)
    try {
      await window.api.settings.set('serverType', serverType)
      await window.api.settings.set('serverVersion', serverVersion)
      
      // We'll just fetch latest build internally or omit build for Paper/Fabric to get latest
      await window.api.versions.download(serverType, serverVersion, undefined)
      
      // Auto-accept EULA for a new server
      await window.api.versions.acceptEula()
      
      toast.success('Server downloaded and EULA accepted!')
      await window.api.settings.set('onboardingComplete', true)
      if (onComplete) onComplete()
    } catch (err) {
      toast.error(`Setup failed: ${err.message}`)
      setDownloading(false)
    }
  }

  const finishImport = async () => {
    await window.api.settings.set('onboardingComplete', true)
    if (onComplete) onComplete()
  }

  if (mode === 'import') {
    return (
      <div className="flex-col h-full items-center justify-center slide-up p-xl">
        <h2 className="text-xl font-bold mb-md">Import Existing Server</h2>
        <p className="text-secondary mb-xl">Follow the prompts in the popup to import your server.</p>
        <button className="btn btn-outline mb-md" onClick={() => setMode(null)}>Back to Options</button>
        <ImportServerModal
          isOpen={true}
          onClose={() => setMode(null)}
          onImportSuccess={finishImport}
        />
      </div>
    )
  }

  if (mode === 'new') {
    return (
      <div className="flex-col h-full slide-up p-xl" style={{ maxWidth: 600, margin: '0 auto' }}>
        <button className="btn btn-ghost btn-sm mb-lg" onClick={() => setMode(null)} style={{ alignSelf: 'flex-start' }}>
          ← Back
        </button>
        <h2 className="text-2xl font-bold mb-xl text-center">Create New Server</h2>
        
        {step === 1 && (
          <div className="settings-section flex-col gap-md">
            <h3 className="settings-title">Step 1: Choose Server Directory</h3>
            <p className="settings-description">Select an empty folder where your server files will be stored.</p>
            <div className="flex-col gap-sm">
              <button className="btn btn-outline" onClick={handleBrowseDir}>
                <FolderOpen size={16} className="mr-sm" /> Select Empty Folder
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="settings-section flex-col gap-md">
            <h3 className="settings-title">Step 2: Setup Java</h3>
            <p className="settings-description">Minecraft requires Java to run. Let's find your installation.</p>
            
            <div className="flex gap-sm mb-md">
              <button className="btn btn-outline" onClick={handleDetectJava}>
                <Search size={16} className="mr-sm" /> Auto-Detect Java
              </button>
              <button className="btn btn-outline" onClick={handleBrowseJava}>
                <FolderOpen size={16} className="mr-sm" /> Browse for Java
              </button>
            </div>

            {javaInstalls.length > 0 && (
              <div style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
                <p className="settings-description mb-sm">Detected Installations:</p>
                {javaInstalls.map((j, i) => (
                  <div key={i} className="flex justify-between items-center py-xs border-b border-subtle last:border-0">
                    <span className="text-sm truncate mr-sm" title={j.path}>{j.version}</span>
                    <button 
                      className={`btn btn-sm ${javaPath === j.path ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setJavaPath(j.path)}
                    >
                      {javaPath === j.path ? 'Selected' : 'Select'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {javaPath && (
              <div className="flex justify-end mt-md">
                <button className="btn btn-primary glow-accent" onClick={confirmJava}>
                  Continue <ChevronRight size={16} className="ml-xs" />
                </button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="settings-section flex-col gap-md">
            <h3 className="settings-title">Step 3: Download Server Software</h3>
            <p className="settings-description">Choose your preferred server type and version.</p>

            <div className="settings-row">
              <label className="settings-label">Server Type</label>
              <select className="select" value={serverType} onChange={(e) => fetchVersions(e.target.value)}>
                <option value="vanilla">Vanilla (Standard)</option>
                <option value="paper">Paper (Optimized + Plugins)</option>
                <option value="fabric">Fabric (Mods)</option>
              </select>
            </div>

            <div className="settings-row">
              <label className="settings-label">Version</label>
              <select className="select" value={serverVersion} onChange={(e) => setServerVersion(e.target.value)}>
                <option value="">Select a version</option>
                {versions.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="flex-col gap-sm mt-md">
              <button 
                className="btn btn-primary glow-accent w-full justify-center" 
                onClick={handleDownloadAndFinish}
                disabled={downloading || !serverVersion}
              >
                {downloading ? 'Downloading...' : 'Download & Finish'}
              </button>
              {downloading && (
                <div className="progress-bar w-full mt-sm">
                  <div className="progress-fill animated" style={{ width: `${downloadProgress}%` }} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Initial Option Selection
  return (
    <div className="flex-col h-full items-center justify-center slide-up p-xl">
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
        <h1 className="text-3xl font-bold mb-sm text-gradient">Welcome to Craftly</h1>
        <p className="text-secondary text-lg">Let's get your Minecraft server set up.</p>
      </div>

      <div className="flex gap-lg" style={{ maxWidth: 800 }}>
        <div 
          className="settings-section flex-col items-center text-center cursor-pointer transition-all hover:border-accent"
          style={{ flex: 1, padding: 'var(--space-2xl) var(--space-xl)' }}
          onClick={handleCreateNew}
        >
          <div className="bg-primary rounded-full p-md mb-md">
            <Plus size={32} className="text-accent" />
          </div>
          <h3 className="text-xl font-semibold mb-sm">Create New Server</h3>
          <p className="text-secondary text-sm">Download and setup a fresh Minecraft server in a new empty folder.</p>
        </div>

        <div 
          className="settings-section flex-col items-center text-center cursor-pointer transition-all hover:border-accent"
          style={{ flex: 1, padding: 'var(--space-2xl) var(--space-xl)' }}
          onClick={handleImport}
        >
          <div className="bg-primary rounded-full p-md mb-md">
            <UploadCloud size={32} className="text-accent" />
          </div>
          <h3 className="text-xl font-semibold mb-sm">Import Existing Server</h3>
          <p className="text-secondary text-sm">Select a folder that already contains your Minecraft server files.</p>
        </div>
      </div>
    </div>
  )
}

export default WelcomePage
