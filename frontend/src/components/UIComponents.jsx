import { scoreColor, scoreLabel, fmtMaybeScore } from '../utils/api'

// Circular score ring
export function ScoreRing({ value, label, size = 90, color }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const safeValue = value ?? 0
  const fill = (safeValue / 100) * circ
  const c = color || scoreColor(safeValue)

  return (
    <div className="score-ring-container">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth="6" />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none"
          stroke={c}
          strokeWidth="6"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ filter: `drop-shadow(0 0 6px ${c}60)`, transition: 'stroke-dasharray 1s cubic-bezier(0.16,1,0.3,1)' }}
        />
        <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
          fill={c} fontSize="18" fontWeight="600" fontFamily="DM Mono, monospace">
          {value === null || value === undefined ? '—' : Math.round(value)}
        </text>
      </svg>
      {label && <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: 'DM Mono' }}>{label}</span>}
    </div>
  )
}

// Merger probability gauge
export function MergerGauge({ probability }) {
  const p = probability ?? 0
  const angle = -135 + (p / 100) * 270
  const c = scoreColor(p)

  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 200 130" width="200" height="130">
        {/* Background arc */}
        <path d="M 20 110 A 80 80 0 1 1 180 110" fill="none" stroke="var(--bg-3)" strokeWidth="14" strokeLinecap="round" />
        {/* Zones */}
        <path d="M 20 110 A 80 80 0 0 1 65 38" fill="none" stroke="rgba(239,68,68,0.35)" strokeWidth="14" strokeLinecap="round" />
        <path d="M 65 38 A 80 80 0 0 1 135 38" fill="none" stroke="rgba(245,158,11,0.35)" strokeWidth="14" />
        <path d="M 135 38 A 80 80 0 0 1 180 110" fill="none" stroke="rgba(16,185,129,0.35)" strokeWidth="14" strokeLinecap="round" />
        {/* Needle */}
        <line
          x1="100" y1="110"
          x2="100" y2="40"
          stroke={c}
          strokeWidth="3"
          strokeLinecap="round"
          style={{ transformOrigin: '100px 110px', transform: `rotate(${angle}deg)`, filter: `drop-shadow(0 0 4px ${c})`, transition: 'transform 1.2s cubic-bezier(0.16,1,0.3,1)' }}
        />
        <circle cx="100" cy="110" r="6" fill={c} style={{ filter: `drop-shadow(0 0 6px ${c})` }} />
        {/* Value */}
        <text x="100" y="92" textAnchor="middle" fill={c} fontSize="26" fontWeight="600" fontFamily="DM Mono, monospace">{Math.round(p)}%</text>
        <text x="100" y="106" textAnchor="middle" fill="var(--text-3)" fontSize="9" fontFamily="DM Mono" letterSpacing="1">PROBABILITY</text>
        {/* Labels */}
        <text x="18" y="125" textAnchor="middle" fill="var(--red)" fontSize="8" fontFamily="DM Mono">LOW</text>
        <text x="100" y="20" textAnchor="middle" fill="var(--gold)" fontSize="8" fontFamily="DM Mono">MED</text>
        <text x="182" y="125" textAnchor="middle" fill="var(--green)" fontSize="8" fontFamily="DM Mono">HIGH</text>
      </svg>
    </div>
  )
}

// KPI Card
export function KPICard({ label, value, sub, color, prefix = '', suffix = '', trend }) {
  const c = color || 'var(--text-1)'
  return (
    <div className="card">
      <div className="card-title">{label}</div>
      <div className="card-value" style={{ color: c }}>
        {prefix}{value}{suffix}
      </div>
      {sub && <div className="card-sub">{sub}</div>}
      {trend !== undefined && (
        <div style={{ marginTop: 6, fontSize: 11, color: trend >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'DM Mono' }}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  )
}

// Score bar row
export function ScoreBar({ label, value, color }) {
  const c = value === null || value === undefined ? 'var(--text-3)' : (color || scoreColor(value))
  return (
    <div className="esg-bar-row">
      <div className="esg-bar-header">
        <span className="esg-bar-label">{label}</span>
        <span className="esg-bar-val" style={{ color: c }}>{fmtMaybeScore(value)}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${value ?? 0}%`, background: c }} />
      </div>
    </div>
  )
}

// Loading state
export function Loading({ text = 'Fetching data...' }) {
  return (
    <div className="loading-state">
      <div className="loading-spinner" />
      <span className="loading-text">{text}</span>
    </div>
  )
}

// Recommendation banner
export function RecBanner({ recommendation, detail, riskLevel, score }) {
  const isGood = score >= 70
  const isMid = score >= 50 && score < 70
  const cls = isGood ? 'alert-success' : isMid ? 'alert-warning' : 'alert-danger'

  return (
    <div className={`rec-banner ${cls}`} style={{ borderRadius: 'var(--radius-lg)' }}>
      <div style={{ flex: 1 }}>
        <div className="rec-label">AI Recommendation</div>
        <div className="rec-text">{recommendation}</div>
        {detail && <div className="rec-detail">{detail}</div>}
      </div>
      {riskLevel && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontFamily: 'DM Mono', letterSpacing: 1.5, opacity: 0.7, textTransform: 'uppercase', marginBottom: 4 }}>Risk Level</div>
          <span className={`score-badge ${isGood ? 'score-high' : isMid ? 'score-mid' : 'score-low'}`}>{riskLevel}</span>
        </div>
      )}
    </div>
  )
}

// News item
export function NewsItem({ article }) {
  const sentColor = (article.sentiment === 'positive' || article.sentiment > 0)
    ? 'var(--green)' : (article.sentiment === 'negative' || article.sentiment < 0)
    ? 'var(--red)' : 'var(--text-3)'

  return (
    <div className="news-item">
      <div className="news-title">
        {article.url
          ? <a href={article.url} target="_blank" rel="noreferrer" className="citation-link">{article.title || 'Untitled'}</a>
          : <span>{article.title || 'Untitled'}</span>
        }
      </div>
      <div className="news-meta">
        <span>{article.publisher || article.source || ''}</span>
        {article.date && <span>{article.date.slice(0, 10)}</span>}
        <span style={{ color: sentColor }}>●</span>
      </div>
    </div>
  )
}

// Metric row
export function MetricRow({ label, value, highlight }) {
  return (
    <div className="metric-row">
      <span className="metric-label">{label}</span>
      <span className="metric-value" style={highlight ? { color: 'var(--accent)' } : {}}>{value}</span>
    </div>
  )
}

// Company search autocomplete
export function TickerInput({ label, value, onChange, placeholder = 'e.g. AAPL' }) {
  return (
    <div className="input-group">
      {label && <label className="input-label">{label}</label>}
      <input
        className="input-field"
        value={value}
        onChange={e => onChange(e.target.value.toUpperCase())}
        placeholder={placeholder}
        style={{ letterSpacing: 1 }}
      />
    </div>
  )
}