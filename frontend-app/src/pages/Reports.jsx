import { useState } from 'react'
import { FileText, Download, ChevronRight } from 'lucide-react'

const REPORT_SECTIONS = [
  { id: 'exec', title: 'Executive Summary', desc: 'High-level investment thesis and recommendation' },
  { id: 'val', title: 'Valuation Analysis', desc: 'DCF, multiples, and comparable company analysis' },
  { id: 'merger', title: 'Merger Feasibility', desc: 'Probability scoring, synergy analysis, integration risk' },
  { id: 'esg', title: 'ESG Assessment', desc: 'GNN-enhanced sustainability scoring and risk factors' },
  { id: 'risk', title: 'Risk Evaluation', desc: 'Risk-tolerance adjusted scoring and mitigation framework' },
  { id: 'sources', title: 'Sources & Citations', desc: 'All referenced data sources with links' },
]

const RECENT = [
  { id: 'RPT-001', name: 'AAPL × MSFT Merger Analysis', date: '2025-01-15', type: 'Merger', score: 68 },
  { id: 'RPT-002', name: 'NVDA Valuation Report', date: '2025-01-14', type: 'Valuation', score: 82 },
  { id: 'RPT-003', name: 'TSLA ESG Assessment', date: '2025-01-13', type: 'ESG', score: 55 },
]

export default function Reports() {
  const [selected, setSelected] = useState([])

  function toggleSection(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleExport() {
    alert('In production, this generates a formatted PDF report with all analysis data, citations, and visualizations. Connect the backend and use the /reports/generate endpoint.')
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title"><FileText size={20} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />Reports & Exports</h1>
        <p className="page-subtitle">Generate comprehensive PDF reports with citations, analysis, and recommendations</p>
      </div>

      <div className="grid-2 animate-in">
        {/* Report builder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-title">Build Custom Report</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14 }}>Select sections to include in your export:</div>
            {REPORT_SECTIONS.map(sec => (
              <div key={sec.id} onClick={() => toggleSection(sec.id)}
                style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'flex-start' }}>
                <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${selected.includes(sec.id) ? 'var(--accent)' : 'var(--border)'}`,
                  background: selected.includes(sec.id) ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  {selected.includes(sec.id) && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{sec.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{sec.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleExport} disabled={selected.length === 0}>
                <Download size={14} /> Export PDF Report
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setSelected(REPORT_SECTIONS.map(s => s.id))}>
                Select All
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Report Includes</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8 }}>
              ✓ Source title, publisher, and URL for every claim<br/>
              ✓ Publication dates and reliability scores<br/>
              ✓ Extracted claims and model feature impact<br/>
              ✓ Direction of impact (positive/negative/mixed)<br/>
              ✓ Risk-tolerance adjusted final scores<br/>
              ✓ Composite score breakdown with weights<br/>
              ✓ AI-generated merger insights narrative
            </div>
          </div>
        </div>

        {/* Recent reports */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-title">Recent Reports</div>
            {RECENT.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => alert(`Report ${r.id} — connect to backend /reports/${r.id} to load saved reports`)}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>
                    {r.type} · {r.date} · Score: {r.score}/100
                  </div>
                </div>
                <ChevronRight size={14} color="var(--text-3)" />
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Scoring Framework</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 2 }}>
              {[
                ['Financial Health', '30%'],
                ['Valuation Attractiveness', '20%'],
                ['Merger Feasibility', '20%'],
                ['ESG Network Score', '15%'],
                ['Strategic Momentum', '10%'],
                ['User Article Impact', '5%'],
              ].map(([label, weight]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', padding: '5px 0' }}>
                  <span>{label}</span>
                  <span style={{ fontFamily: 'DM Mono', color: 'var(--accent)' }}>{weight}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-2)', borderRadius: 8, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
              Final score applies a risk-tolerance adjustment: Conservative (−8 pts), Moderate (±0), Aggressive (+6 pts)
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}