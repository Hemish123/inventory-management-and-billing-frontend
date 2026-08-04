import { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import { getPurchases, createPurchase, receivePurchase } from '../../api/stockAPI';
import { getProductDropdown, getSuppliers } from '../../api/productsAPI';
import { getBranchDropdown } from '../../api/coreAPI';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Plus, CheckCircle, Truck, Trash2, Loader2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    branch_id: '', supplier: '', invoice_number: '', 
    purchase_date: new Date().toISOString().split('T')[0],
    gst_percentage: 0,
    items: [{ product: '', quantity: 1, unit_cost: '' }]
  });

  useEffect(() => { loadPurchases(); loadDropdowns(); }, []);

  const loadPurchases = async () => {
    setLoading(true);
    const { data } = await getPurchases();
    if (data?.data) setPurchases(Array.isArray(data.data) ? data.data : data.data.results || []);
    setLoading(false);
  };

  const loadDropdowns = async () => {
    const [s, p, b] = await Promise.all([getSuppliers(), getProductDropdown(), getBranchDropdown()]);
    if (s.data?.data) setSuppliers(Array.isArray(s.data.data) ? s.data.data : s.data.data.results || []);
    if (p.data?.data) setProducts(p.data.data);
    if (b.data?.data) {
      setBranches(b.data.data);
      if (b.data.data.length > 0) setForm(prev => ({ ...prev, branch_id: b.data.data[0].id }));
    }
  };

  const handleReceive = async (id, poNumber) => {
    if (!window.confirm(`Mark PO ${poNumber} as received? This will update stock.`)) return;
    const { error } = await receivePurchase(id);
    if (error) toast.error(error);
    else { toast.success(`PO ${poNumber} received — stock updated`); loadPurchases(); }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...form.items];
    newItems[index][field] = value;
    if (field === 'product') {
      const selected = products.find(p => p.id === parseInt(value));
      if (selected) newItems[index].unit_cost = selected.cost_price || 0;
    }
    setForm({ ...form, items: newItems });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { product: '', quantity: 1, unit_cost: '' }] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.branch_id) return toast.error('Select a branch');
    
    setSubmitting(true);
    const processedItems = form.items.map(item => ({
      product: parseInt(item.product),
      quantity: parseInt(item.quantity) || 0,
      unit_cost: parseFloat(item.unit_cost) || 0,
    }));
    
    const subtotal = processedItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
    const gst_amount = subtotal * (parseFloat(form.gst_percentage) || 0) / 100;
    const total_amount = subtotal + gst_amount;
    
    const payload = { 
      branch_id: parseInt(form.branch_id),
      supplier: parseInt(form.supplier), 
      purchase_date: form.purchase_date,
      invoice_number: form.invoice_number,
      gst_percentage: parseFloat(form.gst_percentage) || 0,
      gst_amount: parseFloat(gst_amount.toFixed(2)),
      total_amount: parseFloat(total_amount.toFixed(2)),
      items: processedItems,
    };
    
    const { data, error } = await createPurchase(payload);
    
    setSubmitting(false);
    if (data) {
      toast.success('Purchase order created successfully');
      setShowModal(false);
      setForm({ ...form, invoice_number: '', gst_percentage: 0, items: [{ product: '', quantity: 1, unit_cost: '' }] });
      loadPurchases();
    } else toast.error(error || 'Failed to create purchase order');
  };

  const columns = [
    { key: 'po_number', label: 'PO #', sortable: true, render: v => (
      <span className="font-mono text-sm font-semibold text-violet-600">{v}</span>
    )},
    { key: 'invoice_number', label: 'Invoice #', render: v => v || <span className="text-slate-300">—</span> },
    { key: 'supplier_name', label: 'Supplier', sortable: true },
    { key: 'branch_name', label: 'Branch' },
    { key: 'total_amount', label: 'Amount', sortable: true, render: v => formatCurrency(v) },
    { key: 'status', label: 'Status', render: v => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
        v === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700' :
        v === 'CANCELLED' ? 'bg-rose-50 text-rose-700' :
        'bg-amber-50 text-amber-700'
      }`}>{v}</span>
    )},
    { key: 'purchase_date', label: 'Date', render: v => formatDate(v) },
    { key: 'actions', label: '', render: (_, row) => !['RECEIVED', 'CANCELLED'].includes(row.status) ? (
      <button onClick={() => handleReceive(row.id, row.po_number)}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
        <CheckCircle className="w-3 h-3" /> Receive
      </button>
    ) : null },
  ];

  const subtotal = form.items.reduce((s, i) => s + ((parseFloat(i.quantity)||0) * (parseFloat(i.unit_cost)||0)), 0);
  const gstAmt = subtotal * (parseFloat(form.gst_percentage)||0) / 100;

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="Purchase Orders" />
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap">
            <Plus className="w-4 h-4" /> Create PO
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? <div className="p-6"><SkeletonTable rows={6} cols={7} /></div> : (
            <Table columns={columns} data={purchases} />
          )}
        </div>
      </div>

      {showModal && (
        <Modal title="Create Purchase Order" onClose={() => setShowModal(false)} size="lg">
          <form onSubmit={handleSubmit} className="space-y-6 p-4">
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500">Branch *</label>
                <select required value={form.branch_id} onChange={e => setForm({...form, branch_id: e.target.value})} className="input-field mt-1">
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500">Supplier *</label>
                <select required value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} className="input-field mt-1">
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500">Invoice Number</label>
                <input type="text" placeholder="Optional" value={form.invoice_number} onChange={e => setForm({...form, invoice_number: e.target.value})} className="input-field mt-1" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs font-medium text-slate-500">Purchase Date</label>
                <input required type="date" value={form.purchase_date} onChange={e => setForm({...form, purchase_date: e.target.value})} className="input-field mt-1" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-medium text-slate-500">Line Items *</label>
                <button type="button" onClick={addItem} className="text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg transition-colors">
                  + Add Item
                </button>
              </div>
              
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                {form.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <select required value={item.product} onChange={e => handleItemChange(index, 'product', e.target.value)} className="input-field text-sm">
                        <option value="">Select Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku || p.barcode})</option>)}
                      </select>
                    </div>
                    <div className="w-24">
                      <input required type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} className="input-field text-sm" />
                    </div>
                    <div className="w-32">
                      <input required type="number" min="0" step="0.01" placeholder="Cost" value={item.unit_cost} onChange={e => handleItemChange(index, 'unit_cost', e.target.value)} className="input-field text-sm" />
                    </div>
                    <button type="button" onClick={() => removeItem(index)} disabled={form.items.length === 1} className="p-2.5 mt-0.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                <div className="pt-4 mt-2 border-t border-slate-200 flex flex-col items-end space-y-1">
                  <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
                    <span>Subtotal:</span>
                    <span className="w-24 text-right font-mono">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
                    <span className="flex items-center gap-2">
                      Overall GST % <input type="number" min="0" max="100" value={form.gst_percentage} onChange={e => setForm({...form, gst_percentage: parseFloat(e.target.value)||0})} className="w-16 border rounded px-1 py-0.5 text-right" />
                    </span>
                    <span className="w-24 text-right font-mono">{formatCurrency(gstAmt)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-lg font-bold text-slate-800 pt-1">
                    <span>Total:</span>
                    <span className="w-24 text-right font-mono text-indigo-600">{formatCurrency(subtotal + gstAmt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary px-4 py-2">Cancel</button>
              <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-70 transition-colors">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Create PO
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
