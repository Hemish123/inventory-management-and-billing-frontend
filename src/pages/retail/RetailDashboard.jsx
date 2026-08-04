import { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import { getDashboardStats, getSalesTrend, getTopProducts, getLowStockReport } from '../../api/reportsAPI';
import { formatCurrency } from '../../utils/formatters';
import {
  IndianRupee, ShoppingCart, Package, AlertTriangle,
  TrendingUp, ArrowUpRight, ArrowDownRight, Truck
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, subtext, color, trend }) {
  return (
    <div className="glass-card p-5 flex items-start gap-4 group hover:shadow-lg transition-all duration-300">
      <div className={`p-3 rounded-xl ${color} transition-transform group-hover:scale-110 duration-300`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-1 font-sora">{value}</p>
        {subtext && (
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
            {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-rose-500" />}
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

function SalesChart({ data }) {
  if (!data || data.length === 0) return <p className="text-slate-400 text-sm p-4">No sales data yet</p>;

  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="flex items-end gap-1 h-48 px-2">
      {data.map((d, i) => {
        const height = (d.revenue / maxRevenue) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center group relative">
            <div className="absolute -top-8 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {formatCurrency(d.revenue)} • {d.bills} bills
            </div>
            <div
              className="w-full rounded-t-sm bg-gradient-to-t from-indigo-500 to-indigo-400 hover:from-indigo-600 hover:to-indigo-500 transition-all duration-200 cursor-pointer min-h-[2px]"
              style={{ height: `${Math.max(height, 1)}%` }}
            />
            {i % 5 === 0 && (
              <span className="text-[9px] text-slate-400 mt-1 rotate-45 origin-left">
                {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TopProductsTable({ data }) {
  if (!data || data.length === 0) return <p className="text-slate-400 text-sm p-4">No sales data yet</p>;

  return (
    <div className="divide-y divide-slate-100">
      {data.map((p, i) => (
        <div key={i} className="flex items-center justify-between py-3 px-1 hover:bg-slate-50/50 rounded-lg transition-colors">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
            <div>
              <p className="text-sm font-medium text-slate-700">{p.product_name}</p>
              <p className="text-xs text-slate-400">{p.barcode}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-700">{formatCurrency(p.total_revenue)}</p>
            <p className="text-xs text-slate-400">{p.total_quantity} units</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function LowStockAlerts({ data }) {
  if (!data || data.length === 0) return <p className="text-emerald-500 text-sm p-4 font-medium">✓ All stock levels healthy</p>;

  return (
    <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
      {data.slice(0, 10).map((item, i) => (
        <div key={i} className="flex items-center justify-between py-2.5 px-1">
          <div>
            <p className="text-sm font-medium text-slate-700">{item.product_name}</p>
            <p className="text-xs text-slate-400">{item.branch}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              {item.current_stock}/{item.minimum_level}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RetailDashboard() {
  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [s, t, p, l] = await Promise.all([
      getDashboardStats(),
      getSalesTrend(),
      getTopProducts(),
      getLowStockReport(),
    ]);
    if (s.data?.data) setStats(s.data.data);
    if (t.data?.data) setTrend(t.data.data);
    if (p.data?.data) setTopProducts(p.data.data);
    if (l.data?.data) setLowStock(l.data.data);
    setLoading(false);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="Dashboard" />
      <div className="p-6 space-y-6">
        {loading ? (
          <div className="p-6"><SkeletonTable rows={4} cols={4} /></div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={IndianRupee} label="Today's Revenue" color="bg-gradient-to-br from-emerald-500 to-emerald-600"
                value={formatCurrency(stats?.today_revenue || 0)}
                subtext={`${stats?.today_bills || 0} bills today`} trend="up" />
              <StatCard icon={TrendingUp} label="Monthly Revenue" color="bg-gradient-to-br from-indigo-500 to-indigo-600"
                value={formatCurrency(stats?.month_revenue || 0)}
                subtext={`${stats?.month_bills || 0} bills this month`} trend="up" />
              <StatCard icon={Package} label="Total Products" color="bg-gradient-to-br from-violet-500 to-violet-600"
                value={stats?.total_products || 0}
                subtext="Active products" />
              <StatCard icon={AlertTriangle} label="Low Stock Alerts" color="bg-gradient-to-br from-amber-500 to-amber-600"
                value={stats?.low_stock_alerts || 0}
                subtext={`${stats?.pending_purchases || 0} pending POs`} trend={stats?.low_stock_alerts > 0 ? 'down' : 'up'} />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 glass-card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" /> Sales Trend (Last 30 Days)
                </h3>
                <SalesChart data={trend} />
              </div>
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-emerald-500" /> Top Selling Products
                </h3>
                <TopProductsTable data={topProducts} />
              </div>
            </div>

            {/* Low Stock Alerts */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Low Stock Alerts
              </h3>
              <LowStockAlerts data={lowStock} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
