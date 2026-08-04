import { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import { getSuppliers, createSupplier } from '../../api/productsAPI';
import { Plus, Building2, Trash2, Phone, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '', contact_person: '', phone: '', email: '', address: '', gstin: ''
  });

  useEffect(() => { loadSuppliers(); }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    const { data } = await getSuppliers();
    if (data?.data) setSuppliers(Array.isArray(data.data) ? data.data : data.data.results || []);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await createSupplier(form);
    if (data) {
      toast.success('Supplier created');
      setShowModal(false);
      setForm({ name: '', contact_person: '', phone: '', email: '', address: '', gstin: '' });
      loadSuppliers();
    } else toast.error(error || 'Failed');
  };

  const columns = [
    { key: 'name', label: 'Supplier', sortable: true, render: (val, row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-violet-500" />
        </div>
        <div>
          <p className="font-medium text-slate-800 text-sm">{val}</p>
          {row.contact_person && <p className="text-xs text-slate-400">{row.contact_person}</p>}
        </div>
      </div>
    )},
    { key: 'phone', label: 'Phone', render: v => v ? (
      <span className="flex items-center gap-1 text-sm text-slate-600"><Phone className="w-3 h-3" />{v}</span>
    ) : <span className="text-slate-300">—</span> },
    { key: 'email', label: 'Email', render: v => v ? (
      <span className="flex items-center gap-1 text-sm text-slate-600"><Mail className="w-3 h-3" />{v}</span>
    ) : <span className="text-slate-300">—</span> },
    { key: 'gstin', label: 'GSTIN', render: v => v || <span className="text-slate-300">—</span> },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="Suppliers" />
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-violet-700 text-white rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-violet-800 transition-all shadow-lg shadow-violet-500/20">
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? <div className="p-6"><SkeletonTable rows={6} cols={4} /></div> : (
            <Table columns={columns} data={suppliers} />
          )}
        </div>
      </div>

      {showModal && (
        <Modal title="Add Supplier" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Name *</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Contact Person</label>
                <input value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} className="input-field mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Phone</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">GSTIN</label>
                <input value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value})} className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Address</label>
                <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="input-field mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary px-4 py-2">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-colors">Create Supplier</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
