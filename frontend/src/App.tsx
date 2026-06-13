import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, TrendingUp } from 'lucide-react'
import DashboardPage from './pages/DashboardPage'
import DebtorsPage from './pages/DebtorsPage'
import LoanDetailPage from './pages/LoanDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-gray-50">
        {/* ── Header/Nav ─────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-md">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-700" />
              <span className="font-bold text-base tracking-tight text-gray-900">CrediControl</span>
            </div>
            <nav className="flex gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gray-50 text-gray-900'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                  }`
                }
              >
                <LayoutDashboard size={15} />
                <span>Dashboard</span>
              </NavLink>
              <NavLink
                to="/debtors"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gray-50 text-gray-900'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                  }`
                }
              >
                <Users size={15} />
                <span>Devedores</span>
              </NavLink>
            </nav>
          </div>
        </header>

        {/* ── Main Content ───────────────────────────────────────── */}
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/debtors" element={<DebtorsPage />} />
            <Route path="/loans/:id" element={<LoanDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
