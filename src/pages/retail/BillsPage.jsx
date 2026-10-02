import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import { getBills, getBill, voidBill, updateBill } from '../../api/billingAPI';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Search, XCircle, FileText, PlayCircle, Edit3, Phone, Minus, Plus, Trash2, Save, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BillsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const navigate = useNavigate();

  // Bill Edit/Return State
  const [editModal, setEditModal] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadBills(); }, []);

  const loadBills = async () => {
    setLoading(true);
    const params = {};
    if (phoneSearch) params.phone = phoneSearch;
    const { data } = await getBills(params);
    if (data?.data) setBills(Array.isArray(data.data) ? data.data : data.data.results || []);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => loadBills(), 400);
    return () => clearTimeout(timer);
  }, [phoneSearch]);

  const handleVoid = async (id, billNumber) => {
    if (!window.confirm(`Void bill ${billNumber}? This will restore stock.`)) return;
    const { error } = await voidBill(id);
    if (error) toast.error(error);
    else { toast.success(`Bill ${billNumber} voided`); loadBills(); }
  };

  const handleOpenEdit = async (billId) => {
    setEditLoading(true);
    setEditModal(true);
    const { data, error } = await getBill(billId);
    if (data?.data) {
      const bill = data.data;
      setEditBill(bill);
      setEditItems(bill.items.map(item => ({
        product: item.product,
        product_name: item.product_name,
        barcode: item.barcode || '',
        hsn_code: item.hsn_code || '',
        quantity: parseFloat(item.quantity),
        unit_price: parseFloat(item.unit_price),
        tax_percentage: item.tax_percentage || 0,
        discount_type: item.discount_type || 'NONE',
        discount_percentage: parseFloat(item.discount_percentage || 0),
        discount_amount: parseFloat(item.discount_amount || 0),
        tax_amount: parseFloat(item.tax_amount || 0),
        line_total: parseFloat(item.line_total || 0),
      })));
    } else {
      toast.error(error || 'Failed to load bill');
      setEditModal(false);
    }
    setEditLoading(false);
  };

  const updateEditQty = (idx, delta) => {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const newQty = Math.max(0, item.quantity + delta);
      return recalcItem({ ...item, quantity: newQty });
    }));
  };

  const removeEditItem = (idx) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  };

  const recalcItem = (item) => {
    const base = item.unit_price * item.quantity;
    let itemDisc = 0;
    if (item.discount_type === 'PERCENTAGE') itemDisc = base * (item.discount_percentage / 100);
    else if (item.discount_type === 'FIXED') itemDisc = item.discount_amount;
    const afterDisc = base - itemDisc;
    const tax = afterDisc * (item.tax_percentage / 100);
    return {
      ...item,
      discount_amount: parseFloat(itemDisc.toFixed(2)),
      tax_amount: parseFloat(tax.toFixed(2)),
      line_total: parseFloat((afterDisc + tax).toFixed(2)),
    };
  };

  const handleSaveEdit = async () => {
    if (!editBill) return;
    if (editItems.length === 0) {
      toast.error('Bill must have at least one item. Use Void to cancel entirely.');
      return;
    }
    setSaving(true);

    // Recalculate all items
    const processedItems = editItems.map(item => recalcItem(item));

    const subtotal = processedItems.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0);
    const taxTotal = processedItems.reduce((acc, item) => acc + item.tax_amount, 0);
    const grandTotal = Math.round(subtotal + taxTotal);
    const roundOff = grandTotal - (subtotal + taxTotal);

    const payload = {
      items: processedItems,
      discount_type: 'NONE',
      discount_percentage: 0,
      discount_amount: 0,
      round_off: parseFloat(roundOff.toFixed(2)),
      amount_received: grandTotal,
    };

    const { data, error } = await updateBill(editBill.id, payload);
    setSaving(false);
    if (data?.data) {
      toast.success(`Bill ${editBill.bill_number} updated! Stock adjusted.`);
      setEditModal(false);
      setEditBill(null);
      setEditItems([]);
      loadBills();
    } else {
      toast.error(error || 'Failed to update bill');
    }
  };

  const editSubtotal = editItems.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
  const editTaxTotal = editItems.reduce((acc, item) => acc + (recalcItem(item).tax_amount), 0);
  const editGrandTotal = Math.round(editSubtotal + editTaxTotal);

  const filtered = bills.filter(b =>
    b.bill_number?.toLowerCase().includes(search.toLowerCase()) ||
    b.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.cashier_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.customer_phone?.includes(search)
  );

  const columns = [
    { key: 'bill_number', label: 'Bill #', sortable: true, render: v => (
      <span className="font-mono text-sm font-semibold text-indigo-600">{v}</span>
    )},
    { key: 'customer_name', label: 'Customer', sortable: true },
    { key: 'customer_phone', label: 'Phone', sortable: false, render: v => v ? (
      <span className="text-xs text-slate-600 font-mono">{v}</span>
    ) : <span className="text-slate-300">—</span> },
    { key: 'branch_name', label: 'Branch', sortable: true },
    { key: 'cashier_name', label: 'Cashier', sortable: true, render: v => v ? (
      <span className="text-xs text-slate-500 font-medium">{v}</span>
    ) : <span className="text-slate-300">—</span> },
    { key: 'grand_total', label: 'Total', sortable: true, render: v => formatCurrency(v) },
    { key: 'payment_method', label: 'Payment', sortable: true, render: v => (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{v}</span>
    )},
    { key: 'status', label: 'Status', sortable: true, render: v => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
        v === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
        v === 'VOID' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
      }`}>{v === 'HOLD' ? 'DRAFT' : v}</span>
    )},
    { key: 'billing_date', label: 'Date', sortable: true, render: v => formatDate(v) },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-2 justify-end">
        {row.status === 'COMPLETED' && (
          <button onClick={() => handleOpenEdit(row.id)}
            className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-full transition-colors" title="Edit / Return Items">
            <Edit3 className="w-5 h-5" />
          </button>
        )}
        {row.status === 'HOLD' && (
          <button onClick={() => navigate(`/pos?draftId=${row.id}`)}
            className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title="Resume Bill">
            <PlayCircle className="w-5 h-5" />
          </button>
        )}
        {row.status !== 'VOID' && (
          <button onClick={() => handleVoid(row.id, row.bill_number)}
            className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors" title="Void Bill">
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="Bills History" />
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by bill, customer, or cashier..." className="input-field pl-10" />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={phoneSearch} onChange={e => setPhoneSearch(e.target.value)}
              placeholder="Search by phone number..."
              className="input-field pl-10 w-64" />
          </div>
        </div>
        <div className="glass-card overflow-hidden">
          {loading ? <div className="p-6"><SkeletonTable rows={8} cols={9} /></div> : (
            <Table columns={columns} data={filtered} />
          )}
        </div>
      </div>

      {/* Bill Edit / Return Modal */}
      {editModal && (
        <Modal title={editBill ? `Edit Bill: ${editBill.bill_number}` : 'Loading...'} onClose={() => { setEditModal(false); setEditBill(null); setEditItems([]); }} size="xl">
          <div className="p-4">
            {editLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : editBill ? (
              <div className="space-y-4">
                {/* Bill Info Header */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-slate-500">Customer: <span className="font-semibold text-slate-800">{editBill.customer_name}</span></p>
                      {editBill.customer_phone && <p className="text-sm text-slate-500">Phone: <span className="font-mono font-semibold text-slate-800">{editBill.customer_phone}</span></p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Date: <span className="font-semibold text-slate-800">{formatDate(editBill.billing_date)}</span></p>
                      <p className="text-sm text-slate-500">Branch: <span className="font-semibold text-slate-800">{editBill.branch_name}</span></p>
                    </div>
                  </div>
                </div>

                {/* Info Banner */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800 font-medium">
                    Reduce quantities or remove items for returns. Stock will be automatically adjusted when you save.
                  </p>
                </div>

                {/* Items Table */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="p-3 w-10 text-center">#</th>
                        <th className="p-3">Item</th>
                        <th className="p-3 w-36 text-center">Qty</th>
                        <th className="p-3 text-right">Price</th>
                        <th className="p-3 text-right">Total</th>
                        <th className="p-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editItems.map((item, idx) => {
                        const calc = recalcItem(item);
                        return (
                          <tr key={idx} className="group hover:bg-indigo-50/30 transition-colors">
                            <td className="p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                            <td className="p-3">
                              <p className="font-bold text-slate-800 text-sm">{item.product_name}</p>
                              <p className="text-xs text-slate-400 font-mono mt-0.5">{item.barcode}</p>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center bg-slate-100 rounded-lg p-1">
                                <button type="button" onClick={() => updateEditQty(idx, -1)}
                                  className="w-7 h-7 rounded bg-white shadow-sm flex items-center justify-center text-slate-600 hover:text-rose-600 transition-colors">
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input type="number" min="0" value={item.quantity}
                                  onChange={e => {
                                    const newQty = parseInt(e.target.value) || 0;
                                    setEditItems(prev => prev.map((it, i) => i === idx ? recalcItem({ ...it, quantity: newQty }) : it));
                                  }}
                                  className="w-10 text-center bg-transparent font-bold text-slate-800 outline-none text-sm" />
                                <button type="button" onClick={() => updateEditQty(idx, 1)}
                                  className="w-7 h-7 rounded bg-white shadow-sm flex items-center justify-center text-slate-600 hover:text-indigo-600 transition-colors">
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <p className="font-medium text-slate-700 text-sm">{formatCurrency(item.unit_price)}</p>
                              {item.tax_percentage > 0 && <p className="text-xs text-amber-500 mt-0.5">+{item.tax_percentage}% GST</p>}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(calc.line_total)}</td>
                            <td className="p-3 text-center">
                              <button type="button" onClick={() => removeEditItem(idx)}
                                className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-between items-end pt-2 border-t border-slate-200">
                  <div className="space-y-1 text-sm text-slate-500">
                    <div className="flex gap-6"><span>Original Total:</span><span className="line-through text-slate-400">{formatCurrency(editBill.grand_total)}</span></div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">New Total</p>
                    <p className="text-2xl font-black text-indigo-600">{formatCurrency(editGrandTotal)}</p>
                    {parseFloat(editBill.grand_total) > editGrandTotal && (
                      <p className="text-xs text-emerald-600 font-semibold mt-1">
                        Refund: {formatCurrency(parseFloat(editBill.grand_total) - editGrandTotal)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => { setEditModal(false); setEditBill(null); setEditItems([]); }}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors text-sm">
                    Cancel
                  </button>
                  <button onClick={handleSaveEdit} disabled={saving || editItems.length === 0}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes & Adjust Stock'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </Modal>
      )}
    </div>
  );
}
