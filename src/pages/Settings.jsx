import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setUser } from '../store/authSlice';
import { useAuth } from '../hooks/useAuth';
import { updateProfile } from '../api/authAPI';
import Navbar from '../components/common/Navbar';
import Modal from '../components/common/Modal';
import { User, Building2, Phone, Save, Loader2, Moon, Sun } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, logout, deleteAccount } = useAuth();
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    company_name: user?.company_name || '',
    company_gst: user?.company_gst || '',
    company_street: user?.company_street || '',
    company_city: user?.company_city || '',
    company_state: user?.company_state || '',
    company_pin: user?.company_pin || '',
    company_email: user?.company_email || '',
    bank_name: user?.bank_name || '',
    bank_account_number: user?.bank_account_number || '',
    bank_ifsc: user?.bank_ifsc || '',
    phone: user?.phone || '',
    company_logo: null
  });
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const dispatch = useDispatch();

  const handleSave = async () => {
    setSaving(true);
    const formData = new FormData();
    Object.keys(form).forEach(key => {
      // Don't append null/undefined, but DO append empty strings to clear fields.
      // Also ignore company_logo if it's explicitly null.
      if (form[key] !== null && form[key] !== undefined) {
        // If it's the logo but it's not a File object (meaning it wasn't updated), we can skip it.
        // Wait, if it's an empty string, it's a text field.
        formData.append(key, form[key]);
      }
    });
    const { data, error } = await updateProfile(formData);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Profile updated!');
      if (data && data.data) dispatch(setUser(data.data));
    }
    setSaving(false);
  };



  const onChange = (e) => {
    if (e.target.type === 'file') {
      setForm({ ...form, [e.target.name]: e.target.files[0] });
    } else {
      setForm({ ...form, [e.target.name]: e.target.value });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title="Settings" />
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="glass-card p-6 animate-slide-up">
          <h2 className="font-sora text-lg font-semibold text-slate-800 mb-6">Profile Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-brand-500/20">
                {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-800">{user?.email}</p>
                <p className="text-sm text-slate-400">MSME Owner</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 flex items-center gap-1 font-medium"><User className="w-3 h-3" /> First Name</label>
                <input name="first_name" value={form.first_name} onChange={onChange} className="input-field" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 flex items-center gap-1 font-medium"><User className="w-3 h-3" /> Last Name</label>
                <input name="last_name" value={form.last_name} onChange={onChange} className="input-field" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 flex items-center gap-1 font-medium"><Building2 className="w-3 h-3" /> Company Name</label>
                <input name="company_name" value={form.company_name} onChange={onChange} className="input-field" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 flex items-center gap-1 font-medium"><Building2 className="w-3 h-3" /> Company GST</label>
                <input name="company_gst" value={form.company_gst} onChange={onChange} className="input-field" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-slate-500 mb-1 block font-medium">Street Address</label>
                <input name="company_street" value={form.company_street} onChange={onChange} className="input-field" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block font-medium">City</label>
                <input name="company_city" value={form.company_city} onChange={onChange} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-medium">State</label>
                  <input name="company_state" value={form.company_state} onChange={onChange} className="input-field" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-medium">PIN</label>
                  <input name="company_pin" value={form.company_pin} onChange={onChange} className="input-field" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 flex items-center gap-1 font-medium"><Building2 className="w-3 h-3" /> Company Email</label>
                <input name="company_email" type="email" value={form.company_email} onChange={onChange} className="input-field" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 flex items-center gap-1 font-medium"><Phone className="w-3 h-3" /> Phone</label>
                <input name="phone" value={form.phone} onChange={onChange} className="input-field" />
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border border-slate-200 rounded-lg p-4">
                <div className="md:col-span-3">
                  <label className="text-xs text-slate-500 block font-medium">Bank Details (For Invoice Footer)</label>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-medium">Bank Name</label>
                  <input name="bank_name" value={form.bank_name} onChange={onChange} className="input-field" placeholder="HDFC Bank" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-medium">A/C Number</label>
                  <input name="bank_account_number" value={form.bank_account_number} onChange={onChange} className="input-field" placeholder="1234567890" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-medium">IFSC Code</label>
                  <input name="bank_ifsc" value={form.bank_ifsc} onChange={onChange} className="input-field" placeholder="HDFC000123" />
                </div>
              </div>
              <div className="md:col-span-2 border border-slate-200 rounded-lg p-4">
                <label className="text-xs text-slate-500 mb-2 block font-medium">Company Logo</label>
                {user?.company_logo && (
                  <div className="mb-3">
                    <p className="text-xs text-emerald-600 mb-1">Current Logo:</p>
                    <img src={
                      user.company_logo.startsWith('http') && !user.company_logo.includes('localhost') && !user.company_logo.includes('127.0.0.1')
                        ? user.company_logo 
                        : `${import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '')}${user.company_logo.replace(/^https?:\/\/[^\/]+/, '')}`
                    } alt="Logo" className="h-16 object-contain" />
                  </div>
                )}
                <input name="company_logo" type="file" accept="image/*" onChange={onChange}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-sora text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            Preferences
          </h2>
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
                {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-medium text-slate-800">Dark Mode</p>
                <p className="text-xs text-slate-500">Toggle dark theme for the application</p>
              </div>
            </div>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`w-12 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-brand-500' : 'bg-slate-300'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${darkMode ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <div className="glass-card p-6 border border-rose-200">
          <h3 className="font-sora text-lg font-semibold text-rose-600 mb-2">Danger Zone</h3>
          <p className="text-sm text-slate-500 mb-4">Once you log out or delete your account, you'll need to sign in again.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={logout} className="btn-danger bg-rose-100 text-rose-600 hover:bg-rose-200">Logout</button>
            <button onClick={() => setShowDeleteModal(true)} className="btn-danger">Delete Account</button>
          </div>
        </div>

        <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Account">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete your account? This action will deactivate your account. 
              You can reactivate it later by simply logging in again.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={async () => {
                const success = await deleteAccount();
                if (success) setShowDeleteModal(false);
              }} className="btn-danger">Yes, Deactivate My Account</button>
            </div>
          </div>
        </Modal>

      </div>
    </div>
  );
}
