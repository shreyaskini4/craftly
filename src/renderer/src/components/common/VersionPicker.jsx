import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Check } from 'lucide-react'

function VersionPicker({ 
  items, 
  value, 
  onChange, 
  placeholder = "Select a version...",
  disabled = false,
  width = '100%',
  showFilters = true
}) {
  const [search, setSearch] = useState('')
  const [showReleases, setShowReleases] = useState(true)
  const [showSnapshots, setShowSnapshots] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const pickerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const normalizedItems = useMemo(() => {
    if (!items) return []
    return items.map(item => {
      if (typeof item === 'string' || typeof item === 'number') {
        return { id: String(item), type: 'release' }
      }
      return {
        ...item,
        id: String(item.id || item.version || item),
        type: item.type || 'release'
      }
    })
  }, [items])

  const filteredItems = useMemo(() => {
    let result = normalizedItems.filter(item => {
      const isRelease = item.type === 'release' || item.stable === true
      const isSnapshot = item.type === 'snapshot' || item.stable === false
      const isOld = item.type === 'old_beta' || item.type === 'old_alpha'
      
      if (!isSnapshot && !isOld) {
        if (!showReleases) return false
      } else if (isSnapshot) {
        if (!showSnapshots) return false
      } else if (isOld) {
        if (!showOld) return false
      }
      
      if (search) {
        return item.id.toLowerCase().includes(search.toLowerCase())
      }
      return true
    })
    return result
  }, [normalizedItems, showReleases, showSnapshots, showOld, search])

  const latestRelease = useMemo(() => {
    return normalizedItems.find(i => i.type === 'release' || i.stable === true)
  }, [normalizedItems])
  
  const latestSnapshot = useMemo(() => {
    return normalizedItems.find(i => i.type === 'snapshot' || i.stable === false)
  }, [normalizedItems])

  const pinnedItems = []
  if (latestRelease && !search && showReleases) pinnedItems.push({ ...latestRelease, isPinned: true, pinLabel: 'Latest Release' })
  if (latestSnapshot && !search && showSnapshots) pinnedItems.push({ ...latestSnapshot, isPinned: true, pinLabel: 'Latest Snapshot' })

  // Determine if we actually have snapshots/old versions to even show the checkboxes for
  const hasSnapshots = normalizedItems.some(i => i.type === 'snapshot' || i.stable === false)
  const hasOld = normalizedItems.some(i => i.type === 'old_beta' || i.type === 'old_alpha')

  return (
    <div className="version-picker" ref={pickerRef} style={{ position: 'relative', width }}>
      <button 
        className="select flex justify-between items-center w-full"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        type="button"
        style={{ opacity: disabled ? 0.5 : 1, textAlign: 'left', minHeight: 38 }}
      >
        <span className="truncate">{value || placeholder}</span>
        <span style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: 8 }}>▼</span>
      </button>

      {isOpen && (
        <div 
          className="version-picker-dropdown slide-up"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 400,
            minWidth: 250
          }}
        >
          <div style={{ padding: 'var(--space-md)', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <div className="search-bar" style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input 
                type="text" 
                className="input w-full" 
                style={{ paddingLeft: 32 }}
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            
            {showFilters && (hasSnapshots || hasOld) && (
              <div className="filters flex gap-md flex-wrap" style={{ fontSize: 12, marginTop: 4 }}>
                <label className="flex items-center gap-xs cursor-pointer">
                  <input type="checkbox" checked={showReleases} onChange={e => setShowReleases(e.target.checked)} />
                  Releases
                </label>
                {hasSnapshots && (
                  <label className="flex items-center gap-xs cursor-pointer">
                    <input type="checkbox" checked={showSnapshots} onChange={e => setShowSnapshots(e.target.checked)} />
                    Snapshots
                  </label>
                )}
                {hasOld && (
                  <label className="flex items-center gap-xs cursor-pointer">
                    <input type="checkbox" checked={showOld} onChange={e => setShowOld(e.target.checked)} />
                    Old (Alpha/Beta)
                  </label>
                )}
              </div>
            )}
          </div>

          <div className="version-list custom-scrollbar" style={{ overflowY: 'auto', flex: 1, padding: 'var(--space-xs) 0' }}>
            {pinnedItems.length > 0 && (
              <>
                <div style={{ padding: '4px 12px', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Pinned</div>
                {pinnedItems.map(item => (
                  <button
                    key={'pin-' + item.id}
                    className="w-full text-left flex justify-between items-center"
                    style={{
                      padding: '8px 12px',
                      background: value === item.id ? 'var(--bg-tertiary)' : 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = value === item.id ? 'var(--bg-tertiary)' : 'transparent'}
                    onClick={() => {
                      onChange(item.id)
                      setIsOpen(false)
                    }}
                  >
                    <span>{item.id} <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 4 }}>({item.pinLabel})</span></span>
                    {value === item.id && <Check size={14} color="var(--accent)" />}
                  </button>
                ))}
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              </>
            )}

            {filteredItems.length === 0 ? (
              <div style={{ padding: 'var(--space-md)', textAlign: 'center', color: 'var(--text-secondary)' }}>No versions found</div>
            ) : (
              filteredItems.map(item => (
                <button
                  key={item.id}
                  className="w-full text-left flex justify-between items-center"
                  style={{
                    padding: '8px 12px',
                    background: value === item.id ? 'var(--bg-tertiary)' : 'transparent',
                    border: 'none',
                    color: (item.type === 'release' || item.stable === true) ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = value === item.id ? 'var(--bg-tertiary)' : 'transparent'}
                  onClick={() => {
                    onChange(item.id)
                    setIsOpen(false)
                  }}
                >
                  <span>
                    {item.id} 
                    {(item.type !== 'release' && item.type) && <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 4, textTransform: 'capitalize' }}>({item.type.replace('_', ' ')})</span>}
                  </span>
                  {value === item.id && <Check size={14} color="var(--accent)" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default VersionPicker
