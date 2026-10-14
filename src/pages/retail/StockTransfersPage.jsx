import { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import {
  getStockTransfers, createStockTransfer, updateStockTransfer, deleteStockTransfer,
  approveTransfer, rejectTransfer, completeTransfer, cancelTransfer
} from '../../api/stockAPI';
import { getProductDropdown } from '../../api/productsAPI';
import { getBranchDropdown } from '../../api/coreAPI';
import { formatDate } from '../../utils/formatters';
import { Plus, CheckCircle, XCircle, Truck, Trash2, Pencil, Loader2, Ban, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  DRAFT: 'bg-slate-100 text-slate-700 border border-slate-200',
  REQUESTED: 'bg-amber-50 text-amber-700 border border-amber-200',
  APPROVED: 'bg-blue-50 text-blue-700 border border-blue-200',
  IN_TRANSIT: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border border-rose-200',
  CANCELLED: 'bg-slate-50 text-slate-500 border border-slate-200',
};

export default function StockTransfersPage() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTransfer, setEditingTransfer] = useState(null);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [form, setForm] = useState({
    from_branch: '',
    to_branch: '',
    status: 'REQUESTED',
    notes: '',
    items: [{ product: '', quantity: 1 }]
  });

  useEffect(() => { loadTransfers(); loadDropdowns(); }, [page]);

  const loadTransfers = async () => {
    setLoading(true);
    const { data } = await getStockTransfers({ page, page_size: 20 });
    if (data?.data) {
      if (Array.isArray(data.data)) {
        setTransfers(data.data);
        setTotalCount(data.data.length);
      } else {
        setTransfers(data.data.results || []);
        setTotalCount(data.data.count || 0);
      }
    }
    setLoading(false);
  };

  const loadDropdowns = async () => {
    const [b, p] = await Promise.all([getBranchDropdown(), getProductDropdown()]);
    if (b.data?.data) setBranches(b.data.data);
    if (p.data?.data) setProducts(p.data.data);
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setEditingTransfer(null);
    setForm({
      from_branch: branches[0]?.id ? String(branches[0].id) : '',
      to_branch: branches[1]?.id ? String(branches[1].id) : '',
      status: 'REQUESTED',
      notes: '',
      items: [{ product: '', quantity: 1 }]
    });
    setShowModal(true);
  };

  const handleEdit = (transfer) => {
    setEditingId(transfer.id);
    setEditingTransfer(transfer);
    setForm({
      from_branch: transfer.from_branch ? String(transfer.from_branch) : '',
      to_branch: transfer.to_branch ? String(transfer.to_branch) : '',
      status: transfer.status || 'REQUESTED',
      notes: transfer.notes || '',
      items: transfer.items && transfer.items.length > 0
        ? transfer.items.map(it => ({
            product: String(it.product),
            quantity: it.quantity || 1
          }))
        : [{ product: '', quantity: 1 }]
    });
    setShowModal(true);
  };

  const handleDelete = async (row) => {
    const isCompleted = row.status === 'COMPLETED';
    const msg = isCompleted
      ? `Delete transfer "${row.transfer_number}"?\n\nWARNING: This transfer is COMPLETED. Deleting it will automatically revert the transferred stock back to source branch (${row.from_branch_name}).`
      : `Delete transfer "${row.transfer_number}"?`;
    if (!window.confirm(msg)) return;

    const { data, error } = await deleteStockTransfer(row.id);
    if (error) {
      toast.error(error);
    } else {
      toast.success(data?.message || 'Transfer deleted successfully');
      loadTransfers();
    }
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
    if (!form.from_branch || !form.to_branch) {
      toast.error('Please select both source and destination branches');
      return;
    }
    if (String(form.from_branch) === String(form.to_branch)) {
      toast.error('Source and destination branches must be different');
      return;
    }
    const validItems = form.items.filter(i => i.product && parseInt(i.quantity, 10) > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one product with quantity > 0');
      return;
    }

    setSubmitting(true);
    const payload = {
      from_branch: parseInt(form.from_branch, 10),
      to_branch: parseInt(form.to_branch, 10),
      status: form.status || 'REQUESTED',
      notes: form.notes || '',
      items: validItems.map(i => ({ product: parseInt(i.product, 10), quantity: parseInt(i.quantity, 10) })),
    };

    const { data, error } = editingId
      ? await updateStockTransfer(editingId, payload)
      : await createStockTransfer(payload);

    setSubmitting(false);
    if (data) {
      toast.success(editingId ? 'Transfer updated and stocks adjusted' : 'Transfer created');
      setShowModal(false);
      setEditingId(null);
      setEditingTransfer(null);
      setForm({ from_branch: '', to_branch: '', status: 'REQUESTED', notes: '', items: [{ product: '', quantity: 1 }] });
      loadTransfers();
    } else {
      toast.error(error || 'Failed to save transfer');
    }
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
    { key: 'items', label: 'Items', render: (_, row) => (
      <div className="flex flex-wrap gap-1 max-w-xs">
        {(row.items || []).map((it, idx) => (
          <span key={idx} className="inline-flex items-center text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
            {it.product_name} <span className="text-indigo-600 ml-1 font-bold">×{it.quantity}</span>
          </span>
        ))}
        {(!row.items || row.items.length === 0) && <span className="text-xs text-slate-400">None</span>}
      </div>
    )},
    { key: 'status', label: 'Status', render: v => (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[v] || ''}`}>{v}</span>
    )},
    { key: 'created_at', label: 'Created', render: v => formatDate(v) },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
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
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors" title="Complete Transfer">
            <Truck className="w-3.5 h-3.5" /> Complete
          </button>
        )}
        {!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(row.status) && (
          <button onClick={() => handleAction(cancelTransfer, row.id, 'Cancel')}
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Cancel">
            <Ban className="w-4 h-4" />
          </button>
        )}
        <button onClick={() => handleEdit(row)}
          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Transfer">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => handleDelete(row)}
          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Transfer">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )},
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="Stock Transfers" />
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <button onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-500/20">
            <Plus className="w-4 h-4" /> New Transfer
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? <div className="p-6"><SkeletonTable rows={6} cols={6} /></div> : (
            <Table columns={columns} data={transfers} />
          )}
        </div>

        {Math.ceil(totalCount / 20) > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{totalCount} transfers total</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="btn-secondary py-2 px-3 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm text-slate-600">Page {page} of {Math.ceil(totalCount / 20)}</span>
              <button onClick={() => setPage(Math.min(Math.ceil(totalCount / 20), page + 1))} disabled={page === Math.ceil(totalCount / 20)}
                className="btn-secondary py-2 px-3 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={editingId ? `Edit Stock Transfer: ${editingTransfer?.transfer_number || ''}` : "Create Stock Transfer"}
          onClose={() => { setShowModal(false); setEditingId(null); setEditingTransfer(null); }}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  {branches.filter(b => String(b.id) !== String(form.from_branch)).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Status *</label>
                <select required value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input-field mt-1 font-semibold">
                  <option value="DRAFT">Draft</option>
                  <option value="REQUESTED">Requested</option>
                  <option value="APPROVED">Approved</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            {form.status === 'COMPLETED' && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Notice: Completed status automatically deducts stock from the source branch and adds it to the destination branch.</span>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-500">Notes / Reason</label>
              <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Reason for transfer or reference notes..." className="input-field mt-1" rows={2} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-medium text-slate-500">Transfer Products *</label>
                <button type="button" onClick={addItem} className="text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg transition-colors">+ Add Item</button>
              </div>
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100 max-h-64 overflow-y-auto">
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <select required value={item.product} onChange={e => handleItemChange(idx, 'product', e.target.value)} className="input-field text-sm">
                        <option value="">Select Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} {p.barcode ? `(${p.barcode})` : ''}</option>)}
                      </select>
                    </div>
                    <div className="w-28">
                      <input required type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} className="input-field text-sm" />
                    </div>
                    <button type="button" onClick={() => removeItem(idx)} disabled={form.items.length === 1} className="p-2.5 text-rose-400 hover:text-rose-600 rounded-xl transition-colors disabled:opacity-40" title="Remove Item">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => { setShowModal(false); setEditingId(null); setEditingTransfer(null); }} className="btn-secondary px-4 py-2">Cancel</button>
              <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-70 transition-colors">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? "Save Changes" : "Create Transfer"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
