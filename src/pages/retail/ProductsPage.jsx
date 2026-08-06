import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { getProducts, createProduct, deleteProduct, getCategories, createCategory, getBrands, createBrand, getProductStock } from '../../api/productsAPI';
import { getSuppliers } from '../../api/productsAPI';
import { formatCurrency } from '../../utils/formatters';
import { Search, Plus, Trash2, Pencil, Package, AlertTriangle, ScanLine, Info, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import Barcode from 'react-barcode';
import html2pdf from 'html2pdf.js';

export default function ProductsPage() {
  const { user } = useAuth();
  const isEmployee = user?.role_name === 'EMPLOYEE';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  // Selection and Printing State
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [barcodeModal, setBarcodeModal] = useState({ isOpen: false, product: null });
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printCounts, setPrintCounts] = useState({});
  const [printing, setPrinting] = useState(false);

  const [form, setForm] = useState({
    name: '', sku: '', barcode: '', description: '', category: '', brand: '', supplier: '',
    unit: 'Nos', cost_price: '', selling_price: '', hsn_code: '', tax_percentage: 18,
    minimum_stock_level: 10, reorder_level: 20,
  });
  const [stockModal, setStockModal] = useState({ isOpen: false, product: null, stocks: [], loading: false });

  useEffect(() => { loadProducts(); loadDropdowns(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    const { data } = await getProducts({ search });
    if (data?.data) setProducts(Array.isArray(data.data) ? data.data : data.data.results || []);
    setLoading(false);
  };

  const loadDropdowns = async () => {
    const [c, b, s] = await Promise.all([getCategories(), getBrands(), getSuppliers()]);
    if (c.data?.data) setCategories(c.data.data);
    if (b.data?.data) setBrands(b.data.data);
    if (s.data?.data) setSuppliers(Array.isArray(s.data.data) ? s.data.data : s.data.data.results || []);
  };

  useEffect(() => { loadProducts(); }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (!payload.category) delete payload.category;
    if (!payload.brand) delete payload.brand;
    if (!payload.supplier) delete payload.supplier;
    if (!payload.barcode) delete payload.barcode;
    const { data, error } = await createProduct(payload);
    if (data) {
      toast.success('Product created');
      setShowModal(false);
      setForm({ name: '', sku: '', barcode: '', description: '', category: '', brand: '', supplier: '',
        unit: 'Nos', cost_price: '', selling_price: '', hsn_code: '', tax_percentage: 18, minimum_stock_level: 10, reorder_level: 20 });
      loadProducts();
    } else toast.error(error || 'Failed');
  };

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${name}"?`)) return;
    const { error } = await deleteProduct(id);
    if (error) toast.error(error); else { toast.success('Deleted'); loadProducts(); }
  };

  const handleViewStock = async (e, product) => {
    e.stopPropagation();
    setStockModal({ isOpen: true, product, stocks: [], loading: true });
    const { data } = await getProductStock(product.id);
    setStockModal({ isOpen: true, product, stocks: data?.data || [], loading: false });
  };

  const handlePrintBarcodes = () => {
    const validProducts = products.filter(p => selectedProducts.includes(p.id) && p.barcode);
    if (validProducts.length === 0) {
      toast.error('None of the selected products have a barcode assigned.');
      return;
    }
    
    const initialCounts = {};
    validProducts.forEach(p => {
      initialCounts[p.id] = 1;
    });
    setPrintCounts(initialCounts);
    setShowPrintModal(true);
  };

  const generatePDF = () => {
    setPrinting(true);
    const element = document.getElementById('print-barcodes-container');
    const opt = {
      margin: 0,
      filename: `barcodes_${new Date().getTime()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    setTimeout(() => {
      html2pdf().set(opt).from(element).save().then(() => {
        setPrinting(false);
        setShowPrintModal(false);
      }).catch(() => {
        toast.error('Failed to generate PDF');
        setPrinting(false);
      });
    }, 300);
  };

  const columns = [
    { key: 'name', label: 'Product', sortable: true, render: (val, row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Package className="w-4 h-4 text-indigo-500" />
        </div>
        <div>
          <p className="font-medium text-slate-800 text-sm">{val}</p>
          <p className="text-xs text-slate-400">SKU: {row.sku || 'N/A'}</p>
        </div>
      </div>
    )},
    { key: 'barcode', label: 'Barcode', sortable: true, render: (val, row) => (
      val ? (
        <button onClick={(e) => { e.stopPropagation(); setBarcodeModal({ isOpen: true, product: row }); }} 
          className="text-indigo-600 hover:underline font-mono text-sm transition-colors hover:text-indigo-800">
          {val}
        </button>
      ) : '-'
    )},
    { key: 'category_name', label: 'Category', sortable: true },
    { key: 'selling_price', label: 'Price', sortable: true, render: v => formatCurrency(v) },
    { key: 'cost_price', label: 'Cost', sortable: true, render: v => formatCurrency(v) },
    { key: 'total_stock', label: 'Stock', sortable: true, render: (v, row) => (
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-sm ${(v || 0) < row.minimum_stock_level ? 'text-rose-600' : (v || 0) <= row.reorder_level ? 'text-amber-500' : 'text-emerald-600'}`}>
            {v || 0}
            {(v || 0) < row.minimum_stock_level && <AlertTriangle className="w-3 h-3 inline ml-1" />}
          </span>
          <button onClick={(e) => handleViewStock(e, row)} className="text-slate-400 hover:text-indigo-600 transition-colors">
            <Info className="w-4 h-4" />
          </button>
        </div>
        <span className="text-[10px] text-slate-400">Min: {row.minimum_stock_level} | Reorder: {row.reorder_level}</span>
      </div>
    )},
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        {!isEmployee && (
          <button onClick={(e) => handleDelete(e, row.id, row.name)}
            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-full transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div className="flex-1 overflow-y-auto relative">
      <Navbar title="Products" />
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search or scan barcode..." className="input-field pl-10 font-mono text-sm" autoFocus />
          </div>
          <div className="flex gap-2">
            {selectedProducts.length > 0 && (
              <button onClick={handlePrintBarcodes} disabled={printing}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm">
                <Printer className="w-4 h-4" /> {printing ? 'Generating...' : `Print Barcodes (${selectedProducts.length})`}
              </button>
            )}
            {!isEmployee && (
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap">
                <Plus className="w-4 h-4" /> Add Product
              </button>
            )}
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          {loading ? <div className="p-6"><SkeletonTable rows={8} cols={6} /></div> : (
            <Table 
              columns={columns} 
              data={products} 
              selectable={true} 
              selectedRows={selectedProducts} 
              onSelectionChange={setSelectedProducts} 
            />
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      {showModal && (
        <Modal title="Add Product" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Name *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Barcode</label>
                <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })}
                  placeholder="Scan or type" className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">SKU</label>
                <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })}
                  className="input-field mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Category</label>
                <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  placeholder="Type category..." className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Brand</label>
                <input type="text" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}
                  placeholder="Type brand..." className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Supplier</label>
                <select value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
                  className="input-field mt-1">
                  <option value="">None</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Selling Price *</label>
                <input required type="number" step="0.01" value={form.selling_price}
                  onChange={e => setForm({ ...form, selling_price: e.target.value })} className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Cost Price</label>
                <input type="number" step="0.01" value={form.cost_price}
                  onChange={e => setForm({ ...form, cost_price: e.target.value })} className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Tax %</label>
                <select value={form.tax_percentage} onChange={e => setForm({ ...form, tax_percentage: parseInt(e.target.value) })}
                  className="input-field mt-1">
                  {[0, 5, 12, 18, 28].map(t => <option key={t} value={t}>{t}%</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Unit</label>
                <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                  className="input-field mt-1">
                  {['Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Pcs', 'Set', 'Pair', 'Dozen'].map(u =>
                    <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">HSN Code</label>
                <input value={form.hsn_code} onChange={e => setForm({ ...form, hsn_code: e.target.value })}
                  className="input-field mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Min Stock Level</label>
                <input type="number" value={form.minimum_stock_level}
                  onChange={e => setForm({ ...form, minimum_stock_level: parseInt(e.target.value) || 0 })}
                  className="input-field mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Reorder Level</label>
                <input type="number" value={form.reorder_level}
                  onChange={e => setForm({ ...form, reorder_level: parseInt(e.target.value) || 0 })}
                  className="input-field mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary px-4 py-2">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
                Create Product
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Branch Stock Viewer Modal */}
      {stockModal.isOpen && (
        <Modal title={`Stock Breakdown: ${stockModal.product?.name}`} onClose={() => setStockModal({ isOpen: false, product: null, stocks: [], loading: false })}>
          <div className="p-4">
            {stockModal.loading ? (
              <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
            ) : stockModal.stocks.length === 0 ? (
              <div className="py-8 text-center text-slate-500">No stock found in any branch.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Branch</th>
                    <th className="py-3 px-4 font-semibold text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {stockModal.stocks.map(s => (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm font-medium text-slate-800">{s.branch_name}</td>
                      <td className="py-3 px-4 text-sm font-bold text-right text-indigo-600">{s.quantity}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50">
                    <td className="py-3 px-4 text-sm font-bold text-slate-700">Total Stock</td>
                    <td className="py-3 px-4 text-sm font-bold text-right text-indigo-700">
                      {stockModal.stocks.reduce((acc, curr) => acc + curr.quantity, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
            <div className="mt-6 flex justify-end">
              <button onClick={() => setStockModal({ isOpen: false, product: null, stocks: [], loading: false })} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-medium transition-colors">
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Barcode Viewer Modal */}
      {barcodeModal.isOpen && barcodeModal.product && (
        <Modal title={`Barcode: ${barcodeModal.product.name}`} onClose={() => setBarcodeModal({ isOpen: false, product: null })}>
          <div className="p-8 flex flex-col items-center justify-center">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex justify-center w-full">
              <Barcode value={barcodeModal.product.barcode} width={2} height={80} />
            </div>
            <p className="mt-4 text-sm text-slate-500 font-mono font-medium">SKU: {barcodeModal.product.sku || 'N/A'}</p>
          </div>
        </Modal>
      )}

      {/* Print Configuration Modal */}
      {showPrintModal && (
        <Modal title="Configure Barcode Quantities" onClose={() => !printing && setShowPrintModal(false)}>
          <div className="p-4 space-y-4">
            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2">
              {products.filter(p => selectedProducts.includes(p.id) && p.barcode).map(product => (
                <div key={product.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-semibold text-slate-800 text-sm truncate">{product.name}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{product.barcode}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-500">Qty:</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="1000"
                      value={printCounts[product.id] || 1} 
                      onChange={(e) => setPrintCounts({ ...printCounts, [product.id]: parseInt(e.target.value) || 1 })}
                      className="input-field w-20 text-center font-semibold"
                      disabled={printing}
                    />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setShowPrintModal(false)} 
                className="btn-secondary px-4 py-2"
                disabled={printing}
              >
                Cancel
              </button>
              <button 
                onClick={generatePDF} 
                disabled={printing}
                className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                <Printer className="w-4 h-4" />
                {printing ? 'Generating PDF...' : 'Generate PDF'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Hidden container for PDF printing (A4 formatted) */}
      <div className="absolute top-0 left-[-9999px] opacity-0 pointer-events-none">
        <div id="print-barcodes-container" className="bg-white" style={{ width: '210mm' }}>
          {(() => {
            const printProducts = products.filter(p => selectedProducts.includes(p.id) && p.barcode);
            const duplicatedProducts = [];
            printProducts.forEach(p => {
              const count = printCounts[p.id] || 1;
              for (let i = 0; i < count; i++) {
                duplicatedProducts.push({ ...p, _printId: `${p.id}-${i}` });
              }
            });
            
            const totalPages = Math.ceil(duplicatedProducts.length / 21) || 1;
            return Array.from({ length: totalPages }).map((_, pageIndex) => (
              <div key={pageIndex}>
                <div className="p-8" style={{ boxSizing: 'border-box' }}>
                  <div className="grid grid-cols-3 gap-6">
                    {duplicatedProducts.slice(pageIndex * 21, (pageIndex + 1) * 21).map(p => (
                      <div key={p._printId} className="flex flex-col items-center justify-center p-3 border border-slate-300 rounded-lg">
                        <Barcode value={p.barcode} width={1.2} height={40} fontSize={10} margin={0} />
                        <span className="text-[10px] font-bold mt-2 text-center truncate w-full" title={p.name}>{p.name}</span>
                        <span className="text-[10px] text-slate-600 font-semibold">{formatCurrency(p.selling_price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {pageIndex < totalPages - 1 && <div className="html2pdf__page-break"></div>}
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
