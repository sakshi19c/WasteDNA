import { useEffect, useState } from 'react'

// Runs an async loader whenever `deps` change. `loading` is derived (not set
// inside the effect), so switching inputs shows a fresh loading state cleanly.
export function useAsync(loader, deps) {
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState({ key: null, data: null, error: null })
  const key = `${JSON.stringify(deps)}#${retry}`

  useEffect(() => {
    let live = true
    loader()
      .then((data) => live && setState({ key, data, error: null }))
      .catch((error) => live && setState({ key, data: null, error }))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const ready = state.key === key
  return {
    loading: !ready,
    data: ready ? state.data : null,
    error: ready ? state.error : null,
    retry: () => setRetry((n) => n + 1),
  }
}

const ROUTES = ['scan', 'leaks', 'progress']
const readRoute = () => {
  const hash = window.location.hash.replace(/^#\/?/, '')
  return ROUTES.includes(hash) ? hash : 'scan'
}

export function useRoute() {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const onChange = () => setRoute(readRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'light',
  )
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('wastedna-theme', theme)
    } catch {
      // storage unavailable (private mode): the theme still works for this visit
    }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

export function useLang() {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('wastedna-lang') === 'hi' ? 'hi' : 'en'
    } catch {
      return 'en'
    }
  })
  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem('wastedna-lang', lang)
    } catch {
      // storage unavailable: the choice still holds for this visit
    }
  }, [lang])
  return [lang, () => setLang((l) => (l === 'en' ? 'hi' : 'en'))]
}
