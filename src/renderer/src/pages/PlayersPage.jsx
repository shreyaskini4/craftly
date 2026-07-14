import { useState, useEffect } from 'react'
import { 
  Users, Crown, Ban, Clock, UserCheck, UserMinus, UserX, Plus, Search, ShieldAlert, ShieldCheck
} from 'lucide-react'
import { toast } from 'sonner'
import useMonitorStore from '../stores/monitorStore'
import useServerStore from '../stores/serverStore'

function PlayerAvatar({ name, uuid, size = 32 }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    const identifier = uuid || name || '606e2ff0-ed77-4871-b501-55b4d189c8c5'
    setSrc(`https://crafatar.com/avatars/${identifier}?size=${size}&overlay`)
  }, [name, uuid, size])

  const handleError = () => {
    setSrc(`https://crafatar.com/avatars/606e2ff0-ed77-4871-b501-55b4d189c8c5?size=${size}&overlay`)
  }

  return (
    <img
      src={src}
      alt={name || 'Player'}
      onError={handleError}
      style={{
        width: size,
        height: size,
        borderRadius: '4px',
        imageRendering: 'pixelated',
        flexShrink: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid var(--border-subtle)'
      }}
    />
  )
}

function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    })
  } catch {
    return dateStr
  }
}

function formatTime(dateStr) {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    })
  } catch {
    return dateStr
  }
}

function PlayersPage() {
  const { status } = useServerStore()
  const { players } = useMonitorStore()
  const initMonitorListeners = useMonitorStore(state => state.initListeners)

  const [gameState, setGameState] = useState({ ops: [], whitelist: [], banned: [] })
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('ops') // ops | whitelist | banned
  const [whitelistInput, setWhitelistInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const refreshState = async () => {
    try {
      if (window.api && window.api.players) {
        const state = await window.api.players.getState()
        const hist = await window.api.players.getHistory()
        setGameState(state || { ops: [], whitelist: [], banned: [] })
        setHistory(hist || [])
      }
    } catch (err) {
      console.error('Failed to fetch players state/history:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    initMonitorListeners()
    refreshState()
    const interval = setInterval(refreshState, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleKick = async (name) => {
    const reason = window.prompt(`Enter reason for kicking ${name}:`, 'Kicked by administrator')
    if (reason === null) return
    try {
      await window.api.players.kick(name, reason)
      toast.success(`Kicked ${name}`)
      refreshState()
    } catch (err) {
      toast.error(err.message || `Failed to kick ${name}`)
    }
  }

  const handleBan = async (name) => {
    const reason = window.prompt(`Enter reason for banning ${name}:`, 'Banned by administrator')
    if (reason === null) return
    try {
      await window.api.players.ban(name, reason)
      toast.success(`Banned ${name}`)
      refreshState()
    } catch (err) {
      toast.error(err.message || `Failed to ban ${name}`)
    }
  }

  const handleUnban = async (name) => {
    try {
      await window.api.players.unban(name)
      toast.success(`Pardoned ${name}`)
      refreshState()
    } catch (err) {
      toast.error(err.message || `Failed to pardon ${name}`)
    }
  }

  const handleOp = async (name) => {
    try {
      await window.api.players.op(name)
      toast.success(`Promoted ${name} to Operator`)
      refreshState()
    } catch (err) {
      toast.error(err.message || `Failed to op ${name}`)
    }
  }

  const handleDeop = async (name) => {
    try {
      await window.api.players.deop(name)
      toast.success(`Demoted ${name} from Operator`)
      refreshState()
    } catch (err) {
      toast.error(err.message || `Failed to deop ${name}`)
    }
  }

  const handleWhitelistAdd = async (e) => {
    e.preventDefault()
    if (!whitelistInput.trim()) return
    const name = whitelistInput.trim()
    try {
      await window.api.players.whitelistAdd(name)
      toast.success(`Added ${name} to Whitelist`)
      setWhitelistInput('')
      refreshState()
    } catch (err) {
      toast.error(err.message || `Failed to add ${name} to whitelist`)
    }
  }

  const handleWhitelistRemove = async (name) => {
    try {
      await window.api.players.whitelistRemove(name)
      toast.success(`Removed ${name} from Whitelist`)
      refreshState()
    } catch (err) {
      toast.error(err.message || `Failed to remove ${name} from whitelist`)
    }
  }

  const isOnline = status === 'online'
  const onlinePlayers = players?.list || []

  // Filtered management lists based on query search
  const filteredOps = gameState.ops.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredWhitelist = gameState.whitelist.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredBanned = gameState.banned.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="slide-up">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, margin: 0, lineHeight: 1.2, color: 'var(--text-primary)' }}>
            Players
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
            Manage online players, whitelists, operators, and bans
          </p>
        </div>
      </div>

      {/* Offline Alert */}
      {!isOnline && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          color: 'var(--color-warning)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 'var(--space-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: 500
        }}>
          <span>⚠️</span>
          <span><strong>Server is Offline:</strong> Player actions (kick, ban, pardon, op, whitelist) require the server to be online. You can still view cached lists below.</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="players-layout">
        
        {/* Left Side: Online Players & Management */}
        <div className="flex-col gap-lg">
          
          {/* Online Players Grid Card */}
          <div className="card">
            <div className="card-content">
              <div className="card-header" style={{ marginBottom: 'var(--space-md)' }}>
                <span className="card-title text-pixel">
                  <div className="icon-chip primary"><Users size={16} /></div>
                  Online Players ({onlinePlayers.length})
                </span>
              </div>

              {onlinePlayers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0', color: 'var(--text-tertiary)' }}>
                  <Users size={32} style={{ marginBottom: 12, opacity: 0.3, margin: '0 auto' }} />
                  <p>No players online right now</p>
                </div>
              ) : (
                <div className="online-players-grid">
                  {onlinePlayers.map((player) => {
                    const isOp = gameState.ops.some(o => o.name?.toLowerCase() === player.name?.toLowerCase() || o.uuid === player.uuid)
                    return (
                      <div key={player.uuid || player.name} className="online-player-card">
                        <div className="player-info-wrapper">
                          <PlayerAvatar name={player.name} uuid={player.uuid} size={36} />
                          <div className="player-details">
                            <span className="name">{player.name}</span>
                            {isOp && <span className="badge-op">Operator</span>}
                          </div>
                        </div>
                        <div className="player-actions-container">
                          <button
                            className="btn btn-outline btn-sm btn-premium btn-icon no-drag"
                            title={isOp ? "Demote from Operator" : "Promote to Operator"}
                            onClick={() => isOp ? handleDeop(player.name) : handleOp(player.name)}
                            disabled={!isOnline}
                          >
                            <Crown size={14} style={{ color: isOp ? '#a855f7' : 'var(--text-tertiary)' }} />
                          </button>
                          <button
                            className="btn btn-outline btn-sm btn-premium btn-icon no-drag"
                            title="Kick Player"
                            onClick={() => handleKick(player.name)}
                            disabled={!isOnline}
                          >
                            <UserMinus size={14} style={{ color: 'var(--color-warning)' }} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm btn-premium btn-icon no-drag"
                            title="Ban Player"
                            onClick={() => handleBan(player.name)}
                            disabled={!isOnline}
                          >
                            <UserX size={14} style={{ color: '#fff' }} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Management Config Lists Card */}
          <div className="card">
            <div className="card-content">
              {/* Tab Selector & Search Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                <div className="tabs-header-container" style={{ margin: 0, borderBottom: 'none' }}>
                  <button 
                    className={`tab-trigger-btn text-pixel ${activeTab === 'ops' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ops')}
                  >
                    Operators
                  </button>
                  <button 
                    className={`tab-trigger-btn text-pixel ${activeTab === 'whitelist' ? 'active' : ''}`}
                    onClick={() => setActiveTab('whitelist')}
                  >
                    Whitelist
                  </button>
                  <button 
                    className={`tab-trigger-btn text-pixel ${activeTab === 'banned' ? 'active' : ''}`}
                    onClick={() => setActiveTab('banned')}
                  >
                    Banned Players
                  </button>
                </div>

                {/* Inline Search Bar */}
                <div className="input-group" style={{ maxWidth: 220 }}>
                  <input
                    type="text"
                    className="input text-pixel"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: 'var(--font-sm)' }}
                  />
                </div>
              </div>

              {/* Whitelist Addition Form */}
              {activeTab === 'whitelist' && (
                <form onSubmit={handleWhitelistAdd} className="flex gap-sm" style={{ marginBottom: 'var(--space-md)' }}>
                  <input
                    type="text"
                    className="input text-pixel"
                    placeholder="Add username to whitelist..."
                    value={whitelistInput}
                    onChange={(e) => setWhitelistInput(e.target.value)}
                    style={{ maxWidth: 260 }}
                  />
                  <button type="submit" className="btn btn-primary btn-premium glow-accent text-pixel" disabled={!isOnline}>
                    <Plus size={16} /> Add
                  </button>
                </form>
              )}

              {/* Tab Contents: Tables */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0' }}>
                  <div className="loading-spinner" style={{ margin: '0 auto' }} />
                </div>
              ) : (
                <>
                  {/* Operators Tab */}
                  {activeTab === 'ops' && (
                    filteredOps.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0', color: 'var(--text-tertiary)' }}>
                        <Crown size={32} style={{ marginBottom: 12, opacity: 0.3, margin: '0 auto' }} />
                        <p>No operator configurations found</p>
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table className="management-table text-pixel">
                          <thead>
                            <tr>
                              <th>Player</th>
                              <th>UUID</th>
                              <th>OP Level</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredOps.map((op) => (
                              <tr key={op.uuid || op.name}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <PlayerAvatar name={op.name} uuid={op.uuid} size={24} />
                                    <span>{op.name}</span>
                                  </div>
                                </td>
                                <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)', fontFamily: 'monospace' }}>
                                  {op.uuid || 'N/A'}
                                </td>
                                <td>
                                  <span style={{ background: 'var(--glass-bg-medium)', padding: '2px 6px', borderRadius: '4px', fontSize: 'var(--font-xs)' }}>
                                    Level {op.level || 4}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    className="btn btn-outline btn-sm btn-premium no-drag"
                                    onClick={() => handleDeop(op.name)}
                                    disabled={!isOnline}
                                  >
                                    <UserMinus size={14} /> Demote
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {/* Whitelist Tab */}
                  {activeTab === 'whitelist' && (
                    filteredWhitelist.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0', color: 'var(--text-tertiary)' }}>
                        <UserCheck size={32} style={{ marginBottom: 12, opacity: 0.3, margin: '0 auto' }} />
                        <p>No whitelisted players found</p>
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table className="management-table text-pixel">
                          <thead>
                            <tr>
                              <th>Player</th>
                              <th>UUID</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredWhitelist.map((player) => (
                              <tr key={player.uuid || player.name}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <PlayerAvatar name={player.name} uuid={player.uuid} size={24} />
                                    <span>{player.name}</span>
                                  </div>
                                </td>
                                <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)', fontFamily: 'monospace' }}>
                                  {player.uuid || 'N/A'}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    className="btn btn-danger btn-sm btn-premium no-drag"
                                    onClick={() => handleWhitelistRemove(player.name)}
                                    disabled={!isOnline}
                                  >
                                    <UserMinus size={14} /> Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {/* Banned Players Tab */}
                  {activeTab === 'banned' && (
                    filteredBanned.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0', color: 'var(--text-tertiary)' }}>
                        <Ban size={32} style={{ marginBottom: 12, opacity: 0.3, margin: '0 auto' }} />
                        <p>No banned players found</p>
                      </div>
                    ) : (
                      <div className="table-wrapper">
                        <table className="management-table text-pixel">
                          <thead>
                            <tr>
                              <th>Player</th>
                              <th>Reason</th>
                              <th>Created</th>
                              <th>Expires</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredBanned.map((player) => (
                              <tr key={player.uuid || player.name}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <PlayerAvatar name={player.name} uuid={player.uuid} size={24} />
                                    <span>{player.name}</span>
                                  </div>
                                </td>
                                <td style={{ color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={player.reason}>
                                  {player.reason || 'Banned by admin'}
                                </td>
                                <td>
                                  {formatDateTime(player.created)}
                                </td>
                                <td>
                                  <span style={{ color: player.expires?.toLowerCase().includes('forever') ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                                    {player.expires || 'Forever'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    className="btn btn-outline btn-sm btn-premium no-drag"
                                    onClick={() => handleUnban(player.name)}
                                    disabled={!isOnline}
                                  >
                                    <UserCheck size={14} /> Pardon
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Activity History Section */}
        <div className="card">
          <div className="card-content">
            <div className="card-header" style={{ marginBottom: 'var(--space-md)' }}>
              <span className="card-title text-pixel">
                <div className="icon-chip primary"><Clock size={16} /></div>
                Recent Activity
              </span>
            </div>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-lg) 0', color: 'var(--text-tertiary)' }}>
                <Clock size={32} style={{ marginBottom: 12, opacity: 0.3, margin: '0 auto' }} />
                <p>No activity logged yet</p>
              </div>
            ) : (
              <div className="history-events-list">
                {history.slice(0, 50).map((event, idx) => (
                  <div key={idx} className="history-event-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <PlayerAvatar name={event.name} size={24} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="text-pixel" style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>
                          {event.name}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                          {formatTime(event.timestamp)}
                        </span>
                      </div>
                    </div>
                    <span className={`history-badge text-pixel ${event.action}`}>
                      {event.action}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default PlayersPage
