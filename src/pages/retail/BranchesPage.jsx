import { useState, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { getBranches, createBranch, deleteBranch } from '../../api/coreAPI';
import { Plus, Trash2, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BranchesPage() {
  const { user } = useAuth();
  const isEmployee = user?.role_name === 'EMPLOYEE';
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '', phone: '', email: '', manager_name: '' });

  useEffect(() => { loadBranches(); }, []);

  const loadBranches = async () => {
    setLoading(true);
    const { data } = await getBranches();
    if (data?.data) setBranches(data.data);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await createBranch(form);
    if (data) {
      toast.success('Branch created');
      setShowModal(false);
      setForm({ name: '', code: '', address: '', phone: '', email: '', manager_name: '' });
      loadBranches();
    } else toast.error(error || 'Failed');
  };

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    if (!window.confirm(`Delete branch "${name}"?`)) return;
    const { error } = await deleteBranch(id);
    if (error) toast.error(error); else { toast.success('Deleted'); loadBranches(); }
  };

  const columns = [
    { key: 'name', label: 'Branch', render: (v, row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
          <MapPin className="w-4 h-4 text-violet-500" />
        </div>
        <div>
          <p className="font-medium text-slate-800 text-sm">{v}</p>
          <p className="text-xs text-slate-400 font-mono">{row.code}</p>
        </div>
      </div>
    )},
    { key: 'manager_name', label: 'Manager' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'staff_count', label: 'Staff', render: v => <span className="font-semibold">{v || 0}</span> },
    { key: 'actions', label: '', render: (_, row) => (
      !isEmployee && (
        <button onClick={(e) => handleDelete(e, row.id, row.name)}
          className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      )
    )},
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="Branches" />
      <div className="p-6 space-y-6">
        {!isEmployee && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-violet-700 text-white rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-violet-800 transition-all shadow-lg shadow-violet-500/20">
            <Plus className="w-4 h-4" /> Add Branch
          </button>
        )}
        <div className="glass-card overflow-hidden">
          {loading ? <div className="p-6"><SkeletonTable rows={4} cols={6} /></div> : (
            <Table columns={columns} data={branches} />
          )}
        </div>
      </div>

      {showModal && (
        <Modal title="Add Branch" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Name *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Code * (e.g. BR01)</label>
                <input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="input-field mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Address</label>
              <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="input-field mt-1" rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Phone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Manager</label>
                <input value={form.manager_name} onChange={e => setForm({ ...form, manager_name: e.target.value })} className="input-field mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary px-4 py-2">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-violet-600 text-white rounded-xl font-semibold">Create Branch</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
