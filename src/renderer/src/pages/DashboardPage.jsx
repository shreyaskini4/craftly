import { useState, useEffect, useMemo } from 'react'
// import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Play, Square, RotateCcw, Users, /* Cpu, MemoryStick, */ Activity, ArrowRight, Archive } from 'lucide-react'
import { toast } from 'sonner'
import useServerStore from '../stores/serverStore'
import useMonitorStore from '../stores/monitorStore'
import StatusBadge from '../components/common/StatusBadge'
import ImportServerModal from '../components/common/ImportServerModal'

function formatUptime(ms) {
  if (!ms || ms <= 0) return '00:00:00'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function DashboardPage({ onNavigate }) {
  const { status, startTime, crashInfo } = useServerStore()
  // const { cpuHistory, ramHistory, currentCpu, currentRam, players, tps, monitorError } = useMonitorStore()
  const { players, tps, monitorError } = useMonitorStore()
  const initMonitorListeners = useMonitorStore(state => state.initListeners)
  const [uptime, setUptime] = useState(0)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [serverDir, setServerDir] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [settings, setSettings] = useState(null)
  const [versions, setVersions] = useState([])
  const [fetchingVersions, setFetchingVersions] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const s = await window.api.settings.get()
        setSettings(s)
        setServerDir(s.serverDir)
      } catch(e) {
        console.error(e)
      }
      setLoadingSettings(false)
    }
    fetchSettings()
  }, [])

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
    try {
      let result = []
      switch (type || settings?.serverType) {
        case 'vanilla':
          result = await window.api.versions.fetchVanilla()
          setVersions(result.map(v => v.id))
          break
        case 'paper':
          result = await window.api.versions.fetchPaper()
          setVersions(result)
          break
        case 'fabric':
          result = await window.api.versions.fetchFabric()
          setVersions(result.map(v => v.id))
          break
      }
      toast.success(`Found ${result.length} versions`)
    } catch (err) {
      toast.error(`Failed to fetch versions: ${err.message}`)
    }
    setFetchingVersions(false)
  }

  const handleImportSuccess = async () => {
    try {
      const s = await window.api.settings.get()
      setSettings(s)
      setServerDir(s.serverDir)
    } catch(e) {
      console.error(e)
    }
  }

  useEffect(() => {
    initMonitorListeners()
  }, [])

  useEffect(() => {
    if (status === 'online' && startTime) {
      const timer = setInterval(() => {
        setUptime(Date.now() - startTime)
      }, 1000)
      return () => clearInterval(timer)
    } else {
      setUptime(0)
    }
  }, [status, startTime])

  useEffect(() => {
    if (status === 'crashed' && crashInfo && !crashInfo.fatal && crashInfo.nextRetryMs) {
      setSecondsLeft(Math.ceil(crashInfo.nextRetryMs / 1000))
      const interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [status, crashInfo])

  const handleStart = async () => {
    try {
      await window.api.server.start()
      toast.success('Server starting...')
    } catch (err) {
      toast.error(err.message || 'Failed to start server')
    }
  }

  const handleStop = async () => {
    try {
      await window.api.server.stop()
      toast.success('Server stopping...')
    } catch (err) {
      toast.error(err.message || 'Failed to stop server')
    }
  }

  const handleRestart = async () => {
    try {
      await window.api.server.restart()
      toast.success('Server restarting...')
    } catch (err) {
      toast.error(err.message || 'Failed to restart server')
    }
  }

  const handleBackup = async () => {
    try {
      toast.promise(window.api.backups.create(), {
        loading: 'Creating backup...',
        success: 'Backup created successfully!',
        error: 'Failed to create backup'
      })
    } catch (err) {
      toast.error(err.message)
    }
  }

  const isOnline = status === 'online'
  const isOffline = status === 'offline'

  const tpsError = tps?.error
  const tpsValue = (!tpsError && typeof tps?.tps1m === 'number') ? tps.tps1m : null
  const tpsColor = tpsValue === null ? 'var(--text-tertiary)' :
    tpsValue >= 18 ? 'var(--color-success)' :
    tpsValue >= 15 ? 'var(--color-warning)' : 'var(--color-danger)'

  const tpsIconClass = tpsValue === null ? '' :
    tpsValue >= 18 ? 'success' :
    tpsValue >= 15 ? 'warning' : 'danger'

  // Recharts evaluates functional domains while the history is empty. A
  // numeric fallback prevents an initial NaN axis from taking down the page.
  /* const ramDomain = useMemo(() => {
    const values = ramHistory.map(point => point.value).filter(Number.isFinite)
    if (values.length === 0) return [0, 1]
    const min = Math.min(...values)
    const max = Math.max(...values)
    const padding = Math.max(0.1, max * 0.1)
    return [Math.max(0, min - padding), max + padding]
  }, [ramHistory])

  const chartTooltipStyle = {
    backgroundColor: '#000000',
    border: '1px solid rgba(147, 51, 234, 0.4)',
    borderRadius: '4px',
    fontFamily: 'var(--font-pixel)',
    fontSize: '16px',
    color: 'var(--text-primary)',
    padding: '8px 12px'
  } */

  if (loadingSettings) {
    return (
      <div className="slide-up">
        <div className="empty-state">
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
        </div>
      </div>
    )
  }

  if (!serverDir) {
    return (
      <div className="slide-up">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Monitor your Minecraft server at a glance</p>
          </div>
        </div>
        <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 'var(--space-md)' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: 'var(--space-xs)' }}>No Server Configured</h2>
            <p style={{ color: 'var(--text-secondary)' }}>You haven't set up a server directory yet.</p>
          </div>
          <button className="btn btn-primary btn-premium glow-accent" onClick={() => setIsImportModalOpen(true)}>
            Import Existing Server
          </button>
        </div>
        <ImportServerModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={handleImportSuccess}
        />
      </div>
    )
  }

  return (
    <div className="slide-up">
      {monitorError && (
        <div style={{ background: 'var(--color-danger)', color: '#fff', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>
          <span>⚠️</span> <span><strong>Monitoring Error:</strong> {monitorError}</span>
        </div>
      )}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, margin: 0, lineHeight: 1.2, color: 'var(--text-primary)' }}>
            Dashboard
          </h1>
        </div>
        <div className="flex gap-md items-center">
          {settings && (
            <div className="flex gap-sm items-center no-drag" style={{ background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', fontWeight: 600 }}>Version</div>
              <select
                className="select no-drag"
                value={settings.serverVersion || ''}
                onChange={e => updateSetting('serverVersion', e.target.value)}
                style={{ width: 140, background: 'transparent', border: 'none', padding: 0, fontWeight: 500, fontSize: 'var(--font-sm)', paddingRight: '20px', boxShadow: 'none' }}
                onClick={() => { if(versions.length === 0) fetchVersions() }}
              >
                <option value="">{settings.serverVersion || 'Select version'}</option>
                {versions.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}

          {isOffline ? (
            <button className="btn btn-success no-drag" onClick={handleStart} style={{ padding: '8px 20px', fontWeight: 600 }}>
              <Play size={18} /> Start
            </button>
          ) : (
            <button className="btn btn-danger no-drag" onClick={handleStop} style={{ padding: '8px 20px', fontWeight: 600 }}>
              <Square size={18} /> Stop
            </button>
          )}
        </div>
      </div>

      {crashInfo && (
        <div style={{
          background: crashInfo.fatal ? 'rgba(244, 63, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
          color: crashInfo.fatal ? '#f43f5e' : '#f59e0b',
          border: `1px solid ${crashInfo.fatal ? 'rgba(244, 63, 94, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
          padding: '16px 20px',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-lg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-md)',
          boxShadow: crashInfo.fatal ? '0 0 15px rgba(244, 63, 94, 0.15)' : '0 0 15px rgba(245, 158, 11, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>{crashInfo.fatal ? '🚨' : '⚠️'}</span>
            <div>
              <h4 style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>
                {crashInfo.fatal ? 'Fatal Server Crash' : 'Server Crashed!'}
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                {crashInfo.fatal
                  ? 'Server crashed repeatedly. Auto-restart disabled until manual intervention.'
                  : `Server crashed! Auto-restarting in ${secondsLeft} seconds... (Attempt ${crashInfo.attempt} of ${settings?.autoRestartMaxRetries ?? 5})`
                }
              </p>
            </div>
          </div>
          {crashInfo.fatal && (
            <button
              className="btn btn-danger no-drag"
              onClick={handleStart}
              style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Play size={16} /> Start Server
            </button>
          )}
        </div>
      )}

      <div className="dashboard-bento-grid">
        {/* Server Status Card */}
        <div className={`card card-status ${status === 'online' ? 'glow-online' : status === 'offline' ? 'glow-offline' : 'glow-starting'}`}>
          <div className="card-content">
            <div className="card-header">
              <span className="card-title text-pixel">Server Status</span>
              <StatusBadge status={status} />
            </div>
            <div className={`card-value uptime-value ${
              status === 'online' ? 'glow-text-success' :
              status === 'offline' ? 'glow-text-danger' : 'glow-text-warning'
            }`}>{formatUptime(uptime)}</div>
            <p className="card-subtitle">Uptime</p>
          </div>
        </div>

        {/* Players Card */}
        <div className={`card card-players ${isOnline && players.online > 0 ? 'glow-success' : ''}`}>
          <div className="card-content" style={{ flex: 1 }}>
            <div className="card-header">
              <span className="card-title text-pixel"><div className="icon-chip primary"><Users size={16} /></div>Players</span>
            </div>
            <div className="card-value text-pixel glow-text-success">{players.online}<span style={{ fontSize: 'var(--font-lg)', color: 'var(--text-tertiary)' }}>/{players.max || 20}</span></div>
            {players.list.length > 0 ? (
              <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {players.list.slice(0, 5).map(p => (
                  <div key={p.uuid || p.name} className="player-item" style={{ background: 'var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}>
                    <img
                      className="player-avatar"
                      src={`https://crafatar.com/avatars/${p.uuid}?size=32&overlay`}
                      alt={p.name}
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                    <span className="player-name">{p.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="card-subtitle" style={{ marginTop: 'var(--space-sm)' }}>No players online</p>
            )}
          </div>
          <div className="card-info-bar">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}><Users size={14} /> View All</span>
          </div>
        </div>

        {/* TPS Card */}
        <div className={`card card-tps ${!tpsError && isOnline && tpsValue >= 18 ? 'glow-success' : !tpsError && isOnline && tpsValue >= 15 ? 'glow-warning' : !tpsError && isOnline && tpsValue !== null ? 'glow-danger' : ''}`}>
          <div className="card-content">
            <div className="card-header">
              <span className="card-title text-pixel"><div className={`icon-chip ${tpsIconClass}`.trim()}><Activity size={16} /></div>TPS</span>
            </div>
            {tpsError ? (
              <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)' }}>
                {tpsError}
              </div>
            ) : (
              <>
                <div className="card-value text-pixel" style={{ color: tpsColor, textShadow: tpsValue !== null ? (tpsValue >= 18 ? '0 0 6px rgba(16, 185, 129, 0.8), 0 0 15px rgba(16, 185, 129, 0.4)' : tpsValue >= 15 ? '0 0 6px rgba(245, 158, 11, 0.8), 0 0 15px rgba(245, 158, 11, 0.4)' : '0 0 6px rgba(244, 63, 94, 0.8), 0 0 15px rgba(244, 63, 94, 0.4)') : 'none' }}>
                  {tpsValue !== null ? tpsValue.toFixed(1) : 'N/A'}
                </div>
                <p className="card-subtitle">
                  {tpsValue !== null ? (tpsValue >= 18 ? 'Excellent' : tpsValue >= 15 ? 'Moderate' : 'Poor') : 'Server offline or TPS unavailable'}
                </p>
              </>
            )}
          </div>
          <div className="card-info-bar">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}><Activity size={14} /> Real-time</span>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="card card-quick-actions glow-purple">
          <div className="card-content">
            <div className="card-header">
              <span className="card-title text-pixel">Quick Actions</span>
            </div>
            <div className="flex gap-sm" style={{ flexWrap: 'wrap', marginTop: 'var(--space-sm)' }}>
              <button className="btn btn-outline text-pixel btn-quick-action btn-restart" onClick={handleRestart} disabled={!isOnline}>
                <RotateCcw size={16} /> Restart Server
              </button>
              <button className="btn btn-outline text-pixel btn-quick-action" onClick={handleBackup}>
                <Archive size={16} /> Backup World
              </button>
              <button className="btn btn-outline text-pixel btn-quick-action btn-console" onClick={() => onNavigate('console')}>
                <ArrowRight size={16} /> Open Terminal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
