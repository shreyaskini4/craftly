import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Square, RotateCcw, Trash2, ChevronRight, Terminal as TerminalIcon, CornerDownLeft } from 'lucide-react'
import { toast } from 'sonner'
import useServerStore from '../stores/serverStore'

const COMMAND_SUGGESTIONS = [
  { cmd: 'help', desc: 'View list of available commands', usage: 'help [command]' },
  { cmd: 'op', desc: 'Grant operator status to a player', usage: 'op <player>' },
  { cmd: 'deop', desc: 'Revoke operator status from a player', usage: 'deop <player>' },
  { cmd: 'whitelist', desc: 'Manage server whitelist', usage: 'whitelist <add|remove|list|on|off|reload>' },
  { cmd: 'ban', desc: 'Ban a player from the server', usage: 'ban <player> [reason]' },
  { cmd: 'ban-ip', desc: 'Ban an IP address', usage: 'ban-ip <ip|player> [reason]' },
  { cmd: 'pardon', desc: 'Unban a player', usage: 'pardon <player>' },
  { cmd: 'pardon-ip', desc: 'Unban an IP address', usage: 'pardon-ip <ip>' },
  { cmd: 'kick', desc: 'Kick a player from the server', usage: 'kick <player> [reason]' },
  { cmd: 'gamemode', desc: 'Set player game mode', usage: 'gamemode <survival|creative|adventure|spectator> [player]' },
  { cmd: 'difficulty', desc: 'Set game difficulty', usage: 'difficulty <peaceful|easy|normal|hard>' },
  { cmd: 'weather', desc: 'Set the weather', usage: 'weather <clear|rain|thunder> [duration]' },
  { cmd: 'time', desc: 'Change or query world time', usage: 'time <set|add|query> <value>' },
  { cmd: 'gamerule', desc: 'Set or query a game rule value', usage: 'gamerule <rule> [value]' },
  { cmd: 'tp', desc: 'Teleport players or coordinates', usage: 'tp [target] <destination>' },
  { cmd: 'teleport', desc: 'Teleport players or coordinates', usage: 'teleport [target] <destination>' },
  { cmd: 'give', desc: 'Give an item to a player', usage: 'give <player> <item> [amount]' },
  { cmd: 'say', desc: 'Broadcast a message to all players', usage: 'say <message>' },
  { cmd: 'tell', desc: 'Send a private message to a player', usage: 'tell <player> <message>' },
  { cmd: 'msg', desc: 'Send a private message to a player', usage: 'msg <player> <message>' },
  { cmd: 'list', desc: 'List players currently on the server', usage: 'list [uuids]' },
  { cmd: 'save-all', desc: 'Save server state to disk', usage: 'save-all [flush]' },
  { cmd: 'save-off', desc: 'Disable automatic server saves', usage: 'save-off' },
  { cmd: 'save-on', desc: 'Enable automatic server saves', usage: 'save-on' },
  { cmd: 'stop', desc: 'Gracefully save and stop the server', usage: 'stop' },
  { cmd: 'restart', desc: 'Restart the server process', usage: 'restart' },
  { cmd: 'reload', desc: 'Reload server configuration and datapacks', usage: 'reload' },
  { cmd: 'seed', desc: 'Display the world seed', usage: 'seed' },
  { cmd: 'tps', desc: 'Display server TPS performance', usage: 'tps' },
  { cmd: 'version', desc: 'Check server software version', usage: 'version' }
]

function ConsolePage() {
  const { status, consoleLines } = useServerStore()
  const [command, setCommand] = useState('')
  const [commandHistory, setCommandHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [suggestions, setSuggestions] = useState([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const consoleEndRef = useRef(null)
  const consoleContainerRef = useRef(null)
  const inputRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && consoleContainerRef.current) {
      const el = consoleContainerRef.current
      el.scrollTop = el.scrollHeight
    }
  }, [consoleLines, autoScroll])

  // Compute suggestions based on input
  useEffect(() => {
    const raw = command.trimStart()
    if (!raw) {
      setSuggestions([])
      setShowSuggestions(false)
      setSelectedSuggestionIndex(0)
      return
    }

    const clean = raw.startsWith('/') ? raw.slice(1) : raw
    const parts = clean.split(' ')
    const firstWord = parts[0].toLowerCase()

    // Only show command suggestions while typing the first command token
    if (parts.length === 1 && firstWord.length > 0) {
      const matches = COMMAND_SUGGESTIONS.filter(item =>
        item.cmd.toLowerCase().startsWith(firstWord)
      )
      setSuggestions(matches)
      setShowSuggestions(matches.length > 0)
      setSelectedSuggestionIndex(0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
      setSelectedSuggestionIndex(0)
    }
  }, [command])

  const handleScroll = useCallback(() => {
    const el = consoleContainerRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  const handleSendCommand = async (textToSend) => {
    const cmd = (textToSend || command).trim()
    if (!cmd) return
    try {
      await window.api.server.sendCommand(cmd)
      setCommandHistory(prev => [cmd, ...prev.slice(0, 99)])
      setCommand('')
      setHistoryIndex(-1)
      setShowSuggestions(false)
      setAutoScroll(true)
    } catch (err) {
      toast.error(err.message || 'Failed to send command')
    }
  }

  const applySuggestion = (suggestion) => {
    if (!suggestion) return
    const isSlash = command.trimStart().startsWith('/')
    const nextVal = (isSlash ? '/' : '') + suggestion.cmd + ' '
    setCommand(nextVal)
    setShowSuggestions(false)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSuggestionIndex(prev => (prev + 1) % suggestions.length)
        return
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
        return
      } else if (e.key === 'Tab') {
        e.preventDefault()
        const selected = suggestions[selectedSuggestionIndex] || suggestions[0]
        applySuggestion(selected)
        return
      } else if (e.key === 'Enter') {
        // If exact match or Enter pressed, decide whether to complete or send
        const currentTrimmed = command.trim().replace(/^\//, '').toLowerCase()
        const selected = suggestions[selectedSuggestionIndex]
        if (selected && selected.cmd.toLowerCase() === currentTrimmed) {
          // Exact match -> send command
          handleSendCommand()
        } else if (selected) {
          e.preventDefault()
          applySuggestion(selected)
          return
        } else {
          handleSendCommand()
        }
        return
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowSuggestions(false)
        return
      }
    }

    // Default History navigation when suggestions are not open
    if (e.key === 'Enter') {
      handleSendCommand()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1
        setHistoryIndex(newIndex)
        setCommand(commandHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setCommand(commandHistory[newIndex])
      } else {
        setHistoryIndex(-1)
        setCommand('')
      }
    }
  }

  const handleStart = async () => {
    try {
      await window.api.server.start()
      toast.success('Server starting...')
    } catch (err) { toast.error(err.message) }
  }

  const handleStop = async () => {
    try {
      await window.api.server.stop()
      toast.success('Server stopping...')
    } catch (err) { toast.error(err.message) }
  }

  const handleRestart = async () => {
    try {
      await window.api.server.restart()
      toast.success('Server restarting...')
    } catch (err) { toast.error(err.message) }
  }

  const clearConsole = useServerStore(state => state.clearConsole)

  const getLineClass = (line) => {
    if (!line) return ''
    const text = line.text || ''
    const upper = text.toUpperCase()
    const classes = []

    if (line.type === 'stderr') {
      classes.push('type-stderr')
    } else if (line.type === 'stdout') {
      classes.push('type-stdout')
    }

    if (upper.includes('ERROR') || upper.includes('SEVERE') || upper.includes('FATAL') || line.type === 'stderr') {
      classes.push('error')
    } else if (upper.includes('WARN')) {
      classes.push('warn')
    } else if (upper.includes('INFO')) {
      classes.push('info')
    }

    return classes.join(' ')
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour12: false })
  }

  const isOnline = status === 'online'
  const isOffline = status === 'offline'

  return (
    <div className="slide-up" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Console</h1>
          <p className="page-subtitle">Server log output and command input</p>
        </div>
        <div className="flex gap-sm">
          {isOffline ? (
            <button className="btn btn-success btn-sm btn-premium glow-success no-drag" onClick={handleStart}>
              <Play size={14} /> Start
            </button>
          ) : (
            <>
              <button className="btn btn-danger btn-sm btn-premium glow-danger no-drag" onClick={handleStop} disabled={!isOnline}>
                <Square size={14} /> Stop
              </button>
              <button className="btn btn-outline btn-sm btn-premium no-drag" onClick={handleRestart} disabled={!isOnline}>
                <RotateCcw size={14} /> Restart
              </button>
            </>
          )}
          <button className="btn btn-ghost btn-sm btn-premium no-drag" onClick={clearConsole}>
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      <div className="console-container" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="console-output" ref={consoleContainerRef} onScroll={handleScroll} style={{ flex: 1 }}>
          {consoleLines.length === 0 ? (
            <div className="empty-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-tertiary)' }}>No console output yet. Start the server to see logs.</p>
            </div>
          ) : (
            consoleLines.map(line => (
              <div key={line.id} className={`console-line ${getLineClass(line)}`}>
                <span className="timestamp">[{formatTime(line.timestamp)}]</span>
                <span className="text">{line.text}</span>
              </div>
            ))
          )}
          <div ref={consoleEndRef} />
        </div>

        {/* Input bar with floating autocomplete dropdown */}
        <div style={{ position: 'relative', width: '100%' }}>
          {showSuggestions && suggestions.length > 0 && isOnline && (
            <div role="listbox" aria-label="Command suggestions" id="console-autocomplete-list" style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-accent)',
              borderRadius: '10px',
              maxHeight: '220px',
              overflowY: 'auto',
              zIndex: 100,
              boxShadow: 'var(--shadow-lg), 0 0 16px var(--color-primary-subtle)',
              backdropFilter: 'var(--blur-md)',
              padding: '6px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px 6px',
                borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))',
                marginBottom: '4px',
                fontSize: '11px',
                color: 'var(--text-tertiary, #64748b)'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <TerminalIcon size={12} style={{ color: 'var(--accent, #a855f7)' }} />
                  Command Suggestions
                </span>
                <span style={{ fontSize: '10px', background: 'var(--border-subtle)', padding: '2px 6px', borderRadius: '4px' }}>
                  Tab or Enter to select
                </span>
              </div>

              {suggestions.map((item, idx) => {
                const isSelected = idx === selectedSuggestionIndex
                return (
                  <div
                    key={item.cmd}
                    role="option"
                    id={`suggestion-${item.cmd}`}
                    aria-selected={isSelected}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--color-primary-subtle)' : 'transparent',
                      border: isSelected ? '1px solid var(--border-accent)' : '1px solid transparent',
                      transition: 'all var(--transition-fast)',
                      gap: '12px'
                    }}
                    onMouseEnter={() => setSelectedSuggestionIndex(idx)}
                    onClick={() => applySuggestion(item)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <span style={{
                        fontFamily: 'var(--font-mono, monospace)',
                        fontWeight: 600,
                        fontSize: '13px',
                        color: isSelected ? 'var(--accent, #c084fc)' : 'var(--text-primary, #ffffff)'
                      }}>
                        {item.cmd}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary, #94a3b8)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.desc}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <code style={{
                        fontSize: '11px',
                        color: 'var(--text-tertiary, #64748b)',
                        background: 'rgba(0, 0, 0, 0.25)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        {item.usage}
                      </code>
                      {isSelected && (
                        <span style={{
                          fontSize: '10px',
                          color: 'var(--accent, #c084fc)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontWeight: 500
                        }}>
                          Tab <CornerDownLeft size={10} />
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="console-input">
            <ChevronRight size={16} style={{ color: 'var(--color-primary)', flexShrink: 0, marginRight: 8 }} />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showSuggestions && suggestions.length > 0}
              aria-controls="console-autocomplete-list"
              aria-activedescendant={showSuggestions && suggestions.length > 0 ? `suggestion-${suggestions[selectedSuggestionIndex]?.cmd}` : undefined}
              placeholder={isOnline ? 'Type a command (e.g. op, whitelist, gamemode) and press Enter...' : 'Server is offline'}
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true)
              }}
              disabled={!isOnline}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConsolePage

