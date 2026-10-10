// All network calls live here. In dev, Vite proxies /api to the backend.
// For a deployed build, set VITE_API_URL (e.g. https://api.example.com).
const BASE = import.meta.env.VITE_API_URL ?? ''

async function request(path, options) {
  let response
  try {
    response = await fetch(`${BASE}${path}`, options)
  } catch {
    const offline = new Error("Can't reach the WasteDNA server. Check that the backend is running, then try again.")
    offline.code = 'network'
    throw offline
  }

  let body = null
  try {
    body = await response.json()
  } catch {
    // non-JSON error body
  }

  if (!response.ok) {
    const error = new Error(body?.message || body?.error || `Something went wrong (error ${response.status}).`)
    error.code = body?.error
    throw error
  }
  return body
}

// Only needed when the server sets ACCESS_CODE. Kept for this tab's session.
const CODE_KEY = 'wastedna-access-code'
export const accessCode = {
  get() {
    try { return sessionStorage.getItem(CODE_KEY) ?? '' } catch { return '' }
  },
  set(value) {
    try { sessionStorage.setItem(CODE_KEY, value) } catch { /* private mode: not remembered */ }
  },
}

export const api = {
  // `log` ({ locationId, week }) saves the scan to the live dashboards.
  analyze(file, log) {
    const form = new FormData()
    if (log) {
      form.append('location_id', String(log.locationId))
      form.append('week', String(log.week))
    }
    form.append('image', file)
    return request('/api/analyze', { method: 'POST', body: form, headers: { 'x-access-code': accessCode.get() } })
  },
  // `mode` is 'demo' (seeded data) or 'live' (scans people have logged).
  leaks: (mode) => request(`/api/dashboard/leaks?source=${mode}`),
  weekly: (mode) => request(`/api/dashboard/weekly?source=${mode}`),
  sources: (mode) => request(`/api/dashboard/sources?source=${mode}`),
  locations: () => request('/api/dashboard/locations'),
  impact: (id, mode) => request(`/api/dashboard/impact/${id}?source=${mode}`),
}
