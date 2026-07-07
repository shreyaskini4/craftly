import { useState, useEffect } from 'react'
import Modal from './Modal'
import { toast } from 'sonner'

function ServerPropertiesModal({ isOpen, onClose }) {
  const [properties, setProperties] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadProperties()
    }
  }, [isOpen])

  const loadProperties = async () => {
    setIsLoading(true)
    try {
      const props = await window.api.properties.read()
      setProperties(props || {})
    } catch (err) {
      toast.error('Failed to load server properties')
      console.error(err)
    }
    setIsLoading(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await window.api.properties.write(properties)
      toast.success('Server properties saved')
      onClose()
    } catch (err) {
      toast.error('Failed to save server properties')
      console.error(err)
    }
    setIsSaving(false)
  }

  const handleChange = (key, value) => {
    setProperties(prev => ({
      ...prev,
      [key]: value
    }))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit server.properties">
      {isLoading ? (
        <div className="flex-col" style={{ alignItems: 'center', padding: 'var(--space-xl)' }}>
          <div className="loading-spinner" />
          <p style={{ marginTop: 'var(--space-md)' }}>Loading properties...</p>
        </div>
      ) : (
        <div className="flex-col gap-md">
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-xs)' }}>
            <label className="settings-label">MOTD (Message of the Day)</label>
            <input
              className="input w-full"
              type="text"
              value={properties['motd'] !== undefined ? properties['motd'] : ''}
              onChange={e => handleChange('motd', e.target.value)}
              placeholder="A Minecraft Server"
            />
          </div>

          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-xs)' }}>
            <label className="settings-label">Max Players</label>
            <input
              className="input w-full"
              type="number"
              value={properties['max-players'] !== undefined ? properties['max-players'] : 20}
              onChange={e => handleChange('max-players', e.target.value)}
              min={1}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
            <button className="btn btn-outline" onClick={onClose} disabled={isSaving}>Cancel</button>
            <button className="btn btn-primary glow-accent" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Properties'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ServerPropertiesModal
