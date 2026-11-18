import { useEffect, useState } from 'react'
import Sidebar from './components/shared/Sidebar'
import MainSection from './components/shared/MainSection'
import RightSidebar from './components/shared/RightSidebar'
import LoginPage from './components/auth/LoginPage'
import OAuthCallbackPage from './components/auth/OAuthCallbackPage'
import SignupPage from './components/auth/SignupPage'
import MasterDashboard from './components/master/MasterDashboard'
import CredentialsPage from './components/credentials/CredentialsPage'
import LlmProvidersPage from './components/llmproviders/LlmProvidersPage'
import IntegrationsPage from './components/integrations/IntegrationsPage'
import { getSession, isAuthenticated } from './services/authService'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import ConfirmProvider from './components/shared/ConfirmProvider'

const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

// Small top bar shown only where a sidebar is hidden: menu button below md, copilot button below xl.
const TopBar = ({ onMenu }) => {
  const theme = useTheme()
  const isLight = theme.mainSectionTheme === 'light'
  const button = `flex items-center justify-center w-9 h-9 rounded-lg border cursor-pointer bg-transparent ${
    isLight ? 'border-[#E5E4E7] text-gray-700' : 'border-[#263241] text-[#B8C4D0]'
  }`
  return (
    <header
      className={`md:hidden shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b ${
        isLight ? 'bg-white border-[#E5E4E7]' : 'bg-black border-[#263241]/60'
      }`}
    >
      <button type="button" aria-label="Open menu" onClick={onMenu} className={button}>
        <MenuIcon />
      </button>
      <div className="flex items-baseline gap-0.5">
        <span className={`font-bold tracking-wider ${isLight ? 'text-gray-900' : 'text-white'}`}>AI</span>
        <span className="font-bold tracking-wider bg-clip-text text-transparent" style={{ backgroundImage: 'var(--accent-paint)' }}>
          VERSE
        </span>
      </div>
    </header>
  )
}

const Layout = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setCopilotOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-dvh w-full bg-black overflow-hidden">
      <Sidebar mobileOpen={menuOpen} onMobileClose={() => setMenuOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <TopBar onMenu={() => setMenuOpen(true)} />
        {children ?? <MainSection />}
      </div>
      <RightSidebar open={copilotOpen} onClose={() => setCopilotOpen(false)} />

      {/* Floating chatbot button: opens and closes the copilot panel */}
      <button
        type="button"
        aria-label={copilotOpen ? "Close copilot" : "Open copilot"}
        aria-expanded={copilotOpen}
        onClick={() => setCopilotOpen((v) => !v)}
        className={`fixed right-5 bottom-5 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-0 text-black shadow-xl transition hover:scale-105 ${
          copilotOpen ? "pointer-events-none scale-75 opacity-0" : ""
        }`}
        style={{ backgroundImage: "var(--accent-paint)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          <path d="M9 9h.01M13 9h.01M17 9h.01" />
        </svg>
      </button>

      {/* Backdrop behind an open drawer (only exists below the breakpoint that hides each sidebar) */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}
      {copilotOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setCopilotOpen(false)} aria-hidden="true" />
      )}
    </div>
  )
}

// No router yet: /login and /signup render the auth pages, everything else the app shell (which needs a session).
const App = () => {
  const path = window.location.pathname
  const signedIn = isAuthenticated()

  // The OAuth callback must always render: it is where the session is created.
  if (path === '/oauth2/success') {
    return (
      <ThemeProvider>
        <OAuthCallbackPage />
      </ThemeProvider>
    )
  }
  // The role here only decides which screen to show; the gateway enforces MASTER on every /users request.
  const isMaster = getSession()?.user?.role === 'MASTER'
  const home = isMaster ? '/master' : '/'
  if (signedIn && (path === '/login' || path === '/signup')) {
    window.location.replace(home)
    return null
  }
  if (!signedIn && path !== '/login' && path !== '/signup') {
    window.location.replace('/login')
    return null
  }

  // The master account has no credentials page; it goes back to its dashboard.
  if (signedIn && isMaster && (path.startsWith('/credentials'))) {
    window.location.replace(home)
    return null
  }

  // The master dashboard is only for the master account.
  if (signedIn && path.startsWith('/master') && !isMaster) {
    window.location.replace(home)
    return null
  }

  return (
    <ThemeProvider>
      <ConfirmProvider>
      {path === '/master' ? <Layout><MasterDashboard /></Layout> : path === '/credentials' ? <Layout><CredentialsPage /></Layout> : path === '/llm-providers' ? <Layout><LlmProvidersPage /></Layout> : path === '/integrations' ? <Layout><IntegrationsPage /></Layout> : path === '/login' ? <LoginPage /> : path === '/signup' ? <SignupPage /> : <Layout />}
      </ConfirmProvider>
    </ThemeProvider>
  )
}

export default App
