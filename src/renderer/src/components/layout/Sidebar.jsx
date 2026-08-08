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

function getStatusClass(status) {
  if (status === 'starting' || status === 'stopping') return 'transitional'
  if (status === 'crashed') return 'crashed'
  return status
}

function getStatusLabel(status) {
  switch (status) {
    case 'online': return 'Online'
    case 'starting': return 'Starting'
    case 'stopping': return 'Stopping'
    case 'crashed': return 'Crashed'
    default: return 'Offline'
  }
}

function Sidebar({ activePage, onNavigate }) {
  const status = useServerStore(state => state.status)
  const isOnline = status === 'online'
  const isTransitional = status === 'starting' || status === 'stopping'
  const isCrashed = status === 'crashed'
  const statusClass = getStatusClass(status)

  return (
    <aside className="sidebar" role="navigation" aria-label="Main navigation">
      <div className="sidebar-header">
        <div className="titlebar-drag" />
        <div className="sidebar-brand">
          <h1 className="sidebar-title brand-text">Craftly</h1>
          <span className="sidebar-version text-pixel">v1.0.0</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Page navigation">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = activePage === item.id
          return (
            <button
              key={item.id}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Navigate to ${item.label}`}
            >
              <Icon className="icon" />
              <span className="label text-pixel">{item.label}</span>
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
      </nav>

      <div className={`sidebar-status ${statusClass}`} role="status" aria-live="polite" aria-label={`Server status: ${getStatusLabel(status)}`}>
        <div className={`status-dot ${isOnline ? 'online' : ''} ${isTransitional ? 'transitional' : ''} ${isCrashed ? 'crashed' : ''}`} />
        <div className="status-text">
          <span className="status-label text-pixel">Server Status</span>
          <span className={`status-value text-pixel ${statusClass}`}>
            {getStatusLabel(status)}
          </span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar

