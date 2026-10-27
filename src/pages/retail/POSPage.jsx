import { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Navbar from '../../components/common/Navbar';
import Modal from '../../components/common/Modal';
import { barcodeLookup, getProductDropdown } from '../../api/productsAPI';
import { createBill, getDrafts, resumeDraft, discardDraft, bulkDiscardDrafts, finalizeBill, getBill, updateBill } from '../../api/billingAPI';
import { getCustomerDropdown, createCustomer } from '../../api/customerAPI';
import { getBranchDropdown } from '../../api/coreAPI';
import { getSalesPersons } from '../../api/authAPI';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
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
  const { user } = useSelector((state) => state.auth);
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [productList, setProductList] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [draftsList, setDraftsList] = useState([]);
  const [selectedDraftIds, setSelectedDraftIds] = useState([]);
  const [deletingDrafts, setDeletingDrafts] = useState(false);
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
  const [splitCash, setSplitCash] = useState('');
  const [splitUpi, setSplitUpi] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [discountType, setDiscountType] = useState('NONE');
  const [discountValue, setDiscountValue] = useState(0);
  const [manualRoundOff, setManualRoundOff] = useState('');
  const [notes, setNotes] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [lastBill, setLastBill] = useState(null);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [activeEditId, setActiveEditId] = useState(null);
  
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  
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
      // Default to the user's assigned branch if it exists in the list, otherwise first branch
      const userBranch = user?.assigned_branch;
      let initialBranch = '';
      if (userBranch && data.data.some(b => b.id === userBranch)) {
        initialBranch = userBranch;
      } else if (data.data.length > 0) {
        initialBranch = data.data[0].id;
      }
      if (initialBranch) {
        setSelectedBranch(initialBranch);
        loadCustomers(initialBranch);
      }
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

  const loadCustomers = async (branchId) => {
    const targetBranch = branchId || selectedBranch;
    const params = targetBranch ? { branch: targetBranch } : {};
    const { data } = await getCustomerDropdown(params);
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
      branch: selectedBranch || null,
    };
    const { data, error } = await createCustomer(payload);
    setAddingCustomer(false);
    if (data?.data) {
      toast.success(`Customer "${newCustomerName}" added!`);
      const newCust = data.data;
      setCustomersList(prev => [...prev, {
        id: newCust.id,
        name: newCust.name,
        phone: newCust.phone || '',
        email: newCust.email || '',
        gstin: newCust.gstin || '',
        address: newCust.address || '',
        branch: newCust.branch || null,
      }]);
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
      setSelectedDraftIds([]);
      setShowDrafts(true);
    }
  };

  useEffect(() => {
    // Check URL for draftId to auto-resume
    const params = new URLSearchParams(window.location.search);
    const draftId = params.get('draftId');
    const editBillId = params.get('editBillId');
    if (draftId && !activeDraftId) {
      handleResumeDraft(draftId);
      // Clean up URL without refreshing
      window.history.replaceState({}, '', '/pos');
    } else if (editBillId && !activeEditId) {
      handleEditBill(editBillId);
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

  // ── Global Barcode Scanner Detector ──
  // Barcode scanners type all characters within ~50-80ms then press Enter.
  // This listener captures that pattern at the document level, so scanning
  // works even when the barcode input field is NOT focused.
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef(null);
  const SCAN_CHAR_TIMEOUT = 80; // max ms between characters for scanner input
  const MIN_SCAN_LENGTH = 3;    // minimum barcode length to be valid

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Don't intercept if user is actively typing in a focused input/textarea/select
      // (except the barcode input itself — that's handled by its own onKeyDown)
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isBarcodeField = document.activeElement === barcodeRef.current;

      if (e.key === 'F1') { e.preventDefault(); barcodeRef.current?.focus(); return; }
      if (e.key === 'F2') { e.preventDefault(); setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 100); return; }
      if (e.key === 'F4') { e.preventDefault(); if (cartRef.current.length > 0 && holdBillRef.current) holdBillRef.current(); return; }
      if (e.key === 'F7') { e.preventDefault(); setPaymentMethod('CASH'); return; }
      if (e.key === 'F8') { e.preventDefault(); setPaymentMethod('UPI'); return; }
      if (e.key === 'F9') { e.preventDefault(); if (cartRef.current.length > 0 && submitBillRef.current) submitBillRef.current(); return; }

      // If user is focused on the barcode field, let the normal onKeyDown handler work
      if (isBarcodeField) return;

      // If user is typing in another input (customer name, phone, notes, etc.), skip
      if (['input', 'textarea', 'select'].includes(tag)) return;

      // --- Global scanner detection below ---
      if (e.key === 'Enter') {
        // Process accumulated buffer
        const code = scanBufferRef.current.trim();
        scanBufferRef.current = '';
        clearTimeout(scanTimerRef.current);

        if (code.length >= MIN_SCAN_LENGTH) {
          e.preventDefault();
          // This is a barcode scan! Process it.
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
        }
        return;
      }

      // Accumulate printable single characters (scanner sends one char per keystroke)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        clearTimeout(scanTimerRef.current);
        scanBufferRef.current += e.key;

        // Reset buffer if no new character arrives within SCAN_CHAR_TIMEOUT ms
        // (human typing is much slower than a scanner)
        scanTimerRef.current = setTimeout(() => {
          scanBufferRef.current = '';
        }, SCAN_CHAR_TIMEOUT);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      clearTimeout(scanTimerRef.current);
    };
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
    setSplitCash('');
    setSplitUpi('');
    setSplitCard('');
    setDiscountValue(0);
    setManualRoundOff('');
    setNotes('');
    setActiveDraftId(null);
    setActiveEditId(null);
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
  const roundOffVal = parseFloat(manualRoundOff) || 0;
  const grandTotal = Math.max(0, preRoundTotal - roundOffVal);
  const roundOff = -roundOffVal;
  
  const splitTotal = (parseFloat(splitCash)||0) + (parseFloat(splitUpi)||0) + (parseFloat(splitCard)||0);
  const actualAmountReceived = paymentMethod === 'SPLIT' ? splitTotal : (parseFloat(amountReceived) || grandTotal);
  const changeDue = Math.max(0, actualAmountReceived - grandTotal);

  const buildPayload = (saveAsHold = false) => {
    const payload = {
      branch_id: selectedBranch,
      customer_name: customerName || 'Walk-in Customer',
      customer_phone: customerPhone,
      payment_method: paymentMethod,
      amount_received: actualAmountReceived,
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
    
    if (paymentMethod === 'SPLIT') {
      const payments = [];
      if (parseFloat(splitCash) > 0) payments.push({ payment_method: 'CASH', amount: parseFloat(splitCash) });
      if (parseFloat(splitUpi) > 0) payments.push({ payment_method: 'UPI', amount: parseFloat(splitUpi) });
      if (parseFloat(splitCard) > 0) payments.push({ payment_method: 'CARD', amount: parseFloat(splitCard) });
      payload.payments = payments;
    }
    
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

  // --- Auto Save Draft on Unmount ---
  const autoSaveRef = useRef(null);
  useEffect(() => {
    if (cart.length > 0 && selectedBranch) {
      autoSaveRef.current = {
        payload: buildPayload(true),
        draftId: activeDraftId
      };
    } else {
      autoSaveRef.current = null;
    }
  }); // runs every render to keep ref updated


  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && autoSaveRef.current) {
        const { payload, draftId } = autoSaveRef.current;
        if (draftId) {
          // Fire and forget using standard fetch
          discardDraft(draftId).then(() => createBill(payload)).catch(() => {});
        } else {
          createBill(payload).catch(() => {});
        }
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      // Component unmounting
      if (autoSaveRef.current) {
        const { payload, draftId } = autoSaveRef.current;
        if (draftId) {
          discardDraft(draftId).then(() => createBill(payload)).catch(() => {});
        } else {
          createBill(payload).catch(() => {});
        }
      }
    };
  }, []);

  // ----------------------------------

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
      setManualRoundOff(parseFloat(bill.round_off || 0) !== 0 ? Math.abs(parseFloat(bill.round_off)).toString() : '');
      setNotes(bill.notes);
      setActiveDraftId(bill.id);
      setSelectedSalesPerson(bill.salesperson_id ? String(bill.salesperson_id) : '');
      setShowDrafts(false);
      toast.success(`Resumed bill ${bill.bill_number}`);
      
      // Aggressive refocus: HeadlessUI Dialog steals focus on close,
      // so we must re-focus after the Dialog transition animation completes
      barcodeRef.current?.focus();
      setTimeout(() => barcodeRef.current?.focus(), 100);
      setTimeout(() => barcodeRef.current?.focus(), 350);
    }
  };

  const handleEditBill = async (editId) => {
    const { data } = await getBill(editId);
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
      setManualRoundOff(parseFloat(bill.round_off || 0) !== 0 ? Math.abs(parseFloat(bill.round_off)).toString() : '');
      setNotes(bill.notes);
      setActiveEditId(bill.id);
      if (bill.branch) setSelectedBranch(bill.branch);
      setSelectedSalesPerson(bill.salesperson_id ? String(bill.salesperson_id) : '');
      toast.success(`Editing bill ${bill.bill_number}`);
      
      barcodeRef.current?.focus();
    }
  };

  const handleDiscardDraft = async (draftId) => {
    if (!window.confirm('Delete this draft?')) return;
    const { error } = await discardDraft(draftId);
    if (!error) {
      toast.success('Draft discarded');
      setSelectedDraftIds(prev => prev.filter(id => id !== draftId));
      loadDrafts();
      if (activeDraftId === draftId) resetForm();
    }
  };

  const toggleSelectDraft = (draftId) => {
    setSelectedDraftIds(prev =>
      prev.includes(draftId) ? prev.filter(id => id !== draftId) : [...prev, draftId]
    );
  };

  const toggleSelectAllDrafts = () => {
    if (selectedDraftIds.length === draftsList.length) {
      setSelectedDraftIds([]);
    } else {
      setSelectedDraftIds(draftsList.map(d => d.id));
    }
  };

  const handleBulkDiscardDrafts = async () => {
    if (selectedDraftIds.length === 0) return;
    const count = selectedDraftIds.length;
    if (!window.confirm(`Delete ${count} selected draft bill${count > 1 ? 's' : ''}?`)) return;
    setDeletingDrafts(true);
    const { data, error } = await bulkDiscardDrafts(selectedDraftIds);
    setDeletingDrafts(false);
    if (!error) {
      toast.success(data?.message || `${count} draft(s) discarded`);
      if (selectedDraftIds.includes(activeDraftId)) {
        resetForm();
      }
      setSelectedDraftIds([]);
      loadDrafts();
    }
  };

  const handleTriggerPayment = () => {
    if (!selectedBranch) return toast.error('Select a branch');
    if (cart.length === 0) return toast.error('Add items to cart');
    setShowPaymentOptions(true);
  };
  submitBillRef.current = handleTriggerPayment;

  const handleProcessPayment = async (receiptType) => {
    if (receiptType === 'WHATSAPP' && !customerPhone) {
      toast.error('Customer phone number is required for WhatsApp bill');
      return;
    }
    
    setShowPaymentOptions(false);
    setSubmitting(true);
    const payload = buildPayload(false);
    // Send WhatsApp if WHATSAPP is selected, or if Print PDF is selected and customer phone is available
    payload.send_whatsapp = receiptType === 'WHATSAPP' || receiptType === 'PDF';

    let res;
    if (activeEditId) {
      res = await updateBill(activeEditId, payload);
    } else if (activeDraftId) {
      await discardDraft(activeDraftId);
      res = await createBill(payload);
    } else {
      res = await createBill(payload);
    }

    setSubmitting(false);

    if (res.data?.data) {
      toast.success(`Bill ${res.data.data.bill_number} completed!`);
      setLastBill(res.data.data);
      
      if (receiptType === 'PDF') {
        if (customerPhone) {
          toast.success('WhatsApp receipt sending triggered!');
        }
        try {
          const printUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/billing/${res.data.data.id}/pdf/`;
          const printToast = toast.loading("Preparing receipt...");
          
          const response = await fetch(printUrl);
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = blobUrl;
          document.body.appendChild(iframe);
          
          iframe.onload = () => {
            setTimeout(() => {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
              toast.dismiss(printToast);
              
              // Clean up
              setTimeout(() => {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(blobUrl);
              }, 60000); // 1 minute to allow print dialog to finish
            }, 500);
          };
        } catch (error) {
          console.error('Print failed', error);
          toast.error("Failed to prepare print");
        }
      } else if (receiptType === 'WHATSAPP') {
        toast.success('WhatsApp receipt sending triggered!');
      }

      resetForm();
      setTimeout(() => barcodeRef.current?.focus(), 500);
      setTimeout(() => barcodeRef.current?.focus(), 1000);
      setTimeout(() => barcodeRef.current?.focus(), 2000);
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
                  <select
                    value={selectedBranch}
                    onChange={e => {
                      const newBranch = e.target.value;
                      setSelectedBranch(newBranch);
                      loadCustomers(newBranch);
                    }}
                    className="text-[11px] bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 outline-none font-bold cursor-pointer"
                  >
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

              {/* Round Off Row */}
              <div className="bg-amber-50 p-2 rounded-xl border border-amber-100 flex items-center justify-between gap-2 shadow-sm">
                <span className="text-xs font-bold text-amber-800 whitespace-nowrap">Round Off</span>
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-xs font-bold text-amber-600">−₹</span>
                  <input type="number" value={manualRoundOff} onChange={e => setManualRoundOff(e.target.value)} className="flex-1 input-field bg-white py-1 text-xs px-2 border-amber-200 shadow-sm font-semibold text-right focus:border-amber-400" placeholder="0" min="0" step="0.01" />
                </div>
              </div>

              {/* Cash Received Row */}
              {paymentMethod === 'CASH' && (
                <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200 flex items-center justify-between gap-2 shadow-sm shrink-0">
                  <span className="text-xs font-bold text-emerald-800 whitespace-nowrap">Cash Received</span>
                  <input type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder={grandTotal} className="flex-1 input-field bg-white text-sm font-bold font-mono text-emerald-700 border-emerald-300 py-1 px-2.5 focus:border-emerald-500 shadow-sm text-right" />
                </div>
              )}

              {/* Split Payment Row */}
              {paymentMethod === 'SPLIT' && (
                <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-200 flex flex-col gap-2 shadow-sm shrink-0">
                  <span className="text-xs font-bold text-indigo-800">Split Breakdown</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] font-semibold text-indigo-700 block mb-1">Cash</span>
                      <input type="number" value={splitCash} onChange={e => setSplitCash(e.target.value)} placeholder="0" className="w-full input-field bg-white text-xs font-bold font-mono text-indigo-900 border-indigo-300 py-1 px-2 focus:border-indigo-500 shadow-sm text-right" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-indigo-700 block mb-1">UPI</span>
                      <input type="number" value={splitUpi} onChange={e => setSplitUpi(e.target.value)} placeholder="0" className="w-full input-field bg-white text-xs font-bold font-mono text-indigo-900 border-indigo-300 py-1 px-2 focus:border-indigo-500 shadow-sm text-right" />
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-indigo-700 block mb-1">Card</span>
                      <input type="number" value={splitCard} onChange={e => setSplitCard(e.target.value)} placeholder="0" className="w-full input-field bg-white text-xs font-bold font-mono text-indigo-900 border-indigo-300 py-1 px-2 focus:border-indigo-500 shadow-sm text-right" />
                    </div>
                  </div>
                  {splitTotal > 0 && splitTotal !== grandTotal && (
                    <div className="text-[10px] font-bold text-right text-rose-500 mt-1">
                      Total: {splitTotal.toFixed(2)} / {grandTotal.toFixed(2)}
                    </div>
                  )}
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
              {roundOffVal > 0 && <div className="flex justify-between items-center text-amber-600"><span>Round Off</span><span className="font-semibold">-{formatCurrency(roundOffVal)}</span></div>}
            </div>
            
            <div className="flex justify-between items-end mb-3 pt-2 border-t border-slate-200">
              <span className="text-slate-800 font-extrabold uppercase tracking-wider text-xs">Grand Total</span>
              <span className="text-3xl font-black text-indigo-600 tracking-tighter">{formatCurrency(grandTotal)}</span>
            </div>

            {['CASH', 'SPLIT'].includes(paymentMethod) && changeDue > 0 && (
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
              <button onClick={handleTriggerPayment} disabled={cart.length === 0 || submitting} className="col-span-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:shadow-none">
                <Printer className="w-5 h-5" />
                {submitting ? 'PROCESSING' : 'PAY (F9)'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Drafts Modal */}
      {showDrafts && (
        <Modal
          title="Saved Drafts"
          onClose={() => {
            setShowDrafts(false);
            setSelectedDraftIds([]);
          }}
          size="lg"
        >
          <div className="p-4 space-y-3">
            {draftsList.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No drafts found.</p>
            ) : (
              <>
                {/* Multi-select Header / Toolbar */}
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/80 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={draftsList.length > 0 && selectedDraftIds.length === draftsList.length}
                      ref={el => {
                        if (el) {
                          el.indeterminate = selectedDraftIds.length > 0 && selectedDraftIds.length < draftsList.length;
                        }
                      }}
                      onChange={toggleSelectAllDrafts}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                    />
                    <span className="text-xs font-bold text-slate-700">
                      {selectedDraftIds.length > 0
                        ? `${selectedDraftIds.length} of ${draftsList.length} selected`
                        : `Select All (${draftsList.length})`}
                    </span>
                  </label>

                  {selectedDraftIds.length > 0 && (
                    <button
                      onClick={handleBulkDiscardDrafts}
                      disabled={deletingDrafts}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{deletingDrafts ? 'Deleting...' : `Delete Selected (${selectedDraftIds.length})`}</span>
                    </button>
                  )}
                </div>

                {/* Drafts List */}
                <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                  {draftsList.map(draft => {
                    const isSelected = selectedDraftIds.includes(draft.id);
                    return (
                      <div
                        key={draft.id}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-300 shadow-sm'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectDraft(draft.id)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                          />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-slate-800 text-sm">{draft.bill_number}</span>
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-md">
                                {draft.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {draft.customer_name || 'Walk-in Customer'} • {formatDateTime(draft.billing_date)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <p className="font-bold text-base text-slate-800">{formatCurrency(draft.grand_total)}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDiscardDraft(draft.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                            >
                              Discard
                            </button>
                            <button
                              onClick={() => handleResumeDraft(draft.id)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
                            >
                              Resume
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
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

      {/* Payment Options Modal */}
      {showPaymentOptions && (
        <Modal title="Choose Receipt Type" onClose={() => setShowPaymentOptions(false)} size="md">
          <div className="p-6">
            <p className="text-slate-600 mb-6 text-center font-medium">How would you like to send the receipt ?</p>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => handleProcessPayment('PDF')}
                className="flex flex-col items-center justify-center p-6 border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 rounded-2xl transition-all group text-center"
              >
                <div className="w-16 h-16 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center mb-4 transition-colors">
                  <Printer className="w-8 h-8 text-slate-500 group-hover:text-indigo-600" />
                </div>
                <span className="font-bold text-slate-700 group-hover:text-indigo-700">Print PDF</span>
                <span className="text-xs text-slate-400 group-hover:text-indigo-600 mt-1 font-medium">Print + WhatsApp</span>
              </button>
              
              <button 
                onClick={() => handleProcessPayment('WHATSAPP')}
                className="flex flex-col items-center justify-center p-6 border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 rounded-2xl transition-all group text-center"
              >
                <div className="w-16 h-16 rounded-full bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center mb-4 transition-colors">
                  <Smartphone className="w-8 h-8 text-slate-500 group-hover:text-emerald-600" />
                </div>
                <span className="font-bold text-slate-700 group-hover:text-emerald-700">WhatsApp Bill</span>
                <span className="text-xs text-slate-400 group-hover:text-emerald-600 mt-1 font-medium">WhatsApp Only</span>
              </button>
            </div>
            {!customerPhone && (
              <div className="mt-4 p-3 bg-amber-50 text-amber-700 text-sm rounded-lg flex items-center justify-center border border-amber-200">
                <span>Please note: WhatsApp bill requires a customer phone number.</span>
              </div>
            )}
            <div className="mt-6 flex justify-center">
              <button 
                onClick={() => setShowPaymentOptions(false)} 
                className="px-6 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Customer from POS Modal */}
      {showAddCustomer && (
        <Modal title="Add New Customer" onClose={() => { setShowAddCustomer(false); setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerEmail(''); }}>
          <div className="p-5 space-y-4">
            {selectedBranch && (
              <div className="px-3.5 py-2.5 bg-indigo-50/80 border border-indigo-100 rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Branch:</span>
                <span className="font-bold text-indigo-700 bg-white px-2.5 py-0.5 rounded-lg border border-indigo-200 shadow-sm">
                  {branches.find(b => String(b.id) === String(selectedBranch))?.name || 'Selected Branch'}
                </span>
              </div>
            )}
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
