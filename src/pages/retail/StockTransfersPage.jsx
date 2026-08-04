import { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import { getStockTransfers, createStockTransfer, approveTransfer, rejectTransfer, completeTransfer, cancelTransfer } from '../../api/stockAPI';
import { getProductDropdown } from '../../api/productsAPI';
import { getBranchDropdown } from '../../api/coreAPI';
import { formatDate } from '../../utils/formatters';
import { Plus, ArrowLeftRight, CheckCircle, XCircle, Truck, Trash2, Loader2, Ban } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  DRAFT: 'bg-slate-50 text-slate-700',
  REQUESTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-blue-50 text-blue-700',
  IN_TRANSIT: 'bg-indigo-50 text-indigo-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-rose-50 text-rose-700',
  CANCELLED: 'bg-slate-50 text-slate-500',
};

export default function StockTransfersPage() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    from_branch: '', to_branch: '', notes: '',
    items: [{ product: '', quantity: 1 }]
  });

  useEffect(() => { loadTransfers(); loadDropdowns(); }, []);

  const loadTransfers = async () => {
    setLoading(true);
    const { data } = await getStockTransfers();
    if (data?.data) setTransfers(Array.isArray(data.data) ? data.data : data.data.results || []);
    setLoading(false);
  };

  const loadDropdowns = async () => {
    const [b, p] = await Promise.all([getBranchDropdown(), getProductDropdown()]);
    if (b.data?.data) setBranches(b.data.data);
    if (p.data?.data) setProducts(p.data.data);
  };

  const handleItemChange = (idx, field, val) => {
    const items = [...form.items];
    items[idx][field] = val;
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { product: '', quantity: 1 }] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      from_branch: parseInt(form.from_branch),
      to_branch: parseInt(form.to_branch),
      notes: form.notes,
      items: form.items.map(i => ({ product: parseInt(i.product), quantity: parseInt(i.quantity) })),
    };
    const { data, error } = await createStockTransfer(payload);
    setSubmitting(false);
    if (data) {
      toast.success('Transfer request created');
      setShowModal(false);
      setForm({ from_branch: '', to_branch: '', notes: '', items: [{ product: '', quantity: 1 }] });
      loadTransfers();
    } else toast.error(error || 'Failed');
  };

  const handleAction = async (actionFn, id, label) => {
    if (!window.confirm(`${label} this transfer?`)) return;
    const { error } = await actionFn(id);
    if (error) toast.error(error);
    else { toast.success(`Transfer ${label.toLowerCase()}d`); loadTransfers(); }
  };

  const columns = [
    { key: 'transfer_number', label: 'Transfer #', sortable: true, render: v => (
      <span className="font-mono text-sm font-semibold text-indigo-600">{v}</span>
    )},
    { key: 'from_branch_name', label: 'From', sortable: true },
    { key: 'to_branch_name', label: 'To', sortable: true },
    { key: 'status', label: 'Status', render: v => (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[v] || ''}`}>{v}</span>
    )},
    { key: 'created_at', label: 'Created', render: v => formatDate(v) },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        {row.status === 'REQUESTED' && (
          <>
            <button onClick={() => handleAction(approveTransfer, row.id, 'Approve')}
              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Approve">
              <CheckCircle className="w-4 h-4" />
            </button>
            <button onClick={() => handleAction(rejectTransfer, row.id, 'Reject')}
              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Reject">
              <XCircle className="w-4 h-4" />
            </button>
          </>
        )}
        {['APPROVED', 'IN_TRANSIT'].includes(row.status) && (
          <button onClick={() => handleAction(completeTransfer, row.id, 'Complete')}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
            <Truck className="w-3 h-3" /> Complete
          </button>
        )}
        {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(row.status) && (
          <button onClick={() => handleAction(cancelTransfer, row.id, 'Cancel')}
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Cancel">
            <Ban className="w-4 h-4" />
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="Stock Transfers" />
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-500/20">
            <Plus className="w-4 h-4" /> New Transfer
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? <div className="p-6"><SkeletonTable rows={6} cols={6} /></div> : (
            <Table columns={columns} data={transfers} />
          )}
        </div>
      </div>

      {showModal && (
        <Modal title="Create Stock Transfer" onClose={() => setShowModal(false)} size="lg">
          <form onSubmit={handleSubmit} className="space-y-5 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500">Source Branch *</label>
                <select required value={form.from_branch} onChange={e => setForm({...form, from_branch: e.target.value})} className="input-field mt-1">
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Destination Branch *</label>
                <select required value={form.to_branch} onChange={e => setForm({...form, to_branch: e.target.value})} className="input-field mt-1">
                  <option value="">Select Branch</option>
                  {branches.filter(b => String(b.id) !== form.from_branch).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input-field mt-1" rows={2} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-medium text-slate-500">Products *</label>
                <button type="button" onClick={addItem} className="text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg transition-colors">+ Add Item</button>
              </div>
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <select required value={item.product} onChange={e => handleItemChange(idx, 'product', e.target.value)} className="input-field text-sm">
                        <option value="">Select Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="w-24">
                      <input required type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} className="input-field text-sm" />
                    </div>
                    <button type="button" onClick={() => removeItem(idx)} disabled={form.items.length === 1} className="p-2.5 text-rose-400 hover:text-rose-600 rounded-xl transition-colors disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary px-4 py-2">Cancel</button>
              <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-70 transition-colors">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Create Transfer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
