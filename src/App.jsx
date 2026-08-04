import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ErrorBoundary from './components/common/ErrorBoundary';
import Sidebar from './components/common/Sidebar';

// Lazy load pages for code splitting
const Login = lazy(() => import('./pages/Login'));
const Settings = lazy(() => import('./pages/Settings'));
const Customers = lazy(() => import('./pages/Customers'));
const AddCustomer = lazy(() => import('./pages/customers/AddCustomer'));
const RetailDashboard = lazy(() => import('./pages/retail/RetailDashboard'));
const POSPage = lazy(() => import('./pages/retail/POSPage'));
const ProductsPage = lazy(() => import('./pages/retail/ProductsPage'));
const BillsPage = lazy(() => import('./pages/retail/BillsPage'));
const StockPage = lazy(() => import('./pages/retail/StockPage'));
const BranchesPage = lazy(() => import('./pages/retail/BranchesPage'));
const PurchasesPage = lazy(() => import('./pages/retail/PurchasesPage'));
const SuppliersPage = lazy(() => import('./pages/retail/SuppliersPage'));
const StockTransfersPage = lazy(() => import('./pages/retail/StockTransfersPage'));
const ReportsPage = lazy(() => import('./pages/retail/ReportsPage'));
const UsersPage = lazy(() => import('./pages/Users'));

function PrivateRoute({ children }) {
  const { isAuthenticated } = useSelector((s) => s.auth);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-mesh">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
        </div>
      }>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* ─── RetailTrack Routes ─── */}
          <Route path="/dashboard" element={<PrivateRoute><AppLayout><RetailDashboard /></AppLayout></PrivateRoute>} />
          <Route path="/pos" element={<PrivateRoute><AppLayout><POSPage /></AppLayout></PrivateRoute>} />
          <Route path="/products" element={<PrivateRoute><AppLayout><ProductsPage /></AppLayout></PrivateRoute>} />
          <Route path="/bills" element={<PrivateRoute><AppLayout><BillsPage /></AppLayout></PrivateRoute>} />
          <Route path="/stock" element={<PrivateRoute><AppLayout><StockPage /></AppLayout></PrivateRoute>} />
          <Route path="/stock-transfers" element={<PrivateRoute><AppLayout><StockTransfersPage /></AppLayout></PrivateRoute>} />
          <Route path="/purchases" element={<PrivateRoute><AppLayout><PurchasesPage /></AppLayout></PrivateRoute>} />
          <Route path="/suppliers" element={<PrivateRoute><AppLayout><SuppliersPage /></AppLayout></PrivateRoute>} />
          <Route path="/branches" element={<PrivateRoute><AppLayout><BranchesPage /></AppLayout></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><AppLayout><ReportsPage /></AppLayout></PrivateRoute>} />

          {/* ─── Customers ─── */}
          <Route path="/customers" element={<PrivateRoute><AppLayout><Customers /></AppLayout></PrivateRoute>} />
          <Route path="/customers/add" element={<PrivateRoute><AppLayout><AddCustomer /></AppLayout></PrivateRoute>} />
          <Route path="/customers/edit/:id" element={<PrivateRoute><AppLayout><AddCustomer /></AppLayout></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><AppLayout><Settings /></AppLayout></PrivateRoute>} />
          <Route path="/users" element={<PrivateRoute><AppLayout><UsersPage /></AppLayout></PrivateRoute>} />

          {/* ─── Redirects ─── */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
