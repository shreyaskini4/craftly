import { useState, useEffect } from 'react'
import { Toaster } from 'sonner'
import Sidebar from './components/layout/Sidebar'
import DashboardPage from './pages/DashboardPage'
import ConsolePage from './pages/ConsolePage'
import ModsPage from './pages/ModsPage'
import BackupsPage from './pages/BackupsPage'
import SettingsPage from './pages/SettingsPage'
import WelcomePage from './pages/WelcomePage'
import useServerStore from './stores/serverStore'

function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [settings, setSettings] = useState(null)
  const initListeners = useServerStore(state => state.initListeners)

  useEffect(() => {
    initListeners()
    window.api.settings.get().then(s => {
      setSettings(s)
      if (s.theme === 'light') {
        document.body.classList.add('light-theme')
      } else {
        document.body.classList.remove('light-theme')
      }
    })
  }, [])

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage onNavigate={setActivePage} />
      case 'console': return <ConsolePage />
      case 'mods': return <ModsPage />
      case 'backups': return <BackupsPage />
      case 'settings': return <SettingsPage />
      default: return <DashboardPage onNavigate={setActivePage} />
    }
  }

  if (!settings) {
    return <div className="loading-spinner" style={{ margin: 'auto', marginTop: '45vh' }} />
  }

  if (!settings.onboardingComplete) {
    return (
      <div className="app-layout" style={{ display: 'block' }}>
        <WelcomePage onComplete={() => setSettings(prev => ({ ...prev, onboardingComplete: true }))} />
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main className="main-content">
        {renderPage()}
      </main>
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </div>
  )
}

export default App
