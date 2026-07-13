import { useState, useEffect } from 'react'
import { FolderOpen, Search, Download, CheckCircle, Plus, UploadCloud, ChevronRight, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import ImportServerModal from '../components/common/ImportServerModal'
import VersionPicker from '../components/common/VersionPicker'

function WelcomePage({ onComplete }) {
  const [mode, setMode] = useState(null)
  const [step, setStep] = useState(1)
  const [dirPath, setDirPath] = useState('')
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

  const fetchVersions = async (type) => {
    setServerType(type)
    setVersions([])
    setServerVersion('')
    try {
      let result = []
      if (type === 'vanilla') {
        result = await window.api.versions.fetchVanilla()
        setVersions(result)
      } else if (type === 'paper') {
        result = await window.api.versions.fetchPaper()
        setVersions(result.reverse()) // Paper returns oldest first
      } else if (type === 'fabric') {
        result = await window.api.versions.fetchFabric()
        setVersions(result)
      }
    } catch (err) {
      toast.error(`Failed to fetch versions: ${err.message}`)
    }
  }

  useEffect(() => {
    if (step === 2 && versions.length === 0) {
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
      
      // Auto-detect if a compatible Java version is installed locally.
      const parts = serverVersion.split('.').map(Number)
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
        await window.api.settings.provisionJava(serverVersion)
        toast.success(`JRE ${reqJava} provisioned successfully!`)
      } else {
        // Use the first compatible local Java path
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
        }
      }

      // Reset download progress before server JAR download
      setDownloadProgress(0)

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
            <h3 className="settings-title">Step 2: Choose Server Software</h3>
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
              <div style={{ width: 250 }}>
                <VersionPicker 
                  items={versions} 
                  value={serverVersion} 
                  onChange={setServerVersion} 
                />
              </div>
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
        <h1 className="text-3xl font-bold mb-sm text-gradient">Welcome to <span className="brand-text">Craftly</span></h1>
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
