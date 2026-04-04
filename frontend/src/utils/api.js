// SELVAM API Client
const defaultProtocol = typeof window !== 'undefined' ? window.location.protocol : 'http:'
const defaultHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
export const API_BASE_URL = import.meta.env.VITE_API_URL || `${defaultProtocol}//${defaultHost}:8000`
const BASE = API_BASE_URL

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || err.message || 'API error')
  }
  return res.json()
}

export const api = {
  searchCompanies: (q) => request(`/companies/search?q=${encodeURIComponent(q)}`),
  getCompany: (ticker) => request(`/companies/${ticker}`),
  getFinancials: (ticker) => request(`/companies/${ticker}/financials`),
  getRatios: (ticker) => request(`/companies/${ticker}/ratios`),
  getNews: (ticker, name = '') => request(`/companies/${ticker}/news?company_name=${encodeURIComponent(name)}`),
  getESG: (ticker) => request(`/companies/${ticker}/esg`),

  runValuation: (body) => request('/valuation/run', { method: 'POST', body: JSON.stringify(body) }),

  analyzeMerger: (body) => request('/merger/analyze', { method: 'POST', body: JSON.stringify(body) }),

  analyzeArticles: (body) => request('/articles/analyze-links', { method: 'POST', body: JSON.stringify(body) }),

  buildESGGraph: (ticker) => request(`/esg/graph/build?ticker=${ticker}`, { method: 'POST' }),
  getESGScores: (ticker) => request(`/esg/${ticker}`),

  draftContract: (body) => request('/contracts/draft', { method: 'POST', body: JSON.stringify(body) }),
}

// Format numbers
export function fmtMoney(n, compact = true) {
  if (!n && n !== 0) return '—'
  if (compact) {
    if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
    if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
    return `$${n.toFixed(0)}`
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export function fmtPct(n) {
  if (n === null || n === undefined) return '—'
  return `${(n * 100).toFixed(1)}%`
}

export function fmtNum(n, decimals = 2) {
  if (n === null || n === undefined) return '—'
  return n.toFixed(decimals)
}

export function fmtMaybeScore(n) {
  if (n === null || n === undefined) return '—'
  return Math.round(n)
}

export function scoreColor(s) {
  if (s >= 70) return 'var(--green)'
  if (s >= 50) return 'var(--gold)'
  return 'var(--red)'
}

export function scoreClass(s) {
  if (s >= 70) return 'score-high'
  if (s >= 50) return 'score-mid'
  return 'score-low'
}

export function scoreLabel(s) {
  if (s >= 80) return 'Excellent'
  if (s >= 70) return 'Strong'
  if (s >= 60) return 'Good'
  if (s >= 50) return 'Fair'
  if (s >= 40) return 'Weak'
  return 'Poor'
}