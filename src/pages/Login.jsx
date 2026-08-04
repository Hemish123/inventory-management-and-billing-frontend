import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { CreditCard, Loader2, Eye, EyeOff, BarChart3, Shield, TrendingUp } from 'lucide-react';
import Modal from '../components/common/Modal';

export default function Login() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', password_confirm: '',
    username: '', first_name: '', last_name: '', company_name: '',
    company_gst: '', company_street: '', company_city: '', company_state: '', 
    company_pin: '', company_email: '', phone: '', bank_name: '', bank_account_number: '', bank_ifsc: '', company_logo: null
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    let result;
    if (isRegister) {
      const formData = new FormData();
      Object.keys(form).forEach(key => {
        if (key === 'username') {
           formData.append(key, form.email.split('@')[0]);
        } else if (form[key]) {
           formData.append(key, form[key]);
        }
      });
      result = await register(formData);
    } else {
      result = await login(form.email, form.password);
    }
    
    if (result?.success && result?.reactivated) {
      setShowReactivateModal(true);
    }
    setLoading(false);
  };

  const onChange = (e) => {
    if (e.target.type === 'file') {
      setForm({ ...form, [e.target.name]: e.target.files[0] });
    } else {
      setForm({ ...form, [e.target.name]: e.target.value });
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Light animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* Soft floating shapes */}
        <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-gradient-to-br from-brand-200/40 to-purple-200/30 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-32 -right-20 w-[600px] h-[600px] bg-gradient-to-tl from-teal-200/30 to-blue-200/30 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-gradient-to-r from-pink-100/40 to-amber-100/30 rounded-full blur-3xl animate-float" style={{ animationDelay: '5s' }} />
        {/* Dot pattern */}
        <div className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.06) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      {/* Left panel — branding (desktop) */}
      <div className="hidden lg:flex flex-col justify-center items-center flex-1 relative z-10 px-12">
        <div className="max-w-md space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 
                           flex items-center justify-center shadow-lg shadow-brand-500/25">
              <CreditCard className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="font-sora text-3xl font-bold text-slate-800">MSME PayTrack</h1>
              <p className="text-brand-500 text-sm font-medium">Smart Payment Dashboard</p>
            </div>
          </div>

          <p className="text-lg text-slate-600 leading-relaxed">
            Make confident credit decisions. Analyze payment history, identify reliable customers, 
            and assign smart credit timelines — all in one place.
          </p>

          {/* Feature cards */}
          <div className="space-y-3">
            {[
              { icon: BarChart3, text: 'AI-powered payment analysis with 10-year history support', color: 'from-brand-500 to-brand-600' },
              { icon: Shield, text: 'Smart credit scoring system with 5 automated tiers', color: 'from-emerald-500 to-teal-500' },
              { icon: TrendingUp, text: 'Real-time dashboards with interactive charts & heatmaps', color: 'from-amber-500 to-orange-500' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-4 bg-white/60 backdrop-blur-sm rounded-xl px-5 py-4 
                                      border border-white/80 shadow-sm animate-slide-up" style={{ animationDelay: `${i * 150}ms` }}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center flex-shrink-0 shadow-md`}>
                  <f.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm text-slate-600">{f.text}</span>
              </div>
            ))}
          </div>

          {/* <div className="flex items-center gap-6 pt-2 text-slate-400 text-xs font-medium">
            <span>🏢 Built for MSMEs</span>
            <span>📊 Excel Upload</span>
            <span>🔒 Secure JWT Auth</span>
          </div> */}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center relative z-10 p-6 lg:p-12">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 
                           flex items-center justify-center mx-auto mb-3 shadow-lg shadow-brand-500/25">
              <CreditCard className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-sora text-2xl font-bold text-slate-800">MSME PayTrack</h1>
            <p className="text-brand-500 text-sm mt-1">Smart Payment Dashboard</p>
          </div>

          {/* Form Card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-brand-500/5 p-8 border border-white">
            <h2 className="font-sora text-2xl font-bold text-slate-800 mb-1">
              {isRegister ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              {isRegister ? 'Start managing your MSME payments' : 'Sign in to your dashboard'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block font-medium">First Name</label>
                    <input name="first_name" value={form.first_name} onChange={onChange}
                      className="input-field" placeholder="Rajesh" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block font-medium">Last Name</label>
                    <input name="last_name" value={form.last_name} onChange={onChange}
                      className="input-field" placeholder="Kumar" />
                  </div>
                </div>
              )}

              {isRegister && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block font-medium">Company Name</label>
                      <input name="company_name" value={form.company_name} onChange={onChange}
                        className="input-field" placeholder="Your MSME Name" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block font-medium">Company GST</label>
                      <input name="company_gst" value={form.company_gst} onChange={onChange}
                        className="input-field" placeholder="e.g. 24BTIPD48..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block font-medium">Company Email</label>
                      <input name="company_email" type="email" value={form.company_email} onChange={onChange}
                        className="input-field" placeholder="info@company.com" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block font-medium">Company Phone</label>
                      <input name="phone" value={form.phone} onChange={onChange}
                        className="input-field" placeholder="+91..." />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block font-medium">Street Address</label>
                    <input name="company_street" value={form.company_street} onChange={onChange}
                      className="input-field" placeholder="Flat No, Building, Street" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block font-medium">City</label>
                      <input name="company_city" value={form.company_city} onChange={onChange} className="input-field" placeholder="City" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block font-medium">State</label>
                      <input name="company_state" value={form.company_state} onChange={onChange} className="input-field" placeholder="State" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block font-medium">PIN Code</label>
                      <input name="company_pin" value={form.company_pin} onChange={onChange} className="input-field" placeholder="PIN" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
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
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block font-medium">Company Logo (For Invoice Header)</label>
                    <input name="company_logo" type="file" accept="image/*" onChange={onChange}
                      className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-500 mb-1 block font-medium">Email</label>
                <input name="email" type="email" value={form.email} onChange={onChange}
                  className="input-field" placeholder="you@company.com" required />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1 block font-medium">Password</label>
                <div className="relative">
                  <input name="password" type={showPassword ? 'text' : 'password'}
                    value={form.password} onChange={onChange}
                    className="input-field pr-10" placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isRegister && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-medium">Confirm Password</label>
                  <input name="password_confirm" type="password"
                    value={form.password_confirm} onChange={onChange}
                    className="input-field" placeholder="••••••••" required />
                </div>
              )}

              <button type="submit" disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {isRegister ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-slate-500 hover:text-brand-600 transition-colors">
                {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
              </button>
            </div>

            {!isRegister && import.meta.env.DEV && (
              <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-brand-50 to-purple-50 border border-brand-100">
                <p className="text-xs text-slate-600">
                  <span className="text-brand-600 font-semibold">Demo:</span>{' '}
                  demo@msmepaytrack.com / demo1234
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal 
        isOpen={showReactivateModal} 
        onClose={() => {
          setShowReactivateModal(false);
          window.location.href = '/dashboard'; // Force refresh or use navigate
        }} 
        title="Welcome Back!"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Your account was previously deactivated, but it is now **active again**. 
            All your data has been restored.
          </p>
          <div className="flex justify-end pt-2">
            <button 
              onClick={() => {
                setShowReactivateModal(false);
                window.location.href = '/dashboard';
              }} 
              className="btn-primary"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
