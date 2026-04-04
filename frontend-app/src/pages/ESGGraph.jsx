import { useState } from 'react'
import { Leaf } from 'lucide-react'
import { api, scoreColor } from '../utils/api'
import { ScoreRing, Loading, ScoreBar, MetricRow } from '../components/UIComponents'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'

export default function ESGGraph({ globalTickers }) {
  const [ticker, setTicker] = useState(globalTickers.x || '')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  async function handleBuild() {
    if (!ticker) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.buildESGGraph(ticker)
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const radarData = data ? [
    { subject: 'Environmental', value: data.scores?.environmental || 0 },
    { subject: 'Social', value: data.scores?.social || 0 },
    { subject: 'Governance', value: data.scores?.governance || 0 },
    { subject: 'Network', value: data.scores?.network_strength || 0 },
    { subject: 'Overall ESG', value: data.scores?.overall_esg || 0 },
  ] : []

  const nodes = data?.graph_nodes || []
  const edges = data?.graph_edges || []

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title"><Leaf size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />ESG Graph</h1>
        <p className="page-subtitle">Graph Neural Network-inspired ESG scoring with network propagation analysis</p>
      </div>

      <div className="card animate-in" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div className="input-group" style={{ flex: 1 }}>
          <label className="input-label">Company Ticker</label>
          <input className="input-field" value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
            placeholder="Enter ticker..." onKeyDown={e => e.key === 'Enter' && handleBuild()} />
        </div>
        <button className="btn btn-primary" onClick={handleBuild} disabled={loading || !ticker}>
          {loading ? <span className="loading-spinner" style={{ width: 15, height: 15 }} /> : <Leaf size={14} />}
          Build ESG Graph
        </button>
      </div>

      {error && <div className="alert-banner alert-danger">{error}</div>}
      {loading && <Loading text="Computing ESG graph with GNN message passing..." />}

      {data && !loading && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontFamily: 'Instrument Serif', fontSize: 20, fontStyle: 'italic' }}>ESG Analysis — {data.ticker}</span>
            <span className={`score-badge ${data.scores?.overall_esg >= 60 ? 'score-high' : 'score-mid'}`}>
              ESG {data.scores?.overall_esg == null ? 'Unavailable' : `${Math.round(data.scores.overall_esg)}/100`}
            </span>
          </div>

          <div className="grid-2 animate-in animate-in-1">
            {/* Radar */}
            <div className="card">
              <div className="card-title">ESG Radar (GNN-Enhanced)</div>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'var(--text-3)', fontSize: 9 }} />
                  <Radar name="ESG" dataKey="value" stroke="var(--teal)" fill="var(--teal)" fillOpacity={0.2} strokeWidth={2} />
                  <Tooltip contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Scores */}
            <div className="card">
              <div className="card-title">ESG Component Scores</div>
              <ScoreBar label="Overall ESG" value={data.scores?.overall_esg} color="var(--teal)" />
              <ScoreBar label="Environmental (E)" value={data.scores?.environmental} color="var(--green)" />
              <ScoreBar label="Social (S)" value={data.scores?.social} color="var(--accent)" />
              <ScoreBar label="Governance (G)" value={data.scores?.governance} color="var(--purple)" />
              <ScoreBar label="Network Strength" value={data.scores?.network_strength} color="var(--gold)" />
              <div className="divider" />
              <MetricRow label="Governance Risk" value={data.scores?.governance_risk == null ? 'Unavailable' : `${Math.round(data.scores.governance_risk)}/100`} />
              <MetricRow label="Controversy Score" value={(data.scores?.controversy_score || 0).toFixed(2)} />
              <MetricRow label="Sustainability Trend" value={data.scores?.sustainability_trend || 'stable'} highlight />
            </div>

            {/* Graph visualization */}
            <div className="card" style={{ gridColumn: 'span 2' }}>
              <div className="card-title">Graph Structure ({nodes.length} nodes, {edges.length} edges)</div>
              <div style={{ position: 'relative', height: 200, background: 'var(--bg-2)', borderRadius: 8, overflow: 'hidden' }}>
                <svg width="100%" height="200" viewBox="0 0 800 200">
                  {/* Render edges */}
                  {edges.map((e, i) => {
                    const srcIdx = nodes.findIndex(n => n.id === e.source)
                    const tgtIdx = nodes.findIndex(n => n.id === e.target)
                    const sx = 100 + srcIdx * 140, sy = 100
                    const tx = 100 + tgtIdx * 140, ty = 100
                    return <line key={i} x1={sx} y1={sy} x2={tx} y2={ty}
                      stroke="var(--border-accent)" strokeWidth={e.weight * 3} strokeOpacity={0.6} />
                  })}
                  {/* Render nodes */}
                  {nodes.map((n, i) => {
                    const x = 100 + i * 140, y = 100
                    const color = n.type === 'company' ? 'var(--accent)' : n.type === 'esg_topic' ? 'var(--teal)' : 'var(--gold)'
                    const score = n.esg_score ?? n.score ?? null
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r={n.type === 'company' ? 28 : 20} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} />
                        <text x={x} y={y-3} textAnchor="middle" fill={color} fontSize="12" fontFamily="DM Mono">{n.id.split('_').pop()?.slice(0,4).toUpperCase()}</text>
                        <text x={x} y={y+12} textAnchor="middle" fill="var(--text-3)" fontSize="9" fontFamily="DM Mono">{fmtMaybeScore(score)}</text>
                      </g>
                    )
                  })}
                </svg>
                <div style={{ position: 'absolute', bottom: 8, right: 12, display: 'flex', gap: 12 }}>
                  {[['var(--accent)', 'Company'], ['var(--teal)', 'ESG Topic'], ['var(--gold)', 'Factor']].map(([c, l]) => (
                    <div key={l} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 10, color: 'var(--text-3)', fontFamily: 'DM Mono' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Key issues */}
            <div className="card">
              <div className="card-title">Key ESG Issues</div>
              {(data.scores?.key_issues || []).map((issue, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--teal)', fontSize: 11 }}>●</span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{issue}</span>
                </div>
              ))}
            </div>

            {/* Methodology */}
            <div className="card">
              <div className="card-title">GNN Methodology</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8 }}>
                <p style={{ marginBottom: 8 }}>SELVAM's ESG scoring uses a <strong style={{ color: 'var(--teal)' }}>Graph Neural Network (GNN)</strong> approach inspired by social network analysis.</p>
                <p style={{ marginBottom: 8 }}>Node types: Companies, Executives, Suppliers, Investors, ESG Topics, News Articles, Incidents</p>
                <p style={{ marginBottom: 8 }}>Edge types: acquired, invested_in, board_overlap, co-mentioned, ESG_incident, governance_link</p>
                <p>GNN propagates scores via message-passing (GraphSAGE/GAT style), incorporating news sentiment, relationship networks, controversy counts, and recency signals.</p>
              </div>
              <div style={{ marginTop: 12 }}>
                <span className="tag tag-teal" style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}>NetworkX</span>
                {' '}
                <span className="tag tag-teal" style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}>PyTorch Geometric</span>
                {' '}
                <span className="tag tag-accent">ESG Book</span>
                {' '}
                <span className="tag tag-neutral">Finnhub ESG</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}