import { useState, useEffect } from 'react'
import Modal from './Modal'
import { AlertTriangle, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'

function ImportServerModal({ isOpen, onClose, onImportSuccess }) {
  const [step, setStep] = useState(1)
  const [scanResult, setScanResult] = useState(null)
  const [selectedJar, setSelectedJar] = useState('')
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    if (isOpen && step === 1) {
      const scan = async () => {
        try {
          const result = await window.api.settings.scanDir()
          if (!result || !result.dirPath) {
            onClose()
          } else {
            setScanResult(result)
            if (result.jars && result.jars.length > 0) {
              setSelectedJar(result.jars[0])
            }
            setStep(2)
          }
        } catch (err) {
          toast.error(err.message || 'Scan failed')
          onClose()
        }
      }
      scan()
    }
  }, [isOpen, step, onClose])

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setScanResult(null)
      setSelectedJar('')
    }
  }, [isOpen])

  const handleConfirm = async () => {
    setIsImporting(true)
    try {
      await window.api.settings.importServer({
        dirPath: scanResult.dirPath,
        jarFile: selectedJar,
        serverType: scanResult.inferredType || 'vanilla'
      })
      toast.success('Server imported successfully!')
      if (onImportSuccess) onImportSuccess()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Import failed')
    }
    setIsImporting(false)
  }

  if (step === 1) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Import Server">
        <div className="flex-col" style={{ alignItems: 'center', padding: 'var(--space-xl)' }}>
          <div className="loading-spinner" />
          <p style={{ marginTop: 'var(--space-md)' }}>Waiting for folder selection...</p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Import">
      <div className="flex-col gap-md">
        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-xs)' }}>
          <label className="settings-label">Selected Folder</label>
          <p className="settings-description" style={{ wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
            <FolderOpen size={14} /> {scanResult?.dirPath}
          </p>
        </div>

        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-xs)' }}>
          <label className="settings-label">Inferred Server Type</label>
          <p className="settings-description" style={{ textTransform: 'capitalize' }}>
            {scanResult?.inferredType || 'Unknown'}
          </p>
        </div>

        {scanResult?.jars && scanResult.jars.length > 0 && (
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-xs)' }}>
            <label className="settings-label">Select Server Jar</label>
            <select
              className="select w-full"
              value={selectedJar}
              onChange={e => setSelectedJar(e.target.value)}
            >
              {scanResult.jars.map(jar => (
                <option key={jar} value={jar}>{jar}</option>
              ))}
            </select>
          </div>
        )}

        {(!scanResult?.hasEula || !scanResult?.hasWorld) && (
          <div style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-xs)'
          }}>
            {!scanResult?.hasEula && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--color-warning)' }}>
                <AlertTriangle size={16} />
                <span style={{ fontSize: 'var(--font-sm)' }}>No eula.txt found. You may need to accept it before starting.</span>
              </div>
            )}
            {!scanResult?.hasWorld && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', color: 'var(--color-warning)' }}>
                <AlertTriangle size={16} />
                <span style={{ fontSize: 'var(--font-sm)' }}>No world folder found. A new one will be generated.</span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={isImporting}>Cancel</button>
          <button className="btn btn-primary glow-accent" onClick={handleConfirm} disabled={isImporting || (scanResult?.jars?.length > 0 && !selectedJar)}>
            {isImporting ? 'Importing...' : 'Confirm Import'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ImportServerModal
