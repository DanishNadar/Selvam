import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { api, fmtMoney, fmtPct, fmtNum, fmtMaybeScore, scoreColor } from '../utils/api'
import { ScoreRing, Loading, RecBanner, MetricRow, ScoreBar, KPICard } from '../components/UIComponents'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

export default function ValuationPage({ globalTickers, riskProfile }) {
  const [ticker, setTicker] = useState(globalTickers.x || '')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  async function handleRun() {
    if (!ticker) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.runValuation({ company_id: ticker, ticker, risk_tolerance: riskProfile.tolerance })
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const valData = data ? [
    { name: 'Bear Case', value: Math.round((data.valuation?.low || 0) / 1e6), fill: 'var(--red)' },
    { name: 'Base Case', value: Math.round((data.valuation?.base || 0) / 1e6), fill: 'var(--gold)' },
    { name: 'Bull Case', value: Math.round((data.valuation?.high || 0) / 1e6), fill: 'var(--green)' },
  ] : []

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title"><TrendingUp size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />Valuation Engine</h1>
        <p className="page-subtitle">DCF, comparable multiples, and financial health-based company valuation</p>
      </div>

      <div className="card animate-in" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div className="input-group" style={{ flex: 1 }}>
          <label className="input-label">Company Ticker</label>
          <input className="input-field" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
            placeholder="Enter ticker..." onKeyDown={e => e.key === 'Enter' && handleRun()} />
        </div>
        <button className="btn btn-primary btn-lg" onClick={handleRun} disabled={loading || !ticker}>
          {loading ? <span className="loading-spinner" style={{ width: 16, height: 16 }} /> : <TrendingUp size={15} />}
          Run Valuation
        </button>
      </div>

      {error && <div className="alert-banner alert-danger">{error}</div>}
      {loading && <Loading text="Computing valuation using DCF, multiples, and financial health models..." />}

      {data && !loading && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span style={{ fontFamily: 'Instrument Serif', fontSize: 24, fontStyle: 'italic' }}>{data.name}</span>
            <span className="ticker-badge">{data.ticker}</span>
            {data.sector && <span className="tag tag-accent">{data.sector}</span>}
          </div>

          {data.investment_rationale && (
            <RecBanner recommendation={`Investment Verdict: ${data.health_scores?.overall >= 65 ? 'Attractive' : data.health_scores?.overall >= 45 ? 'Neutral' : 'Unattractive'}`}
              detail={data.investment_rationale}
              riskLevel={riskProfile.tolerance}
              score={data.health_scores?.overall ?? 0} />
          )}

          <div className="kpi-grid animate-in animate-in-1">
            <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <ScoreRing value={data.health_scores?.overall} label="Health" size={80} />
              <div>
                <div className="card-title">Health Score</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>Composite financial</div>
              </div>
            </div>
            <KPICard label="Base Valuation" value={fmtMoney(data.valuation?.base)} color="var(--gold)"
              sub={`Range: ${fmtMoney(data.valuation?.low)} – ${fmtMoney(data.valuation?.high)}`} />
            <KPICard label="Current Ratio" value={fmtNum(data.financial_summary?.current_ratio)}
              sub={data.financial_summary?.current_ratio >= 1 ? 'Healthy liquidity ✓' : '⚠ Below 1.0'}
              color={data.financial_summary?.current_ratio >= 1 ? 'var(--green)' : 'var(--red)'} />
            <KPICard label="Revenue" value={fmtMoney(data.financial_summary?.revenue)} />
            <KPICard label="EBITDA" value={fmtMoney(data.financial_summary?.ebitda)} />
            <KPICard label="Free Cash Flow" value={fmtMoney(data.financial_summary?.free_cash_flow)}
              color={(data.financial_summary?.free_cash_flow || 0) > 0 ? 'var(--green)' : 'var(--red)'} />
            <KPICard label="Profit Margin" value={fmtPct(data.financial_summary?.profit_margin)}
              color={(data.financial_summary?.profit_margin || 0) > 0.1 ? 'var(--green)' : 'var(--gold)'} />
            <KPICard label="Confidence" value={`${data.valuation?.confidence ?? '—'}${data.valuation?.confidence == null ? '' : '%'}`} sub={`${data.valuation?.methods_used ?? '—'} methods`} />
          </div>

          <div className="grid-2 animate-in animate-in-2">
            {/* Valuation range chart */}
            <div className="card">
              <div className="card-title">Valuation Scenarios (USD Millions)</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={valData}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={v => [`$${v.toLocaleString()}M`, 'Valuation']} />
                  <Bar dataKey="value" radius={[6,6,0,0]}>
                    {valData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
                {['DCF', 'P/E', 'EV/EBITDA', 'P/S', 'P/B'].map(m => (
                  <span key={m} className="tag tag-neutral" style={{ fontSize: 10 }}>{m}</span>
                ))}
              </div>
            </div>

            {/* Health breakdown */}
            <div className="card">
              <div className="card-title">Financial Health Breakdown</div>
              <ScoreBar label="Liquidity" value={data.health_scores?.liquidity} />
              <ScoreBar label="Profitability" value={data.health_scores?.profitability} />
              <ScoreBar label="Growth" value={data.health_scores?.growth} />
              <ScoreBar label="Leverage" value={data.health_scores?.leverage} />
              <ScoreBar label="Free Cash Flow" value={data.health_scores?.fcf} />
            </div>

            {/* Income statement */}
            <div className="card">
              <div className="card-title">Income Statement</div>
              <MetricRow label="Revenue" value={fmtMoney(data.financial_summary?.revenue)} />
              <MetricRow label="EBITDA" value={fmtMoney(data.financial_summary?.ebitda)} />
              <MetricRow label="Net Income" value={fmtMoney(data.financial_summary?.net_income)} highlight />
              <MetricRow label="Free Cash Flow" value={fmtMoney(data.financial_summary?.free_cash_flow)} />
              <MetricRow label="Gross Profit" value={fmtMoney(data.financial_summary?.gross_profit)} />
              <MetricRow label="Revenue Growth" value={fmtPct(data.financial_summary?.revenue_growth)} />
            </div>

            {/* Balance sheet */}
            <div className="card">
              <div className="card-title">Balance Sheet Key Metrics</div>
              <MetricRow label="Total Assets" value={fmtMoney(data.financial_summary?.total_assets)} />
              <MetricRow label="Total Debt" value={fmtMoney(data.financial_summary?.total_debt)} />
              <MetricRow label="Current Ratio" value={fmtNum(data.financial_summary?.current_ratio)} highlight />
              <MetricRow label="Debt / Equity" value={fmtNum(data.financial_summary?.debt_to_equity)} />
              <MetricRow label="P/E Ratio" value={fmtNum(data.ratios?.price_to_earnings)} />
              <MetricRow label="EV/EBITDA" value={fmtNum(data.ratios?.ev_to_ebitda)} />
            </div>

            {/* Revenue chart */}
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div className="card-title">Revenue History (USD Millions)</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={(data.revenue_history || []).map(h => ({ period: h.period?.slice(0,4), Revenue: Math.round((h.value||0)/1e6) })).reverse()}>
                  <defs>
                    <linearGradient id="vRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--gold)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="period" tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="Revenue" stroke="var(--gold)" fill="url(#vRevGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}