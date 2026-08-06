import { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from '../../components/common/Navbar';
import Modal from '../../components/common/Modal';
import { barcodeLookup, getProductDropdown } from '../../api/productsAPI';
import { createBill, getDrafts, resumeDraft, discardDraft, finalizeBill } from '../../api/billingAPI';
import { getBranchDropdown } from '../../api/coreAPI';
import { formatCurrency, formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';
import {
  ScanLine, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  Banknote, Smartphone, X, Printer, Search, PauseCircle, PlayCircle,
  Keyboard, HelpCircle, FileText
} from 'lucide-react';

const PAYMENT_ICONS = {
  CASH: Banknote, UPI: Smartphone, CARD: CreditCard, NET_BANKING: CreditCard, SPLIT: Banknote,
};

export default function POSPage() {
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [productList, setProductList] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [draftsList, setDraftsList] = useState([]);
  const [branches, setBranches] = useState([]);
  
  const [selectedBranch, setSelectedBranch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountReceived, setAmountReceived] = useState('');
  const [discountType, setDiscountType] = useState('NONE');
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [lastBill, setLastBill] = useState(null);
  const [activeDraftId, setActiveDraftId] = useState(null);
  
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  const barcodeRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    loadBranches();
    loadProducts();
    barcodeRef.current?.focus();
  }, []);

  const loadBranches = async () => {
    const { data } = await getBranchDropdown();
    if (data?.data) {
      setBranches(data.data);
      if (data.data.length > 0) setSelectedBranch(data.data[0].id);
    }
  };

  const loadProducts = async () => {
    const { data } = await getProductDropdown();
    if (data?.data) setProductList(data.data);
  };

  const loadDrafts = async () => {
    if (!selectedBranch) return toast.error('Select a branch to view drafts');
    const { data } = await getDrafts({ branch: selectedBranch });
    if (data?.data) {
      setDraftsList(data.data);
      setShowDrafts(true);
    }
  };

  useEffect(() => {
    // Check URL for draftId to auto-resume
    const params = new URLSearchParams(window.location.search);
    const draftId = params.get('draftId');
    if (draftId && !activeDraftId) {
      handleResumeDraft(draftId);
      // Clean up URL without refreshing
      window.history.replaceState({}, '', '/pos');
    }
  }, []); // Run once on mount

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in textareas or inputs other than specific ones
      if (e.key === 'F1') { e.preventDefault(); barcodeRef.current?.focus(); }
      if (e.key === 'F2') { e.preventDefault(); setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 100); }
      if (e.key === 'F4') { e.preventDefault(); if(cart.length > 0) handleHoldBill(); }
      if (e.key === 'F7') { e.preventDefault(); setPaymentMethod('CASH'); }
      if (e.key === 'F8') { e.preventDefault(); setPaymentMethod('UPI'); }
      if (e.key === 'F9') { e.preventDefault(); if(cart.length > 0 && !submitting) handleSubmit(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, submitting]);

  const addToCart = useCallback((product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product === product.id);
      if (existing) {
        return prev.map(c =>
          c.product === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        product: product.id,
        product_name: product.name,
        barcode: product.barcode || '',
        hsn_code: product.hsn_code || '',
        unit_price: parseFloat(product.selling_price || product.unit_price),
        tax_percentage: product.tax_percentage || 0,
        quantity: 1,
        discount_type: 'NONE',
        discount_percentage: 0,
        discount_amount: 0,
      }];
    });
  }, []);

  const handleBarcodeScan = async (e) => {
    if (e.key !== 'Enter') return;
    
    // Read directly from the DOM event to avoid React state closure timing issues with fast barcode scanners
    const code = e.target.value.trim();
    if (!code) return;
    
    // Clear the React state and the DOM value immediately
    setBarcodeInput('');
    e.target.value = '';
    
    const { data, error } = await barcodeLookup(code);
    if (data?.data) {
      addToCart(data.data);
    } else {
      toast.error(error || 'Product not found');
    }
  };

  const updateQty = (idx, delta) => {
    setCart(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      const newQty = c.quantity + delta;
      return newQty > 0 ? { ...c, quantity: newQty } : c;
    }));
  };

  const setItemDiscount = (idx, type, value) => {
    setCart(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      return { ...c, discount_type: type, [type === 'PERCENTAGE' ? 'discount_percentage' : 'discount_amount']: value };
    }));
  };

  const removeItem = (idx) => setCart(prev => prev.filter((_, i) => i !== idx));

  const resetForm = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setAmountReceived('');
    setDiscountType('NONE');
    setDiscountValue(0);
    setNotes('');
    setActiveDraftId(null);
    barcodeRef.current?.focus();
  };

  // Calculations
  let subtotal = 0;
  let taxTotal = 0;
  
  const processedCart = cart.map(c => {
    const base = c.unit_price * c.quantity;
    let itemDisc = 0;
    if (c.discount_type === 'PERCENTAGE') itemDisc = base * (c.discount_percentage / 100);
    else if (c.discount_type === 'FIXED') itemDisc = c.discount_amount;
    
    const afterDisc = base - itemDisc;
    const tax = afterDisc * (c.tax_percentage / 100);
    
    subtotal += base;
    taxTotal += tax;
    
    return {
      ...c,
      discount_amount: parseFloat(itemDisc.toFixed(2)),
      tax_amount: parseFloat(tax.toFixed(2)),
      line_total: parseFloat((afterDisc + tax).toFixed(2)),
    };
  });

  let overallDisc = 0;
  if (discountType === 'PERCENTAGE') overallDisc = subtotal * (discountValue / 100);
  else if (discountType === 'FIXED') overallDisc = discountValue;

  const preRoundTotal = subtotal + taxTotal - overallDisc;
  const grandTotal = Math.round(preRoundTotal);
  const roundOff = grandTotal - preRoundTotal;
  
  const changeDue = Math.max(0, (parseFloat(amountReceived) || grandTotal) - grandTotal);

  const buildPayload = (saveAsHold = false) => {
    return {
      branch_id: selectedBranch,
      customer_name: customerName || 'Walk-in Customer',
      customer_phone: customerPhone,
      payment_method: paymentMethod,
      amount_received: parseFloat(amountReceived) || grandTotal,
      discount_type: discountType,
      discount_percentage: discountType === 'PERCENTAGE' ? discountValue : 0,
      discount_amount: parseFloat(overallDisc.toFixed(2)),
      round_off: parseFloat(roundOff.toFixed(2)),
      notes,
      items: processedCart,
      save_as_hold: saveAsHold,
    };
  };

  const handleHoldBill = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    if (!selectedBranch) return toast.error('Select a branch');
    
    setSubmitting(true);
    const payload = buildPayload(true);
    
    // Discard old draft to replace it if it exists
    if (activeDraftId) {
      await discardDraft(activeDraftId);
    }
    
    const { data, error } = await createBill(payload);
    setSubmitting(false);
    
    if (data?.data) {
      toast.success('Draft saved');
      resetForm();
    } else toast.error(error || 'Failed to save draft');
  };

  const handleResumeDraft = async (draftId) => {
    // Auto-save current bill as draft if cart is not empty and it's not the same draft
    if (cart.length > 0 && activeDraftId !== draftId) {
      try {
        const payload = buildPayload(true);
        if (activeDraftId) {
          await discardDraft(activeDraftId);
        }
        await createBill(payload);
        toast.success('Current bill auto-saved as draft');
      } catch (err) {
        console.error('Auto-save draft failed', err);
      }
    }

    const { data } = await resumeDraft(draftId);
    if (data?.data) {
      const bill = data.data;
      setCart(bill.items.map(i => ({
        ...i,
        product: i.product,
        unit_price: parseFloat(i.unit_price),
        discount_type: i.discount_type || 'NONE',
        discount_percentage: parseFloat(i.discount_percentage || 0),
        discount_amount: parseFloat(i.discount_amount || 0),
      })));
      setCustomerName(bill.customer_name === 'Walk-in Customer' ? '' : bill.customer_name);
      setCustomerPhone(bill.customer_phone);
      setDiscountType(bill.discount_type || 'NONE');
      setDiscountValue(bill.discount_type === 'PERCENTAGE' ? parseFloat(bill.discount_percentage) : parseFloat(bill.discount_amount));
      setNotes(bill.notes);
      setActiveDraftId(bill.id);
      setShowDrafts(false);
      toast.success(`Resumed bill ${bill.bill_number}`);
      
      // Focus barcode input so subsequent scans add directly to cart
      setTimeout(() => {
        barcodeRef.current?.focus();
      }, 100);
    }
  };

  const handleDiscardDraft = async (draftId) => {
    if (!window.confirm('Delete this draft?')) return;
    const { error } = await discardDraft(draftId);
    if (!error) {
      toast.success('Draft discarded');
      loadDrafts();
      if (activeDraftId === draftId) resetForm();
    }
  };

  const handleSubmit = async () => {
    if (!selectedBranch) return toast.error('Select a branch');
    if (cart.length === 0) return toast.error('Add items to cart');

    setSubmitting(true);
    const payload = buildPayload(false);

    let res;
    if (activeDraftId) {
      // Discard the old draft because finalizeBill doesn't update new line items added during Resume
      await discardDraft(activeDraftId);
      res = await createBill(payload);
    } else {
      res = await createBill(payload);
    }

    setSubmitting(false);

    if (res.data?.data) {
      toast.success(`Bill ${res.data.data.bill_number} completed!`);
      setLastBill(res.data.data);
      resetForm();
      
      // Auto-print thermal receipt
      const printUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/billing/${res.data.data.id}/pdf/`;
      const printWindow = window.open(printUrl, '_blank');
      if(printWindow) {
        printWindow.onload = () => printWindow.print();
      }
    } else {
      toast.error(res.error || 'Failed to complete sale');
    }
  };

  const filteredProducts = productList.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode?.includes(searchQuery)
  );

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
      <Navbar title="Point of Sale">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowShortcuts(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Keyboard className="w-4 h-4" /> Shortcuts
          </button>
          <button onClick={loadDrafts} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors">
            <PauseCircle className="w-4 h-4" /> Drafts
          </button>
        </div>
      </Navbar>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Cart & Search */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-slate-200">
          
          {/* Top Barcode/Search Area */}
          <div className="p-4 bg-white shadow-sm z-10 flex gap-3">
            <div className="flex-1 relative">
              <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500" />
              <input ref={barcodeRef} type="text" value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeScan}
                placeholder="Scan barcode or enter code (F1)..."
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl font-mono text-lg transition-all outline-none shadow-inner"
                autoFocus />
            </div>
            <button onClick={() => { setShowSearch(!showSearch); if(!showSearch) setTimeout(() => searchRef.current?.focus(), 100); }}
              className={`px-5 py-3 rounded-xl flex items-center gap-2 font-medium transition-all ${showSearch ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Search className="w-5 h-5" /> F2
            </button>
          </div>

          {/* Product search slide-down */}
          {showSearch && (
            <div className="border-b border-slate-200 bg-white p-4 shadow-md z-20 absolute top-[140px] left-0 right-[384px] max-h-[50vh] flex flex-col">
              <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products by name..." className="input-field mb-3" />
              <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                {filteredProducts.slice(0, 50).map(p => (
                  <button key={p.id} onClick={() => { addToCart(p); setShowSearch(false); setSearchQuery(''); barcodeRef.current?.focus(); }}
                    className="w-full flex items-center justify-between py-3 px-3 hover:bg-indigo-50 rounded-xl text-left transition-colors">
                    <div>
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{p.barcode || p.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-indigo-600">{formatCurrency(p.selling_price)}</p>
                      <p className="text-xs text-slate-400">Stock: {p.total_stock}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cart Table */}
          <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <ShoppingCart className="w-12 h-12 text-slate-300" />
                  </div>
                  <p className="text-xl font-medium text-slate-500">Cart is empty</p>
                  <p className="text-sm mt-2">Scan items to begin sale</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="p-4 w-12 text-center">#</th>
                      <th className="p-4">Item</th>
                      <th className="p-4 w-32 text-center">Qty</th>
                      <th className="p-4 text-right">Price</th>
                      <th className="p-4 text-right">Total</th>
                      <th className="p-4 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {processedCart.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-indigo-50/30 transition-colors">
                        <td className="p-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="p-4">
                          <p className="font-bold text-slate-800">{item.product_name}</p>
                          <p className="text-xs text-slate-500 mt-1 font-mono">{item.barcode}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center bg-slate-100 rounded-lg p-1">
                            <button onClick={() => updateQty(idx, -1)} className="w-8 h-8 rounded bg-white shadow-sm flex items-center justify-center text-slate-600 hover:text-indigo-600 transition-colors">
                              <Minus className="w-4 h-4" />
                            </button>
                            <input type="number" min="1" value={item.quantity} onChange={e => setCart(prev => prev.map((c, i) => i === idx ? {...c, quantity: parseInt(e.target.value)||1} : c))} 
                              className="w-12 text-center bg-transparent font-bold text-slate-800 outline-none" />
                            <button onClick={() => updateQty(idx, 1)} className="w-8 h-8 rounded bg-white shadow-sm flex items-center justify-center text-slate-600 hover:text-indigo-600 transition-colors">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <p className="font-medium text-slate-700">{formatCurrency(item.unit_price)}</p>
                          {item.tax_percentage > 0 && <p className="text-xs text-amber-500 mt-1">+{item.tax_percentage}% GST</p>}
                        </td>
                        <td className="p-4 text-right font-bold text-slate-800 text-lg">
                          {formatCurrency(item.line_total)}
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={() => removeItem(idx)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right: Checkout Panel */}
        <div className="w-96 flex flex-col bg-white border-l border-slate-200 z-30 shadow-2xl">
          
          <div className="p-5 overflow-y-auto flex-1 space-y-6">
            {/* Header info */}
            {activeDraftId && (
              <div className="bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-200 flex items-center gap-2 text-sm font-semibold">
                <PlayCircle className="w-5 h-5 text-amber-600" /> Resumed Draft Mode
              </div>
            )}

            {/* Customer Details */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <h3 className="font-bold text-slate-800">Customer Info</h3>
                <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="text-xs bg-slate-100 text-slate-600 border-none rounded-lg px-2 py-1 outline-none font-medium">
                  {branches.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
                </select>
              </div>
              <input type="text" placeholder="Customer Name (Walk-in)" value={customerName} onChange={e => setCustomerName(e.target.value)} className="input-field bg-slate-50" />
              <input type="text" placeholder="Phone Number (Optional)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="input-field bg-slate-50" />
            </div>

            <hr className="border-slate-100" />

            {/* Payment Method */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-800 flex justify-between">
                Payment Method 
                <span className="text-xs font-normal text-slate-400">F7-F8</span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {['CASH', 'UPI', 'CARD', 'SPLIT'].map(m => {
                  const Icon = PAYMENT_ICONS[m] || CreditCard;
                  const active = paymentMethod === m;
                  return (
                    <button key={m} onClick={() => setPaymentMethod(m)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-200 ${active ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500 hover:border-indigo-200 hover:bg-slate-50'}`}>
                      <Icon className={`w-6 h-6 mb-2 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                      <span className="text-xs font-bold">{m}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Discount */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-800">Discount</h3>
              <div className="flex gap-2">
                <select value={discountType} onChange={e => {setDiscountType(e.target.value); setDiscountValue(0);}} className="input-field bg-slate-50 w-1/3">
                  <option value="NONE">None</option>
                  <option value="PERCENTAGE">%</option>
                  <option value="FIXED">Fixed (₹)</option>
                </select>
                <input type="number" disabled={discountType === 'NONE'} value={discountValue} onChange={e => setDiscountValue(parseFloat(e.target.value)||0)} className="input-field bg-slate-50 flex-1" placeholder="0" />
              </div>
            </div>

            {/* Amount Received */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <h3 className="font-bold text-emerald-800">Cash Received</h3>
                <input type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder={grandTotal} className="w-full text-2xl font-bold font-mono text-emerald-700 bg-white border-2 border-emerald-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors" />
              </div>
            )}
            
            <textarea placeholder="Add note (optional)" value={notes} onChange={e => setNotes(e.target.value)} className="input-field bg-slate-50 text-sm" rows={2} />
          </div>

          {/* Checkout Totals */}
          <div className="bg-white border-t border-slate-100 p-5 pb-6 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
            <div className="space-y-2.5 mb-5 text-sm font-medium text-slate-500">
              <div className="flex justify-between items-center"><span>Subtotal</span><span className="text-slate-800 font-semibold">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between items-center"><span>Tax (GST)</span><span className="text-slate-800 font-semibold">{formatCurrency(taxTotal)}</span></div>
              {overallDisc > 0 && <div className="flex justify-between items-center text-rose-500"><span>Discount</span><span className="font-semibold">-{formatCurrency(overallDisc)}</span></div>}
              {roundOff !== 0 && <div className="flex justify-between items-center"><span>Round Off</span><span className="text-slate-800 font-semibold">{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span></div>}
            </div>
            
            <div className="flex justify-between items-end mb-6 pt-4 border-t border-slate-100">
              <span className="text-slate-800 font-bold uppercase tracking-widest text-sm">Total</span>
              <span className="text-4xl font-black text-indigo-600 tracking-tight">{formatCurrency(grandTotal)}</span>
            </div>

            {paymentMethod === 'CASH' && changeDue > 0 && (
              <div className="flex justify-between items-center mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <span className="text-emerald-700 font-bold">Change Due</span>
                <span className="text-xl font-bold text-emerald-700">{formatCurrency(changeDue)}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <button onClick={handleHoldBill} disabled={cart.length === 0 || submitting} className="col-span-1 py-4 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 font-bold flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50 shadow-sm">
                <PauseCircle className="w-5 h-5" />
                <span className="text-xs">Draft (F4)</span>
              </button>
              <button onClick={handleSubmit} disabled={cart.length === 0 || submitting} className="col-span-2 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:shadow-none">
                <Printer className="w-6 h-6" />
                {submitting ? 'PROCESSING' : 'PAY (F9)'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Drafts Modal */}
      {showDrafts && (
        <Modal title="Saved Drafts" onClose={() => setShowDrafts(false)} size="lg">
          <div className="p-4">
            {draftsList.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No drafts found.</p>
            ) : (
              <div className="space-y-3">
                {draftsList.map(draft => (
                  <div key={draft.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800">{draft.bill_number}</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-md">{draft.status}</span>
                      </div>
                      <p className="text-sm text-slate-500">{draft.customer_name} • {formatDate(draft.billing_date)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold text-lg text-slate-800">{formatCurrency(draft.grand_total)}</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleDiscardDraft(draft.id)} className="px-3 py-2 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors">Discard</button>
                        <button onClick={() => handleResumeDraft(draft.id)} className="px-3 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">Resume</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Shortcuts Help Modal */}
      {showShortcuts && (
        <Modal title="Keyboard Shortcuts" onClose={() => setShowShortcuts(false)}>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {[
                { k: 'F1', d: 'Focus Barcode Scanner' },
                { k: 'F2', d: 'Search Products' },
                { k: 'F4', d: 'Save Draft' },
                { k: 'F7', d: 'Select Cash Payment' },
                { k: 'F8', d: 'Select UPI Payment' },
                { k: 'F9', d: 'Complete Sale' },
              ].map(s => (
                <div key={s.k} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-600">{s.d}</span>
                  <span className="px-2 py-1 bg-white border border-slate-200 rounded shadow-sm font-mono font-bold text-indigo-600">{s.k}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 text-center">
              <button onClick={() => setShowShortcuts(false)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">Got it</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Last Bill Toast/Alert */}
      {lastBill && (
        <div className="absolute top-20 right-1/2 translate-x-[60%] z-50 animate-bounce">
          <div className="bg-emerald-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <span className="font-bold">Sale Completed: {lastBill.bill_number}</span>
            <button onClick={() => setLastBill(null)} className="ml-2 bg-white/20 hover:bg-white/30 rounded-full p-1"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple icon addition for missing imports
function CheckCircle(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
}
