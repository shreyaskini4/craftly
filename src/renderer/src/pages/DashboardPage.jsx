import { useState, useEffect } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Play, Square, RotateCcw, Users, Cpu, MemoryStick, Activity, ArrowRight, Archive, Settings } from 'lucide-react'
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
  const { status, startTime } = useServerStore()
  const { cpuHistory, ramHistory, currentCpu, currentRam, players, tps } = useMonitorStore()
  const initMonitorListeners = useMonitorStore(state => state.initListeners)
  const [uptime, setUptime] = useState(0)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [serverDir, setServerDir] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [settings, setSettings] = useState(null)
  const [versions, setVersions] = useState([])
  const [fetchingVersions, setFetchingVersions] = useState(false)

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

  const chartTooltipStyle = {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-xs)',
    color: 'var(--text-primary)'
  }

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
      <div className="hero-header" style={{ padding: '48px 32px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))', borderRadius: '24px', marginBottom: '32px', border: '1px solid var(--border-subtle)', boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-50%', left: '-10%', width: '60%', height: '200%', background: 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '56px', fontWeight: 800, letterSpacing: '-1.5px', margin: 0, background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.1 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginTop: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: isOnline ? 'var(--color-success)' : 'var(--text-tertiary)', boxShadow: isOnline ? '0 0 10px var(--color-success)' : 'none' }}></span>
            Server is currently {isOnline ? 'online' : 'offline'}
          </p>
        </div>
        <div className="flex gap-lg items-center" style={{ position: 'relative', zIndex: 1 }}>
          {settings && (
            <div className="flex gap-sm items-center" style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
              <div style={{ padding: '0 12px', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>Version</div>
              <select
                className="select"
                value={settings.serverVersion || ''}
                onChange={e => updateSetting('serverVersion', e.target.value)}
                style={{ width: 180, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '15px', borderRadius: '10px' }}
                onClick={() => { if(versions.length === 0) fetchVersions() }}
              >
                <option value="">{settings.serverVersion || 'Select version'}</option>
                {versions.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}

          {isOffline ? (
            <button onClick={handleStart} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(to bottom, #22c55e, #16a34a)', color: '#fff', fontSize: '24px', fontWeight: 900, padding: '18px 40px', borderRadius: '16px', border: 'none', boxShadow: '0 8px 0 #14532d, 0 20px 25px rgba(22,163,74,0.5)', transform: 'translateY(-4px)', transition: 'all 0.1s', textTransform: 'uppercase', letterSpacing: '2px' }}
              onMouseDown={e => { e.currentTarget.style.transform = 'translateY(4px)'; e.currentTarget.style.boxShadow = '0 0 0 #14532d, 0 10px 15px rgba(22,163,74,0.5)' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 0 #14532d, 0 20px 25px rgba(22,163,74,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 0 #14532d, 0 20px 25px rgba(22,163,74,0.5)' }}
            >
              <Play size={28} style={{ fill: '#fff' }} /> PLAY
            </button>
          ) : (
            <button onClick={handleStop} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(to bottom, #ef4444, #dc2626)', color: '#fff', fontSize: '24px', fontWeight: 900, padding: '18px 40px', borderRadius: '16px', border: 'none', boxShadow: '0 8px 0 #7f1d1d, 0 20px 25px rgba(220,38,38,0.5)', transform: 'translateY(-4px)', transition: 'all 0.1s', textTransform: 'uppercase', letterSpacing: '2px' }}
              onMouseDown={e => { e.currentTarget.style.transform = 'translateY(4px)'; e.currentTarget.style.boxShadow = '0 0 0 #7f1d1d, 0 10px 15px rgba(220,38,38,0.5)' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 0 #7f1d1d, 0 20px 25px rgba(220,38,38,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 0 #7f1d1d, 0 20px 25px rgba(220,38,38,0.5)' }}
            >
              <Square size={28} style={{ fill: '#fff' }} /> STOP
            </button>
          )}
        </div>
      </div>

      <div className="dashboard-stats-grid">
        {/* Server Status Card */}
        <div className={`card ${isOnline ? 'glow-pulse-online' : 'glow-pulse-offline'}`}>
          <div className="card-content">
            <div className="card-header">
              <span className="card-title">Server Status</span>
              <StatusBadge status={status} />
            </div>
            <div className="card-value">{formatUptime(uptime)}</div>
            <p className="card-subtitle">Uptime</p>
          </div>
          <div className="card-info-bar">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div className={`status-dot ${status}`}></div> {status.toUpperCase()}</span>
            <span style={{ color: 'var(--text-tertiary)' }}><Settings size={14} /></span>
          </div>
        </div>

        {/* Players Card */}
        <div className={`card ${isOnline && players.online > 0 ? 'glow-success' : ''}`}>
          <div className="card-content">
            <div className="card-header">
              <span className="card-title"><div className="icon-chip primary"><Users size={16} /></div>Players</span>
            </div>
            <div className="card-value">{players.online}<span style={{ fontSize: 'var(--font-lg)', color: 'var(--text-tertiary)' }}>/{players.max || 20}</span></div>
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

        {/* RAM Usage Card */}
        <div className="card">
          <div className="card-content" style={{ paddingBottom: 0 }}>
            <div className="card-header">
              <span className="card-title"><div className="icon-chip primary"><MemoryStick size={16} /></div>RAM Usage</span>
            </div>
            <div className="card-value">{currentRam.used}<span style={{ fontSize: 'var(--font-base)', color: 'var(--text-tertiary)' }}> MB</span></div>
            <div className="chart-container" style={{ marginTop: 'auto', paddingTop: 'var(--space-md)', flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '80px' }}>
              <ResponsiveContainer width="100%" height="100%" style={{ flexGrow: 1 }}>
                <AreaChart data={ramHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis hide />
                  <Tooltip contentStyle={chartTooltipStyle} className="custom-chart-tooltip" formatter={(v) => [`${v} MB`, 'RAM']} />
                  <Area type="monotone" dataKey="value" stroke="var(--color-primary)" fill="url(#ramGradient)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card-info-bar">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}><Activity size={14} /> Analytics</span>
          </div>
        </div>

        {/* CPU Usage Card */}
        <div className="card">
          <div className="card-content" style={{ paddingBottom: 0 }}>
            <div className="card-header">
              <span className="card-title"><div className="icon-chip success"><Cpu size={16} /></div>CPU Usage</span>
            </div>
            <div className="card-value">{currentCpu}<span style={{ fontSize: 'var(--font-base)', color: 'var(--text-tertiary)' }}>%</span></div>
            <div className="chart-container" style={{ marginTop: 'auto', paddingTop: 'var(--space-md)', flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '80px' }}>
              <ResponsiveContainer width="100%" height="100%" style={{ flexGrow: 1 }}>
                <AreaChart data={cpuHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip contentStyle={chartTooltipStyle} className="custom-chart-tooltip" formatter={(v) => [`${v}%`, 'CPU']} />
                  <Area type="monotone" dataKey="value" stroke="var(--color-success)" fill="url(#cpuGradient)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card-info-bar">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}><Activity size={14} /> Analytics</span>
          </div>
        </div>
      </div>

      {/* Bottom Row: TPS + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
        <div className={`card ${!tpsError && isOnline && tpsValue >= 18 ? 'glow-success' : !tpsError && isOnline && tpsValue >= 15 ? 'glow-warning' : !tpsError && isOnline && tpsValue !== null ? 'glow-danger' : ''}`}>
          <div className="card-content">
            <div className="card-header">
              <span className="card-title"><div className={`icon-chip ${tpsIconClass}`.trim()}><Activity size={16} /></div>TPS</span>
            </div>
            {tpsError ? (
              <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)' }}>
                {tpsError}
              </div>
            ) : (
              <>
                <div className="card-value" style={{ color: tpsColor }}>
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

        <div className="card">
          <div className="card-content">
            <div className="card-header">
              <span className="card-title">Quick Actions</span>
            </div>
            <div className="flex gap-sm" style={{ flexWrap: 'wrap', marginTop: 'var(--space-sm)' }}>
              <button className="btn btn-outline btn-premium" onClick={handleRestart} disabled={!isOnline}>
                <RotateCcw size={16} /> Restart Server
              </button>
              <button className="btn btn-outline btn-premium" onClick={handleBackup}>
                <Archive size={16} /> Backup World
              </button>
              <button className="btn btn-outline btn-premium text-accent" onClick={() => onNavigate('console')}>
                <ArrowRight size={16} /> Open Console
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
