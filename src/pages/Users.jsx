import { useState, useEffect } from 'react';
import Navbar from '../components/common/Navbar';
import Table from '../components/common/Table';
import Modal from '../components/common/Modal';
import { SkeletonTable } from '../components/common/LoadingSpinner';
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from '../api/authAPI';
import { getBranchDropdown } from '../api/coreAPI';
import { Plus, UserCog, User, Shield, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState(null);
  
  const defaultForm = {
    first_name: '', last_name: '', email: '', username: '',
    role: 'EMPLOYEE', phone: '', assigned_branch: '', is_active: true
  };
  const [form, setForm] = useState(defaultForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, branchRes] = await Promise.all([
        getEmployees(),
        getBranchDropdown()
      ]);
      if (empRes.data?.data) {
        setUsers(Array.isArray(empRes.data.data) ? empRes.data.data : empRes.data.data.results || []);
      }
      if (branchRes.data?.data) {
        setBranches(branchRes.data.data);
      }
    } catch (err) {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Auto-generate username from email if empty
    const payload = { ...form };
    if (!payload.username) payload.username = payload.email;
    if (!payload.assigned_branch) delete payload.assigned_branch;

    let data, error;
    if (editId) {
      ({ data, error } = await updateEmployee(editId, payload));
    } else {
      ({ data, error } = await createEmployee(payload));
    }
    setSubmitting(false);
    
    if (data) {
      toast.success(editId ? 'User updated successfully' : 'User created successfully. Default password is Password123!');
      handleCloseModal();
      loadData();
    } else {
      toast.error(error || (editId ? 'Failed to update user' : 'Failed to create user'));
    }
  };

  const handleEdit = (user) => {
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      username: user.username || '',
      role: user.role_name || 'EMPLOYEE',
      phone: user.phone || '',
      assigned_branch: user.assigned_branch || '',
      is_active: user.is_active
    });
    setEditId(user.id);
    setShowModal(true);
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to delete ${user.first_name} ${user.last_name}?`)) return;
    const { error } = await deleteEmployee(user.id);
    if (!error) {
      toast.success('User deleted');
      loadData();
    } else {
      toast.error(error);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditId(null);
    setForm(defaultForm);
  };

  const columns = [
    { key: 'name', label: 'User', render: (_, row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
          <User className="w-4 h-4 text-indigo-500" />
        </div>
        <div>
          <p className="font-medium text-slate-800 text-sm">{row.first_name} {row.last_name}</p>
          <p className="text-xs text-slate-400">{row.email}</p>
        </div>
      </div>
    )},
    { key: 'role_name', label: 'Role', render: (val) => (
      <span className="flex items-center gap-1 text-sm font-medium text-slate-600">
        <Shield className="w-3 h-3" /> {val || 'N/A'}
      </span>
    )},
    { key: 'is_active', label: 'Status', render: (val) => (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${val ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
        {val ? 'Active' : 'Inactive'}
      </span>
    )},
    { key: 'phone', label: 'Phone', render: (val) => <span className="text-sm text-slate-600">{val || '-'}</span> },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => handleEdit(row)} className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
          <UserCog className="w-4 h-4" />
        </button>
        <button onClick={() => handleDelete(row)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )},
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="User Management" />
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-500/20">
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? <div className="p-6"><SkeletonTable rows={5} cols={5} /></div> : (
            <Table columns={columns} data={users} />
          )}
        </div>
      </div>

      {showModal && (
        <Modal title={editId ? "Edit User" : "Add User"} onClose={handleCloseModal}>
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500">First Name *</label>
                <input required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })}
                  className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Last Name *</label>
                <input required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })}
                  className="input-field mt-1" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500">Email *</label>
                <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input-field mt-1" disabled={!!editId} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Phone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="input-field mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500">Role *</label>
                <select required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="input-field mt-1">
                  <option value="EMPLOYEE">Employee</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Assigned Branch</label>
                <select value={form.assigned_branch} onChange={e => setForm({ ...form, assigned_branch: e.target.value })}
                  className="input-field mt-1">
                  <option value="">None (All Branches)</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>

            {editId && (
              <div className="grid grid-cols-1 gap-4">
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" />
                  <span className="text-sm font-medium text-slate-700">Account Active</span>
                </label>
              </div>
            )}

            {!editId && (
              <div className="bg-amber-50 text-amber-700 text-xs p-3 rounded-lg border border-amber-100 mt-2">
                <strong>Note:</strong> The user's default password will be set to <code>Password123!</code>. They will be required to change it upon first login.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={handleCloseModal} className="btn-secondary px-4 py-2">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {submitting ? 'Saving...' : (editId ? 'Save Changes' : 'Create User')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
