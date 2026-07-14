import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  Folder,
  File,
  FolderPlus,
  FilePlus,
  Trash,
  Edit,
  ChevronRight,
  Save,
  RotateCcw,
  FileText,
  Clock,
  HardDrive,
  FolderOpen,
  ArrowLeft
} from 'lucide-react'
import Modal from '../components/common/Modal'

export default function FilesPage() {
  const [currentPath, setCurrentPath] = useState('')
  const [items, setItems] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isContentLoading, setIsContentLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Modals state
  const [activeModal, setActiveModal] = useState(null) // 'create-file' | 'create-folder' | 'rename' | 'delete'
  const [modalInputValue, setModalInputValue] = useState('')

  const textareaRef = useRef(null)
  const gutterRef = useRef(null)

  // Sync scroll for code editor gutter
  const handleScroll = () => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  // Reload file items when path changes
  useEffect(() => {
    loadFiles()
    setSelectedItem(null)
    setFileContent('')
    setOriginalContent('')
  }, [currentPath])

  const loadFiles = async () => {
    setIsLoading(true)
    try {
      const list = await window.api.files.list(currentPath)
      // Sort directories first, then files (alphabetical)
      const sorted = list.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name)
        }
        return a.type === 'dir' ? -1 : 1
      })
      setItems(sorted)
    } catch (err) {
      toast.error(err.message || 'Failed to load files')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectItem = async (item) => {
    setSelectedItem(item)
    setFileContent('')
    setOriginalContent('')

    if (item.type === 'file') {
      if (isEditableFile(item.name)) {
        setIsContentLoading(true)
        try {
          const itemPath = getFullPath(item.name)
          const result = await window.api.files.read(itemPath)
          setFileContent(result.content)
          setOriginalContent(result.content)
        } catch (err) {
          toast.error(err.message || 'Failed to read file')
          console.error(err)
        } finally {
          setIsContentLoading(false)
        }
      }
    }
  }

  // Ctrl+S handler for saving
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (selectedItem && selectedItem.type === 'file' && isEditableFile(selectedItem.name)) {
          const hasChanges = fileContent !== originalContent
          if (hasChanges && !isSaving) {
            handleSaveFile()
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem, fileContent, originalContent, isSaving])

  const handleSaveFile = async () => {
    if (!selectedItem) return
    setIsSaving(true)
    try {
      const itemPath = getFullPath(selectedItem.name)
      await window.api.files.write(itemPath, fileContent)
      setOriginalContent(fileContent)
      toast.success(`Successfully saved ${selectedItem.name}`)
      // Update selected item in items list modified time
      loadFiles()
    } catch (err) {
      toast.error(err.message || 'Failed to save file')
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetFile = () => {
    setFileContent(originalContent)
    toast.info('Changes discarded')
  }

  const isEditableFile = (name) => {
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
    const safeExtensions = [
      '.properties',
      '.json',
      '.yml',
      '.yaml',
      '.txt',
      '.log',
      '.cfg',
      '.toml',
      '.conf',
      '.md',
      '.sh',
      '.bat',
      '.cmd'
    ]
    if (!name.includes('.')) return true
    return safeExtensions.includes(ext)
  }

  const getFullPath = (name) => {
    return currentPath ? `${currentPath}/${name}` : name
  }

  // Breadcrumbs builder
  const navigateToBreadcrumb = (index) => {
    if (index === -1) {
      setCurrentPath('')
      return
    }
    const parts = currentPath.split('/')
    const newPath = parts.slice(0, index + 1).join('/')
    setCurrentPath(newPath)
  }

  const getBreadcrumbs = () => {
    if (!currentPath) return []
    return currentPath.split('/')
  }

  // Modal actions
  const openModal = (type) => {
    setActiveModal(type)
    if (type === 'rename' && selectedItem) {
      setModalInputValue(selectedItem.name)
    } else {
      setModalInputValue('')
    }
  }

  const handleModalSubmit = async (e) => {
    e.preventDefault()
    if (!modalInputValue.trim()) {
      toast.warning('Name cannot be empty')
      return
    }

    const value = modalInputValue.trim()

    try {
      if (activeModal === 'create-file') {
        const filePath = getFullPath(value)
        await window.api.files.createFile(filePath)
        toast.success(`Created file "${value}"`)
        await loadFiles()
        // Auto select newly created file
        const created = items.find(item => item.name === value && item.type === 'file')
        if (created) handleSelectItem(created)
      } else if (activeModal === 'create-folder') {
        const dirPath = getFullPath(value)
        await window.api.files.createDir(dirPath)
        toast.success(`Created folder "${value}"`)
        await loadFiles()
      } else if (activeModal === 'rename') {
        if (!selectedItem) return
        const oldPath = getFullPath(selectedItem.name)
        const newPath = getFullPath(value)
        await window.api.files.rename(oldPath, newPath)
        toast.success(`Renamed to "${value}"`)
        await loadFiles()
      } else if (activeModal === 'delete') {
        if (!selectedItem) return
        const targetPath = getFullPath(selectedItem.name)
        await window.api.files.delete(targetPath)
        toast.success(`Deleted "${selectedItem.name}"`)
        setSelectedItem(null)
        setFileContent('')
        setOriginalContent('')
        await loadFiles()
      }
      setActiveModal(null)
    } catch (err) {
      toast.error(err.message || 'Action failed')
      console.error(err)
    }
  }

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatModified = (isoString) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    return date.toLocaleString()
  }

  // Get line numbers for current file content
  const linesCount = fileContent.split('\n').length
  const lineNumbers = Array.from({ length: linesCount }, (_, i) => i + 1)

  return (
    <div className="slide-up files-page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">File Manager</h1>
          <p className="page-subtitle">Manage server configurations, worlds, and logs directly</p>
        </div>
      </div>

      <div className="files-layout">
        {/* Left Pane: Sidebar browser */}
        <div className="files-sidebar-card card">
          <div className="files-sidebar-toolbar">
            {/* Breadcrumbs */}
            <div className="files-breadcrumbs-container">
              <button
                className={`files-breadcrumb-btn ${!currentPath ? 'active' : ''}`}
                onClick={() => navigateToBreadcrumb(-1)}
              >
                root
              </button>
              {getBreadcrumbs().map((part, index) => (
                <span key={index} className="files-breadcrumb-item">
                  <ChevronRight size={14} className="breadcrumb-separator" />
                  <button
                    className={`files-breadcrumb-btn ${index === getBreadcrumbs().length - 1 ? 'active' : ''}`}
                    onClick={() => navigateToBreadcrumb(index)}
                  >
                    {part}
                  </button>
                </span>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="files-actions-toolbar">
              <button
                className="btn btn-outline btn-sm btn-icon"
                title="New File"
                onClick={() => openModal('create-file')}
              >
                <FilePlus size={16} />
              </button>
              <button
                className="btn btn-outline btn-sm btn-icon"
                title="New Folder"
                onClick={() => openModal('create-folder')}
              >
                <FolderPlus size={16} />
              </button>
            </div>
          </div>

          <div className="files-list-container">
            {isLoading ? (
              <div className="files-loading-overlay">
                <div className="loading-spinner" />
                <p>Reading files...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="files-empty-directory">
                <FolderOpen size={40} className="empty-dir-icon" />
                <p>This directory is empty</p>
              </div>
            ) : (
              <table className="files-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th style={{ textAlign: 'right' }}>Size</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.name}
                      className={`files-item-row ${selectedItem?.name === item.name ? 'active' : ''}`}
                      onClick={() => handleSelectItem(item)}
                      onDoubleClick={() => {
                        if (item.type === 'dir') {
                          setCurrentPath(getFullPath(item.name))
                        }
                      }}
                    >
                      <td className="files-name-cell">
                        {item.type === 'dir' ? (
                          <Folder size={16} className="item-icon folder-icon" />
                        ) : (
                          <FileText size={16} className="item-icon file-icon" />
                        )}
                        <span className="item-name-text">{item.name}</span>
                      </td>
                      <td className="files-size-cell">
                        {item.type === 'dir' ? '-' : formatSize(item.size)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Pane: Editor & Details */}
        <div className="files-detail-card card">
          {!selectedItem ? (
            <div className="files-empty-state">
              <HardDrive size={48} className="empty-icon" />
              <h3>No Item Selected</h3>
              <p>Select a file to edit/view, or double-click a folder to navigate into it.</p>
            </div>
          ) : (
            <div className="files-detail-content">
              {/* Header Details */}
              <div className="files-detail-header">
                <div className="detail-meta">
                  <div className="detail-title-row">
                    {selectedItem.type === 'dir' ? (
                      <Folder size={20} className="folder-icon" />
                    ) : (
                      <FileText size={20} className="file-icon" />
                    )}
                    <h3 className="detail-title">{selectedItem.name}</h3>
                  </div>
                  <div className="detail-sub-meta text-pixel">
                    {selectedItem.type === 'dir' ? (
                      <span>Folder</span>
                    ) : (
                      <>
                        <span>File • {formatSize(selectedItem.size)}</span>
                      </>
                    )}
                    {selectedItem.modified && (
                      <span className="modified-time-row">
                        <Clock size={12} className="meta-icon" />
                        Modified: {formatModified(selectedItem.modified)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="detail-actions">
                  {selectedItem.type === 'dir' && (
                    <button
                      className="btn btn-outline btn-sm glow-accent"
                      onClick={() => setCurrentPath(getFullPath(selectedItem.name))}
                    >
                      <FolderOpen size={14} data-icon="inline-start" />
                      Open Folder
                    </button>
                  )}
                  <button className="btn btn-outline btn-sm" onClick={() => openModal('rename')}>
                    <Edit size={14} data-icon="inline-start" />
                    Rename
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => openModal('delete')}>
                    <Trash size={14} data-icon="inline-start" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Editor Workspace for files */}
              {selectedItem.type === 'file' && (
                <div className="files-editor-workspace">
                  {!isEditableFile(selectedItem.name) ? (
                    <div className="files-binary-alert">
                      <File size={32} />
                      <p>Binary files cannot be viewed in-app.</p>
                    </div>
                  ) : isContentLoading ? (
                    <div className="editor-loading-overlay">
                      <div className="loading-spinner" />
                      <p>Loading file content...</p>
                    </div>
                  ) : (
                    <div className="editor-main-container">
                      <div className="editor-toolbar">
                        <div className="editor-status-info">
                          {fileContent !== originalContent ? (
                            <>
                              <span className="status-dot modified" />
                              <span className="status-text modified">Unsaved changes (Press Ctrl+S to save)</span>
                            </>
                          ) : (
                            <>
                              <span className="status-dot saved" />
                              <span className="status-text saved">All changes saved</span>
                            </>
                          )}
                        </div>
                        <div className="editor-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={fileContent === originalContent || isSaving}
                            onClick={handleResetFile}
                          >
                            <RotateCcw size={14} data-icon="inline-start" />
                            Discard
                          </button>
                          <button
                            className="btn btn-primary glow-accent btn-sm"
                            disabled={fileContent === originalContent || isSaving}
                            onClick={handleSaveFile}
                          >
                            <Save size={14} data-icon="inline-start" />
                            {isSaving ? 'Saving...' : 'Save File'}
                          </button>
                        </div>
                      </div>

                      {/* Code Editor body */}
                      <div className="editor-body">
                        {/* Gutter with line numbers */}
                        <div className="editor-gutter" ref={gutterRef}>
                          {lineNumbers.map((num) => (
                            <div key={num} className="gutter-number">
                              {num}
                            </div>
                          ))}
                        </div>

                        {/* Monospace textarea */}
                        <textarea
                          ref={textareaRef}
                          className="editor-textarea"
                          value={fileContent}
                          onChange={(e) => setFileContent(e.target.value)}
                          onScroll={handleScroll}
                          spellCheck="false"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Modals */}
      <Modal
        isOpen={activeModal !== null}
        onClose={() => setActiveModal(null)}
        title={
          activeModal === 'create-file'
            ? 'New File'
            : activeModal === 'create-folder'
            ? 'New Folder'
            : activeModal === 'rename'
            ? 'Rename Item'
            : 'Delete Item'
        }
      >
        {activeModal === 'delete' ? (
          <form onSubmit={handleModalSubmit}>
            <div className="modal-body">
              <p style={{ marginBottom: 'var(--space-md)' }}>
                Are you sure you want to delete <strong>{selectedItem?.name}</strong>?
              </p>
              <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-sm)' }}>
                ⚠️ This action is permanent and cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger">
                Delete
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleModalSubmit}>
            <div className="modal-body">
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                <label className="settings-label">
                  {activeModal === 'create-file'
                    ? 'File Name'
                    : activeModal === 'create-folder'
                    ? 'Folder Name'
                    : 'New Name'}
                </label>
                <input
                  type="text"
                  className="input"
                  value={modalInputValue}
                  onChange={(e) => setModalInputValue(e.target.value)}
                  placeholder={
                    activeModal === 'create-file'
                      ? 'e.g. settings.txt'
                      : activeModal === 'create-folder'
                      ? 'e.g. plugins'
                      : 'e.g. new-name.txt'
                  }
                  autoFocus
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setActiveModal(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary glow-accent">
                {activeModal === 'rename' ? 'Rename' : 'Create'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
