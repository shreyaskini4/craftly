import { useState, useEffect } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Play, Square, RotateCcw, Users, Cpu, MemoryStick, Activity, ArrowRight, Archive } from 'lucide-react'
import { toast } from 'sonner'
import useServerStore from '../stores/serverStore'
import useMonitorStore from '../stores/monitorStore'
import StatusBadge from '../components/common/StatusBadge'

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

  const tpsValue = tps?.tps1m ?? null
  const tpsColor = tpsValue === null ? 'var(--text-tertiary)' :
    tpsValue >= 18 ? 'var(--color-success)' :
    tpsValue >= 15 ? 'var(--color-warning)' : 'var(--color-danger)'

  const chartTooltipStyle = {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-xs)',
    color: 'var(--text-primary)'
  }

  return (
    <div className="slide-up">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Monitor your Minecraft server at a glance</p>
        </div>
        <div className="flex gap-sm">
          {isOffline ? (
            <button className="btn btn-success btn-premium glow-success" onClick={handleStart}>
              <Play size={16} /> Start Server
            </button>
          ) : (
            <button className="btn btn-danger btn-premium glow-danger" onClick={handleStop} disabled={!isOnline}>
              <Square size={16} /> Stop Server
            </button>
          )}
        </div>
      </div>

      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {/* Server Status Card */}
        <div className={`card glass-card ${isOnline ? 'glow-pulse-online' : 'glow-pulse-offline'}`}>
          <div className="card-header">
            <span className="card-title">Server Status</span>
            <StatusBadge status={status} />
          </div>
          <div className="card-value">{formatUptime(uptime)}</div>
          <p className="card-subtitle">Uptime</p>
        </div>

        {/* Players Card */}
        <div className={`card glass-card ${isOnline && players.online > 0 ? 'glow-success' : ''}`}>
          <div className="card-header">
            <span className="card-title"><Users size={16} style={{ marginRight: 8, color: 'var(--color-primary)' }} />Players</span>
          </div>
          <div className="card-value">{players.online}<span style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>/{players.max || 20}</span></div>
          {players.list.length > 0 ? (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
            <p className="card-subtitle" style={{ marginTop: 8 }}>No players online</p>
          )}
        </div>

        {/* RAM Usage Card */}
        <div className="card glass-card">
          <div className="card-header">
            <span className="card-title"><MemoryStick size={16} style={{ marginRight: 8, color: 'var(--color-primary)' }} />RAM Usage</span>
          </div>
          <div className="card-value">{currentRam.used}<span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}> MB</span></div>
          <div className="chart-container" style={{ marginTop: 12 }}>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={ramHistory}>
                <defs>
                  <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip contentStyle={chartTooltipStyle} className="custom-chart-tooltip" formatter={(v) => [`${v} MB`, 'RAM']} />
                <Area type="monotone" dataKey="value" stroke="var(--color-primary)" fill="url(#ramGradient)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CPU Usage Card */}
        <div className="card glass-card">
          <div className="card-header">
            <span className="card-title"><Cpu size={16} style={{ marginRight: 8, color: 'var(--color-success)' }} />CPU Usage</span>
          </div>
          <div className="card-value">{currentCpu}<span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>%</span></div>
          <div className="chart-container" style={{ marginTop: 12 }}>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={cpuHistory}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip contentStyle={chartTooltipStyle} className="custom-chart-tooltip" formatter={(v) => [`${v}%`, 'CPU']} />
                <Area type="monotone" dataKey="value" stroke="var(--color-success)" fill="url(#cpuGradient)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row: TPS + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: 16, marginTop: 16 }}>
        <div className={`card glass-card ${isOnline && tpsValue >= 18 ? 'glow-success' : isOnline && tpsValue >= 15 ? 'glow-warning' : isOnline ? 'glow-danger' : ''}`}>
          <div className="card-header">
            <span className="card-title"><Activity size={16} style={{ marginRight: 8, color: tpsColor }} />TPS</span>
          </div>
          <div className="card-value" style={{ color: tpsColor }}>
            {tpsValue !== null ? tpsValue.toFixed(1) : 'N/A'}
          </div>
          <p className="card-subtitle">
            {tpsValue !== null ? (tpsValue >= 18 ? 'Excellent' : tpsValue >= 15 ? 'Moderate' : 'Poor') : 'Server offline or TPS unavailable'}
          </p>
        </div>

        <div className="card glass-card">
          <div className="card-header">
            <span className="card-title">Quick Actions</span>
          </div>
          <div className="flex gap-sm" style={{ flexWrap: 'wrap', marginTop: 8 }}>
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
  )
}

export default DashboardPage
