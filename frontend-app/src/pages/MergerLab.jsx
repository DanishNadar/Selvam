import { useState } from 'react'
import { FlaskConical, Plus, Trash2, ArrowRight } from 'lucide-react'
import { api, fmtMoney, fmtPct, fmtNum, scoreColor, scoreClass, scoreLabel } from '../utils/api'
import { ScoreRing, MergerGauge, KPICard, Loading, RecBanner, NewsItem, MetricRow, ScoreBar } from '../components/UIComponents'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

export default function MergerLab({ globalTickers, setGlobalTickers, riskProfile }) {
  const [tickerX, setTickerX] = useState(globalTickers.x || '')
  const [tickerY, setTickerY] = useState(globalTickers.y || '')
  const [txnType, setTxnType] = useState('merger')
  const [articleUrls, setArticleUrls] = useState([''])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('analysis')
  const [scenario, setScenario] = useState('base')
  const [contractDraft, setContractDraft] = useState(null)
  const [draftLoading, setDraftLoading] = useState(false)

  async function handleAnalyze() {
    if (!tickerX || !tickerY) return
    setLoading(true)
    setError(null)
    try {
      const urls = articleUrls.filter(u => u.trim().startsWith('http'))
      const res = await api.analyzeMerger({
        company_x_ticker: tickerX,
        company_y_ticker: tickerY,
        transaction_type: txnType,
        risk_tolerance: riskProfile.tolerance,
        time_horizon: riskProfile.horizon,
        esg_weight: riskProfile.esgImportance,
        user_article_urls: urls
      })
      setResult(res)
      setGlobalTickers({ x: tickerX, y: tickerY })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDraftContract() {
    if (!result) return
    setDraftLoading(true)
    try {
      const val = result.company_x?.market_cap || 1e9
      const draft = await api.draftContract({
        company_x_ticker: tickerX,
        company_y_ticker: tickerY,
        transaction_type: txnType,
        valuation_range_low: val * 0.85,
        valuation_range_high: val * 1.15,
        esg_clauses: true
      })
      setContractDraft(draft)
      setActiveTab('contract')
    } catch (e) {
      alert('Contract draft error: ' + e.message)
    } finally {
      setDraftLoading(false)
    }
  }

  const ma = result?.merger_analysis || {}
  const scenarioAdj = scenario === 'bull' ? 8 : scenario === 'bear' ? -10 : 0
  const baseProb = ma.probability_of_success ?? 0
  const adjProb = Math.min(95, Math.max(5, baseProb + scenarioAdj))

  const radarData = [
    { subject: 'Financial Health', A: ma.financial_health_score || 0 },
    { subject: 'Revenue Fit', A: ma.revenue_compat || 0 },
    { subject: 'ESG Compat', A: result?.esg?.compatibility || 0 },
    { subject: 'Leverage', A: ma.leverage_score || 0 },
    { subject: 'Sector Align', A: ma.sector_score || 0 },
    { subject: 'Synergy', A: ma.synergy_potential || 0 },
  ]

  const compareData = result ? [
    { metric: 'Current Ratio', X: result.company_x?.current_ratio || 0, Y: result.company_y?.current_ratio || 0 },
    { metric: 'ESG Score', X: result.company_x?.esg_score || 0, Y: result.company_y?.esg_score || 0 },
    { metric: 'Profit Margin%', X: (result.company_x?.profit_margin || 0) * 100, Y: (result.company_y?.profit_margin || 0) * 100 },
  ] : []

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title"><FlaskConical size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />Merger Lab</h1>
          <p className="page-subtitle">Analyze merger feasibility, synergies, and M&A strategy between any two companies</p>
        </div>
      </div>

      {/* Setup form */}
      <div className="card animate-in" style={{ marginBottom: 20 }}>
        <div className="company-compare" style={{ gap: 20, marginBottom: 16 }}>
          <div className="input-group">
            <label className="input-label">Company X (Acquirer / Party A)</label>
            <input className="input-field" value={tickerX} onChange={e => setTickerX(e.target.value.toUpperCase())}
              placeholder="AAPL" style={{ letterSpacing: 1, fontSize: 15, fontWeight: 600 }} />
          </div>
          <div className="vs-divider">×</div>
          <div className="input-group">
            <label className="input-label">Company Y (Target / Party B)</label>
            <input className="input-field" value={tickerY} onChange={e => setTickerY(e.target.value.toUpperCase())}
              placeholder="MSFT" style={{ letterSpacing: 1, fontSize: 15, fontWeight: 600 }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="input-group" style={{ minWidth: 160 }}>
            <label className="input-label">Transaction Type</label>
            <select className="input-field" value={txnType} onChange={e => setTxnType(e.target.value)}>
              <option value="merger">Merger</option>
              <option value="acquisition">Acquisition</option>
              <option value="investment">Investment</option>
              <option value="divestiture">Divestiture</option>
            </select>
          </div>
          <div className="input-group" style={{ flex: 1, minWidth: 200 }}>
            <label className="input-label">User Article URLs (optional)</label>
            <div className="url-list">
              {articleUrls.map((url, i) => (
                <div className="url-item" key={i}>
                  <input className="input-field" value={url} onChange={e => {
                    const n = [...articleUrls]; n[i] = e.target.value; setArticleUrls(n)
                  }} placeholder="https://bloomberg.com/article..." style={{ fontSize: 12 }} />
                  {articleUrls.length > 1 && (
                    <button className="url-remove" onClick={() => setArticleUrls(articleUrls.filter((_, j) => j !== i))}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              {articleUrls.length < 5 && (
                <button className="btn btn-outline btn-sm" onClick={() => setArticleUrls([...articleUrls, ''])}>
                  <Plus size={12} /> Add URL
                </button>
              )}
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleAnalyze} disabled={loading || !tickerX || !tickerY}>
            {loading ? <span className="loading-spinner" style={{ width: 16, height: 16 }} /> : <FlaskConical size={15} />}
            Run Merger Analysis
          </button>
        </div>
      </div>

      {error && <div className="alert-banner alert-danger animate-in">⚠ {error}</div>}
      {loading && <Loading text={`Analyzing ${tickerX} × ${tickerY} merger feasibility...`} />}

      {result && !loading && (
        <>
          {/* Recommendation */}
          <RecBanner
            recommendation={ma.recommendation}
            detail={ma.recommendation_detail}
            riskLevel={ma.risk_level}
            score={ma.probability_of_success ?? 0}
          />

          {/* Top metrics */}
          <div className="kpi-grid animate-in animate-in-1">
            <div className="card" style={{ gridColumn: 'span 1' }}>
              <div className="card-title">Merger Probability</div>
              <MergerGauge probability={adjProb} />
              <div className="scenario-bar" style={{ marginTop: 8 }}>
                {['bear', 'base', 'bull'].map(s => (
                  <button key={s} className={`scenario-btn ${scenario === s ? `active-${s === 'bull' ? 'bull' : s === 'base' ? 'base' : 'bear'}` : ''}`}
                    onClick={() => setScenario(s)}>
                    {s === 'bull' ? '🐂 Bull' : s === 'base' ? '📊 Base' : '🐻 Bear'}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Feasibility Score', val: ma.overall_score },
                  { label: 'Synergy Potential', val: ma.synergy_potential },
                  { label: 'Risk-Tolerance Fit', val: ma.risk_tolerance_fit },
                  { label: 'ESG Compatibility', val: result.esg?.compatibility },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</span>
                      <span style={{ fontSize: 12, fontFamily: 'DM Mono', color: scoreColor(val) }}>{Math.round(val || 0)}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${val || 0}%`, background: scoreColor(val) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Integration Risk</div>
              <ScoreRing value={ma.integration_risk} color="var(--red)" size={80} />
              <div style={{ marginTop: 12 }}>
                <div className="card-title">Positive Drivers</div>
                {(ma.key_drivers_positive || []).map((d, i) => (
                  <div key={i} className="tag tag-positive" style={{ marginBottom: 4, width: 'fit-content' }}>✓ {d}</div>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="card-title">Risk Factors</div>
                {(ma.key_drivers_negative || []).map((d, i) => (
                  <div key={i} className="tag tag-negative" style={{ marginBottom: 4, width: 'fit-content' }}>⚠ {d}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="tab-bar animate-in animate-in-2">
            {['analysis', 'comparison', 'esg', 'news', 'contract', 'sources'].map(t => (
              <button key={t} className={`tab-item ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                {t === 'contract' ? '📋 Contract' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Analysis tab */}
          {activeTab === 'analysis' && (
            <div className="grid-2 animate-in animate-in-3">
              <div className="card">
                <div className="card-title">Compatibility Radar</div>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'var(--text-3)', fontSize: 9 }} />
                    <Radar name="Score" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.2} strokeWidth={2} />
                    <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <div className="card-title">Sub-scores Breakdown</div>
                <ScoreBar label="Financial Health" value={ma.financial_health_score} />
                <ScoreBar label="Balance Sheet Compat" value={ma.balance_compat} />
                <ScoreBar label="Revenue Complementarity" value={ma.revenue_compat} />
                <ScoreBar label="Sector Alignment" value={ma.sector_score} />
                <ScoreBar label="Leverage Profile" value={ma.leverage_score} />
                <ScoreBar label="Synergy Potential" value={ma.synergy_potential} color="var(--teal)" />
              </div>
              {result.insights && (
                <div className="card" style={{ gridColumn: 'span 2' }}>
                  <div className="card-title">AI Merger Insights</div>
                  <div className="insight-block">{result.insights}</div>
                </div>
              )}
              {(result.article_analysis?.articles || []).length > 0 && (
                <div className="card" style={{ gridColumn: 'span 2' }}>
                  <div className="card-title">Article Impact Analysis</div>
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Score delta from {result.article_analysis.count} article(s): </span>
                    <span style={{ fontFamily: 'DM Mono', color: result.article_analysis.total_delta >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 14 }}>
                      {result.article_analysis.total_delta > 0 ? '+' : ''}{result.article_analysis.total_delta?.toFixed(1)} pts
                    </span>
                  </div>
                  {result.article_analysis.articles.map((art, i) => (
                    <div key={i} className="card" style={{ background: 'var(--bg-2)', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{art.title || art.url}</span>
                        <span className={`score-badge ${art.score_delta >= 0 ? 'score-high' : 'score-low'}`}>
                          {art.score_delta > 0 ? '+' : ''}{art.score_delta?.toFixed(1)}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>{art.strategic_implication}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className="tag tag-accent">{art.event_type}</span>
                        <span className="tag tag-neutral">{art.publisher}</span>
                        {art.risk_factor && <span className="tag tag-negative">{art.risk_factor}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comparison tab */}
          {activeTab === 'comparison' && (
            <div className="animate-in animate-in-3">
              <div className="company-compare" style={{ gap: 20, marginBottom: 20 }}>
                {/* Company X */}
                <div className="card">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                    <span className="ticker-badge">{result.company_x.ticker}</span>
                    <span style={{ fontFamily: 'Instrument Serif', fontSize: 16, fontStyle: 'italic' }}>{result.company_x.name}</span>
                  </div>
                  <MetricRow label="Current Ratio" value={fmtNum(result.company_x.current_ratio)} highlight />
                  <MetricRow label="Market Cap" value={fmtMoney(result.company_x.market_cap)} />
                  <MetricRow label="Revenue" value={fmtMoney(result.company_x.revenue)} />
                  <MetricRow label="Profit Margin" value={fmtPct(result.company_x.profit_margin)} />
                  <MetricRow label="D/E Ratio" value={fmtNum(result.company_x.debt_to_equity)} />
                  <MetricRow label="ESG Score" value={`${Math.round(result.company_x.esg_score)}/100`} />
                  <MetricRow label="Fin. Health" value={`${Math.round(result.company_x.financial_health)}/100`} />
                </div>
                <div className="vs-divider">vs</div>
                {/* Company Y */}
                <div className="card">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                    <span className="ticker-badge" style={{ background: 'var(--purple-dim)', color: 'var(--purple)', borderColor: 'rgba(139,92,246,0.3)' }}>{result.company_y.ticker}</span>
                    <span style={{ fontFamily: 'Instrument Serif', fontSize: 16, fontStyle: 'italic' }}>{result.company_y.name}</span>
                  </div>
                  <MetricRow label="Current Ratio" value={fmtNum(result.company_y.current_ratio)} highlight />
                  <MetricRow label="Market Cap" value={fmtMoney(result.company_y.market_cap)} />
                  <MetricRow label="Revenue" value={fmtMoney(result.company_y.revenue)} />
                  <MetricRow label="Profit Margin" value={fmtPct(result.company_y.profit_margin)} />
                  <MetricRow label="D/E Ratio" value={fmtNum(result.company_y.debt_to_equity)} />
                  <MetricRow label="ESG Score" value={`${Math.round(result.company_y.esg_score)}/100`} />
                  <MetricRow label="Fin. Health" value={`${Math.round(result.company_y.financial_health)}/100`} />
                </div>
              </div>
              {compareData.length > 0 && (
                <div className="card">
                  <div className="card-title">Side-by-Side Comparison</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={compareData}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis dataKey="metric" tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="X" name={tickerX} fill="var(--accent)" radius={[4,4,0,0]} />
                      <Bar dataKey="Y" name={tickerY} fill="var(--purple)" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ESG tab */}
          {activeTab === 'esg' && (
            <div className="grid-2 animate-in animate-in-3">
              <div className="card">
                <div className="card-title">ESG – {tickerX}</div>
                <ScoreBar label="Overall ESG" value={result.esg?.company_x?.overall_esg} color="var(--teal)" />
                <ScoreBar label="Environmental" value={result.esg?.company_x?.environmental} color="var(--green)" />
                <ScoreBar label="Social" value={result.esg?.company_x?.social} color="var(--accent)" />
                <ScoreBar label="Governance" value={result.esg?.company_x?.governance} color="var(--purple)" />
                <div className="divider" />
                {(result.esg?.company_x?.key_issues || []).map((issue, i) => (
                  <div key={i} className="tag tag-neutral" style={{ marginBottom: 5 }}>{issue}</div>
                ))}
              </div>
              <div className="card">
                <div className="card-title">ESG – {tickerY}</div>
                <ScoreBar label="Overall ESG" value={result.esg?.company_y?.overall_esg} color="var(--teal)" />
                <ScoreBar label="Environmental" value={result.esg?.company_y?.environmental} color="var(--green)" />
                <ScoreBar label="Social" value={result.esg?.company_y?.social} color="var(--accent)" />
                <ScoreBar label="Governance" value={result.esg?.company_y?.governance} color="var(--purple)" />
                <div className="divider" />
                {(result.esg?.company_y?.key_issues || []).map((issue, i) => (
                  <div key={i} className="tag tag-neutral" style={{ marginBottom: 5 }}>{issue}</div>
                ))}
              </div>
              <div className="card" style={{ gridColumn: 'span 2' }}>
                <MetricRow label="ESG Compatibility Score" value={result.esg?.compatibility == null ? 'Unavailable' : `${Math.round(result.esg.compatibility)}/100`} highlight />
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
                  ESG compatibility is computed using a Graph Neural Network (GNN) model that propagates scores through company networks, analyzing relationships, news signals, and controversy events using NetworkX graph structures.
                </div>
              </div>
            </div>
          )}

          {/* News tab */}
          {activeTab === 'news' && (
            <div className="grid-2 animate-in animate-in-3">
              <div className="card">
                <div className="card-title">News – {tickerX}</div>
                {(result.news?.company_x || []).map((art, i) => <NewsItem key={i} article={art} />)}
              </div>
              <div className="card">
                <div className="card-title">News – {tickerY}</div>
                {(result.news?.company_y || []).map((art, i) => <NewsItem key={i} article={art} />)}
              </div>
            </div>
          )}

          {/* Contract tab */}
          {activeTab === 'contract' && (
            <div className="animate-in animate-in-3">
              {!contractDraft ? (
                <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontFamily: 'Instrument Serif', fontSize: 20, fontStyle: 'italic', marginBottom: 12 }}>
                    Generate Draft Contract Documents
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 24 }}>
                    AI-powered LOI, Term Sheet, Acquisition Summary, and Due Diligence Checklist
                  </div>
                  <button className="btn btn-gold btn-lg" onClick={handleDraftContract} disabled={draftLoading}>
                    {draftLoading ? <span className="loading-spinner" style={{ width: 16, height: 16 }} /> : '📋'}
                    Draft Contract Documents
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="alert-banner alert-warning">{contractDraft.disclaimer}</div>
                  {['loi_draft', 'acquisition_summary', 'merger_term_sheet'].map(key => (
                    <div className="card" key={key}>
                      <div className="card-title">{key.replace(/_/g, ' ').toUpperCase()}</div>
                      <div className="insight-block">{contractDraft[key]}</div>
                    </div>
                  ))}
                  <div className="card">
                    <div className="card-title">Due Diligence Checklist</div>
                    <div style={{ columns: 2, gap: 20 }}>
                      {(contractDraft.due_diligence_checklist || []).map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, breakInside: 'avoid' }}>
                          <span style={{ color: 'var(--gold)', fontFamily: 'DM Mono', fontSize: 11, flexShrink: 0 }}>{String(i+1).padStart(2,'0')}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sources tab */}
          {activeTab === 'sources' && (
            <div className="card animate-in animate-in-3">
              <div className="card-title">Citations & Data Sources</div>
              {(result.sources || []).map((src, i) => (
                <div key={i} className="citation-item">
                  <span className="citation-num">[{i + 1}]</span>
                  <div className="citation-body">
                    <div className="citation-title">{src.name || src.title}</div>
                    <div className="citation-meta">{src.publisher}{src.date ? ` · ${src.date?.slice(0,10)}` : ''}</div>
                    {src.url && <a href={src.url} target="_blank" rel="noreferrer" className="citation-link">{src.url}</a>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}