import { LayoutDashboard, FlaskConical, TrendingUp, FileText, Leaf, BarChart3, Settings, Newspaper } from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'merger', label: 'Merger Lab', icon: FlaskConical },
  { id: 'valuation', label: 'Valuation', icon: TrendingUp },
  { id: 'articles', label: 'Article Analyzer', icon: Newspaper },
  { id: 'esg', label: 'ESG Graph', icon: Leaf },
  { id: 'reports', label: 'Reports', icon: FileText },
]

export default function Sidebar({ currentPage, navigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">SELVAM</div>
        <div className="logo-sub">M&amp;A Intelligence Platform</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Navigation</div>
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${currentPage === id ? 'active' : ''}`}
            onClick={() => navigate(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="api-badge">
          SEC · FMP · Finnhub<br/>NewsAPI · ESG Book
        </div>
      </div>
    </aside>
  )
}