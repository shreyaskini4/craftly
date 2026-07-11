import { useState, useEffect, useCallback } from 'react'
import { Search, Download, Trash2, Package, Check, Loader, RefreshCw, ArrowUpCircle } from 'lucide-react'
import { toast } from 'sonner'
import useModStore from '../stores/modStore'

function formatDownloads(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return String(num)
}

function ModsPage() {
  const [activeTab, setActiveTab] = useState('browse')
  const { searchResults, loading, installing, installedMods, filters, availableUpdates, checkingUpdates, updating } = useModStore()
  const search = useModStore(state => state.search)
  const install = useModStore(state => state.install)
  const uninstall = useModStore(state => state.uninstall)
  const loadInstalled = useModStore(state => state.loadInstalled)
  const setFilters = useModStore(state => state.setFilters)
  const checkUpdates = useModStore(state => state.checkUpdates)
  const updateMod = useModStore(state => state.updateMod)
  const updateAll = useModStore(state => state.updateAll)

  const [query, setQuery] = useState('')
  const [gameVersion, setGameVersion] = useState('')
  const [loader, setLoader] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    loadInstalled()
    window.api.settings.get().then(s => {
      if (s) {
        if (s.serverVersion) setGameVersion(s.serverVersion)
        if (['fabric', 'forge', 'quilt', 'paper'].includes(s.serverType)) {
          setLoader(s.serverType)
        }
      }
    }).catch(err => console.error('Failed to load settings', err))
  }, [])

  const handleSearch = useCallback(() => {
    const f = { gameVersion, loader }
    setFilters(f)
    search(query, false)
  }, [query, gameVersion, loader])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2 || query.length === 0) {
        handleSearch()
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [query, gameVersion, loader])

  const handleInstallDirect = async (projectId, title) => {
    try {
      toast.promise(install(projectId, null), {
        loading: `Installing ${title}...`,
        success: `${title} installed!`,
        error: `Failed to install ${title}`
      })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleUninstall = async (filename, title) => {
    try {
      await uninstall(filename)
      toast.success(`${title || filename} uninstalled`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleLoadMore = () => {
    search(query, true)
  }

  const isInstalled = (projectId) => {
    return installedMods.some(m => m.projectId === projectId)
  }

  return (
    <div className="slide-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mods</h1>
          <p className="page-subtitle">Browse and manage Modrinth mods</p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'browse' ? 'active' : ''}`} onClick={() => setActiveTab('browse')}>
          Browse Mods
        </button>
        <button className={`tab ${activeTab === 'installed' ? 'active' : ''}`} onClick={() => setActiveTab('installed')}>
          Installed ({installedMods.length})
        </button>
      </div>

      {activeTab === 'browse' && (
        <>
          <div className="flex flex-wrap gap-md" style={{ marginBottom: 'var(--space-md)' }}>
            <div className="search-container" style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={16} className="search-icon" />
              <input
                className="input search-input"
                placeholder="Search mods..."
                value={query}
                onChange={e => {
                  setQuery(e.target.value)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              {showSuggestions && searchResults.hits.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  maxHeight: '320px',
                  overflowY: 'auto',
                  zIndex: 50,
                  boxShadow: 'var(--shadow-lg)'
                }}>
                  {searchResults.hits.map(hit => (
                    <div 
                      key={hit.project_id} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 14px',
                        gap: '12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-medium)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => {
                        setQuery(hit.title)
                        setShowSuggestions(false)
                        handleSearch()
                      }}
                    >
                      {hit.icon_url ? (
                        <img src={hit.icon_url} alt={hit.title} style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)' }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={16} style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px', fontWeight: 500 }}>
                          {hit.title}
                        </span>
                      </div>
                      <span className="badge badge-info" style={{ gap: '4px', fontSize: '12px' }}>
                        <Download size={12} /> {formatDownloads(hit.downloads)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <select className="select" value={gameVersion} onChange={e => setGameVersion(e.target.value)} style={{ width: 150 }}>
              <option value="">Any Version</option>
              <option value="1.21.5">1.21.5</option>
              <option value="1.21.4">1.21.4</option>
              <option value="1.21.3">1.21.3</option>
              <option value="1.21.2">1.21.2</option>
              <option value="1.21.1">1.21.1</option>
              <option value="1.21">1.21</option>
              <option value="1.20.6">1.20.6</option>
              <option value="1.20.4">1.20.4</option>
              <option value="1.20.1">1.20.1</option>
            </select>
            <select className="select" value={loader} onChange={e => setLoader(e.target.value)} style={{ width: 140 }}>
              <option value="">Any Loader</option>
              <option value="fabric">Fabric</option>
              <option value="forge">Forge</option>
              <option value="quilt">Quilt</option>
              <option value="paper">Paper</option>
            </select>
          </div>

          {loading && searchResults.hits.length === 0 ? (
            <div className="empty-state">
              <div className="loading-spinner lg" style={{ margin: '0 auto 16px' }} />
              <p>Searching mods...</p>
            </div>
          ) : searchResults.hits.length === 0 ? (
            <div className="empty-state">
              <Package size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p>No mods found. Try a different search term.</p>
            </div>
          ) : (
            <>
              {!query.trim() && (
                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Most Used Mods</h2>
                </div>
              )}
              <div className="mod-grid">
                {searchResults.hits.map(hit => (
                  <div key={hit.project_id} className="mod-card">
                    <div className="mod-card-header">
                      {hit.icon_url ? (
                        <img className="mod-icon" src={hit.icon_url} alt={hit.title} style={{ borderRadius: 'var(--radius-sm)' }} />
                      ) : (
                        <div className="mod-icon" style={{ background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)' }}>
                          <Package size={24} style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                      )}
                      <div className="mod-info">
                        <span className="mod-name">{hit.title}</span>
                        <p className="mod-description" style={{ color: 'var(--text-secondary)' }}>{hit.description}</p>
                      </div>
                    </div>
                    <div className="mod-stats" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge badge-info" style={{ gap: '4px' }}>
                        <Download size={12} /> {formatDownloads(hit.downloads)}
                      </span>
                      {hit.categories?.slice(0, 2).map(cat => (
                        <span key={cat} className="badge badge-success" style={{ textTransform: 'capitalize' }}>
                          {cat}
                        </span>
                      ))}
                    </div>
                    <div className="mod-actions">
                      {isInstalled(hit.project_id) ? (
                        <button className="btn btn-outline btn-sm w-full btn-premium" disabled style={{ opacity: 0.8, background: 'rgba(63, 185, 80, 0.1)', color: 'var(--success)', borderColor: 'rgba(63, 185, 80, 0.2)' }}>
                          <Check size={14} /> Installed
                        </button>
                      ) : installing[hit.project_id] ? (
                        <button className="btn btn-outline btn-sm w-full btn-premium" disabled>
                          <Loader size={14} className="spin" /> Installing...
                        </button>
                      ) : (
                        <button className="btn btn-primary btn-sm w-full btn-premium" onClick={() => handleInstallDirect(hit.project_id, hit.title)}>
                          <Download size={14} /> Install
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {searchResults.hits.length < searchResults.totalHits && (
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                  <button className="btn btn-outline btn-premium" onClick={handleLoadMore} disabled={loading}>
                    {loading ? <><Loader size={14} className="spin" /> Loading...</> : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'installed' && (
        <>
          {/* Check for Updates button */}
          {installedMods.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-md)' }}>
              <button
                className="btn btn-outline btn-premium"
                onClick={checkUpdates}
                disabled={checkingUpdates}
              >
                {checkingUpdates ? (
                  <><Loader size={14} className="spin" /> Checking...</>
                ) : (
                  <><RefreshCw size={14} /> Check for Updates</>
                )}
              </button>
              {availableUpdates.length > 0 && (
                <button
                  className="btn btn-primary btn-premium"
                  onClick={updateAll}
                >
                  <ArrowUpCircle size={14} /> Update All ({availableUpdates.length})
                </button>
              )}
            </div>
          )}

          {/* Updates available banner */}
          {availableUpdates.length > 0 && (
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-md)'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowUpCircle size={18} style={{ color: 'var(--accent)' }} />
                {availableUpdates.length} update{availableUpdates.length !== 1 ? 's' : ''} available
              </h3>
              <div className="flex-col gap-sm">
                {availableUpdates.map(mod => (
                  <div key={mod.projectId} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      {mod.iconUrl ? (
                        <img src={mod.iconUrl} alt={mod.title} style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)' }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={16} style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '14px' }}>{mod.title || mod.filename}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          v{mod.versionNumber} → <span style={{ color: 'var(--accent)', fontWeight: 500 }}>v{mod.latestVersionNumber}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-sm btn-premium"
                      onClick={() => updateMod(mod)}
                      disabled={updating[mod.projectId]}
                      style={{ flexShrink: 0 }}
                    >
                      {updating[mod.projectId] ? (
                        <><Loader size={14} className="spin" /> Updating...</>
                      ) : (
                        <><ArrowUpCircle size={14} /> Update</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {installedMods.length === 0 ? (
            <div className="empty-state">
              <Package size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p>No mods installed yet. Browse mods to get started!</p>
            </div>
          ) : (
            <div className="flex-col gap-sm">
              {installedMods.map(mod => {
                const updateAvailable = availableUpdates.find(u => u.projectId === mod.projectId)
                return (
                  <div key={mod.filename} className="backup-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {mod.iconUrl ? (
                        <img src={mod.iconUrl} alt={mod.title} style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)' }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package size={20} style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                      )}
                      <div className="backup-info">
                        <span className="backup-name">{mod.title || mod.filename}</span>
                        <span className="backup-meta">
                          {mod.versionNumber && <span className="badge badge-info" style={{ padding: '1px 6px', fontSize: '11px' }}>v{mod.versionNumber}</span>}
                          {updateAvailable && (
                            <span className="badge badge-success" style={{ padding: '1px 6px', fontSize: '11px', background: 'rgba(63, 185, 80, 0.15)', color: 'var(--success)' }}>
                              → v{updateAvailable.latestVersionNumber}
                            </span>
                          )}
                          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{mod.filename}</span>
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {updateAvailable && (
                        <button
                          className="btn btn-primary btn-sm btn-premium"
                          onClick={() => updateMod(updateAvailable)}
                          disabled={updating[mod.projectId]}
                        >
                          {updating[mod.projectId] ? (
                            <><Loader size={14} className="spin" /> Updating...</>
                          ) : (
                            <><ArrowUpCircle size={14} /> Update</>
                          )}
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm btn-premium" onClick={() => handleUninstall(mod.filename, mod.title)}>
                        <Trash2 size={14} /> Uninstall
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ModsPage
