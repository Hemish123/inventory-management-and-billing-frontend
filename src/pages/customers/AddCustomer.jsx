import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../../components/common/Navbar';
import { createCustomer, getCustomer, updateCustomer } from '../../api/customerAPI';
import { Save, X, Plus, Trash2, Copy, Loader2 } from 'lucide-react';

const TABS = ['Other Details', 'Address', 'Contact Persons', 'Custom Fields', 'Reporting Tags', 'Remarks'];
const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];
const GST_TREATMENTS = [
  'Registered Business - Regular', 'Registered Business - Composition',
  'Unregistered Business', 'Consumer', 'Overseas',
  'Special Economic Zone', 'Deemed Export',
];
const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh','Puducherry',
  'Chandigarh','Dadra & Nagar Haveli','Daman & Diu','Lakshadweep','Andaman & Nicobar Islands',
];
const LANGUAGES = ['English', 'Hindi', 'Gujarati', 'Marathi', 'Tamil'];
const PAYMENT_TERMS = [
  { label: 'Due on Receipt', value: 0 }, { label: 'Net 15', value: 15 },
  { label: 'Net 30', value: 30 }, { label: 'Net 45', value: 45 },
  { label: 'Net 60', value: 60 }, { label: 'Net 90', value: 90 },
];
const COUNTRY_CODES = ['+91 India', '+1 USA', '+44 UK', '+971 UAE', '+65 SG'];
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

const initialForm = {
  customer_type: 'Business', salutation: '', first_name: '', last_name: '',
  company: '', display_name: '', email: '', work_phone: '', mobile: '',
  customer_language: 'English', gst_treatment: '', gstin: '',
  place_of_supply: '', pan_number: '', tax_preference: 'Taxable',
  currency: 'INR', opening_balance: '', payment_terms_days: 0,
  billing_attention: '', billing_country: 'India', billing_street1: '',
  billing_street2: '', billing_city: '', billing_state: '', billing_zip: '',
  shipping_attention: '', shipping_country: 'India', shipping_street1: '',
  shipping_street2: '', shipping_city: '', shipping_state: '', shipping_zip: '',
  contact_persons: [], remarks: '',
};

const emptyContact = { salutation: '', first_name: '', last_name: '', email: '', work_phone: '', mobile: '' };

export default function AddCustomer() {
  const { id } = useParams();
  const isEdit = !!id;
  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState({ ...initialForm });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const navigate = useNavigate();

  useEffect(() => {
    if (isEdit) {
      loadCustomer();
    }
  }, [id]);

  const loadCustomer = async () => {
    setFetching(true);
    const { data, error } = await getCustomer(id);
    if (data) {
      const c = data.data || data;
      setForm({
        customer_type: c.customer_type || 'Business',
        salutation: c.salutation || '',
        first_name: c.first_name || '',
        last_name: c.last_name || '',
        company: c.company || '',
        display_name: c.display_name || '',
        email: c.email || '',
        work_phone: c.work_phone || '',
        mobile: c.mobile || '',
        customer_language: c.customer_language || 'English',
        gst_treatment: c.gst_treatment || '',
        gstin: c.gstin || '',
        place_of_supply: c.place_of_supply || '',
        pan_number: c.pan_number || '',
        tax_preference: c.tax_preference || 'Taxable',
        currency: c.currency || 'INR',
        opening_balance: c.opening_balance || '',
        payment_terms_days: c.payment_terms_days || 0,
        billing_attention: c.billing_attention || '',
        billing_country: c.billing_country || 'India',
        billing_street1: c.billing_street1 || '',
        billing_street2: c.billing_street2 || '',
        billing_city: c.billing_city || '',
        billing_state: c.billing_state || '',
        billing_zip: c.billing_zip || '',
        shipping_attention: c.shipping_attention || '',
        shipping_country: c.shipping_country || 'India',
        shipping_street1: c.shipping_street1 || '',
        shipping_street2: c.shipping_street2 || '',
        shipping_city: c.shipping_city || '',
        shipping_state: c.shipping_state || '',
        shipping_zip: c.shipping_zip || '',
        contact_persons: c.contact_persons || [],
        remarks: c.remarks || '',
      });
    } else {
      toast.error('Failed to load customer details');
      navigate('/customers');
    }
    setFetching(false);
  };

  const set = (field, val) => setForm(p => ({ ...p, [field]: val }));
  const onChange = (e) => {
    let { name, value } = e.target;
    if (name === 'gstin' || name === 'pan_number') {
      value = value.toUpperCase();
    }
    set(name, value);
  };

  const displaySuggestions = () => {
    const parts = [];
    if (form.first_name && form.last_name) parts.push(`${form.first_name} ${form.last_name}`);
    if (form.company) parts.push(form.company);
    if (form.first_name) parts.push(form.first_name);
    return [...new Set(parts)];
  };

  const copyBillingToShipping = () => {
    setForm(p => ({
      ...p,
      shipping_attention: p.billing_attention, shipping_country: p.billing_country,
      shipping_street1: p.billing_street1, shipping_street2: p.billing_street2,
      shipping_city: p.billing_city, shipping_state: p.billing_state, shipping_zip: p.billing_zip,
    }));
    toast.success('Billing address copied to shipping');
  };

  const addContact = () => setForm(p => ({ ...p, contact_persons: [...p.contact_persons, { ...emptyContact }] }));
  const removeContact = (i) => setForm(p => ({ ...p, contact_persons: p.contact_persons.filter((_, idx) => idx !== i) }));
  const updateContact = (i, field, val) => {
    setForm(p => {
      const cp = [...p.contact_persons];
      cp[i] = { ...cp[i], [field]: val };
      return { ...p, contact_persons: cp };
    });
  };

  const validate = () => {
    const e = {};
    if (!form.display_name && !form.first_name) e.display_name = 'Display Name is required';
    if (!form.email) e.email = 'Email is required';
    if (form.gstin && !GST_REGEX.test(form.gstin.trim())) e.gstin = 'Invalid GSTIN format';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) { toast.error('Please fix validation errors'); return; }
    setLoading(true);
    const name = form.display_name || `${form.first_name} ${form.last_name}`.trim() || form.company;
    const payload = { ...form, name, phone: form.work_phone || form.mobile, address: [form.billing_street1, form.billing_street2, form.billing_city, form.billing_state, form.billing_zip].filter(Boolean).join(', ') };
    if (!payload.opening_balance) delete payload.opening_balance;
    
    const { data, error } = isEdit 
      ? await updateCustomer(id, payload)
      : await createCustomer(payload);

    setLoading(false);
    if (error) { 
      toast.error(typeof error === 'string' ? error : `Failed to ${isEdit ? 'update' : 'save'} customer`); 
    }
    else { 
      toast.success(`Customer ${isEdit ? 'updated' : 'saved'} successfully!`); 
      navigate('/customers'); 
    }
  };

  const inputCls = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#1a2744] focus:ring-2 focus:ring-[#1a2744]/15 transition-all';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';
  const reqStar = <span className="text-rose-500 ml-0.5">*</span>;

  // ─── TAB CONTENT ────────────────────────────────────────────────────
  const renderBasicInfo = () => (
    <div className="space-y-5">
      {/* Customer Type */}
      <div>
        <label className={labelCls}>Customer Type</label>
        <div className="flex gap-4 mt-1">
          {['Business', 'Individual'].map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="radio" name="customer_type" value={t} checked={form.customer_type === t} onChange={onChange} className="accent-[#1a2744]" />
              {t}
            </label>
          ))}
        </div>
      </div>
      {/* Primary Contact */}
      <div>
        <label className={labelCls}>Primary Contact</label>
        <div className="grid grid-cols-3 gap-3 mt-1">
          <select name="salutation" value={form.salutation} onChange={onChange} className={`${inputCls} bg-white`}>
            <option value="">Salutation</option>
            {SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input name="first_name" value={form.first_name} onChange={onChange} placeholder="First Name" className={inputCls} />
          <input name="last_name" value={form.last_name} onChange={onChange} placeholder="Last Name" className={inputCls} />
        </div>
      </div>
      {/* Company */}
      <div>
        <label className={labelCls}>Company Name</label>
        <input name="company" value={form.company} onChange={onChange} placeholder="Company Name" className={inputCls} />
      </div>
      {/* Display Name */}
      <div>
        <label className={labelCls}>Display Name{reqStar}</label>
        <input name="display_name" value={form.display_name} onChange={onChange} placeholder="Display Name" className={inputCls} list="display-suggestions" />
        <datalist id="display-suggestions">{displaySuggestions().map((s, i) => <option key={i} value={s} />)}</datalist>
        {errors.display_name && <p className="text-rose-500 text-xs mt-1">{errors.display_name}</p>}
      </div>
      {/* Email */}
      <div>
        <label className={labelCls}>Email Address{reqStar}</label>
        <input name="email" type="email" value={form.email} onChange={onChange} placeholder="email@example.com" className={inputCls} />
        {errors.email && <p className="text-rose-500 text-xs mt-1">{errors.email}</p>}
      </div>
      {/* Phones */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Work Phone</label>
          <input name="work_phone" value={form.work_phone} onChange={onChange} placeholder="+91-XXXXXXXXXX" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Mobile</label>
          <input name="mobile" value={form.mobile} onChange={onChange} placeholder="+91-XXXXXXXXXX" className={inputCls} />
        </div>
      </div>
      {/* Language */}
      <div>
        <label className={labelCls}>Customer Language</label>
        <select name="customer_language" value={form.customer_language} onChange={onChange} className={`${inputCls} bg-white`}>
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
    </div>
  );

  const renderOtherDetails = () => (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>GST Treatment{reqStar}</label>
        <select name="gst_treatment" value={form.gst_treatment} onChange={onChange} className={`${inputCls} bg-white`}>
          <option value="">Select a GST treatment</option>
          {GST_TREATMENTS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        {errors.gst_treatment && <div className="mt-1.5 bg-rose-50 border border-rose-200 text-rose-600 px-3 py-1.5 rounded text-xs flex items-center gap-1.5"><span>⚠</span>{errors.gst_treatment}</div>}
      </div>
      <div>
        <label className={labelCls}>GSTIN</label>
        <input name="gstin" value={form.gstin} onChange={onChange} placeholder="22AAAAA0000A1Z5" maxLength={15} className={`${inputCls} font-mono uppercase`} />
        {errors.gstin && <p className="text-rose-500 text-xs mt-1">{errors.gstin}</p>}
      </div>
      <div>
        <label className={labelCls}>Place of Supply{reqStar}</label>
        <select name="place_of_supply" value={form.place_of_supply} onChange={onChange} className={`${inputCls} bg-white`}>
          <option value="">Select state</option>
          {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>PAN</label>
        <input name="pan_number" value={form.pan_number} onChange={onChange} placeholder="AAAAA0000A" maxLength={10} className={`${inputCls} font-mono uppercase`} />
      </div>
      <div>
        <label className={labelCls}>Tax Preference{reqStar}</label>
        <div className="flex gap-4 mt-1">
          {['Taxable', 'Tax Exempt'].map(t => (
            <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="radio" name="tax_preference" value={t} checked={form.tax_preference === t} onChange={onChange} className="accent-[#1a2744]" />
              {t}
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Currency</label>
          <select name="currency" value={form.currency} onChange={onChange} className={`${inputCls} bg-white`}>
            <option value="INR">INR - Indian Rupee</option>
            <option value="USD">USD - US Dollar</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="EUR">EUR - Euro</option>
            <option value="AED">AED - UAE Dirham</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Opening Balance</label>
          <input name="opening_balance" type="number" step="0.01" value={form.opening_balance} onChange={onChange} placeholder="0.00" className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Payment Terms</label>
        <select name="payment_terms_days" value={form.payment_terms_days} onChange={(e) => set('payment_terms_days', parseInt(e.target.value))} className={`${inputCls} bg-white`}>
          {PAYMENT_TERMS.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
        </select>
      </div>
    </div>
  );

  const AddressCol = ({ prefix, label }) => (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm text-slate-700">{label}</h4>
      <div><label className={labelCls}>Attention</label><input name={`${prefix}_attention`} value={form[`${prefix}_attention`]} onChange={onChange} className={inputCls} /></div>
      <div><label className={labelCls}>Country/Region</label><input name={`${prefix}_country`} value={form[`${prefix}_country`]} onChange={onChange} className={inputCls} /></div>
      <div><label className={labelCls}>Street 1</label><textarea name={`${prefix}_street1`} value={form[`${prefix}_street1`]} onChange={onChange} rows={2} className={`${inputCls} resize-none`} /></div>
      <div><label className={labelCls}>Street 2</label><textarea name={`${prefix}_street2`} value={form[`${prefix}_street2`]} onChange={onChange} rows={2} className={`${inputCls} resize-none`} /></div>
      <div><label className={labelCls}>City</label><input name={`${prefix}_city`} value={form[`${prefix}_city`]} onChange={onChange} className={inputCls} /></div>
      <div>
        <label className={labelCls}>State</label>
        <select name={`${prefix}_state`} value={form[`${prefix}_state`]} onChange={onChange} className={`${inputCls} bg-white`}>
          <option value="">Select state</option>
          {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div><label className={labelCls}>ZIP</label><input name={`${prefix}_zip`} value={form[`${prefix}_zip`]} onChange={onChange} className={inputCls} /></div>
    </div>
  );

  const renderAddress = () => (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <AddressCol prefix="billing" label="Billing Address" />
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm text-slate-700">Shipping Address</h4>
            <button type="button" onClick={copyBillingToShipping} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
              <Copy className="w-3 h-3" /> Copy billing address
            </button>
          </div>
          <div className="space-y-3">
            <div><label className={labelCls}>Attention</label><input name="shipping_attention" value={form.shipping_attention} onChange={onChange} className={inputCls} /></div>
            <div><label className={labelCls}>Country/Region</label><input name="shipping_country" value={form.shipping_country} onChange={onChange} className={inputCls} /></div>
            <div><label className={labelCls}>Street 1</label><textarea name="shipping_street1" value={form.shipping_street1} onChange={onChange} rows={2} className={`${inputCls} resize-none`} /></div>
            <div><label className={labelCls}>Street 2</label><textarea name="shipping_street2" value={form.shipping_street2} onChange={onChange} rows={2} className={`${inputCls} resize-none`} /></div>
            <div><label className={labelCls}>City</label><input name="shipping_city" value={form.shipping_city} onChange={onChange} className={inputCls} /></div>
            <div><label className={labelCls}>State</label><select name="shipping_state" value={form.shipping_state} onChange={onChange} className={`${inputCls} bg-white`}><option value="">Select state</option>{INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className={labelCls}>ZIP</label><input name="shipping_zip" value={form.shipping_zip} onChange={onChange} className={inputCls} /></div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContactPersons = () => (
    <div>
      {form.contact_persons.length > 0 && (
        <div className="overflow-x-auto border border-slate-200 rounded-xl mb-4">
          <table className="w-full min-w-[700px] text-sm">
            <thead><tr className="bg-slate-50 text-xs uppercase text-slate-500">
              <th className="px-3 py-2 text-left">Salutation</th><th className="px-3 py-2 text-left">First Name</th>
              <th className="px-3 py-2 text-left">Last Name</th><th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Work Phone</th><th className="px-3 py-2 text-left">Mobile</th>
              <th className="px-3 py-2 w-10"></th>
            </tr></thead>
            <tbody>{form.contact_persons.map((cp, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-2 py-1.5"><select value={cp.salutation} onChange={e => updateContact(i, 'salutation', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs w-full"><option value="">--</option>{SALUTATIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></td>
                <td className="px-2 py-1.5"><input value={cp.first_name} onChange={e => updateContact(i, 'first_name', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs w-full" /></td>
                <td className="px-2 py-1.5"><input value={cp.last_name} onChange={e => updateContact(i, 'last_name', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs w-full" /></td>
                <td className="px-2 py-1.5"><input value={cp.email} onChange={e => updateContact(i, 'email', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs w-full" /></td>
                <td className="px-2 py-1.5"><input value={cp.work_phone} onChange={e => updateContact(i, 'work_phone', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs w-full" /></td>
                <td className="px-2 py-1.5"><input value={cp.mobile} onChange={e => updateContact(i, 'mobile', e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs w-full" /></td>
                <td className="px-2 py-1.5"><button onClick={() => removeContact(i)} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <button type="button" onClick={addContact} className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium">
        <Plus className="w-4 h-4" /> Add Contact Person
      </button>
    </div>
  );

  const tabContent = [
    renderOtherDetails(),
    renderAddress(),
    renderContactPersons(),
    <div className="py-8 text-center text-slate-400 text-sm">No custom fields configured.</div>,
    <div className="py-8 text-center text-slate-400 text-sm">No reporting tags available.</div>,
    <div><label className={labelCls}>Remarks</label><textarea name="remarks" value={form.remarks} onChange={onChange} rows={5} placeholder="Internal notes about this customer..." className={`${inputCls} resize-none`} /></div>,
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <Navbar title={isEdit ? 'Edit Customer' : 'Add Customer'} />
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {fetching ? (
            <div className="flex flex-col items-center justify-center h-[600px] text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
              <p className="font-medium">Fetching customer details...</p>
            </div>
          ) : (
            <>
              {/* Basic Info (always visible at top) */}
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 mb-5">Basic Information</h3>
                {renderBasicInfo()}
              </div>

              {/* Tabs */}
              <div className="border-b border-slate-200">
                <div className="flex overflow-x-auto px-6">
                  {TABS.map((tab, i) => (
                    <button key={tab} onClick={() => setActiveTab(i)}
                      className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-all -mb-px
                        ${activeTab === i ? 'text-[#1a2744] border-[#1a2744] font-semibold' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                    >{tab}</button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">{tabContent[activeTab]}</div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
                <button onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button onClick={handleSubmit} disabled={loading} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1a2744] hover:bg-[#243352] shadow-md transition-all disabled:opacity-60 flex items-center gap-1.5">
                  <Save className="w-4 h-4" /> {loading ? (isEdit ? 'Updating...' : 'Saving...') : (isEdit ? 'Update' : 'Save')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
