import { useState, useRef, useEffect } from 'react';
import Navbar from '../../components/common/Navbar';
import Modal from '../../components/common/Modal';
import { barcodeLookup, getProductDropdown } from '../../api/productsAPI';
import { createBill, getDrafts, resumeDraft, discardDraft, finalizeBill } from '../../api/billingAPI';
import { getCustomerDropdown, createCustomer } from '../../api/customerAPI';
import { getBranchDropdown } from '../../api/coreAPI';
import { getSalesPersons } from '../../api/authAPI';
import { formatCurrency, formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';
import {
  ScanLine, Plus, Minus, Trash2, ShoppingCart, CreditCard,
  Banknote, Smartphone, X, Printer, Search, PauseCircle, PlayCircle,
  Keyboard, HelpCircle, FileText, UserPlus, ChevronDown
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
  const [salesPersonsList, setSalesPersonsList] = useState([]);
  
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSalesPerson, setSelectedSalesPerson] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customersList, setCustomersList] = useState([]);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [addingCustomer, setAddingCustomer] = useState(false);
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
  const addToCartRef = useRef(null);

  useEffect(() => {
    loadBranches();
    loadProducts();
    loadSalesPersons();
    loadCustomers();
    barcodeRef.current?.focus();
  }, []);

  // Auto-focus barcode input whenever modals close
  useEffect(() => {
    if (!showDrafts && !showShortcuts && !showSearch) {
      const t1 = setTimeout(() => barcodeRef.current?.focus(), 50);
      const t2 = setTimeout(() => barcodeRef.current?.focus(), 200);
      const t3 = setTimeout(() => barcodeRef.current?.focus(), 400);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [showDrafts, showShortcuts, showSearch]);

  // Auto-focus barcode input when user switches back to this tab (e.g., after receipt PDF)
  useEffect(() => {
    const onWindowFocus = () => {
      // Small delay to let browser settle focus
      setTimeout(() => barcodeRef.current?.focus(), 100);
    };
    window.addEventListener('focus', onWindowFocus);
    return () => window.removeEventListener('focus', onWindowFocus);
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

  const loadSalesPersons = async () => {
    const { data } = await getSalesPersons();
    if (data?.data) {
      const persons = Array.isArray(data.data) ? data.data : data.data.results || [];
      setSalesPersonsList(persons);
    }
  };

  const loadCustomers = async () => {
    const { data } = await getCustomerDropdown();
    if (data?.data) setCustomersList(data.data);
  };

  const handleCustomerInputChange = (e) => {
    const val = e.target.value;
    const matched = customersList.find(c => `${c.name}${c.phone ? ` - ${c.phone}` : ''}` === val);
    
    if (matched) {
      setSelectedCustomerId(matched.id);
      setCustomerName(matched.name);
      setCustomerPhone(matched.phone || '');
    } else {
      setSelectedCustomerId(null);
      setCustomerName(val);
      setCustomerPhone('');
    }
  };

  const handleAddCustomerFromPOS = async () => {
    if (!newCustomerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    setAddingCustomer(true);
    const payload = {
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim(),
      email: newCustomerEmail.trim(),
    };
    const { data, error } = await createCustomer(payload);
    setAddingCustomer(false);
    if (data?.data) {
      toast.success(`Customer "${newCustomerName}" added!`);
      const newCust = data.data;
      setCustomersList(prev => [...prev, { id: newCust.id, name: newCust.name, phone: newCust.phone || '', email: newCust.email || '', gstin: newCust.gstin || '', address: newCust.address || '' }]);
      setSelectedCustomerId(newCust.id);
      setCustomerName(newCust.name);
      setCustomerPhone(newCust.phone || '');
      setShowAddCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerEmail('');
    } else {
      toast.error(error || 'Failed to add customer');
    }
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

  // Auto-hide the "Sale Completed" message after 5 seconds
  useEffect(() => {
    if (lastBill) {
      const timer = setTimeout(() => setLastBill(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastBill]);

  // ── addToCart: plain function, stored in ref for stable access ──
  const addToCart = (product) => {
    setCart(prev => {
      const productId = typeof product.id === 'string' ? parseInt(product.id, 10) : product.id;
      const existing = prev.find(c => c.product === productId);
      if (existing) {
        return prev.map(c =>
          c.product === productId ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        product: productId,
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
  };

  // Always keep the ref pointing to the latest addToCart
  addToCartRef.current = addToCart;

  // ── Barcode scan handler: fire-and-forget to never block rapid scans ──
  const handleBarcodeScan = (e) => {
    if (e.key !== 'Enter') return;

    const code = (e.target.value || '').trim();
    if (!code) return;

    // Clear input immediately for next scan
    setBarcodeInput('');
    e.target.value = '';

    // Fire the lookup without blocking — each scan is independent
    barcodeLookup(code).then(({ data, error }) => {
      if (data?.data) {
        addToCartRef.current(data.data);
      } else {
        toast.error(error || 'Product not found');
      }
    }).catch(() => {
      toast.error('Scanner error. Try again.');
    }).finally(() => {
      barcodeRef.current?.focus();
    });
  };

  // ── Keyboard Shortcuts: use refs for handlers to avoid stale closures ──
  const holdBillRef = useRef(null);
  const submitBillRef = useRef(null);
  const cartRef = useRef(cart);
  cartRef.current = cart;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') { e.preventDefault(); barcodeRef.current?.focus(); }
      if (e.key === 'F2') { e.preventDefault(); setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 100); }
      if (e.key === 'F4') { e.preventDefault(); if (cartRef.current.length > 0 && holdBillRef.current) holdBillRef.current(); }
      if (e.key === 'F7') { e.preventDefault(); setPaymentMethod('CASH'); }
      if (e.key === 'F8') { e.preventDefault(); setPaymentMethod('UPI'); }
      if (e.key === 'F9') { e.preventDefault(); if (cartRef.current.length > 0 && submitBillRef.current) submitBillRef.current(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty deps — refs always point to latest

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
    setSelectedCustomerId(null);
    setAmountReceived('');
    setDiscountType('NONE');
    setDiscountValue(0);
    setNotes('');
    setActiveDraftId(null);
    setSelectedSalesPerson('');
    // Aggressive refocus: try immediately + delayed to beat HeadlessUI focus trap
    barcodeRef.current?.focus();
    setTimeout(() => barcodeRef.current?.focus(), 50);
    setTimeout(() => barcodeRef.current?.focus(), 200);
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
    const payload = {
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
    if (selectedCustomerId) payload.customer_id = selectedCustomerId;
    if (selectedSalesPerson) payload.salesperson_id = selectedSalesPerson;
    return payload;
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
  holdBillRef.current = handleHoldBill;

  const handleResumeDraft = async (draftId) => {
    // Auto-save current bill as draft if cart has items and it's a different bill
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
        product: typeof i.product === 'string' ? parseInt(i.product, 10) : i.product,
        product_name: i.product_name || '',
        barcode: i.barcode || '',
        hsn_code: i.hsn_code || '',
        unit_price: parseFloat(i.unit_price) || 0,
        tax_percentage: parseFloat(i.tax_percentage) || 0,
        quantity: parseFloat(i.quantity) || 1,
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
      
      // Aggressive refocus: HeadlessUI Dialog steals focus on close,
      // so we must re-focus after the Dialog transition animation completes
      barcodeRef.current?.focus();
      setTimeout(() => barcodeRef.current?.focus(), 100);
      setTimeout(() => barcodeRef.current?.focus(), 350);
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
      await discardDraft(activeDraftId);
      res = await createBill(payload);
    } else {
      res = await createBill(payload);
    }

    setSubmitting(false);

    if (res.data?.data) {
      toast.success(`Bill ${res.data.data.bill_number} completed!`);
      setLastBill(res.data.data);
      
      // Open receipt PDF in new tab
      const printUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/billing/${res.data.data.id}/pdf/`;
      const printWindow = window.open(printUrl, '_blank');
      if(printWindow) {
        printWindow.onload = () => printWindow.print();
      }

      // Reset form AFTER window.open, then aggressively recapture focus
      resetForm();
      // Re-focus after the new tab steals focus
      setTimeout(() => barcodeRef.current?.focus(), 500);
      setTimeout(() => barcodeRef.current?.focus(), 1000);
      setTimeout(() => barcodeRef.current?.focus(), 2000);
    } else {
      toast.error(res.error || 'Failed to complete sale');
    }
  };
  submitBillRef.current = handleSubmit;

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
        <div className="w-96 flex flex-col bg-white border-l border-slate-200 z-30 shadow-2xl relative">
          
          {/* Scrollable form area */}
          <div className="p-3 flex-1 overflow-y-auto space-y-3">
              
              {/* Resumed Draft Badge */}
              {activeDraftId && (
                <div className="bg-amber-50 text-amber-800 p-1.5 rounded-lg border border-amber-200 flex items-center gap-2 text-xs font-bold">
                  <PlayCircle className="w-3.5 h-3.5 text-amber-600" /> Resumed Draft
                </div>
              )}

              {/* Customer Info Row */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-xs">Customer Details</h3>
                  <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="text-[11px] bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 outline-none font-bold">
                    {branches.map(b => <option key={b.id} value={b.id}>{b.code}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input 
                      list="customers-list"
                      type="text" 
                      placeholder="Name or Select..." 
                      value={customerName} 
                      onChange={handleCustomerInputChange} 
                      className="input-field bg-slate-50 py-1.5 text-xs px-2.5 shadow-sm border-slate-200 focus:border-indigo-400 w-full" 
                    />
                    <datalist id="customers-list">
                      {customersList.map(c => (
                        <option key={c.id} value={`${c.name}${c.phone ? ` - ${c.phone}` : ''}`} />
                      ))}
                    </datalist>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Phone (WhatsApp)" 
                    value={customerPhone} 
                    onChange={e => {
                      setCustomerPhone(e.target.value);
                      if (selectedCustomerId) setSelectedCustomerId(null);
                    }} 
                    className="input-field bg-slate-50 py-1.5 text-xs px-2.5 shadow-sm border-slate-200 focus:border-indigo-400 w-full" 
                  />
                </div>
              </div>

              {/* Sales Person Dropdown */}
              {salesPersonsList.length > 0 && (
                <div className="space-y-1">
                  <h3 className="font-bold text-slate-800 text-xs">Sales Person</h3>
                  <select value={selectedSalesPerson} onChange={e => setSelectedSalesPerson(e.target.value)}
                    className="input-field bg-slate-50 py-1.5 text-xs px-2.5 shadow-sm border-slate-200 focus:border-indigo-400 w-full">
                    <option value="">Self (Default)</option>
                    {salesPersonsList.map(sp => (
                      <option key={sp.id} value={sp.id}>{sp.first_name} {sp.last_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Payment Methods */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 text-xs">Payment Method</h3>
                  <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 rounded">F7 - F8</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {['CASH', 'UPI', 'CARD', 'SPLIT'].map(m => {
                    const Icon = PAYMENT_ICONS[m] || CreditCard;
                    const active = paymentMethod === m;
                    return (
                      <button key={m} onClick={() => setPaymentMethod(m)}
                        className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border-2 transition-all duration-200 shadow-sm ${active ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 scale-[1.02]' : 'border-slate-100 bg-white text-slate-500 hover:border-indigo-200 hover:bg-slate-50'}`}>
                        <Icon className={`w-4 h-4 mb-0.5 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <span className="text-[9px] font-extrabold tracking-wide">{m}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Discount Row */}
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center justify-between gap-2 shadow-sm">
                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Discount</span>
                <div className="flex gap-1.5 flex-1">
                  <select value={discountType} onChange={e => {setDiscountType(e.target.value); setDiscountValue(0);}} className="input-field bg-white py-1 text-xs px-2 border-slate-200 shadow-sm w-20">
                    <option value="NONE">None</option>
                    <option value="PERCENTAGE">%</option>
                    <option value="FIXED">₹</option>
                  </select>
                  <input type="number" disabled={discountType === 'NONE'} value={discountValue} onChange={e => setDiscountValue(parseFloat(e.target.value)||0)} className="input-field bg-white py-1 text-xs px-2 border-slate-200 shadow-sm flex-1 font-semibold" placeholder="0" />
                </div>
              </div>

              {/* Cash Received Row */}
              {paymentMethod === 'CASH' && (
                <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200 flex items-center justify-between gap-2 shadow-sm shrink-0">
                  <span className="text-xs font-bold text-emerald-800 whitespace-nowrap">Cash Received</span>
                  <input type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder={grandTotal} className="flex-1 input-field bg-white text-sm font-bold font-mono text-emerald-700 border-emerald-300 py-1 px-2.5 focus:border-emerald-500 shadow-sm text-right" />
                </div>
              )}

              {/* Bill Notes (Fills empty space) */}
              <div className="flex-1 min-h-[70px] pt-1">
                <textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add bill notes or remarks here..."
                  className="w-full h-full bg-slate-50 border border-slate-200 focus:border-indigo-400 rounded-xl p-2.5 text-xs text-slate-700 resize-none shadow-sm placeholder-slate-400 outline-none transition-colors"
                />
              </div>
          </div>

          {/* Checkout Totals — always pinned at bottom */}
          <div className="bg-slate-50/50 border-t border-slate-200 p-3 shrink-0">
            <div className="space-y-1 mb-2 text-sm font-medium text-slate-500">
              <div className="flex justify-between items-center"><span>Subtotal</span><span className="text-slate-800 font-semibold">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between items-center"><span>Tax (GST)</span><span className="text-slate-800 font-semibold">{formatCurrency(taxTotal)}</span></div>
              {overallDisc > 0 && <div className="flex justify-between items-center text-rose-500"><span>Discount</span><span className="font-semibold">-{formatCurrency(overallDisc)}</span></div>}
              {roundOff !== 0 && <div className="flex justify-between items-center"><span>Round Off</span><span className="text-slate-800 font-semibold">{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span></div>}
            </div>
            
            <div className="flex justify-between items-end mb-3 pt-2 border-t border-slate-200">
              <span className="text-slate-800 font-extrabold uppercase tracking-wider text-xs">Grand Total</span>
              <span className="text-3xl font-black text-indigo-600 tracking-tighter">{formatCurrency(grandTotal)}</span>
            </div>

            {paymentMethod === 'CASH' && changeDue > 0 && (
              <div className="flex justify-between items-center mb-3 p-2 bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm">
                <span className="text-emerald-800 font-bold text-xs">Change Due</span>
                <span className="text-xl font-black text-emerald-600">{formatCurrency(changeDue)}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <button onClick={handleHoldBill} disabled={cart.length === 0 || submitting} className="col-span-1 py-2.5 rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-bold flex flex-col items-center justify-center gap-0.5 transition-all disabled:opacity-50 shadow-sm">
                <PauseCircle className="w-4 h-4 text-slate-400" />
                <span className="text-[9px] uppercase tracking-wider">Draft (F4)</span>
              </button>
              <button onClick={handleSubmit} disabled={cart.length === 0 || submitting} className="col-span-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:shadow-none">
                <Printer className="w-5 h-5" />
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

      {/* Add Customer from POS Modal */}
      {showAddCustomer && (
        <Modal title="Add New Customer" onClose={() => { setShowAddCustomer(false); setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerEmail(''); }}>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Name *</label>
              <input type="text" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)}
                placeholder="Customer name" className="input-field" autoFocus />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Phone</label>
              <input type="text" value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)}
                placeholder="Phone number" className="input-field" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Email</label>
              <input type="email" value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)}
                placeholder="Email (optional)" className="input-field" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setShowAddCustomer(false); setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerEmail(''); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleAddCustomerFromPOS} disabled={addingCustomer || !newCustomerName.trim()}
                className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                <UserPlus className="w-4 h-4" />
                {addingCustomer ? 'Adding...' : 'Add Customer'}
              </button>
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
