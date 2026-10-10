import { useCallback, useEffect, useState } from 'react'
import Analyze from './pages/Analyze'
import FindLeaks from './pages/FindLeaks'
import TrackImpact from './pages/TrackImpact'
import { Logo, ScanIcon, LeakIcon, TrendIcon, SunIcon, MoonIcon } from './components/ui'
import { useLang, useRoute, useTheme } from './lib/hooks'
import { LangContext, T } from './lib/i18n'

const TABS = [
  { id: 'scan', Icon: ScanIcon },
  { id: 'leaks', Icon: LeakIcon },
  { id: 'progress', Icon: TrendIcon },
]

export default function App() {
  const route = useRoute()
  const [theme, toggleTheme] = useTheme()
  const [lang, toggleLang] = useLang()
  // Dashboards read seeded demo data or real logged scans. `liveVersion` bumps
  // whenever a scan is logged so the dashboards reload instead of showing stale data.
  const [mode, setMode] = useState('demo')
  const [liveVersion, setLiveVersion] = useState(0)

  const t = T[lang]

  const onLogged = useCallback(() => setLiveVersion((v) => v + 1), [])
  const viewLive = useCallback(() => {
    setMode('live')
    window.location.hash = '#/leaks'
  }, [])

  useEffect(() => {
    document.title = `${t.nav[route]} · WasteDNA`
  }, [route, t])

  return (
    <LangContext.Provider value={lang}>
      <a className="skip" href="#main">{t.nav.skip}</a>

      <header className="topbar">
        <a className="brand" href="#/scan" aria-label={t.nav.home}>
          <Logo />
          <span>WasteDNA</span>
        </a>

        <nav className="tabs" aria-label={t.nav.main}>
          {TABS.map(({ id, Icon }) => (
            <a key={id} href={`#/${id}`} aria-current={route === id ? 'page' : undefined}>
              <Icon size={18} />
              <span>{t.nav[id]}</span>
            </a>
          ))}
        </nav>

        <button className="lang-btn" onClick={toggleLang} lang={lang === 'en' ? 'hi' : 'en'}
          aria-label={lang === 'en' ? 'हिन्दी में दिखाएँ' : 'Show in English'}>
          {lang === 'en' ? 'हिन्दी' : 'EN'}
        </button>

        <button className="icon-btn" onClick={toggleTheme}
          aria-label={theme === 'dark' ? t.themeToLight : t.themeToDark}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      {/* Every page stays mounted so a scan result survives a trip to another tab. */}
      <main id="main">
        <div hidden={route !== 'scan'}><Analyze lang={lang} onLogged={onLogged} onViewLive={viewLive} /></div>
        <div hidden={route !== 'leaks'}><FindLeaks mode={mode} onMode={setMode} version={liveVersion} /></div>
        <div hidden={route !== 'progress'}><TrackImpact mode={mode} onMode={setMode} version={liveVersion} /></div>
      </main>

      <footer className="foot">
        <p>{t.foot}</p>
        <p className="foot-meta">{t.footTracks}</p>
        <p className="foot-meta">{t.footTools}</p>
      </footer>
    </LangContext.Provider>
  )
}
