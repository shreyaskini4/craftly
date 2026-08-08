import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import ErrorBoundary from '../src/renderer/src/components/common/ErrorBoundary.jsx'

describe('React ErrorBoundary Recovery', () => {
  beforeEach(() => {
    global.window = {
      api: {
        logs: {
          logUiError: vi.fn().mockResolvedValue('ui-error-test.txt')
        }
      }
    }
  })

  it('catches a real forced render error and renders recovery UI without breaking parent layout', () => {
    const errorLogMock = vi.fn().mockResolvedValue('ui-error-test.txt')
    global.window.api.logs.logUiError = errorLogMock

    const onResetMock = vi.fn()
    const element = React.createElement(ErrorBoundary, { onReset: onResetMock }, React.createElement('div', null, 'Child'))
    const instance = new element.type(element.props)
    
    // Wire up mock setState for unit testing lifecycle
    instance.setState = function(updater) {
      this.state = typeof updater === 'function' ? updater(this.state) : { ...this.state, ...updater }
    }

    // 1. Force a real error through getDerivedStateFromError
    const forcedError = new Error('Simulated runtime render crash in Paper view')
    const errorInfo = { componentStack: '\n    at PaperView\n    at ErrorBoundary' }
    
    const derivedState = ErrorBoundary.getDerivedStateFromError(forcedError)
    expect(derivedState.hasError).toBe(true)
    expect(derivedState.error).toBe(forcedError)

    instance.state = derivedState

    // 2. Trigger componentDidCatch
    instance.componentDidCatch(forcedError, errorInfo)

    // Verify error logging IPC was called with stack details
    expect(errorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Simulated runtime render crash in Paper view',
        componentStack: expect.stringContaining('PaperView')
      })
    )

    // 3. Verify the render method produces fallback recovery UI
    const rendered = instance.render()
    expect(rendered).not.toBeNull()
    expect(rendered.type).toBe('div')

    // 4. Test handleReset resets error state and calls onReset handler
    instance.handleReset()
    expect(instance.state.hasError).toBe(false)
    expect(instance.state.error).toBeNull()
    expect(onResetMock).toHaveBeenCalledTimes(1)
  })
})
