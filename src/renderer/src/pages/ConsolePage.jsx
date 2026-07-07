import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Square, RotateCcw, Trash2, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import useServerStore from '../stores/serverStore'

function ConsolePage() {
  const { status, consoleLines } = useServerStore()
  const [command, setCommand] = useState('')
  const [commandHistory, setCommandHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const consoleEndRef = useRef(null)
  const consoleContainerRef = useRef(null)
  const inputRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [consoleLines, autoScroll])

  const handleScroll = useCallback(() => {
    const el = consoleContainerRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  const handleSendCommand = async () => {
    const cmd = command.trim()
    if (!cmd) return
    try {
      await window.api.server.sendCommand(cmd)
      setCommandHistory(prev => [cmd, ...prev.slice(0, 99)])
      setCommand('')
      setHistoryIndex(-1)
    } catch (err) {
      toast.error(err.message || 'Failed to send command')
    }
  }

  const handleKeyDown = (e) => {
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

  const getLineClass = (text) => {
    if (!text) return ''
    const upper = text.toUpperCase()
    if (upper.includes('ERROR') || upper.includes('SEVERE') || upper.includes('FATAL')) return 'error'
    if (upper.includes('WARN')) return 'warn'
    if (upper.includes('INFO')) return 'info'
    return ''
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
            <button className="btn btn-success btn-sm btn-premium glow-success" onClick={handleStart}>
              <Play size={14} /> Start
            </button>
          ) : (
            <>
              <button className="btn btn-danger btn-sm btn-premium glow-danger" onClick={handleStop} disabled={!isOnline}>
                <Square size={14} /> Stop
              </button>
              <button className="btn btn-outline btn-sm btn-premium" onClick={handleRestart} disabled={!isOnline}>
                <RotateCcw size={14} /> Restart
              </button>
            </>
          )}
          <button className="btn btn-ghost btn-sm btn-premium" onClick={clearConsole}>
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      <div className="console-container glass-card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'rgba(13, 17, 23, 0.45)' }}>
        <div className="console-output" ref={consoleContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto' }}>
          {consoleLines.length === 0 ? (
            <div className="empty-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-tertiary)' }}>No console output yet. Start the server to see logs.</p>
            </div>
          ) : (
            consoleLines.map(line => (
              <div key={line.id} className={`console-line ${getLineClass(line.text)}`} style={{ padding: '4px 0' }}>
                <span className="timestamp" style={{ opacity: 0.8 }}>[{formatTime(line.timestamp)}]</span>
                <span className="text">{line.text}</span>
              </div>
            ))
          )}
          <div ref={consoleEndRef} />
        </div>

        <div className="console-input" style={{ background: 'rgba(22, 27, 34, 0.8)', borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
          <ChevronRight size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginRight: 8 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder={isOnline ? 'Type a command and press Enter...' : 'Server is offline'}
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isOnline}
            style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </div>
    </div>
  )
}

export default ConsolePage
