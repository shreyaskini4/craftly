import React from 'react'
import { AlertTriangle, RotateCcw, Home, FileText, ChevronDown, ChevronUp } from 'lucide-react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      loggedReport: null
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary caught an unhandled render error:', error, errorInfo)

    // Save UI crash report to crash-reports folder for logs inspection
    if (window.api && window.api.logs && window.api.logs.logUiError) {
      window.api.logs.logUiError({
        message: error?.message || String(error),
        stack: error?.stack || '',
        componentStack: errorInfo?.componentStack || ''
      }).then(reportFile => {
        if (reportFile) {
          this.setState({ loggedReport: reportFile })
        }
      }).catch(err => {
        console.error('Failed to log UI error via IPC:', err)
      })
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      loggedReport: null
    })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }))
  }

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails, loggedReport } = this.state

      return (
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          animation: 'fadeIn 0.3s ease-out',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'var(--bg-elevated, #16161a)',
            border: '1px solid var(--color-danger-glow)',
            boxShadow: 'var(--shadow-lg), 0 0 20px var(--color-danger-subtle)',
            borderRadius: '16px',
            maxWidth: '640px',
            width: '100%',
            padding: '36px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--color-danger-subtle)',
              border: '1px solid var(--color-danger-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-danger)'
            }}>
              <AlertTriangle size={32} />
            </div>

            <div>
              <h2 style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary, #ffffff)',
                marginBottom: '8px',
                letterSpacing: '-0.02em'
              }}>
                Something went wrong
              </h2>
              <p style={{
                fontSize: '14px',
                color: 'var(--text-secondary, #94a3b8)',
                lineHeight: 1.5,
                margin: 0
              }}>
                An unexpected error occurred while rendering this view. The rest of Craftly and your server are still operating normally.
              </p>
            </div>

            {error && (
              <div style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '13px',
                color: 'var(--color-danger-hover)',
                fontFamily: 'var(--font-mono, monospace)',
                wordBreak: 'break-word',
                textAlign: 'left'
              }}>
                {error.toString()}
              </div>
            )}

            {loggedReport && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: 'var(--text-tertiary, #64748b)'
              }}>
                <FileText size={14} />
                <span>Saved crash report to: <code style={{ color: 'var(--accent, #a855f7)' }}>{loggedReport}</code></span>
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              width: '100%'
            }}>
              <button
                className="btn btn-primary btn-premium"
                onClick={this.handleReset}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <RotateCcw size={16} />
                <span>Reload View</span>
              </button>

              <button
                className="btn btn-outline btn-premium"
                onClick={this.handleReset}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Home size={16} />
                <span>Go to Dashboard</span>
              </button>

              {(error?.stack || errorInfo?.componentStack) && (
                <button
                  className="btn btn-ghost btn-premium"
                  onClick={this.toggleDetails}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                >
                  {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{showDetails ? 'Hide Stack' : 'View Stack Trace'}</span>
                </button>
              )}
            </div>

            {showDetails && (
              <div style={{
                width: '100%',
                maxHeight: '220px',
                overflowY: 'auto',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '14px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--text-secondary)',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.4
              }}>
                {error?.stack}
                {errorInfo?.componentStack}
              </div>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
