import { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../../api/expensesAPI';
import { getSuppliers } from '../../api/productsAPI';
import { getBranchDropdown } from '../../api/coreAPI';
import { formatCurrency } from '../../utils/formatters';
import { Plus, Wallet, Trash2, Pencil, Calendar, MapPin, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { Navigate } from 'react-router-dom';

export default function ExpensesPage() {
  const { user } = useAuth();
  if (['EMPLOYEE', 'USER'].includes(user?.role_name)) {
    return <Navigate to="/pos" replace />;
  }

  const [expenses, setExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [form, setForm] = useState({
    branch: '', supplier: '', bill_no: '', expense_rate: '', expense_type: ''
  });

  useEffect(() => { 
    loadData(); 
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [expRes, supRes, branchRes] = await Promise.all([
      getExpenses(),
      getSuppliers(),
      getBranchDropdown()
    ]);
    
    if (expRes.data?.data) {
      setExpenses(Array.isArray(expRes.data.data) ? expRes.data.data : expRes.data.data.results || []);
    }
    if (supRes.data?.data) {
      setSuppliers(Array.isArray(supRes.data.data) ? supRes.data.data : supRes.data.data.results || []);
    }
    if (branchRes.data?.data) {
      setBranches(branchRes.data.data);
    }
    
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
        ...form,
        supplier: form.supplier || null,
        expense_rate: Number(form.expense_rate)
    };

    const { data, error } = editingId 
      ? await updateExpense(editingId, payload)
      : await createExpense(payload);
      
    if (data) {
      toast.success(editingId ? 'Expense updated' : 'Expense created');
      closeModal();
      loadData();
    } else toast.error(error || 'Failed');
  };

  const handleEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      branch: expense.branch || '',
      supplier: expense.supplier || '',
      bill_no: expense.bill_no || '',
      expense_rate: expense.expense_rate || '',
      expense_type: expense.expense_type || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (e, id, label) => {
    e.stopPropagation();
    if (!window.confirm(`Delete expense "${label || 'item'}"?`)) return;
    const { error } = await deleteExpense(id);
    if (error) toast.error(error); else { toast.success('Deleted'); loadData(); }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ branch: '', supplier: '', bill_no: '', expense_rate: '', expense_type: '' });
  };

  const columns = [
    { key: 'bill_no', label: 'Expense Info', render: (val, row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
          <Wallet className="w-4 h-4 text-teal-500" />
        </div>
        <div>
          <p className="font-medium text-slate-800 text-sm">{val ? `Bill: ${val}` : row.expense_type}</p>
          <p className="text-xs text-slate-400">{val ? row.expense_type : 'No bill number'}</p>
        </div>
      </div>
    )},
    { key: 'branch_name', label: 'Branch', render: v => (
      <span className="flex items-center gap-1 text-sm text-slate-600"><MapPin className="w-3 h-3" />{v || '—'}</span>
    ) },
    { key: 'supplier_name', label: 'Supplier', render: v => v ? (
      <span className="flex items-center gap-1 text-sm text-slate-600"><Building2 className="w-3 h-3" />{v}</span>
    ) : <span className="text-slate-300">—</span> },
    { key: 'date', label: 'Date', render: v => (
      <span className="flex items-center gap-1 text-sm text-slate-600"><Calendar className="w-3 h-3" />{v}</span>
    ) },
    { key: 'expense_rate', label: 'Amount', render: v => (
      <span className="font-semibold text-slate-800">{formatCurrency(v)}</span>
    ) },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
        <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
          className="p-1.5 text-teal-500 hover:text-teal-700 hover:bg-teal-50 rounded-full transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={(e) => handleDelete(e, row.id, row.bill_no || row.expense_type)}
          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )},
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="Expenses" />
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-500/20">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? <div className="p-6"><SkeletonTable rows={6} cols={5} /></div> : (
            <Table columns={columns} data={expenses} />
          )}
        </div>
      </div>

      {showModal && (
        <Modal title={editingId ? "Edit Expense" : "Add Expense"} onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Branch *</label>
                <select required value={form.branch} onChange={e => setForm({...form, branch: e.target.value})} className="input-field mt-1">
                  <option value="">Select Branch</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Supplier (Optional)</label>
                <select value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} className="input-field mt-1">
                  <option value="">No Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Bill No (Optional)</label>
                <input value={form.bill_no} onChange={e => setForm({...form, bill_no: e.target.value})} className="input-field mt-1" placeholder="Enter Bill No (Optional)" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Expense Type *</label>
                <input required value={form.expense_type} onChange={e => setForm({...form, expense_type: e.target.value})} className="input-field mt-1" placeholder="e.g. Electricity, Maintenance, Rent" list="expenseTypes" />
                <datalist id="expenseTypes">
                    <option value="Electricity" />
                    <option value="Maintenance" />
                    <option value="Rent" />
                    <option value="Salary" />
                    <option value="Office Supplies" />
                </datalist>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">Expense Rate (Amount) *</label>
              <input required type="number" step="0.01" min="0" value={form.expense_rate} onChange={e => setForm({...form, expense_rate: e.target.value})} className="input-field mt-1" placeholder="0.00" />
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={closeModal} className="btn-secondary px-4 py-2">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
                {editingId ? "Save Changes" : "Create Expense"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
