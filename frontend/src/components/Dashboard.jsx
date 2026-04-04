import { useState } from 'react'
import { Search, TrendingUp, FlaskConical, Zap, ChevronRight } from 'lucide-react'
import { API_BASE_URL, api, fmtMoney, fmtPct, fmtNum, fmtMaybeScore, scoreColor, scoreClass, scoreLabel } from '../utils/api'
import { ScoreRing, KPICard, Loading, RecBanner, NewsItem, MetricRow, ScoreBar } from '../components/UIComponents'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const SAMPLE_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM']

export default function Dashboard({ globalTickers, setGlobalTickers, riskProfile, setRiskProfile, navigate }) {
  const [ticker, setTicker] = useState(globalTickers.x || '')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  async function handleAnalyze() {
    if (!ticker) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.runValuation({
        company_id: ticker,
        ticker: ticker,
        risk_tolerance: riskProfile.tolerance
      })
      setData(result)
      setGlobalTickers(prev => ({ ...prev, x: ticker }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const revenueData = data?.revenue_history?.map(h => ({
    period: h.period?.slice(0, 4) || '',
    Revenue: Math.round((h.value || 0) / 1e6)
  })).reverse() || []

  const incomeData = data?.income_history?.map(h => ({
    period: h.period?.slice(0, 4) || '',
    'Net Income': Math.round((h.value || 0) / 1e6)
  })).reverse() || []

  return (
    <div className="page">
      <div className="noise-overlay" />

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">SELVAM Dashboard</h1>
          <p className="page-subtitle">Strategic Enterprise Leverage & Valuation Analysis Machine</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['conservative', 'moderate', 'aggressive'].map(r => (
            <button key={r} className={`btn btn-sm ${riskProfile.tolerance === r ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRiskProfile(p => ({ ...p, tolerance: r }))}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div className="card animate-in" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="input-label" style={{ marginBottom: 6 }}>Company / Ticker</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input-field"
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL, MSFT, GOOGL..."
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                style={{ letterSpacing: 1 }}
              />
            </div>
          </div>
          <div style={{ minWidth: 120 }}>
            <div className="input-label" style={{ marginBottom: 6 }}>Time Horizon</div>
            <select className="input-field" value={riskProfile.horizon}
              onChange={e => setRiskProfile(p => ({ ...p, horizon: e.target.value }))}>
              <option value="1Y">1 Year</option>
              <option value="3Y">3 Years</option>
              <option value="5Y">5 Years</option>
            </select>
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleAnalyze} disabled={loading || !ticker}>
            {loading ? <span className="loading-spinner" style={{ width: 16, height: 16 }} /> : <Search size={15} />}
            Analyze Company
          </button>
        </div>

        {/* Quick tickers */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {SAMPLE_TICKERS.map(t => (
            <button key={t} className="btn btn-sm btn-outline"
              style={{ padding: '4px 10px', fontFamily: 'DM Mono', fontSize: 11 }}
              onClick={() => { setTicker(t); }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert-banner alert-danger animate-in">⚠ {error} — Backend: {API_BASE_URL}</div>}

      {loading && <Loading text="Fetching financial data from SEC · FMP · Finnhub..." />}

      {data && !loading && (
        <>
          {/* Company header */}
          <div className="animate-in" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            {data.image && <img src={data.image} alt="" style={{ width: 42, height: 42, borderRadius: 8, background: 'var(--bg-3)' }} onError={e => e.target.style.display='none'} />}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'Instrument Serif', fontSize: 22, fontStyle: 'italic' }}>{data.name}</span>
                <span className="ticker-badge">{data.ticker}</span>
                {data.sector && <span className="tag tag-accent">{data.sector}</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                Market Cap: {fmtMoney(data.market_cap)} · {data.country || 'US'} · {data.exchange || ''}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('merger')}>
                <FlaskConical size={13} /> Merger Lab
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('valuation')}>
                <TrendingUp size={13} /> Full Valuation
              </button>
            </div>
          </div>

          {/* Recommendation banner */}
          {data.investment_rationale && (
            <RecBanner
              recommendation={scoreLabel(data.health_scores?.overall ?? 0) + ' Investment Candidate'}
              detail={data.investment_rationale?.slice(0, 200) + '...'}
              riskLevel={riskProfile.tolerance}
              score={data.health_scores?.overall ?? 0}
            />
          )}

          {/* KPI Cards */}
          <div className="kpi-grid animate-in animate-in-1">
            <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <ScoreRing value={data.health_scores?.overall} label="Health" size={72} />
              <div>
                <div className="card-title">Overall Score</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{scoreLabel(data.health_scores?.overall)}</div>
              </div>
            </div>
            <KPICard label="Valuation (Base)" value={fmtMoney(data.valuation?.base)} sub={`${fmtMoney(data.valuation?.low)} – ${fmtMoney(data.valuation?.high)}`} color="var(--gold)" />
            <KPICard label="Current Ratio" value={fmtNum(data.financial_summary?.current_ratio)}
              sub={data.financial_summary?.current_ratio >= 1 ? '✓ Healthy liquidity' : '⚠ Liquidity concern'}
              color={data.financial_summary?.current_ratio >= 1 ? 'var(--green)' : 'var(--red)'} />
            <KPICard label="Revenue" value={fmtMoney(data.financial_summary?.revenue)} sub="Annual" color="var(--accent)" />
            <KPICard label="EBITDA" value={fmtMoney(data.financial_summary?.ebitda)} sub="Earnings before interest, taxes" />
            <KPICard label="ESG Score" value={fmtMaybeScore(data.esg?.overall_esg)} suffix={data.esg?.overall_esg == null ? '' : '/100'}
              sub={data.esg?.sustainability_trend || 'stable'} color="var(--teal)" />
            <KPICard label="Profit Margin" value={fmtPct(data.financial_summary?.profit_margin)}
              color={data.financial_summary?.profit_margin > 0.10 ? 'var(--green)' : 'var(--gold)'} />
            <KPICard label="Confidence" value={`${data.valuation?.confidence ?? '—'}${data.valuation?.confidence == null ? '' : '%'}`} sub={`${data.valuation?.methods_used ?? '—'} methods used`} />
          </div>

          {/* Tab bar */}
          <div className="tab-bar animate-in animate-in-2">
            {['overview', 'financials', 'esg', 'news', 'sources'].map(t => (
              <button key={t} className={`tab-item ${activeTab === t ? 'active' : ''}`}
                onClick={() => setActiveTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          {activeTab === 'overview' && (
            <div className="grid-2 animate-in animate-in-3">
              {/* Revenue chart */}
              <div className="card">
                <div className="card-title">Revenue Trend (USD Millions)</div>
                {revenueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={revenueData}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="Revenue" stroke="var(--accent)" fill="url(#revGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '40px 0', textAlign: 'center' }}>No historical data</div>}
              </div>

              {/* Health scores */}
              <div className="card">
                <div className="card-title">Health Score Breakdown</div>
                <ScoreBar label="Liquidity" value={data.health_scores?.liquidity} />
                <ScoreBar label="Profitability" value={data.health_scores?.profitability} />
                <ScoreBar label="Growth" value={data.health_scores?.growth} />
                <ScoreBar label="Leverage" value={data.health_scores?.leverage} />
                <ScoreBar label="Free Cash Flow" value={data.health_scores?.fcf} />
              </div>
            </div>
          )}

          {/* Financials tab */}
          {activeTab === 'financials' && (
            <div className="grid-2 animate-in animate-in-3">
              <div className="card">
                <div className="card-title">Income Statement</div>
                <MetricRow label="Revenue" value={fmtMoney(data.financial_summary?.revenue)} />
                <MetricRow label="Net Income" value={fmtMoney(data.financial_summary?.net_income)} highlight />
                <MetricRow label="EBITDA" value={fmtMoney(data.financial_summary?.ebitda)} />
                <MetricRow label="Free Cash Flow" value={fmtMoney(data.financial_summary?.free_cash_flow)} />
                <MetricRow label="Profit Margin" value={fmtPct(data.financial_summary?.profit_margin)} />
                <MetricRow label="Revenue Growth (YoY)" value={fmtPct(data.financial_summary?.revenue_growth)} />
              </div>
              <div className="card">
                <div className="card-title">Balance Sheet</div>
                <MetricRow label="Total Assets" value={fmtMoney(data.financial_summary?.total_assets)} />
                <MetricRow label="Total Debt" value={fmtMoney(data.financial_summary?.total_debt)} />
                <MetricRow label="Current Ratio" value={fmtNum(data.financial_summary?.current_ratio)} highlight />
                <MetricRow label="Debt / Equity" value={fmtNum(data.financial_summary?.debt_to_equity)} />
                <MetricRow label="P/E Ratio" value={fmtNum(data.ratios?.price_to_earnings)} />
                <MetricRow label="EV/EBITDA" value={fmtNum(data.ratios?.ev_to_ebitda)} />
              </div>
              <div className="card">
                <div className="card-title">Valuation Range</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0' }}>
                  {['low', 'base', 'high'].map((k, i) => (
                    <div key={k} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'DM Mono', marginBottom: 4 }}>{k.toUpperCase()}</div>
                      <div style={{ fontSize: 20, fontFamily: 'Instrument Serif', fontStyle: 'italic', color: i === 1 ? 'var(--gold)' : 'var(--text-2)' }}>
                        {fmtMoney(data.valuation?.[k])}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="divider" />
                <MetricRow label="Confidence Band" value={`${data.valuation?.confidence ?? '—'}${data.valuation?.confidence == null ? '' : '%'}`} highlight />
                <MetricRow label="Methods Used" value={`${data.valuation?.methods_used || 3} approaches`} />
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
                  Assumptions: P/E {data.valuation?.assumptions?.pe_multiple}x · EV/EBITDA {data.valuation?.assumptions?.ev_ebitda_multiple}x · Discount rate {data.valuation?.assumptions?.discount_rate}
                </div>
              </div>
              <div className="card">
                <div className="card-title">Net Income Trend (USD Millions)</div>
                {incomeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={incomeData}>
                      <defs>
                        <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="Net Income" stroke="var(--green)" fill="url(#incGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '40px 0', textAlign: 'center' }}>No data</div>}
              </div>
            </div>
          )}

          {/* ESG tab */}
          {activeTab === 'esg' && (
            <div className="grid-2 animate-in animate-in-3">
              <div className="card">
                <div className="card-title">ESG Scores (GNN-Enhanced)</div>
                <ScoreBar label="Overall ESG" value={data.esg?.overall_esg} color="var(--teal)" />
                <ScoreBar label="Environmental" value={data.esg?.environmental} color="var(--green)" />
                <ScoreBar label="Social" value={data.esg?.social} color="var(--accent)" />
                <ScoreBar label="Governance" value={data.esg?.governance} color="var(--purple)" />
                <div className="divider" />
                <MetricRow label="Governance Risk" value={data.esg?.governance_risk == null ? 'Unavailable' : `${Math.round(data.esg?.governance_risk)}/100`} />
                <MetricRow label="Controversy Score" value={fmtNum(data.esg?.controversy_score)} />
                <MetricRow label="Sustainability Trend" value={data.esg?.sustainability_trend || 'stable'} highlight />
              </div>
              <div className="card">
                <div className="card-title">Key ESG Issues</div>
                {(data.esg?.key_issues || []).map((issue, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--teal)', fontSize: 11 }}>●</span>
                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{issue}</span>
                  </div>
                ))}
                <div className="divider" />
                <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
                  ESG scores are computed using a Graph Neural Network-inspired approach, incorporating news signals, relationship graphs, and ESG Book data sources.
                </div>
              </div>
            </div>
          )}

          {/* News tab */}
          {activeTab === 'news' && (
            <div className="card animate-in animate-in-3">
              <div className="card-title">Recent News & Events</div>
              {(data.news || []).length === 0
                ? <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '20px 0' }}>No recent news found</div>
                : (data.news || []).map((art, i) => <NewsItem key={i} article={art} />)
              }
            </div>
          )}

          {/* Sources tab */}
          {activeTab === 'sources' && (
            <div className="card animate-in animate-in-3">
              <div className="card-title">Data Sources & Citations</div>
              {(data.sources || []).map((src, i) => (
                <div key={i} className="citation-item">
                  <span className="citation-num">[{i + 1}]</span>
                  <div className="citation-body">
                    <div className="citation-title">{src.name}</div>
                    <div className="citation-meta">
                      {src.publisher && <span>{src.publisher}</span>}
                      {src.date && <span>{src.date?.slice(0, 10)}</span>}
                    </div>
                    {src.url && <a href={src.url} target="_blank" rel="noreferrer" className="citation-link">{src.url}</a>}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-2)', borderRadius: 8, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-2)' }}>Data Sources:</strong> SEC EDGAR (official US filings) · Financial Modeling Prep (financial statements, ratios) · Finnhub (company profiles) · Alpha Vantage (market data) · NewsAPI (news articles) · TechCrunch RSS (tech news) · ESG Book (ESG data) · OpenCorporates (company registry)
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="card animate-in" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontFamily: 'Instrument Serif', fontSize: 28, fontStyle: 'italic', color: 'var(--text-2)', marginBottom: 10 }}>
            Enter a ticker to begin
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>
            Search any public company to get valuation, financial health, ESG scores, and merger intelligence
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {SAMPLE_TICKERS.slice(0, 6).map(t => (
              <button key={t} className="btn btn-outline" onClick={() => { setTicker(t); }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}