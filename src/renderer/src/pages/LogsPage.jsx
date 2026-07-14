import { useState, useEffect } from 'react'
import { FileText, Search, RefreshCw, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

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

function LogsPage() {
  const [logs, setLogs] = useState([])
  const [crashReports, setCrashReports] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [selectedFile, setSelectedFile] = useState(null) // { name, type: 'log' | 'crash' }
  const [fileContent, setFileContent] = useState('')
  const [loadingContent, setLoadingContent] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [logsExpanded, setLogsExpanded] = useState(true)
  const [crashReportsExpanded, setCrashReportsExpanded] = useState(true)

  const loadLists = async () => {
    setLoadingList(true)
    try {
      const [logsList, crashList] = await Promise.all([
        window.api.logs.listLogs(),
        window.api.logs.listCrashReports()
      ])
      setLogs(logsList)
      setCrashReports(crashList)
    } catch (err) {
      toast.error('Failed to load logs list: ' + err.message)
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    loadLists()
  }, [])

  const loadFile = async (name, type) => {
    setLoadingContent(true)
    try {
      let content = ''
      if (type === 'log') {
        content = await window.api.logs.readLog(name)
      } else {
        content = await window.api.logs.readCrashReport(name)
      }
      setFileContent(content)
      setSelectedFile({ name, type })
    } catch (err) {
      toast.error(`Failed to read file ${name}: ` + err.message)
    } finally {
      setLoadingContent(false)
    }
  }

  const handleRefreshContent = async () => {
    if (selectedFile) {
      await loadFile(selectedFile.name, selectedFile.type)
      toast.success('Log reloaded')
    }
  }

  const getLineClass = (line) => {
    if (!line) return 'log-default'
    const upper = line.toUpperCase()
    if (
      upper.includes('[ERROR]') ||
      upper.includes('[FATAL]') ||
      upper.includes('[SEVERE]') ||
      upper.includes('ERROR') ||
      upper.includes('FATAL')
    ) {
      return 'log-error'
    }
    if (upper.includes('[WARN]') || upper.includes('[WARNING]')) {
      return 'log-warn'
    }
    if (upper.includes('[INFO]')) {
      return 'log-info'
    }
    return 'log-default'
  }

  const lines = fileContent ? fileContent.split(/\r?\n/) : []
  const filteredLines = searchQuery
    ? lines.filter(line => line.toLowerCase().includes(searchQuery.toLowerCase()))
    : lines

  return (
    <div className="slide-up" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Logs & Crash Reports</h1>
          <p className="page-subtitle">View and search server log files and crash reports</p>
        </div>
      </div>

      <div className="logs-layout">
        {/* Left Pane */}
        <div className="logs-sidebar">
          <div className="logs-sidebar-content">
            {/* Logs Accordion */}
            <div className="accordion-group">
              <button className="accordion-header" onClick={() => setLogsExpanded(!logsExpanded)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {logsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="text-pixel" style={{ fontWeight: 600, fontSize: '13px' }}>
                    Logs ({logs.length})
                  </span>
                </span>
              </button>
              {logsExpanded && (
                <div className="accordion-content">
                  {loadingList ? (
                    <div className="no-items-text">Loading...</div>
                  ) : logs.length === 0 ? (
                    <div className="no-items-text">No log files found</div>
                  ) : (
                    logs.map(item => (
                      <button
                        key={item.name}
                        className={`log-item-btn ${selectedFile?.name === item.name ? 'active' : ''}`}
                        onClick={() => loadFile(item.name, 'log')}
                      >
                        <FileText size={16} className="item-icon" />
                        <div className="item-details">
                          <span className="item-name">{item.name}</span>
                          <span className="item-meta">
                            {formatSize(item.size)} • {formatDate(item.date)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Crash Reports Accordion */}
            <div className="accordion-group">
              <button className="accordion-header" onClick={() => setCrashReportsExpanded(!crashReportsExpanded)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {crashReportsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="text-pixel" style={{ fontWeight: 600, fontSize: '13px' }}>
                    Crash Reports ({crashReports.length})
                  </span>
                </span>
              </button>
              {crashReportsExpanded && (
                <div className="accordion-content">
                  {loadingList ? (
                    <div className="no-items-text">Loading...</div>
                  ) : crashReports.length === 0 ? (
                    <div className="no-items-text">No crash reports found</div>
                  ) : (
                    crashReports.map(item => (
                      <button
                        key={item.name}
                        className={`log-item-btn ${selectedFile?.name === item.name ? 'active' : ''}`}
                        onClick={() => loadFile(item.name, 'crash')}
                      >
                        <AlertTriangle size={16} className="item-icon text-danger" />
                        <div className="item-details">
                          <span className="item-name">{item.name}</span>
                          <span className="item-meta">
                            {formatSize(item.size)} • {formatDate(item.date)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Pane */}
        <div className="logs-viewer">
          {!selectedFile ? (
            <div className="empty-state" style={{ height: '100%', justifyContent: 'center', border: 'none', background: 'transparent' }}>
              <FileText className="empty-icon" style={{ opacity: 0.3, width: 48, height: 48 }} />
              <p className="empty-title">No Log Selected</p>
              <p className="empty-text">Select a log file or a crash report from the left pane to view its contents.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="viewer-header">
                <div className="viewer-file-info">
                  {selectedFile.type === 'crash' ? (
                    <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />
                  ) : (
                    <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                  )}
                  <span className="viewer-filename text-pixel">{selectedFile.name}</span>
                </div>
                <div className="viewer-actions">
                  <button className="btn btn-outline btn-sm btn-premium" onClick={handleRefreshContent} disabled={loadingContent}>
                    <RefreshCw size={14} className={loadingContent ? 'animate-spin' : ''} style={{ marginRight: 4 }} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Filter / Search Bar */}
              <div className="viewer-search-row">
                <div className="search-input-wrapper">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Filter log lines..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                {searchQuery && (
                  <span className="search-matches text-pixel">
                    {filteredLines.length} match{filteredLines.length !== 1 ? 'es' : ''}
                  </span>
                )}
              </div>

              {/* Content Container */}
              <div className="viewer-content-container">
                {loadingContent ? (
                  <div className="loading-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="loading-spinner lg" />
                  </div>
                ) : filteredLines.length === 0 ? (
                  <div className="empty-state" style={{ height: '100%', justifyContent: 'center', border: 'none', background: 'transparent' }}>
                    <Search className="empty-icon" style={{ opacity: 0.3, width: 48, height: 48 }} />
                    <p className="empty-title">No matching lines</p>
                    <p className="empty-text">No lines matched your filter query "{searchQuery}".</p>
                  </div>
                ) : (
                  <div className="viewer-log-lines">
                    {filteredLines.map((line, idx) => (
                      <div key={idx} className={`log-line ${getLineClass(line)}`}>
                        <span className="line-number">{idx + 1}</span>
                        <span className="line-text">{line}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default LogsPage
