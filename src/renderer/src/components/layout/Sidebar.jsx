import { LayoutDashboard, Terminal, Package, Archive, Settings, Sliders, HelpCircle, FolderOpen, Users, FileText } from 'lucide-react'
import { useState, useEffect } from 'react'
import useServerStore from '../../stores/serverStore'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'players', label: 'Players', icon: Users },
  { id: 'console', label: 'Terminal', icon: Terminal },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'mods', label: 'Mods', icon: Package },
  { id: 'backups', label: 'Backups', icon: Archive },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'properties', label: 'Server Properties', icon: Sliders },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'faq', label: 'Help / FAQ', icon: HelpCircle }
]

function Sidebar({ activePage, onNavigate }) {
  const status = useServerStore(state => state.status)
  const isOnline = status === 'online'
  const isTransitional = status === 'starting' || status === 'stopping'
  const isCrashed = status === 'crashed'

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="titlebar-drag" />
        <div className="sidebar-brand">
          <h1 className="sidebar-title brand-text">Craftly</h1>
          <span className="sidebar-version text-pixel">v1.0.0</span>
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
              <span className="label text-pixel">{item.label}</span>
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
      </nav>

      <div className={`sidebar-status ${
        status === 'starting' || status === 'stopping' ? 'transitional' :
        status === 'crashed' ? 'crashed' :
        status
      }`}>
        <div className={`status-dot ${isOnline ? 'online' : ''} ${isTransitional ? 'transitional' : ''} ${isCrashed ? 'crashed' : ''}`} />
        <div className="status-text">
          <span className="status-label text-pixel">Server Status</span>
          <span className={`status-value text-pixel ${
            status === 'starting' || status === 'stopping' ? 'transitional' :
            status === 'crashed' ? 'crashed' :
            status
          }`}>
            {status === 'online' ? 'Online' :
             status === 'starting' ? 'Starting' :
             status === 'stopping' ? 'Stopping' :
             status === 'crashed' ? 'Crashed' : 'Offline'}
          </span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
