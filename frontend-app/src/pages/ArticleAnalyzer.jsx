import { useState } from 'react'
import { Newspaper, Plus, Trash2, ArrowRight } from 'lucide-react'
import { api } from '../utils/api'
import { Loading } from '../components/UIComponents'

export default function ArticleAnalyzer({ globalTickers }) {
  const [tickerX, setTickerX] = useState(globalTickers.x || '')
  const [tickerY, setTickerY] = useState(globalTickers.y || '')
  const [urls, setUrls] = useState(['', '', ''])
  const [baseline, setBaseline] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleAnalyze() {
    const validUrls = urls.filter(u => u.trim().startsWith('http'))
    if (!validUrls.length || !tickerX) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.analyzeArticles({
        urls: validUrls,
        company_x_ticker: tickerX,
        company_y_ticker: tickerY || undefined,
        baseline_merger_score: baseline ? parseFloat(baseline) : undefined
      })
      setResult(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const sentColor = (s) => {
    if (typeof s === 'number') return s > 0.1 ? 'var(--green)' : s < -0.1 ? 'var(--red)' : 'var(--text-3)'
    return s === 'positive' ? 'var(--green)' : s === 'negative' ? 'var(--red)' : 'var(--text-3)'
  }

  const sentLabel = (s) => {
    if (typeof s === 'number') return s > 0.1 ? 'Positive' : s < -0.1 ? 'Negative' : 'Neutral'
    return s || 'Neutral'
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title"><Newspaper size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />Article Analyzer</h1>
        <p className="page-subtitle">Paste article links — AI will extract strategic implications and compute score impact on your merger analysis</p>
      </div>

      <div className="card animate-in" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="input-group" style={{ flex: 1, minWidth: 140 }}>
            <label className="input-label">Company X</label>
            <input className="input-field" value={tickerX} onChange={e => setTickerX(e.target.value.toUpperCase())} placeholder="AAPL" />
          </div>
          <div className="input-group" style={{ flex: 1, minWidth: 140 }}>
            <label className="input-label">Company Y (optional)</label>
            <input className="input-field" value={tickerY} onChange={e => setTickerY(e.target.value.toUpperCase())} placeholder="MSFT" />
          </div>
          <div className="input-group" style={{ minWidth: 140 }}>
            <label className="input-label">Baseline Score (optional)</label>
            <input className="input-field" value={baseline} onChange={e => setBaseline(e.target.value)} placeholder="0–100" type="number" />
          </div>
        </div>

        <div className="input-label" style={{ marginBottom: 8 }}>Article URLs</div>
        <div className="url-list" style={{ marginBottom: 12 }}>
          {urls.map((url, i) => (
            <div className="url-item" key={i}>
              <input className="input-field" value={url} onChange={e => { const n = [...urls]; n[i] = e.target.value; setUrls(n) }}
                placeholder={`https://techcrunch.com/... (URL ${i+1})`} style={{ fontSize: 12 }} />
              {urls.length > 1 && (
                <button className="url-remove" onClick={() => setUrls(urls.filter((_, j) => j !== i))}><Trash2 size={12} /></button>
              )}
            </div>
          ))}
          {urls.length < 8 && (
            <button className="btn btn-outline btn-sm" onClick={() => setUrls([...urls, ''])}><Plus size={12} /> Add URL</button>
          )}
        </div>

        <button className="btn btn-primary" onClick={handleAnalyze} disabled={loading || !tickerX || !urls.some(u => u.startsWith('http'))}>
          {loading ? <span className="loading-spinner" style={{ width: 15, height: 15 }} /> : <Newspaper size={14} />}
          Analyze Articles
        </button>
      </div>

      {error && <div className="alert-banner alert-danger">{error}</div>}
      {loading && <Loading text="Fetching articles and extracting strategic signals with AI..." />}

      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary banner */}
          <div className="card animate-in" style={{ background: result.total_delta >= 0 ? 'var(--green-dim)' : 'var(--red-dim)', border: `1px solid ${result.total_delta >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontFamily: 'DM Mono', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>Article Impact Summary</div>
                <div style={{ fontFamily: 'Instrument Serif', fontSize: 20, fontStyle: 'italic' }}>{result.summary}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, fontFamily: 'DM Mono', opacity: 0.7, marginBottom: 4 }}>SCORE DELTA</div>
                <div style={{ fontSize: 28, fontFamily: 'DM Mono', color: result.total_delta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {result.total_delta > 0 ? '+' : ''}{result.total_delta?.toFixed(1)}
                </div>
              </div>
            </div>
            {result.baseline_score != null && (
              <div style={{ display: 'flex', gap: 24, marginTop: 14, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontFamily: 'DM Mono', letterSpacing: 1.5, opacity: 0.7 }}>BASELINE</div>
                  <div style={{ fontSize: 22, fontFamily: 'DM Mono' }}>{result.baseline_score?.toFixed(0)}%</div>
                </div>
                <ArrowRight size={20} style={{ opacity: 0.5 }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontFamily: 'DM Mono', letterSpacing: 1.5, opacity: 0.7 }}>NEW SCORE</div>
                  <div style={{ fontSize: 22, fontFamily: 'DM Mono' }}>{result.new_score?.toFixed(0)}%</div>
                </div>
              </div>
            )}
          </div>

          {/* Main causes */}
          {(result.main_causes || []).length > 0 && (
            <div className="card animate-in animate-in-1">
              <div className="card-title">Key Drivers of Score Change</div>
              {result.main_causes.map((cause, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{String(i+1).padStart(2,'0')}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{cause}</span>
                </div>
              ))}
            </div>
          )}

          {/* Individual articles */}
          {(result.articles || []).map((art, i) => (
            <div className="card animate-in" style={{ animationDelay: `${i * 0.05}s` }} key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {art.title || art.url}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {art.publisher && <span className="tag tag-neutral">{art.publisher}</span>}
                    {art.publication_date && <span className="tag tag-neutral">{art.publication_date?.slice(0,10)}</span>}
                    {art.event_type && <span className="tag tag-accent">{art.event_type}</span>}
                    <span style={{ fontSize: 11, fontFamily: 'DM Mono', color: sentColor(art.sentiment) }}>
                      ● {sentLabel(art.sentiment)} sentiment
                    </span>
                    <span style={{ fontSize: 11, fontFamily: 'DM Mono', color: 'var(--text-3)' }}>
                      Reliability: {Math.round((art.reliability_score || 0.7) * 100)}%
                    </span>
                  </div>
                </div>
                <div style={{ marginLeft: 16, flexShrink: 0, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontFamily: 'DM Mono', letterSpacing: 1.5, color: 'var(--text-3)', marginBottom: 4 }}>IMPACT</div>
                  <div className={`score-badge ${(art.score_delta||0) >= 0 ? 'score-high' : 'score-low'}`} style={{ fontSize: 14, padding: '4px 12px' }}>
                    {(art.score_delta||0) > 0 ? '+' : ''}{(art.score_delta||0).toFixed(1)}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10, padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                <strong style={{ color: 'var(--text-3)', fontSize: 10, fontFamily: 'DM Mono', letterSpacing: 1, display: 'block', marginBottom: 4 }}>STRATEGIC IMPLICATION</strong>
                {art.strategic_implication}
              </div>

              <div className="grid-2" style={{ gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'DM Mono', color: 'var(--text-3)', marginBottom: 4 }}>IMPACT ON {tickerX}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{art.impact_on_x}</div>
                </div>
                {art.impact_on_y && art.impact_on_y !== 'N/A' && (
                  <div>
                    <div style={{ fontSize: 10, fontFamily: 'DM Mono', color: 'var(--text-3)', marginBottom: 4 }}>IMPACT ON {tickerY}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{art.impact_on_y}</div>
                  </div>
                )}
              </div>

              {(art.key_claims || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontFamily: 'DM Mono', color: 'var(--text-3)', marginBottom: 6 }}>KEY CLAIMS</div>
                  {art.key_claims.map((claim, j) => (
                    <div key={j} style={{ fontSize: 12, color: 'var(--text-2)', padding: '4px 0', display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--accent)' }}>›</span> {claim}
                    </div>
                  ))}
                </div>
              )}

              {art.url && (
                <div style={{ marginTop: 10 }}>
                  <a href={art.url} target="_blank" rel="noreferrer" className="citation-link" style={{ fontSize: 12 }}>
                    View Source Article →
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}