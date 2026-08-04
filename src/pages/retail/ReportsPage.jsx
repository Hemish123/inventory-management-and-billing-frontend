import { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import {
  getSalesReport, getPurchaseReport, getInventoryReport, getTopProducts,
  getLowStockReport, getDeadStockReport, getBranchSalesReport,
  getSupplierPurchaseReport, getCustomerPurchaseReport,
  getProfitReport, getStockValuation, exportCSV,
} from '../../api/reportsAPI';
import { getBranchDropdown } from '../../api/coreAPI';
import {
  BarChart3, TrendingUp, Package, AlertTriangle, Skull, MapPin,
  Truck, Users, DollarSign, Warehouse, Download, Calendar,
  ArrowUp, ArrowDown, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const today = new Date().toISOString().split('T')[0];
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

const REPORT_CARDS = [
  { id: 'sales', label: 'Sales Report', desc: 'Revenue by date range', icon: TrendingUp, color: 'emerald' },
  { id: 'purchases', label: 'Purchase Report', desc: 'Purchase orders summary', icon: Truck, color: 'blue' },
  { id: 'inventory', label: 'Inventory Report', desc: 'Branch-wise stock levels', icon: Package, color: 'violet' },
  { id: 'top-products', label: 'Top Products', desc: 'Best-selling items', icon: BarChart3, color: 'amber' },
  { id: 'low-stock', label: 'Low Stock Alert', desc: 'Below minimum levels', icon: AlertTriangle, color: 'rose' },
  { id: 'dead-stock', label: 'Dead Stock', desc: 'No sales in 90 days', icon: Skull, color: 'slate' },
  { id: 'branch-sales', label: 'Branch Sales', desc: 'Compare branch performance', icon: MapPin, color: 'indigo' },
  { id: 'supplier-purchases', label: 'Supplier Purchases', desc: 'Purchases by supplier', icon: Truck, color: 'cyan' },
  { id: 'customer-purchases', label: 'Customer Purchases', desc: 'Top customers by spend', icon: Users, color: 'purple' },
  { id: 'profit', label: 'Profit Report', desc: 'Revenue vs cost analysis', icon: DollarSign, color: 'emerald' },
  { id: 'stock-valuation', label: 'Stock Valuation', desc: 'Total inventory value', icon: Warehouse, color: 'orange' },
];

const FETCHERS = {
  'sales': getSalesReport,
  'purchases': getPurchaseReport,
  'inventory': getInventoryReport,
  'top-products': getTopProducts,
  'low-stock': getLowStockReport,
  'dead-stock': getDeadStockReport,
  'branch-sales': getBranchSalesReport,
  'supplier-purchases': getSupplierPurchaseReport,
  'customer-purchases': getCustomerPurchaseReport,
  'profit': getProfitReport,
  'stock-valuation': getStockValuation,
};

const EXPORTABLE = ['sales', 'inventory', 'low-stock'];

function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function ReportsPage() {
  const [active, setActive] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({ start_date: monthStart, end_date: today, branch: '' });

  useEffect(() => { getBranchDropdown().then(r => { if (r.data?.data) setBranches(r.data.data); }); }, []);

  const loadReport = async (reportId) => {
    setActive(reportId);
    setData(null);
    setLoading(true);
    const fetcher = FETCHERS[reportId];
    if (!fetcher) { setLoading(false); return; }
    const params = {};
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
    if (filters.branch) params.branch = filters.branch;
    const { data: res, error } = await fetcher(params);
    setLoading(false);
    if (res?.data) setData(res.data);
    else if (error) toast.error(error);
  };

  const handleExport = async () => {
    try {
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.branch) params.branch = filters.branch;
      const res = await exportCSV(active, params);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${active}_report.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
  };

  const renderReportGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {REPORT_CARDS.map(card => {
        const Icon = card.icon;
        return (
          <button key={card.id} onClick={() => loadReport(card.id)}
            className={`text-left p-5 rounded-2xl border transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group ${active === card.id ? `bg-${card.color}-50 border-${card.color}-200 shadow-md` : 'bg-white border-slate-100 hover:border-slate-200'}`}>
            <div className={`w-10 h-10 rounded-xl bg-${card.color}-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
              <Icon className={`w-5 h-5 text-${card.color}-500`} />
            </div>
            <h3 className="font-semibold text-sm text-slate-800">{card.label}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{card.desc}</p>
          </button>
        );
      })}
    </div>
  );

  const renderTable = (rows, columns) => {
    if (!rows || !rows.length) return <p className="text-slate-400 text-center py-8">No data available</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">{columns.map(c => <th key={c.key} className="text-left py-3 px-4 font-semibold text-slate-500 text-xs uppercase tracking-wider">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                {columns.map(c => <td key={c.key} className="py-3 px-4 text-slate-700">{c.render ? c.render(row[c.key], row) : row[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderReportData = () => {
    if (!active) return null;
    if (loading) return <div className="glass-card p-6"><SkeletonTable rows={8} cols={5} /></div>;
    if (!data) return null;

    // Sales Report
    if (active === 'sales' && data.summary) return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Revenue', val: fmt(data.summary.total_revenue), color: 'emerald' },
            { label: 'Total Tax', val: fmt(data.summary.total_tax), color: 'blue' },
            { label: 'Total Discount', val: fmt(data.summary.total_discount), color: 'amber' },
            { label: 'Total Bills', val: data.summary.total_bills, color: 'violet' },
          ].map(s => (
            <div key={s.label} className={`glass-card p-4`}>
              <p className="text-xs text-slate-400 font-medium">{s.label}</p>
              <p className={`text-xl font-bold text-${s.color}-600 mt-1`}>{s.val}</p>
            </div>
          ))}
        </div>
        {renderTable(data.daily, [
          { key: 'date', label: 'Date' },
          { key: 'revenue', label: 'Revenue', render: v => fmt(v) },
          { key: 'tax', label: 'Tax', render: v => fmt(v) },
          { key: 'discount', label: 'Discount', render: v => fmt(v) },
          { key: 'bills', label: 'Bills' },
        ])}
      </div>
    );

    // Profit
    if (active === 'profit') return (
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Revenue', val: fmt(data.total_revenue), color: 'emerald' },
          { label: 'Cost', val: fmt(data.total_cost), color: 'blue' },
          { label: 'Gross Profit', val: fmt(data.gross_profit), color: data.gross_profit >= 0 ? 'emerald' : 'rose' },
          { label: 'Margin', val: `${data.profit_margin}%`, color: 'violet' },
        ].map(s => (
          <div key={s.label} className="glass-card p-5">
            <p className="text-xs text-slate-400 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold text-${s.color}-600 mt-1`}>{s.val}</p>
          </div>
        ))}
      </div>
    );

    // Stock Valuation
    if (active === 'stock-valuation' && data.items) return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Cost Value', val: fmt(data.total_cost_value), color: 'blue' },
            { label: 'Retail Value', val: fmt(data.total_retail_value), color: 'emerald' },
            { label: 'Potential Profit', val: fmt(data.potential_profit), color: 'violet' },
          ].map(s => (
            <div key={s.label} className="glass-card p-5">
              <p className="text-xs text-slate-400 font-medium">{s.label}</p>
              <p className={`text-2xl font-bold text-${s.color}-600 mt-1`}>{s.val}</p>
            </div>
          ))}
        </div>
        {renderTable(data.items, [
          { key: 'product_name', label: 'Product' },
          { key: 'branch', label: 'Branch' },
          { key: 'quantity', label: 'Qty' },
          { key: 'cost_value', label: 'Cost Value', render: v => fmt(v) },
          { key: 'retail_value', label: 'Retail Value', render: v => fmt(v) },
        ])}
      </div>
    );

    // Array-based reports (most reports)
    if (Array.isArray(data)) {
      const columns = {
        'inventory': [
          { key: 'product_name', label: 'Product' }, { key: 'sku', label: 'SKU' },
          { key: 'branch', label: 'Branch' }, { key: 'quantity', label: 'Qty' },
          { key: 'stock_value', label: 'Value', render: v => fmt(v) },
        ],
        'top-products': [
          { key: 'product_name', label: 'Product' }, { key: 'barcode', label: 'Barcode' },
          { key: 'total_quantity', label: 'Qty Sold' },
          { key: 'total_revenue', label: 'Revenue', render: v => fmt(v) },
        ],
        'low-stock': [
          { key: 'product_name', label: 'Product' }, { key: 'branch', label: 'Branch' },
          { key: 'current_stock', label: 'Current' }, { key: 'minimum_level', label: 'Minimum' },
          { key: 'deficit', label: 'Deficit', render: v => <span className="text-rose-600 font-bold">-{v}</span> },
        ],
        'dead-stock': [
          { key: 'product_name', label: 'Product' }, { key: 'sku', label: 'SKU' },
          { key: 'category', label: 'Category' },
          { key: 'cost_price', label: 'Cost', render: v => fmt(v) },
          { key: 'selling_price', label: 'Sell', render: v => fmt(v) },
        ],
        'branch-sales': [
          { key: 'branch', label: 'Branch' }, { key: 'code', label: 'Code' },
          { key: 'revenue', label: 'Revenue', render: v => fmt(v) },
          { key: 'bills', label: 'Bills' },
          { key: 'avg_bill', label: 'Avg Bill', render: v => fmt(v) },
        ],
        'supplier-purchases': [
          { key: 'supplier', label: 'Supplier' },
          { key: 'total_amount', label: 'Total Amount', render: v => fmt(v) },
          { key: 'total_orders', label: 'Orders' },
        ],
        'customer-purchases': [
          { key: 'customer', label: 'Customer' }, { key: 'phone', label: 'Phone' },
          { key: 'total_amount', label: 'Total Spent', render: v => fmt(v) },
          { key: 'total_bills', label: 'Bills' },
        ],
      };
      return renderTable(data, columns[active] || Object.keys(data[0] || {}).map(k => ({ key: k, label: k })));
    }

    // Purchases
    if (data.purchases) return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Amount', val: fmt(data.summary.total_amount), color: 'blue' },
            { label: 'Total GST', val: fmt(data.summary.total_gst), color: 'amber' },
            { label: 'Total Orders', val: data.summary.total_orders, color: 'violet' },
          ].map(s => (
            <div key={s.label} className="glass-card p-4">
              <p className="text-xs text-slate-400 font-medium">{s.label}</p>
              <p className={`text-xl font-bold text-${s.color}-600 mt-1`}>{s.val}</p>
            </div>
          ))}
        </div>
        {renderTable(data.purchases, [
          { key: 'po_number', label: 'PO#' }, { key: 'supplier__name', label: 'Supplier' },
          { key: 'branch__name', label: 'Branch' }, { key: 'purchase_date', label: 'Date' },
          { key: 'total_amount', label: 'Amount', render: v => fmt(v) }, { key: 'status', label: 'Status' },
        ])}
      </div>
    );

    return <p className="text-slate-400 text-center py-8">No data</p>;
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="Reports" />
      <div className="p-6 space-y-6">
        {/* Filters bar */}
        <div className="glass-card p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs font-medium text-slate-500">Start Date</label>
              <input type="date" value={filters.start_date} onChange={e => setFilters({...filters, start_date: e.target.value})}
                className="input-field mt-1 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">End Date</label>
              <input type="date" value={filters.end_date} onChange={e => setFilters({...filters, end_date: e.target.value})}
                className="input-field mt-1 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Branch</label>
              <select value={filters.branch} onChange={e => setFilters({...filters, branch: e.target.value})} className="input-field mt-1 text-sm">
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            {active && (
              <button onClick={() => loadReport(active)}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
                Apply Filters
              </button>
            )}
            {active && EXPORTABLE.includes(active) && (
              <button onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors">
                <Download className="w-4 h-4" /> Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Report Cards Grid */}
        {renderReportGrid()}

        {/* Report Data */}
        <div className="glass-card p-6">
          {!active ? (
            <div className="text-center py-16">
              <BarChart3 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-400">Select a Report</h3>
              <p className="text-sm text-slate-300 mt-1">Click any report card above to view data</p>
            </div>
          ) : renderReportData()}
        </div>
      </div>
    </div>
  );
}
