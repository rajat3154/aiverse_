import { useEffect, useState } from 'react'
import Sidebar from './components/shared/Sidebar'
import MainSection from './components/shared/MainSection'
import RightSidebar from './components/shared/RightSidebar'
import SignupPage from './components/auth/SignupPage'
import { ThemeProvider, useTheme } from './context/ThemeContext'

const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

const CopilotIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
  </svg>
)

// Small top bar shown only where a sidebar is hidden: menu button below md, copilot button below xl.
const TopBar = ({ onMenu, onCopilot }) => {
  const theme = useTheme()
  const isLight = theme.mainSectionTheme === 'light'
  const button = `flex items-center justify-center w-9 h-9 rounded-lg border cursor-pointer bg-transparent ${
    isLight ? 'border-[#E5E4E7] text-gray-700' : 'border-[#263241] text-[#B8C4D0]'
  }`
  return (
    <header
      className={`xl:hidden shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-b ${
        isLight ? 'bg-white border-[#E5E4E7]' : 'bg-[#030712] border-[#263241]/60'
      }`}
    >
      <button type="button" aria-label="Open menu" onClick={onMenu} className={`${button} md:hidden`}>
        <MenuIcon />
      </button>
      <div className="flex items-baseline gap-0.5 md:hidden">
        <span className={`font-bold tracking-wider ${isLight ? 'text-gray-900' : 'text-white'}`}>AI</span>
        <span className="font-bold tracking-wider bg-clip-text text-transparent" style={{ backgroundImage: 'var(--accent-paint)' }}>
          VERSE
        </span>
      </div>
      <button type="button" aria-label="Open copilot" onClick={onCopilot} className={`${button} ml-auto text-(--accent-readable)`}>
        <CopilotIcon />
      </button>
    </header>
  )
}

const Layout = () => {
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
        <TopBar onMenu={() => setMenuOpen(true)} onCopilot={() => setCopilotOpen(true)} />
        <MainSection />
      </div>
      <RightSidebar mobileOpen={copilotOpen} onMobileClose={() => setCopilotOpen(false)} />

      {/* Backdrop behind an open drawer (only exists below the breakpoint that hides each sidebar) */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}
      {copilotOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 xl:hidden" onClick={() => setCopilotOpen(false)} aria-hidden="true" />
      )}
    </div>
  )
}

// No router yet: /signup renders the signup page, everything else the app shell.
const App = () => (
  <ThemeProvider>
    {window.location.pathname === '/signup' ? <SignupPage /> : <Layout />}
  </ThemeProvider>
)

export default App
