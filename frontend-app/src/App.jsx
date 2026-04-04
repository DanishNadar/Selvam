import { useState } from 'react'
import Dashboard from './components/Dashboard'
import MergerLab from './pages/MergerLab'
import ValuationPage from './pages/ValuationPage'
import ArticleAnalyzer from './pages/ArticleAnalyzer'
import ESGGraph from './pages/ESGGraph'
import Reports from './pages/Reports'
import Sidebar from './components/Sidebar'
import './styles/globals.css'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [globalTickers, setGlobalTickers] = useState({ x: '', y: '' })
  const [riskProfile, setRiskProfile] = useState({
    tolerance: 'moderate',
    horizon: '3Y',
    esgImportance: 0.5,
  })

  const pages = {
    dashboard: (
      <Dashboard
        globalTickers={globalTickers}
        setGlobalTickers={setGlobalTickers}
        riskProfile={riskProfile}
        setRiskProfile={setRiskProfile}
        navigate={setPage}
      />
    ),
    merger: (
      <MergerLab
        globalTickers={globalTickers}
        setGlobalTickers={setGlobalTickers}
        riskProfile={riskProfile}
      />
    ),
    valuation: <ValuationPage globalTickers={globalTickers} riskProfile={riskProfile} />,
    articles: <ArticleAnalyzer globalTickers={globalTickers} />,
    esg: <ESGGraph globalTickers={globalTickers} />,
    reports: <Reports />,
  }

  return (
    <div className="app-shell">
      <Sidebar currentPage={page} navigate={setPage} />
      <main className="main-content">{pages[page] || pages.dashboard}</main>
    </div>
  )
}
