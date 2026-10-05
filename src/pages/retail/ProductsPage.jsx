import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { getProducts, createProduct, updateProduct, deleteProduct, getCategories, createCategory, getBrands, createBrand, getProductStock, uploadProductsPDF } from '../../api/productsAPI';
import { getSuppliers, createSupplier } from '../../api/productsAPI';
import { getBranchDropdown } from '../../api/coreAPI';
import { formatCurrency } from '../../utils/formatters';
import { Search, Plus, Trash2, Pencil, Package, AlertTriangle, ScanLine, Info, Printer, Upload, FileUp, X, Check, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import Barcode from 'react-barcode';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/*
 * ── Sticker-sheet size configurations — NJ MPL series ──
 * All dimensions in mm. Margins center the grid on A4 (210 × 297 mm).
 *   pageMarginLeft = (210 - cols*labelW - (cols-1)*gapX) / 2
 *   pageMarginTop  = (297 - rows*labelH - (rows-1)*gapY) / 2
 *
 * Fine-tune pageMarginTop / pageMarginLeft / gapX / gapY after a test print.
 */
const STICKER_CONFIGS = {
  l48: {
    // Grid: 4×48 + 3×2 = 198mm wide → margin = (210-198)/2 = 6
    // Grid: 12×24 + 11×0.25 = 290.75mm tall → margin = (297-290.75)/2 = 3.125
    cols: 4, rows: 12, labelW: 48, labelH: 24, gapX: 2, gapY: 0.25,
    pageMarginTop: 3.125,
    pageMarginLeft: 6,
    // Label internals (mm)
    padTop: 0.5, padBottom: 0.5, padLeft: 1.5, padRight: 1.5,
    barcodeW: 38, barcodeH: 8,
    companyFont: 5.5, companyBoxH: 3.5,
    digitsFont: 5.5, digitsBoxH: 3,
    nameFont: 5.5, priceFont: 8, bottomRowH: 5,
    showCompany: true, showName: true, showPrice: true,
    layout: 'vertical',
    pdfScale: 3,
  },
  l16: {
    // Grid: 2×99 + 1×2 = 200mm wide → margin = (210-200)/2 = 5
    // Grid: 8×34 + 7×1.28 = 280.96mm tall → margin = (297-280.96)/2 = 8.02
    cols: 2, rows: 8, labelW: 99, labelH: 34, gapX: 2, gapY: 1.28,
    pageMarginTop: 8.02,
    pageMarginLeft: 5,
    padTop: 1.5, padBottom: 1.5, padLeft: 2, padRight: 2,
    leftColW: 48, rightColW: 45,
    barcodeW: 46, barcodeH: 14,
    digitsFont: 7, digitsBoxH: 4,
    companyFont: 5.5, companyBoxH: 5,
    nameFont: 8, nameBoxH: 9, // 2 lines
    priceFont: 14, priceBoxH: 8,
    showCompany: true, showName: true, showPrice: true,
    layout: 'horizontal',
    pdfScale: 3,
  },
  l40: {
    // Grid: 10×18 + 9×1 = 189mm wide → margin = (210-189)/2 = 10.5
    // Grid: 4×73 + 3×1 = 295mm tall → margin = (297-295)/2 = 1
    cols: 10, rows: 4, labelW: 18, labelH: 73, gapX: 1, gapY: 1,
    pageMarginTop: 1,
    pageMarginLeft: 10.5,
    barcodeW: 48, barcodeH: 4.5,
    companyFont: 5,
    digitsFont: 5,
    nameFont: 5, priceFont: 7,
    showCompany: true, showName: true, showPrice: true,
    layout: 'rotated',
    pdfScale: 4,
  },
  l110: {
    // Grid: 5×35 + 4×2 = 183mm wide → margin = (210-183)/2 = 13.5
    // Grid: 22×10 + 21×2.5 = 272.5mm tall → margin = (297-272.5)/2 = 12.25
    cols: 5, rows: 22, labelW: 35, labelH: 10, gapX: 2, gapY: 2.5,
    pageMarginTop: 12.25,
    pageMarginLeft: 13.5,
    barcodeW: 19, barcodeH: 2,
    digitsFont: 3,
    companyFont: 3.5,
    nameFont: 3.5,
    priceFont: 5,
    showCompany: true, showName: true, showPrice: true,
    layout: 'tiny',
    pdfScale: 4,
  },
};

/* Decide barcode format: CODE128C for all-digit even-length, else CODE128 */
function barcodeFormat(val) {
  return /^\d+$/.test(val) && val.length % 2 === 0 ? 'CODE128C' : 'CODE128';
}

export default function ProductsPage() {
  const { user } = useAuth();
  const isEmployee = user?.role_name === 'EMPLOYEE';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [branches, setBranches] = useState([]);

  // Selection and Printing State
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [barcodeModal, setBarcodeModal] = useState({ isOpen: false, product: null });
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printCounts, setPrintCounts] = useState({});
  const [barcodeSize, setBarcodeSize] = useState('l48'); // 'l40' | 'l16' | 'l110' | 'l48'
  const [printing, setPrinting] = useState(false);
  const [showCutGuides, setShowCutGuides] = useState(false);

  // PDF Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pdfReviewProducts, setPdfReviewProducts] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const pagesContainerRef = useRef(null);

  const [form, setForm] = useState({
    name: '', sku: '', barcode: '', description: '', category: '', brand: '', supplier_name: '',
    unit: 'Nos', cost_price: '', selling_price: '', hsn_code: '', tax_percentage: 0,
    minimum_stock_level: 0, reorder_level: 20, dead_stock_days: 0, initial_stock: '', initial_stock_branch: '',
  });
  const [stockModal, setStockModal] = useState({ isOpen: false, product: null, stocks: [], loading: false });

  useEffect(() => { loadProducts(); loadDropdowns(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    const params = { page, page_size: 20 };
    if (search) params.search = search;
    const { data } = await getProducts(params);
    if (data?.data) {
      if (Array.isArray(data.data)) {
        setProducts(data.data);
        setTotalCount(data.data.length);
      } else {
        setProducts(data.data.results || []);
        setTotalCount(data.data.count || 0);
      }
    }
    setLoading(false);
  };

  const loadDropdowns = async () => {
    const [c, b, s, br] = await Promise.all([getCategories(), getBrands(), getSuppliers(), getBranchDropdown()]);
    if (c.data?.data) setCategories(c.data.data);
    if (b.data?.data) setBrands(b.data.data);
    if (s.data?.data) setSuppliers(Array.isArray(s.data.data) ? s.data.data : s.data.data.results || []);
    if (br.data?.data) {
      setBranches(br.data.data);
      if (br.data.data.length > 0) {
        setForm(prev => ({ ...prev, initial_stock_branch: br.data.data[0].id }));
      }
    }
  };

  useEffect(() => { loadProducts(); }, [search, page]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form };

    // Handle Supplier Auto-Creation
    if (payload.supplier_name && payload.supplier_name.trim() !== '') {
      const existing = suppliers.find(s => s.name.toLowerCase() === payload.supplier_name.trim().toLowerCase());
      if (existing) {
        payload.supplier = existing.id;
      } else {
        try {
          const { data: newSupplier } = await createSupplier({ name: payload.supplier_name.trim() });
          if (newSupplier) {
            payload.supplier = newSupplier.id;
            setSuppliers(prev => [...prev, newSupplier]);
          }
        } catch (err) {
          console.error("Failed to create supplier", err);
        }
      }
    }

    if (!payload.category) delete payload.category;
    if (!payload.brand) delete payload.brand;
    if (!payload.supplier) delete payload.supplier;
    if (!payload.barcode) delete payload.barcode;
    if (payload.selling_price === '') delete payload.selling_price;
    if (payload.cost_price === '') delete payload.cost_price;
    delete payload.supplier_name;

    // Remove initial_stock and initial_stock_branch for edit requests (stock is managed separately)
    if (editingId) {
      delete payload.initial_stock;
      delete payload.initial_stock_branch;
    }
    // Remove empty initial_stock to avoid sending 0 unnecessarily
    if (!payload.initial_stock) {
      delete payload.initial_stock;
      delete payload.initial_stock_branch;
    }

    const { data, error } = editingId
      ? await updateProduct(editingId, payload)
      : await createProduct(payload);

    if (data) {
      toast.success(editingId ? 'Product updated' : 'Product created');
      setShowModal(false);
      setEditingId(null);
      setForm({
        name: '', sku: '', barcode: '', description: '', category: '', brand: '', supplier_name: '',
        unit: 'Nos', cost_price: '', selling_price: '', hsn_code: '', tax_percentage: 0, minimum_stock_level: 0, reorder_level: 20, dead_stock_days: 0, initial_stock: '', initial_stock_branch: branches[0]?.id || ''
      });
      loadProducts();
    } else toast.error(error || 'Failed');
  };

  const handleEdit = (product) => {
    setEditingId(product.id);
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      description: product.description || '',
      category: product.category_name || '',
      brand: product.brand_name || '',
      supplier_name: product.supplier_name || '',
      unit: product.unit || 'Nos',
      cost_price: product.cost_price || '',
      selling_price: product.selling_price || '',
      hsn_code: product.hsn_code || '',
      tax_percentage: product.tax_percentage !== undefined ? product.tax_percentage : 0,
      minimum_stock_level: product.minimum_stock_level !== undefined ? product.minimum_stock_level : 0,
      reorder_level: product.reorder_level !== undefined ? product.reorder_level : 20,
      dead_stock_days: product.dead_stock_days !== undefined ? product.dead_stock_days : 0
    });
    setShowModal(true);
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

  /* ── PDF generation ── */
  const generatePDF = async () => {
    setPrinting(true);
    try {
      const cfg = STICKER_CONFIGS[barcodeSize] || STICKER_CONFIGS.l48;

      // Wait for fonts and a short render tick
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 400));

      const container = pagesContainerRef.current;
      if (!container) throw new Error('Print container not found');

      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

      if (cfg.layout === 'rotated') {
        /* ── L40 special path: capture each horizontal label, rotate 90°, compose onto pages ── */
        const sourceEls = container.querySelectorAll('.l40-source');
        if (sourceEls.length === 0) throw new Error('No L40 labels found');

        // Capture each label individually (horizontal 73×18mm)
        const rotatedImages = [];
        for (const srcEl of sourceEls) {
          const c = await html2canvas(srcEl, {
            scale: cfg.pdfScale,
            backgroundColor: '#ffffff',
            useCORS: true, logging: false, scrollY: 0,
            windowWidth: srcEl.scrollWidth,
            windowHeight: srcEl.scrollHeight,
          });
          // Rotate canvas 90° clockwise: (w×h) → (h×w)
          const rc = document.createElement('canvas');
          rc.width = c.height;
          rc.height = c.width;
          const ctx = rc.getContext('2d');
          ctx.translate(rc.width, 0);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(c, 0, 0);
          rotatedImages.push(rc.toDataURL('image/png'));
        }

        // Compose rotated images onto PDF pages in a grid
        const { cols, rows, labelW, labelH, gapX, gapY, pageMarginTop, pageMarginLeft } = cfg;
        const perPage = cols * rows;
        const totalPdfPages = Math.ceil(rotatedImages.length / perPage);

        for (let pg = 0; pg < totalPdfPages; pg++) {
          if (pg > 0) pdf.addPage();
          for (let i = 0; i < perPage; i++) {
            const idx = pg * perPage + i;
            if (idx >= rotatedImages.length) break;
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = pageMarginLeft + col * (labelW + gapX);
            const y = pageMarginTop + row * (labelH + gapY);
            pdf.addImage(rotatedImages[idx], 'PNG', x, y, labelW, labelH);
          }
        }
      } else {
        /* ── Standard path: capture each page as a whole ── */
        const pageEls = container.querySelectorAll('.label-page');
        if (pageEls.length === 0) throw new Error('No pages to print');

        for (let i = 0; i < pageEls.length; i++) {
          const canvas = await html2canvas(pageEls[i], {
            scale: cfg.pdfScale,
            backgroundColor: '#ffffff',
            useCORS: true, logging: false, scrollY: 0,
            windowWidth: pageEls[i].scrollWidth,
            windowHeight: pageEls[i].scrollHeight,
          });
          const imgData = canvas.toDataURL('image/png');
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
        }
      }

      pdf.save(`barcodes_${Date.now()}.pdf`);
      setPrinting(false);
      setShowPrintModal(false);
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('Failed to generate PDF');
      setPrinting(false);
    }
  };

  const columns = [
    {
      key: 'name', label: 'Product', sortable: true, render: (val, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Package className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <p className="font-medium text-slate-800 text-sm">{val}</p>
            <p className="text-xs text-slate-400">SKU: {row.sku || 'N/A'}</p>
          </div>
        </div>
      )
    },
    {
      key: 'barcode', label: 'Barcode', sortable: true, render: (val, row) => (
        val ? (
          <button onClick={(e) => { e.stopPropagation(); setBarcodeModal({ isOpen: true, product: row }); }}
            className="text-indigo-600 hover:underline font-mono text-sm transition-colors hover:text-indigo-800">
            {val}
          </button>
        ) : '-'
      )
    },
    { key: 'category_name', label: 'Category', sortable: true },
    { key: 'selling_price', label: 'Price', sortable: true, render: v => formatCurrency(v) },
    { key: 'cost_price', label: 'Cost', sortable: true, render: v => formatCurrency(v) },
    {
      key: 'total_stock', label: 'Stock', sortable: true, render: (v, row) => (
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
      )
    },
    {
      key: 'actions', label: '', render: (_, row) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          {!isEmployee && (
            <>
              <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
                className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={(e) => handleDelete(e, row.id, row.name)}
                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-full transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )
    },
  ];

  /* ── Build duplicated label list and page data ── */
  const cfg = STICKER_CONFIGS[barcodeSize] || STICKER_CONFIGS.l48;
  const perPage = cfg.cols * cfg.rows;
  const companyName = user?.company_name || '';
  const ff = 'Arial, Helvetica, sans-serif';
  const border = showCutGuides ? '1px dashed #cbd5e1' : 'none';

  const printProducts = products.filter(p => selectedProducts.includes(p.id) && p.barcode);
  const duplicatedProducts = [];
  printProducts.forEach(p => {
    const count = printCounts[p.id] || 1;
    for (let i = 0; i < count; i++) {
      duplicatedProducts.push({ ...p, _printId: `${p.id}-${i}` });
    }
  });
  const totalPages = Math.ceil(duplicatedProducts.length / perPage) || 1;

  /* ── SVG barcode component with exact mm sizing ── */
  let barcodeIdx = 0;
  const SizedBarcode = ({ value, widthMM, heightMM }) => {
    const fmt = barcodeFormat(value);
    const cls = `bc-${widthMM}-${heightMM}-${barcodeIdx++}`.replace(/\./g, '_');
    return (
      <div className={cls} style={{ width: `${widthMM}mm`, height: `${heightMM}mm`, overflow: 'hidden', lineHeight: 0, flexShrink: 0 }}>
        <Barcode
          value={value}
          format={fmt}
          renderer="svg"
          displayValue={false}
          margin={0}
          width={2}
          height={100}
          background="transparent"
        />
        <style>{`
          .${cls} > svg {
            width: ${widthMM}mm !important;
            height: ${heightMM}mm !important;
          }
        `}</style>
      </div>
    );
  };

  /* ── Per-layout label renderers ── */
  const renderLabelL48 = (p) => (
    <div key={p._printId} style={{
      width: `${cfg.labelW}mm`, height: `${cfg.labelH}mm`, boxSizing: 'border-box',
      border, overflow: 'hidden', backgroundColor: '#fff',
      padding: `${cfg.padTop}mm ${cfg.padRight}mm ${cfg.padBottom}mm ${cfg.padLeft}mm`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {/* Company */}
      {cfg.showCompany && companyName && (
        <div style={{ width: '100%', minHeight: `${cfg.companyBoxH}mm`, maxHeight: `${cfg.companyBoxH}mm`, fontSize: `${cfg.companyFont}pt`,
          fontWeight: 'bold', textTransform: 'uppercase', color: '#000', fontFamily: ff,
          lineHeight: `${cfg.companyBoxH}mm`, overflow: 'visible', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center',
          flexShrink: 0,
        }}>{companyName}</div>
      )}
      {/* Barcode */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
        <SizedBarcode value={p.barcode} widthMM={cfg.barcodeW} heightMM={cfg.barcodeH} />
      </div>
      {/* Digits */}
      <div style={{ width: '100%', minHeight: `${cfg.digitsBoxH}mm`, fontSize: `${cfg.digitsFont}pt`,
        color: '#000', fontFamily: ff, lineHeight: `${cfg.digitsBoxH}mm`, textAlign: 'center',
        flexShrink: 0,
      }}>{p.barcode}</div>
      {/* Name + Price row */}
      <div style={{ width: '100%', minHeight: `${cfg.bottomRowH}mm`, maxHeight: `${cfg.bottomRowH}mm`, display: 'flex', alignItems: 'center', gap: '1mm', flexShrink: 0 }}>
        {cfg.showName && (
          <div style={{ flex: 1, minWidth: 0, fontSize: `${cfg.nameFont}pt`, fontWeight: 'bold',
            color: '#000', fontFamily: ff, lineHeight: `${cfg.bottomRowH}mm`,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={p.name}>{p.name}</div>
        )}
        {cfg.showPrice && (
          <div style={{ flexShrink: 0, fontSize: `${cfg.priceFont}pt`, fontWeight: 900,
            color: '#000', fontFamily: ff, lineHeight: `${cfg.bottomRowH}mm`, whiteSpace: 'nowrap',
          }}>{formatCurrency(p.selling_price)}</div>
        )}
      </div>
    </div>
  );

  const renderLabelL16 = (p) => (
    <div key={p._printId} style={{
      width: `${cfg.labelW}mm`, height: `${cfg.labelH}mm`, boxSizing: 'border-box',
      border, overflow: 'hidden', backgroundColor: '#fff',
      padding: `${cfg.padTop}mm ${cfg.padRight}mm ${cfg.padBottom}mm ${cfg.padLeft}mm`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* TOP ROW: company name — full width */}
      {cfg.showCompany && companyName && (
        <div style={{ width: '100%', minHeight: `${cfg.companyBoxH}mm`, maxHeight: `${cfg.companyBoxH}mm`,
          fontSize: `${cfg.companyFont}pt`, fontWeight: 'bold', textTransform: 'uppercase', color: '#000',
          fontFamily: ff, lineHeight: `${cfg.companyBoxH}mm`, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', flexShrink: 0, textAlign: 'left',
        }}>{companyName}</div>
      )}
      {/* BOTTOM SECTION: barcode+digits left, name+price right */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2mm', minHeight: 0 }}>
        {/* LEFT column: barcode + digits */}
        <div style={{ width: `${cfg.leftColW}mm`, flexShrink: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <SizedBarcode value={p.barcode} widthMM={cfg.barcodeW} heightMM={cfg.barcodeH} />
          <div style={{ width: '100%', minHeight: `${cfg.digitsBoxH}mm`, fontSize: `${cfg.digitsFont}pt`,
            color: '#000', fontFamily: ff, lineHeight: `${cfg.digitsBoxH}mm`, textAlign: 'center',
            flexShrink: 0,
          }}>{p.barcode}</div>
        </div>
        {/* RIGHT column: name, price */}
        <div style={{ width: `${cfg.rightColW}mm`, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', gap: '0.5mm',
        }}>
          {cfg.showName && (
            <div style={{ minHeight: `${cfg.nameBoxH}mm`, maxHeight: `${cfg.nameBoxH}mm`, fontSize: `${cfg.nameFont}pt`,
              fontWeight: 'bold', color: '#000', fontFamily: ff, lineHeight: 1.3,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              flexShrink: 0,
            }} title={p.name}>{p.name}</div>
          )}
          {cfg.showPrice && (
            <div style={{ minHeight: `${cfg.priceBoxH}mm`, fontSize: `${cfg.priceFont}pt`,
              fontWeight: 900, color: '#000', fontFamily: ff, lineHeight: `${cfg.priceBoxH}mm`,
              display: 'flex', alignItems: 'center', flexShrink: 0,
            }}>{formatCurrency(p.selling_price)}</div>
          )}
        </div>
      </div>
    </div>
  );

  /* L40: rendered HORIZONTALLY (73mm wide × 18mm tall), then canvas is rotated 90° in generatePDF.
   * Pure absolute positioning with NO height and NO overflow:hidden to prevent html2canvas from 
   * arbitrarily clipping ascenders/descenders on tight bounding boxes. */
  const renderLabelL40 = (p) => (
    <div key={p._printId} className="l40-source" style={{
      width: `${cfg.labelH}mm`, height: `${cfg.labelW}mm`, boxSizing: 'border-box',
      border, overflow: 'hidden', backgroundColor: '#fff', position: 'relative'
    }}>
      {/* Company */}
      {cfg.showCompany && companyName && (
        <div style={{ position: 'absolute', top: '0.5mm', left: '2mm', right: '2mm',
          fontSize: `${cfg.companyFont}pt`, fontWeight: 'bold', textTransform: 'uppercase',
          color: '#000', fontFamily: ff, textAlign: 'center', whiteSpace: 'nowrap'
        }}>{companyName}</div>
      )}

      {/* Barcode — pushed down to 5mm for clear gap from company name */}
      <div style={{ position: 'absolute', top: '5mm', left: '0', right: '0',
        display: 'flex', justifyContent: 'center'
      }}>
        <SizedBarcode value={p.barcode} widthMM={cfg.barcodeW} heightMM={cfg.barcodeH} />
      </div>

      {/* Digits */}
      <div style={{ position: 'absolute', top: '10mm', left: '0', right: '0',
        fontSize: `${cfg.digitsFont}pt`, color: '#000', fontFamily: ff, textAlign: 'center', whiteSpace: 'nowrap'
      }}>{p.barcode}</div>

      {/* Name */}
      {cfg.showName && (
        <div style={{ position: 'absolute', top: '13mm', left: '2mm', right: '16mm',
          fontSize: `${cfg.nameFont}pt`, fontWeight: 'bold',
          color: '#000', fontFamily: ff, whiteSpace: 'nowrap', textAlign: 'left'
        }} title={p.name}>{p.name}</div>
      )}

      {/* Price */}
      {cfg.showPrice && (
        <div style={{ position: 'absolute', top: '13mm', right: '2mm',
          fontSize: `${cfg.priceFont}pt`, fontWeight: 900, color: '#000',
          fontFamily: ff, textAlign: 'right', whiteSpace: 'nowrap'
        }}>{formatCurrency(p.selling_price)}</div>
      )}
    </div>
  );

  /* L110 (35×10mm): pure absolute positioning without overflow:hidden */
  const renderLabelL110 = (p) => (
    <div key={p._printId} style={{
      width: `${cfg.labelW}mm`, height: `${cfg.labelH}mm`, boxSizing: 'border-box',
      border, overflow: 'hidden', backgroundColor: '#fff', position: 'relative'
    }}>
      {/* Company Name */}
      {cfg.showCompany && companyName && (
        <div style={{ position: 'absolute', top: '0.3mm', left: '1mm', right: '1mm',
          fontSize: `${cfg.companyFont}pt`, fontWeight: 'bold', color: '#000', fontFamily: ff,
          textAlign: 'center', whiteSpace: 'nowrap'
        }}>{companyName}</div>
      )}
      {/* Product name */}
      {cfg.showName && (
        <div style={{ position: 'absolute', top: '2mm', left: '1mm', right: '1mm',
          fontSize: `${cfg.nameFont}pt`, fontWeight: 'bold', color: '#000', fontFamily: ff,
          textAlign: 'center', whiteSpace: 'nowrap'
        }}>{p.name}</div>
      )}
      {/* Barcode — gap from product name, shorter 2mm height */}
      <div style={{ position: 'absolute', top: '4.5mm', left: '1mm', width: `${cfg.barcodeW}mm` }}>
        <SizedBarcode value={p.barcode} widthMM={cfg.barcodeW} heightMM={cfg.barcodeH} />
      </div>
      {/* Digits */}
      <div style={{ position: 'absolute', top: '6.8mm', left: '1mm', width: `${cfg.barcodeW}mm`,
        fontSize: `${cfg.digitsFont}pt`, color: '#000', fontFamily: ff, textAlign: 'center', whiteSpace: 'nowrap'
      }}>{p.barcode}</div>
      {/* Price */}
      {cfg.showPrice && (
        <div style={{ position: 'absolute', top: '5mm', right: '1mm',
          fontSize: `${cfg.priceFont}pt`, fontWeight: 900, color: '#000', fontFamily: ff,
          textAlign: 'right', whiteSpace: 'nowrap'
        }}>{formatCurrency(p.selling_price)}</div>
      )}
    </div>
  );

  const renderLabel = (p) => {
    if (cfg.layout === 'horizontal') return renderLabelL16(p);
    if (cfg.layout === 'rotated') return renderLabelL40(p);
    if (cfg.layout === 'tiny') return renderLabelL110(p);
    return renderLabelL48(p);
  };

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
              <>
                {/* <button onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/20 whitespace-nowrap">
                  <Upload className="w-4 h-4" /> Upload PDF
                </button> */}
                <button onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-500/20 whitespace-nowrap">
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </>
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

        {Math.ceil(totalCount / 20) > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{totalCount} products total</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="btn-secondary py-2 px-3 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm text-slate-600">Page {page} of {Math.ceil(totalCount / 20)}</span>
              <button onClick={() => setPage(Math.min(Math.ceil(totalCount / 20), page + 1))} disabled={page === Math.ceil(totalCount / 20)}
                className="btn-secondary py-2 px-3 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {showModal && (
        <Modal title={editingId ? "Edit Product" : "Add Product"} onClose={() => { setShowModal(false); setEditingId(null); setForm({ name: '', sku: '', barcode: '', description: '', category: '', brand: '', supplier_name: '', unit: 'Nos', cost_price: '', selling_price: '', hsn_code: '', tax_percentage: 0, minimum_stock_level: 0, reorder_level: 20, dead_stock_days: 0, initial_stock: '', initial_stock_branch: branches[0]?.id || '' }); }}>
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
                <input list="supplier-options" value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                  placeholder="Type or select..." className="input-field mt-1" />
                <datalist id="supplier-options">
                  {suppliers.map(s => <option key={s.id} value={s.name} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Selling Price</label>
                <input type="number" step="0.01" value={form.selling_price}
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
                  {['Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Pcs', 'Set', 'Pair', 'Dozen', 'Packets', 'Cartoon'].map(u =>
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
                  onChange={e => setForm({ ...form, minimum_stock_level: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
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
              <div>
                <label className="text-xs font-medium text-slate-500">Dead Stock Days</label>
                <input type="number" value={form.dead_stock_days}
                  onChange={e => setForm({ ...form, dead_stock_days: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="input-field mt-1" />
                <p className="text-[10px] text-slate-400 mt-0.5">No sale in these days = dead stock</p>
              </div>
              {!editingId && (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Initial Stock (Opening)</label>
                    <input type="number" min="0" value={form.initial_stock}
                      onChange={e => setForm({ ...form, initial_stock: e.target.value })}
                      placeholder="0"
                      className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500">Stock Branch</label>
                    <select 
                      value={form.initial_stock_branch} 
                      onChange={e => setForm({ ...form, initial_stock_branch: e.target.value })} 
                      className="input-field mt-1"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowModal(false); setEditingId(null); setForm({ name: '', sku: '', barcode: '', description: '', category: '', brand: '', supplier_name: '', unit: 'Nos', cost_price: '', selling_price: '', hsn_code: '', tax_percentage: 0, minimum_stock_level: 0, reorder_level: 20, dead_stock_days: 0, initial_stock: '', initial_stock_branch: branches[0]?.id || '' }); }} className="btn-secondary px-4 py-2">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
                {editingId ? "Save Changes" : "Create Product"}
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
        <Modal title="Configure Barcode Printing" onClose={() => !printing && setShowPrintModal(false)}>
          <div className="p-4 space-y-5">
            {/* Sticker Sheet Format Selector — 2×2 grid */}
            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-3">Sticker Sheet Format</h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'l48',  shortLabel: '48L',  size: '48 × 24 mm',  count: '48 labels / page' },
                  { key: 'l16',  shortLabel: '16L',  size: '99 × 34 mm',  count: '16 labels / page' },
                  { key: 'l40',  shortLabel: '40P',  size: '18 × 73 mm',  count: '40 labels / page' },
                  { key: 'l110', shortLabel: '110L', size: '35 × 10 mm',  count: '110 labels / page' },
                ].map(s => (
                  <button key={s.key} onClick={() => setBarcodeSize(s.key)} disabled={printing}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${barcodeSize === s.key
                        ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
                      }`}>
                    <span className={`font-bold text-sm ${barcodeSize === s.key ? 'text-indigo-700' : 'text-slate-700'}`}>{s.shortLabel}</span>
                    <p className={`text-xs font-semibold mt-0.5 ${barcodeSize === s.key ? 'text-indigo-600' : 'text-slate-500'}`}>{s.size}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.count}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Cut guides checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={showCutGuides} onChange={e => setShowCutGuides(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" disabled={printing} />
              <span className="text-sm text-slate-600">Show cut guides (for plain-paper test)</span>
            </label>

            {/* Product Quantities */}
            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-2">Product Quantities</h4>
              <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2">
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

      {/* Hidden container for label rendering */}
      <div style={{ position: 'fixed', top: 0, left: '-9999px', zIndex: -1 }} ref={pagesContainerRef}>
        {cfg.layout === 'rotated' ? (
          /* L40: render each label HORIZONTALLY (73×18mm) as individual divs.
           * generatePDF captures each, rotates 90°, and composes onto pages. */
          duplicatedProducts.map(p => renderLabel(p))
        ) : (
          /* Other layouts: render as page grids for full-page capture */
          Array.from({ length: totalPages }).map((_, pageIndex) => {
            const pageItems = duplicatedProducts.slice(pageIndex * perPage, (pageIndex + 1) * perPage);
            return (
              <div key={`page-${pageIndex}`} className="label-page" style={{
                width: '210mm', height: '297mm', position: 'relative',
                overflow: 'hidden', boxSizing: 'border-box', backgroundColor: '#fff',
              }}>
                <div style={{
                  position: 'absolute',
                  left: `${cfg.pageMarginLeft}mm`,
                  top: `${cfg.pageMarginTop}mm`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cfg.cols}, ${cfg.labelW}mm)`,
                  gridTemplateRows: `repeat(${cfg.rows}, ${cfg.labelH}mm)`,
                  columnGap: `${cfg.gapX}mm`,
                  rowGap: `${cfg.gapY}mm`,
                }}>
                  {pageItems.map(p => renderLabel(p))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PDF Upload Modal */}
      {showUploadModal && (
        <Modal title="Upload Product PDF" onClose={() => !uploading && setShowUploadModal(false)}>
          <div className="p-6">
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center hover:border-indigo-400 transition-colors bg-slate-50/50">
              <FileUp className="w-12 h-12 mx-auto text-indigo-400 mb-4" />
              <p className="text-slate-700 font-semibold mb-1">Select a PDF file with product details</p>
              <p className="text-xs text-slate-400 mb-5">AI will extract product information automatically</p>
              <input
                type="file"
                accept=".pdf"
                id="pdf-upload-input"
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  const { data, error } = await uploadProductsPDF(file);
                  setUploading(false);
                  if (data?.data?.products) {
                    setPdfReviewProducts(data.data.products);
                    setShowUploadModal(false);
                    setShowReviewModal(true);
                    toast.success(data.message || `${data.data.count} products extracted!`);
                  } else {
                    toast.error(error || 'Failed to process PDF');
                  }
                  e.target.value = '';
                }}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <p className="text-sm text-indigo-600 font-semibold">AI is extracting products...</p>
                  <p className="text-xs text-slate-400">This may take 15-30 seconds</p>
                </div>
              ) : (
                <label htmlFor="pdf-upload-input"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 transition-all cursor-pointer shadow-lg shadow-indigo-500/20">
                  <Upload className="w-4 h-4" /> Choose PDF File
                </label>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* PDF Review / Edit Modal */}
      {showReviewModal && pdfReviewProducts.length > 0 && (
        <Modal title={`Review Extracted Products (${pdfReviewProducts.length})`} onClose={() => { setShowReviewModal(false); setPdfReviewProducts([]); loadProducts(); }}>
          <div className="p-4 space-y-4">
            <p className="text-sm text-slate-500">Products have been created. You can edit any product below, then click <strong>Save Changes</strong> to update.</p>
            <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
              {pdfReviewProducts.map((p, idx) => (
                <div key={p.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 hover:bg-white transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">#{idx + 1}</span>
                    <button onClick={() => setPdfReviewProducts(prev => prev.filter(x => x.id !== p.id))}
                      className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors" title="Remove">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Name</label>
                      <input value={p.name} onChange={e => setPdfReviewProducts(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                        className="input-field mt-0.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">SKU</label>
                      <input value={p.sku || ''} onChange={e => setPdfReviewProducts(prev => prev.map(x => x.id === p.id ? { ...x, sku: e.target.value } : x))}
                        className="input-field mt-0.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Barcode</label>
                      <input value={p.barcode || ''} disabled className="input-field mt-0.5 text-sm bg-slate-100 text-slate-500" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Category</label>
                      <input value={p.category_name || ''} onChange={e => setPdfReviewProducts(prev => prev.map(x => x.id === p.id ? { ...x, category_name: e.target.value } : x))}
                        className="input-field mt-0.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Brand</label>
                      <input value={p.brand_name || ''} onChange={e => setPdfReviewProducts(prev => prev.map(x => x.id === p.id ? { ...x, brand_name: e.target.value } : x))}
                        className="input-field mt-0.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Unit</label>
                      <select value={p.unit || 'Nos'} onChange={e => setPdfReviewProducts(prev => prev.map(x => x.id === p.id ? { ...x, unit: e.target.value } : x))}
                        className="input-field mt-0.5 text-sm">
                        {['Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Pcs', 'Set', 'Pair', 'Dozen'].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Selling Price</label>
                      <input type="number" step="0.01" value={p.selling_price || 0} onChange={e => setPdfReviewProducts(prev => prev.map(x => x.id === p.id ? { ...x, selling_price: e.target.value } : x))}
                        className="input-field mt-0.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Cost Price</label>
                      <input type="number" step="0.01" value={p.cost_price || 0} onChange={e => setPdfReviewProducts(prev => prev.map(x => x.id === p.id ? { ...x, cost_price: e.target.value } : x))}
                        className="input-field mt-0.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Tax %</label>
                      <select value={p.tax_percentage || 18} onChange={e => setPdfReviewProducts(prev => prev.map(x => x.id === p.id ? { ...x, tax_percentage: parseInt(e.target.value) } : x))}
                        className="input-field mt-0.5 text-sm">
                        {[0, 5, 12, 18, 28].map(t => <option key={t} value={t}>{t}%</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <span className="text-sm text-slate-500">{pdfReviewProducts.length} product(s)</span>
              <div className="flex gap-2">
                <button onClick={() => { setShowReviewModal(false); setPdfReviewProducts([]); loadProducts(); }}
                  className="btn-secondary px-4 py-2">Done</button>
                <button onClick={async () => {
                  let updated = 0;
                  for (const p of pdfReviewProducts) {
                    const payload = {
                      name: p.name, sku: p.sku, barcode: p.barcode, description: p.description,
                      category: p.category_name || '', brand: p.brand_name || '',
                      unit: p.unit, cost_price: p.cost_price, selling_price: p.selling_price,
                      hsn_code: p.hsn_code, tax_percentage: p.tax_percentage,
                    };
                    const { data } = await updateProduct(p.id, payload);
                    if (data) updated++;
                  }
                  toast.success(`${updated} product(s) updated!`);
                  setShowReviewModal(false);
                  setPdfReviewProducts([]);
                  loadProducts();
                }}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/20">
                  <Check className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
