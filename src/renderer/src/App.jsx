import { useState, useEffect } from 'react'
import { Toaster } from 'sonner'
import Sidebar from './components/layout/Sidebar'
import DashboardPage from './pages/DashboardPage'
import ConsolePage from './pages/ConsolePage'
import ModsPage from './pages/ModsPage'
import BackupsPage from './pages/BackupsPage'
import SettingsPage from './pages/SettingsPage'
import useServerStore from './stores/serverStore'

function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const initListeners = useServerStore(state => state.initListeners)

  useEffect(() => {
    initListeners()
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
