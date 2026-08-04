import { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import { getStockMovements, adjustStock } from '../../api/stockAPI';
import { getProductDropdown } from '../../api/productsAPI';
import { getBranchDropdown } from '../../api/coreAPI';
import { formatDate } from '../../utils/formatters';
import { Search, Plus, ArrowUpFromLine, ArrowDownToLine } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StockPage() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ product: '', branch: '', quantity: '', reason: 'MANUAL', notes: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [m, p, b] = await Promise.all([getStockMovements(), getProductDropdown(), getBranchDropdown()]);
    if (m.data?.data) setMovements(Array.isArray(m.data.data) ? m.data.data : m.data.data.results || []);
    if (p.data?.data) setProducts(p.data.data);
    if (b.data?.data) setBranches(b.data.data);
    setLoading(false);
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    const { data, error } = await adjustStock(form);
    if (data) {
      toast.success('Stock adjusted');
      setShowModal(false);
      setForm({ product: '', branch: '', quantity: '', reason: 'MANUAL', notes: '' });
      loadData();
    } else toast.error(error || 'Failed');
  };

  const columns = [
    { key: 'movement_type', label: 'Type', render: v => (
      <span className={`flex items-center gap-1 text-xs font-bold ${
        v === 'IN' || v === 'TRANSFER_IN' ? 'text-emerald-600' : 'text-rose-600'
      }`}>
        {v === 'IN' || v === 'TRANSFER_IN' ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
        {v}
      </span>
    )},
    { key: 'product_name', label: 'Product', sortable: true },
    { key: 'branch_name', label: 'Branch' },
    { key: 'reason', label: 'Reason', render: v => <span className="text-xs px-2 py-0.5 bg-slate-100 rounded-full">{v}</span> },
    { key: 'quantity', label: 'Qty', render: v => (
      <span className={`font-bold ${v > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{v > 0 ? `+${v}` : v}</span>
    )},
    { key: 'balance_after', label: 'Balance', render: v => <span className="font-semibold">{v}</span> },
    { key: 'reference_id', label: 'Ref', render: v => v ? <span className="text-xs font-mono text-slate-400">{v}</span> : '—' },
    { key: 'created_at', label: 'Date', render: v => formatDate(v) },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="Stock Movements" />
      <div className="p-6 space-y-6">
        <div className="flex gap-3">
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-500/20">
            <Plus className="w-4 h-4" /> Manual Adjustment
          </button>
        </div>
        <div className="glass-card overflow-hidden">
          {loading ? <div className="p-6"><SkeletonTable rows={8} cols={8} /></div> : (
            <Table columns={columns} data={movements} />
          )}
        </div>
      </div>

      {showModal && (
        <Modal title="Stock Adjustment" onClose={() => setShowModal(false)}>
          <form onSubmit={handleAdjust} className="space-y-4 p-4">
            <div>
              <label className="text-xs font-medium text-slate-500">Product *</label>
              <select required value={form.product} onChange={e => setForm({ ...form, product: e.target.value })}
                className="input-field mt-1">
                <option value="">Select product</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.barcode})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Branch *</label>
              <select required value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })}
                className="input-field mt-1">
                <option value="">Select branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Quantity * (positive=add, negative=remove)</label>
              <input required type="number" value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })} className="input-field mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Reason</label>
              <select value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                className="input-field mt-1">
                {['MANUAL', 'DAMAGE', 'RETURN', 'INITIAL'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                className="input-field mt-1" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary px-4 py-2">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold">Adjust Stock</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
