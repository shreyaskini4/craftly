import { LayoutDashboard, Terminal, Package, Archive, Settings, Sun, Moon } from 'lucide-react'
import { useState, useEffect } from 'react'
import useServerStore from '../../stores/serverStore'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'console', label: 'Console', icon: Terminal },
  { id: 'mods', label: 'Mods', icon: Package },
  { id: 'backups', label: 'Backups', icon: Archive },
  { id: 'settings', label: 'Settings', icon: Settings }
]

function Sidebar({ activePage, onNavigate }) {
  const status = useServerStore(state => state.status)
  const isOnline = status === 'online'
  const isTransitional = status === 'starting' || status === 'stopping'
  
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    window.api.settings.get().then(s => {
      setTheme(s.theme || 'dark')
    })
  }, [])

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    await window.api.settings.update({ theme: newTheme })
    if (newTheme === 'light') {
      document.body.classList.add('light-theme')
    } else {
      document.body.classList.remove('light-theme')
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="titlebar-drag" />
        <div className="sidebar-brand">
          <span className="sidebar-logo">⛏</span>
          <div>
            <h1 className="sidebar-title">Craftly</h1>
            <span className="sidebar-version">v1.0.0</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`sidebar-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={20} className="icon" />
              <span className="label">{item.label}</span>
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <button className="sidebar-item" onClick={toggleTheme} style={{ marginTop: 'auto', justifyContent: 'center' }}>
          {theme === 'dark' ? <Sun size={20} className="icon" /> : <Moon size={20} className="icon" />}
          <span className="label">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </nav>

      <div className="sidebar-status">
        <div className={`status-dot ${isOnline ? 'online' : ''} ${isTransitional ? 'transitional' : ''}`} />
        <div className="status-text">
          <span className="status-label">Server Status</span>
          <span className={`status-value ${status}`}>
            {status === 'online' ? 'Online' :
             status === 'starting' ? 'Starting...' :
             status === 'stopping' ? 'Stopping...' : 'Offline'}
          </span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
