import { useState, useEffect } from 'react'
import Modal from './Modal'
import { toast } from 'sonner'

function ServerPropertiesModal({ isOpen, onClose }) {
  const [properties, setProperties] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('General')

  useEffect(() => {
    if (isOpen) {
      loadProperties()
      setActiveTab('General')
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

  const renderInput = (key, label, type = 'text', placeholder = '', min, max) => (
    <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
      <label className="settings-label">{label}</label>
      <input
        className="input w-full"
        type={type}
        value={properties[key] !== undefined ? properties[key] : ''}
        onChange={e => handleChange(key, e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
      />
    </div>
  )

  const renderCheckbox = (key, label) => (
    <div className="settings-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
      <input
        type="checkbox"
        id={`cb-${key}`}
        checked={properties[key] === 'true' || properties[key] === true}
        onChange={e => handleChange(key, e.target.checked.toString())}
        style={{ cursor: 'pointer' }}
      />
      <label htmlFor={`cb-${key}`} className="settings-label" style={{ marginBottom: 0, cursor: 'pointer' }}>{label}</label>
    </div>
  )

  const tabs = ['General', 'Resources', 'Security/Admin', 'World', 'Network']

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit server.properties">
      {isLoading ? (
        <div className="flex-col" style={{ alignItems: 'center', padding: 'var(--space-xl)' }}>
          <div className="loading-spinner" />
          <p style={{ marginTop: 'var(--space-md)' }}>Loading properties...</p>
        </div>
      ) : (
        <div className="flex-col">
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 'var(--space-md)', overflowX: 'auto' }}>
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                  padding: 'var(--space-sm) var(--space-md)',
                  color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  fontWeight: activeTab === tab ? 'bold' : 'normal'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 'var(--space-xs)' }}>
            {activeTab === 'General' && (
              <>
                {renderInput('motd', 'MOTD (Message of the Day)', 'text', 'A Minecraft Server')}
                {renderInput('max-players', 'Max Players', 'number', '20', 1)}
              </>
            )}

            {activeTab === 'Resources' && (
              <>
                {renderInput('resource-pack', 'Resource Pack URL', 'text', 'https://...')}
                {renderInput('resource-pack-sha1', 'Resource Pack SHA-1', 'text')}
                {renderCheckbox('require-resource-pack', 'Require Resource Pack')}
                {renderInput('resource-pack-prompt', 'Resource Pack Prompt', 'text')}
              </>
            )}

            {activeTab === 'Security/Admin' && (
              <>
                {renderInput('player-idle-timeout', 'Player Idle Timeout (minutes)', 'number', '0', 0)}
                {renderInput('op-permission-level', 'OP Permission Level', 'number', '4', 1, 4)}
                {renderInput('function-permission-level', 'Function Permission Level', 'number', '2', 1, 4)}
                {renderCheckbox('hide-online-players', 'Hide Online Players')}
                {renderCheckbox('prevent-proxy-connections', 'Prevent Proxy Connections')}
              </>
            )}

            {activeTab === 'World' && (
              <>
                {renderCheckbox('generate-structures', 'Generate Structures')}
                {renderInput('max-world-size', 'Max World Size', 'number', '29999984')}
              </>
            )}

            {activeTab === 'Network' && (
              <>
                {renderCheckbox('enable-query', 'Enable Query')}
                {renderInput('query.port', 'Query Port', 'number', '25565')}
                {renderInput('entity-broadcast-range-percentage', 'Entity Broadcast Range Percentage', 'number', '100')}
                {renderInput('network-compression-threshold', 'Network Compression Threshold', 'number', '256')}
                {renderCheckbox('sync-chunk-writes', 'Sync Chunk Writes')}
              </>
            )}
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
