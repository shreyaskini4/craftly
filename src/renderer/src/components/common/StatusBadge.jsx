function StatusBadge({ status }) {
  const config = {
    online: { label: 'Online', className: 'badge-success' },
    offline: { label: 'Offline', className: 'badge-danger' },
    starting: { label: 'Starting...', className: 'badge-warning' },
    stopping: { label: 'Stopping...', className: 'badge-warning' }
  }

  const { label, className } = config[status] || config.offline
  const isPulsing = status === 'starting' || status === 'stopping'

  return (
    <span className={`badge ${className}`}>
      <span className={`badge-dot ${isPulsing ? 'pulse' : ''}`} />
      {label}
    </span>
  )
}

export default StatusBadge
