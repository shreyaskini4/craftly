import { useState, useEffect } from 'react'
import { Archive, RotateCcw, Trash2, Clock, HardDrive, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import useBackupStore from '../stores/backupStore'
import Modal from '../components/common/Modal'

function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function BackupsPage() {
  const { backups, creating, restoring, autoBackup } = useBackupStore()
  const loadBackups = useBackupStore(state => state.loadBackups)
  const createBackup = useBackupStore(state => state.createBackup)
  const restoreBackup = useBackupStore(state => state.restoreBackup)
  const deleteBackup = useBackupStore(state => state.deleteBackup)
  const setAutoBackup = useBackupStore(state => state.setAutoBackup)

  const [confirmModal, setConfirmModal] = useState(null)
  const [backupsDir, setBackupsDir] = useState('')

  useEffect(() => {
    loadBackups()
    loadAutoBackupConfig()
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const s = await window.api.settings.get()
      if (s && s.backupsDir) {
        setBackupsDir(s.backupsDir)
      }
    } catch { /* ignore */ }
  }

  const handleOpenFolder = async () => {
    try {
      await window.api.backups.openFolder()
    } catch (err) {
      toast.error(err.message || 'Failed to open backups folder')
    }
  }

  const loadAutoBackupConfig = async () => {
    try {
      const schedule = await window.api.backups.getSchedule()
      setAutoBackup(schedule)
    } catch { /* ignore */ }
  }

  const handleCreateBackup = async () => {
    try {
      await createBackup()
      toast.success('Backup created successfully!')
    } catch (err) {
      toast.error(err.message || 'Failed to create backup')
    }
  }

  const handleRestore = async (backupPath) => {
    setConfirmModal(null)
    try {
      await restoreBackup(backupPath)
      toast.success('Backup restored successfully!')
    } catch (err) {
      toast.error(err.message || 'Failed to restore backup')
    }
  }

  const handleDelete = async (backupPath) => {
    setConfirmModal(null)
    try {
      await deleteBackup(backupPath)
      toast.success('Backup deleted')
    } catch (err) {
      toast.error(err.message || 'Failed to delete backup')
    }
  }

  const handleAutoBackupToggle = async (enabled) => {
    try {
      if (enabled) {
        await window.api.backups.setSchedule(autoBackup.intervalHours || 6)
      } else {
        await window.api.backups.setSchedule(0)
      }
      setAutoBackup({ ...autoBackup, enabled })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleIntervalChange = async (hours) => {
    try {
      const h = parseInt(hours)
      await window.api.backups.setSchedule(h)
      setAutoBackup({ enabled: true, intervalHours: h })
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="slide-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Backups</h1>
          <p className="page-subtitle">Manage world backups and auto-backup schedule</p>
          {backupsDir && (
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              📁 {backupsDir}
            </div>
          )}
        </div>
        <div className="flex gap-sm" style={{ alignItems: 'center' }}>
          <button className="btn btn-outline btn-premium" onClick={handleOpenFolder}>
            <FolderOpen size={16} /> Open Folder
          </button>
          <button className="btn btn-primary btn-premium glow-accent" onClick={handleCreateBackup} disabled={creating}>
            {creating ? (
              <><div className="loading-spinner sm" /> Creating...</>
            ) : (
              <><Archive size={16} /> Backup Now</>
            )}
          </button>
        </div>
      </div>

      {/* Auto-backup Config */}
      <div className="settings-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="card-title"><Clock size={16} style={{ marginRight: 8, color: 'var(--accent)' }} />Automatic Backups</span>
            <p className="card-subtitle" style={{ marginTop: 4 }}>Schedule automatic world backups</p>
          </div>
          <div className="flex gap-sm" style={{ alignItems: 'center' }}>
            <select
              className="select"
              value={autoBackup.intervalHours || 6}
              onChange={e => handleIntervalChange(e.target.value)}
              disabled={!autoBackup.enabled}
              style={{ width: 120 }}
            >
              <option value="1">Every 1h</option>
              <option value="2">Every 2h</option>
              <option value="4">Every 4h</option>
              <option value="6">Every 6h</option>
              <option value="12">Every 12h</option>
              <option value="24">Every 24h</option>
            </select>
            <label className="toggle">
              <input
                type="checkbox"
                checked={autoBackup.enabled || false}
                onChange={e => handleAutoBackupToggle(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>

      {/* Backup List */}
      {backups.length === 0 ? (
        <div className="empty-state">
          <Archive size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <p className="empty-title">No Backups Yet</p>
          <p className="empty-text">Create your first backup using the button above to secure your world files.</p>
        </div>
      ) : (
        <div className="flex-col gap-sm">
          {backups.map(backup => (
            <div key={backup.path} className="backup-item">
              <div className="backup-info">
                <span className="backup-name" style={{ display: 'flex', alignItems: 'center', fontWeight: 600 }}>
                  <Archive size={16} style={{ marginRight: 8, color: 'var(--accent)' }} />
                  {backup.name}
                </span>
                <span className="backup-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 4 }}>
                  <HardDrive size={12} /> {formatSize(backup.size)} • {formatDate(backup.date)}
                </span>
              </div>
              <div className="flex gap-sm">
                <button
                  className="btn btn-outline btn-sm btn-premium"
                  onClick={() => setConfirmModal({ type: 'restore', backup })}
                  disabled={restoring}
                >
                  <RotateCcw size={14} /> Restore
                </button>
                <button
                  className="btn btn-danger btn-sm btn-premium"
                  onClick={() => setConfirmModal({ type: 'delete', backup })}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={confirmModal?.type === 'restore' ? 'Restore Backup' : 'Delete Backup'}
      >
        <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 14 }}>
          {confirmModal?.type === 'restore'
            ? 'This will replace your current world with the backup. The server must be stopped. Are you sure?'
            : `Are you sure you want to delete "${confirmModal?.backup?.name}"? This cannot be undone.`}
        </p>
        <div className="modal-actions">
          <button className="btn btn-outline btn-premium" onClick={() => setConfirmModal(null)}>Cancel</button>
          {confirmModal?.type === 'restore' ? (
            <button className="btn btn-primary btn-premium glow-accent" onClick={() => handleRestore(confirmModal.backup.path)}>
              Restore
            </button>
          ) : (
            <button className="btn btn-danger btn-premium glow-danger" onClick={() => handleDelete(confirmModal.backup.path)}>
              Delete
            </button>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default BackupsPage
