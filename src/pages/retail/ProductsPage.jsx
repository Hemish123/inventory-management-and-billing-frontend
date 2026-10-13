import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import { SkeletonTable } from '../../components/common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { getProducts, createProduct, updateProduct, deleteProduct, getCategories, createBrand, getProductStock, uploadProductsPDF, getBrands } from '../../api/productsAPI';
import { getSuppliers, createSupplier } from '../../api/productsAPI';
import { getBranchDropdown } from '../../api/coreAPI';
import { formatCurrency } from '../../utils/formatters';
import { Search, Plus, Trash2, Pencil, Package, AlertTriangle, ScanLine, Info, Printer, Upload, FileUp, X, Check, Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import Barcode from 'react-barcode';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';

/* ═══════════════════════════════════════════════════════════════════
 * Thermal label roll engine — TSC TA220 · 203 dpi · 2-up · 50×25 mm
 * Single source of truth, everything in millimetres.
 * ═══════════════════════════════════════════════════════════════════ */

const DOT = 0.125;               // 1 dot @ 203 dpi = 0.125 mm
const PT = 25.4 / 72;            // 1 pt in mm
const BASELINE = 0.77;           // baseline factor inside em box
const MIN_FONT = 5;              // pt, general minimum
const MIN_NUM_FONT = 4.5;        // pt, for number line
const MIN_MODULE = 0.25;         // 2 dots minimum module width

const DEFAULT_ROLL = {
  cols: 2, labelW: 50, labelH: 25, gapX: 0,
  mediaW: 100, offsetX: 0, offsetY: 0,
  padX: 2, padY: 1.5, startRight: false,
};

const ROLL_STORAGE_KEY = 'thermalRoll_v1';

/** Snap a value to the 0.125 mm dot grid. */
const snap = (v) => Math.round(v / DOT) * DOT;

/** Load saved roll settings from localStorage, merging with defaults. */
function loadRollSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(ROLL_STORAGE_KEY));
    if (saved && typeof saved === 'object') {
      return {
        ...DEFAULT_ROLL,
        mediaW: saved.mediaW ?? DEFAULT_ROLL.mediaW,
        gapX: saved.gapX ?? DEFAULT_ROLL.gapX,
        offsetX: saved.offsetX ?? DEFAULT_ROLL.offsetX,
        offsetY: saved.offsetY ?? DEFAULT_ROLL.offsetY,
        startRight: !!saved.startRight,
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_ROLL };
}

/** Save editable settings to localStorage. */
function saveRollSettings(cfg) {
  try {
    localStorage.setItem(ROLL_STORAGE_KEY, JSON.stringify({
      mediaW: cfg.mediaW,
      gapX: cfg.gapX,
      offsetX: cfg.offsetX,
      offsetY: cfg.offsetY,
      startRight: cfg.startRight,
    }));
  } catch { /* ignore */ }
}

/* ───────────── geometry & validation ───────────── */

function getRollGeometry(cfg) {
  const usedW = cfg.cols * cfg.labelW + (cfg.cols - 1) * cfg.gapX;
  const leftMargin = snap((cfg.mediaW - usedW) / 2);
  return { usedW, leftMargin };
}

/** Returns positions for label index i (0 or 1) within a row. */
function getLabelPos(cfg, geo, i) {
  const x = snap(geo.leftMargin + cfg.offsetX + i * (cfg.labelW + cfg.gapX));
  const y = snap(cfg.offsetY);
  return { x, y };
}

/** Validate roll config. Returns array of problem strings. */
function validateRoll(cfg) {
  const problems = [];
  const geo = getRollGeometry(cfg);
  if (geo.usedW > cfg.mediaW) problems.push(`Labels + gap (${geo.usedW.toFixed(2)} mm) exceed media width (${cfg.mediaW} mm).`);
  if (cfg.mediaW > 108) problems.push(`Media width ${cfg.mediaW} mm exceeds the TSC TA220 max print width of 108 mm.`);
  const pos0 = getLabelPos(cfg, geo, 0);
  if (pos0.x < 0) problems.push(`Left label starts at ${pos0.x.toFixed(3)} mm — off the left edge.`);
  const pos1 = getLabelPos(cfg, geo, 1);
  const rightEdge = pos1.x + cfg.labelW;
  if (rightEdge > cfg.mediaW) problems.push(`Right label ends at ${rightEdge.toFixed(3)} mm — past media width ${cfg.mediaW} mm.`);
  if (cfg.offsetY < 0 || cfg.offsetY > 3) problems.push(`Shift down must be 0–3 mm (currently ${cfg.offsetY} mm).`);
  if (cfg.padX < 1) problems.push(`Horizontal padding must be at least 1 mm (currently ${cfg.padX} mm).`);
  if (cfg.padY < 1) problems.push(`Vertical padding must be at least 1 mm (currently ${cfg.padY} mm).`);
  return problems;
}

/* ───────────── barcode encoding (vector) ───────────── */

function detectFormat(v) {
  if (/^\d{12}$/.test(v)) return 'UPC';
  if (/^\d{13}$/.test(v)) return 'EAN13';
  if (/^\d{8}$/.test(v)) return 'EAN8';
  return 'CODE128';
}

const barCache = new Map();

/** Returns the barcode as a string of 1/0 modules. */
function getBarcodeBinary(value) {
  if (barCache.has(value)) return barCache.get(value);
  let binary = null;
  for (const format of [detectFormat(value), 'CODE128']) {
    try {
      const out = {};
      JsBarcode(out, value, { format, displayValue: false, margin: 0 });
      binary = out.encodings.map((e) => e.data).join('');
      if (binary) break;
    } catch (e) {
      /* invalid checksum etc. -> try next format */
    }
  }
  if (!binary) throw new Error(`Cannot encode barcode "${value}"`);
  barCache.set(value, binary);
  return binary;
}

/* ───────────── text fitting ───────────── */

function wrapText(pdf, text, maxW, maxLines) {
  const lines = [];
  let cur = '';
  const flush = () => { if (cur) lines.push(cur); cur = ''; };
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    let w = word;
    while (w.length > 1 && pdf.getTextWidth(w) > maxW) {
      let cut = w.length - 1;
      while (cut > 1 && pdf.getTextWidth(w.slice(0, cut)) > maxW) cut--;
      flush();
      lines.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    const test = cur ? `${cur} ${w}` : w;
    if (pdf.getTextWidth(test) <= maxW) cur = test;
    else { flush(); cur = w; }
  }
  flush();
  return lines.length <= maxLines ? lines : null;
}

function ellipsize(pdf, text, maxW, maxLines) {
  const all = wrapText(pdf, text, maxW, Infinity);
  const out = all.slice(0, maxLines);
  if (all.length > maxLines && out.length) {
    let last = out[out.length - 1];
    while (last.length > 1 && pdf.getTextWidth(`${last}...`) > maxW) last = last.slice(0, -1);
    out[out.length - 1] = `${last}...`;
  }
  return out;
}

/** Largest font (<= startSize) at which text fits in maxW within maxLines. */
function fitLines(pdf, text, maxW, startSize, minSize, maxLines, style) {
  pdf.setFont('helvetica', style);
  const str = String(text ?? '').trim();
  for (let s = startSize; s >= minSize - 1e-6; s -= 0.25) {
    pdf.setFontSize(s);
    const lines = wrapText(pdf, str, maxW, maxLines);
    if (lines) return { lines, size: s };
  }
  pdf.setFontSize(minSize);
  return { lines: ellipsize(pdf, str, maxW, maxLines), size: minSize };
}

function formatPrice(v) {
  const n = Number(v);
  if (!n || Number.isNaN(n)) return '';
  return `Rs.${Number.isInteger(n) ? n : n.toFixed(2).replace(/\.?0+$/, '')}`;
}

/* ───────────── thermal label layout (inside safe area) ───────────── */

/**
 * Build a layout plan for one label.
 * Company name, product name + price, barcode, number — vertically centred.
 * Simplify if bars would be too short: 2-line→1-line name, drop company, drop name.
 */
function buildThermalPlan(pdf, p, companyName, safeW, safeH, opts) {
  const { showCompany, nameLines } = opts;
  const rows = [];
  const gap = 0.8;

  // Company (compact font size to fit neatly)
  if (showCompany && companyName) {
    const f = fitLines(pdf, companyName, safeW, 5.5, 4.5, 1, 'bold');
    rows.push({ type: 'company', ...f, h: f.lines.length * f.size * PT });
  }

  // Name + Price
  if (opts.showName) {
    const price = formatPrice(p.selling_price);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    const priceW = price ? pdf.getTextWidth(price) : 0;
    const nameW = safeW - (price ? priceW + 1 : 0);
    const f = fitLines(pdf, p.name, nameW, 8, MIN_FONT, nameLines, 'bold');
    const priceH = price ? 10 * PT : 0;
    rows.push({
      type: 'name', ...f, price, priceSize: 10,
      h: Math.max(f.lines.length * f.size * PT, priceH),
    });
  } else if (opts.showPrice) {
    // Price only (name dropped)
    const price = formatPrice(p.selling_price);
    if (price) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      rows.push({ type: 'price-only', lines: [price], size: 10, h: 10 * PT });
    }
  }

  // Number line
  const num = fitLines(pdf, String(p.barcode).trim(), safeW, 6, MIN_NUM_FONT, 1, 'normal');
  const numH = num.size * PT;
  const numGap = Math.min(gap, 0.6);

  const fixedH = rows.reduce((s, r) => s + r.h, 0) + rows.length * gap + numGap + numH;
  const barMaxH = 11;
  const barMinH = 8;
  const barH = Math.max(0, Math.min(barMaxH, safeH - fixedH));
  const startY = Math.max(0, (safeH - (fixedH + barH)) / 2);

  return { rows, num, numH, numGap, barH, barMinH, startY, gap };
}

function planThermalLabel(pdf, p, companyName, safeW, safeH) {
  const hasName = !!String(p.name || '').trim();
  const attempts = [
    { showCompany: true, showName: hasName, showPrice: true, nameLines: 2 },
    { showCompany: true, showName: hasName, showPrice: true, nameLines: 1 },
    { showCompany: false, showName: hasName, showPrice: true, nameLines: 1 },
    { showCompany: false, showName: false, showPrice: true, nameLines: 0 },
  ];
  let plan;
  for (const a of attempts) {
    plan = buildThermalPlan(pdf, p, companyName, safeW, safeH, a);
    if (plan.barH >= plan.barMinH) break;
  }
  return plan;
}

/** Draw a single label's content inside its safe area. */
function drawThermalLabel(pdf, p, plan, safeX, safeY, safeW, warnings) {
  let y = safeY + plan.startY;
  pdf.setTextColor(0, 0, 0);

  for (const r of plan.rows) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(r.size);
    const lh = r.size * PT;
    r.lines.forEach((ln, i) => {
      const by = y + i * lh + lh * BASELINE;
      if (r.type === 'company') {
        pdf.text(ln, safeX + safeW / 2, by, { align: 'center' });
      } else if (r.type === 'price-only') {
        pdf.text(ln, safeX + safeW / 2, by, { align: 'center' });
      } else {
        pdf.text(ln, safeX, by);
      }
    });
    if (r.type === 'name' && r.price) {
      pdf.setFontSize(r.priceSize);
      pdf.text(r.price, safeX + safeW, y + r.priceSize * PT * BASELINE, { align: 'right' });
    }
    y += r.h + plan.gap;
  }

  // Barcode bars (vector)
  const barcodeStr = String(p.barcode).trim();
  const binary = getBarcodeBinary(barcodeStr);
  const quietZone = 2;
  const availBarW = Math.min(40, safeW - 2 * quietZone);
  let module = Math.floor((availBarW / binary.length) / DOT) * DOT;
  if (module < MIN_MODULE) {
    warnings.add(`Barcode ${barcodeStr}: module width ${(availBarW / binary.length).toFixed(4)} mm is below ${MIN_MODULE} mm minimum. Barcode may not scan.`);
    module = MIN_MODULE;
  }
  if (plan.barH < plan.barMinH - 1e-6) {
    warnings.add(`Some labels are crowded; barcode height was reduced.`);
  }

  const totalBarW = binary.length * module;
  const barStartX = snap(safeX + (safeW - totalBarW) / 2);
  const barStartY = snap(y);

  pdf.setFillColor(0, 0, 0);
  for (let i = 0; i < binary.length;) {
    if (binary[i] === '1') {
      let j = i;
      while (j < binary.length && binary[j] === '1') j++;
      const rx = snap(barStartX + i * module);
      const rw = snap((j - i) * module);
      pdf.rect(rx, barStartY, rw, plan.barH, 'F');
      i = j;
    } else i++;
  }
  y = barStartY + plan.barH + plan.numGap;

  // Human-readable number
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(plan.num.size);
  pdf.text(plan.num.lines[0] || '', safeX + safeW / 2, y + plan.num.size * PT * BASELINE, { align: 'center' });
}

/* ───────────── PDF generators ───────────── */

/**
 * Generate barcode label PDF for thermal 2-across roll.
 * items: [{ name, barcode, selling_price }] already expanded by quantity.
 */
function generateThermalPDF({ items, companyName = '', rollCfg }) {
  const cfg = { ...DEFAULT_ROLL, ...rollCfg };
  const geo = getRollGeometry(cfg);
  const safeW = cfg.labelW - 2 * cfg.padX;   // 46 mm
  const safeH = cfg.labelH - 2 * cfg.padY;   // 22 mm

  const pdf = new jsPDF({
    unit: 'mm',
    format: [cfg.mediaW, cfg.labelH],
    orientation: 'landscape',
    compress: true,
  });

  const warnings = new Set();
  const planCache = new Map();
  const cols = cfg.cols;

  // Determine slot list: if startRight, first slot is index 1 (right)
  const slots = [];
  if (cfg.startRight && items.length > 0) {
    slots.push({ itemIdx: -1, col: 0 }); // blank left slot on page 1
  }
  items.forEach((_, i) => slots.push({ itemIdx: i, col: -1 }));

  // Assign cols
  slots.forEach((s, si) => {
    if (s.col === -1) s.col = si % cols;
  });

  // Group into rows (pages)
  const pages = [];
  for (let i = 0; i < slots.length; i += cols) {
    pages.push(slots.slice(i, i + cols));
  }

  pages.forEach((row, pageIdx) => {
    if (pageIdx > 0) pdf.addPage([cfg.mediaW, cfg.labelH], 'landscape');

    row.forEach((slot) => {
      if (slot.itemIdx < 0) return; // blank slot
      const p = items[slot.itemIdx];
      const pos = getLabelPos(cfg, geo, slot.col);

      // Clip to label rectangle
      pdf.saveGraphicsState();
      pdf.rect(pos.x, pos.y, cfg.labelW, cfg.labelH);
      pdf.clip();
      pdf.discardPath();

      // Plan & draw
      const key = `${p.name}|${p.selling_price}|${p.barcode}`;
      if (!planCache.has(key)) {
        planCache.set(key, planThermalLabel(pdf, p, companyName, safeW, safeH));
      }
      const plan = planCache.get(key);
      const safeX = pos.x + cfg.padX;
      const safeY = pos.y + cfg.padY;
      drawThermalLabel(pdf, p, plan, safeX, safeY, safeW, warnings);

      pdf.restoreGraphicsState();
    });
  });

  return { pdf, pages: pdf.getNumberOfPages(), warnings: [...warnings] };
}

/**
 * Generate test label PDF: one page with outlines, crosshairs, rulers, L/R labels.
 */
function generateTestLabelPDF(rollCfg) {
  const cfg = { ...DEFAULT_ROLL, ...rollCfg };
  const geo = getRollGeometry(cfg);

  const pdf = new jsPDF({
    unit: 'mm',
    format: [cfg.mediaW, cfg.labelH],
    orientation: 'landscape',
    compress: true,
  });

  for (let col = 0; col < cfg.cols; col++) {
    const pos = getLabelPos(cfg, geo, col);
    const { x, y } = pos;
    const lw = cfg.labelW;
    const lh = cfg.labelH;

    // Label outline (solid black 0.25 mm)
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.25);
    pdf.rect(x, y, lw, lh);

    // Safe area outline (dashed 0.125 mm)
    pdf.setLineWidth(0.125);
    pdf.setLineDashPattern([1, 0.5], 0);
    const sx = x + cfg.padX;
    const sy = y + cfg.padY;
    const sw = lw - 2 * cfg.padX;
    const sh = lh - 2 * cfg.padY;
    pdf.rect(sx, sy, sw, sh);
    pdf.setLineDashPattern([], 0);

    // Centre crosshair
    const cx = x + lw / 2;
    const cy = y + lh / 2;
    pdf.setLineWidth(0.125);
    pdf.line(cx - 3, cy, cx + 3, cy);
    pdf.line(cx, cy - 3, cx, cy + 3);

    // L or R letter at top-left of safe area
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(col === 0 ? 'L' : 'R', sx + 0.5, sy + 2.5);

    // 40 mm ruler centred horizontally, at y = cy + 4 (below crosshair)
    const rulerLen = 40;
    const rulerY = cy + 4;
    const rulerX = cx - rulerLen / 2;
    pdf.setLineWidth(0.2);
    pdf.line(rulerX, rulerY, rulerX + rulerLen, rulerY);
    // End ticks (1.5 mm tall)
    pdf.line(rulerX, rulerY - 0.75, rulerX, rulerY + 0.75);
    pdf.line(rulerX + rulerLen, rulerY - 0.75, rulerX + rulerLen, rulerY + 0.75);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5);
    pdf.text('40 mm', cx, rulerY - 1, { align: 'center' });

    // Size text near the bottom of safe area
    pdf.setFontSize(5);
    pdf.text(`${lw} × ${lh} mm`, cx, sy + sh - 1, { align: 'center' });
  }

  return pdf;
}

/* ───────────── Products page ───────────── */

export default function ProductsPage() {
  const { user } = useAuth();
  const isEmployee = ['EMPLOYEE', 'USER'].includes(user?.role_name);
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
  const [printing, setPrinting] = useState(false);
  const [showRollSettings, setShowRollSettings] = useState(false);
  const [rollCfg, setRollCfg] = useState(loadRollSettings);

  // PDF Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pdfReviewProducts, setPdfReviewProducts] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const pagesContainerRef = useRef(null);

  const [form, setForm] = useState({
    name: '', sku: '', barcode: '', description: '', category: '', brand: '', supplier_name: '',
    unit: 'Nos', cost_price: '', selling_price: '', hsn_code: '', tax_percentage: 0,
    minimum_stock_level: 0, reorder_level: 0, dead_stock_days: 0, initial_stock: '', initial_stock_branch: '',
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
        payload.supplier = payload.supplier_name.trim(); // let backend create it
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
        unit: 'Nos', cost_price: '', selling_price: '', hsn_code: '', tax_percentage: 0, minimum_stock_level: 0, reorder_level: 0, dead_stock_days: 0, initial_stock: '', initial_stock_branch: branches[0]?.id || ''
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
      reorder_level: product.reorder_level !== undefined ? product.reorder_level : 0,
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
      initialCounts[p.id] = '1';
    });
    setPrintCounts(initialCounts);
    setRollCfg(loadRollSettings());
    setShowPrintModal(true);
  };

  /* ───────────── Thermal roll printing helpers ───────────── */

  const updateRollField = (field, raw) => {
    setRollCfg(prev => {
      const val = raw === '' ? (field === 'startRight' ? false : 0) : (field === 'startRight' ? !!raw : snap(parseFloat(raw) || 0));
      const next = { ...prev, [field]: val };
      saveRollSettings(next);
      return next;
    });
  };

  const printList = products.filter(p => selectedProducts.includes(p.id) && p.barcode);
  const qtyOf = (id) => Math.max(1, Math.min(1000, parseInt(printCounts[id], 10) || 1));
  const totalLabels = printList.reduce((s, p) => s + qtyOf(p.id), 0);
  const totalRows = totalLabels > 0 ? Math.ceil((totalLabels + (rollCfg.startRight ? 1 : 0)) / rollCfg.cols) : 0;
  const rollProblems = validateRoll(rollCfg);

  const openPDFPreview = (pdf) => {
    const blob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (!win) {
      // Fallback if browser blocked window.open popup
      const a = document.createElement('a');
      a.href = blobUrl;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const getPrintItems = () => {
    const items = [];
    printList.forEach(p => {
      const q = qtyOf(p.id);
      for (let i = 0; i < q; i++)
        items.push({ name: p.name, barcode: p.barcode, selling_price: p.selling_price });
    });
    return items;
  };

  const generatePDF = () => {
    setPrinting(true);
    try {
      const items = getPrintItems();
      if (!items.length) {
        toast.error('No items to print');
        return;
      }
      const { pdf, warnings } = generateThermalPDF({
        items, companyName: user?.company_name || '', rollCfg,
      });
      if (warnings.length) toast(warnings.join('\n'), { icon: '⚠️', duration: 6000 });

      openPDFPreview(pdf);
      toast.success('Labels PDF opened! You can print or download from the tab.');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error(err.message || 'Failed to generate labels');
    } finally {
      setPrinting(false);
    }
  };

  const downloadPDF = () => {
    try {
      const items = getPrintItems();
      const { pdf, warnings } = generateThermalPDF({
        items, companyName: user?.company_name || '', rollCfg,
      });
      if (warnings.length) toast(warnings.join('\n'), { icon: '⚠️', duration: 6000 });

      pdf.save(`labels_2up_50x25_${Date.now()}.pdf`);
      toast.success('Labels PDF downloaded');
    } catch (err) {
      console.error('PDF download error:', err);
      toast.error(err.message || 'Failed to download PDF');
    }
  };

  const printTestLabel = () => {
    try {
      const pdf = generateTestLabelPDF(rollCfg);
      openPDFPreview(pdf);
      toast.success('Test label PDF opened in preview tab');
    } catch (err) {
      toast.error(err.message || 'Failed to generate test label');
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
        <Modal title={editingId ? "Edit Product" : "Add Product"} onClose={() => { setShowModal(false); setEditingId(null); setForm({ name: '', sku: '', barcode: '', description: '', category: '', brand: '', supplier_name: '', unit: 'Nos', cost_price: '', selling_price: '', hsn_code: '', tax_percentage: 0, minimum_stock_level: 0, reorder_level: 0, dead_stock_days: 0, initial_stock: '', initial_stock_branch: branches[0]?.id || '' }); }}>
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <div className="grid grid-cols-4 gap-3">
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
              <div>
                <label className="text-xs font-medium text-slate-500">Description</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Short desc..." className="input-field mt-1" />
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
                  onChange={e => setForm({ ...form, reorder_level: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
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
              <button type="button" onClick={() => { setShowModal(false); setEditingId(null); setForm({ name: '', sku: '', barcode: '', description: '', category: '', brand: '', supplier_name: '', unit: 'Nos', cost_price: '', selling_price: '', hsn_code: '', tax_percentage: 0, minimum_stock_level: 0, reorder_level: 0, dead_stock_days: 0, initial_stock: '', initial_stock_branch: branches[0]?.id || '' }); }} className="btn-secondary px-4 py-2">Cancel</button>
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

      {/* ═══════ Thermal Roll Print Configuration Modal ═══════ */}
      {showPrintModal && (
        <Modal title="Configure Barcode Printing" onClose={() => !printing && setShowPrintModal(false)}>
          <div className="p-4 space-y-4">

            {/* 1. Info card */}
            <div className="bg-indigo-50 p-3 rounded-xl space-y-1">
              <p className="text-sm font-bold text-indigo-800">Thermal roll: {rollCfg.cols} labels across</p>
              <p className="text-xs text-indigo-600">
                {rollCfg.labelW} × {rollCfg.labelH} mm each · {rollCfg.gapX} mm gap · TSC TA220 (203 dpi)
              </p>
            </div>

            {/* 2. Start-right checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={rollCfg.startRight}
                onChange={e => updateRollField('startRight', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" disabled={printing} />
              <span className="text-sm text-slate-600">First label goes on the RIGHT side (finish a half-used row)</span>
            </label>

            {/* 3. Amber printer note */}
            <div className="bg-amber-50 p-2.5 rounded-lg text-xs text-amber-700 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Printer: <b>TSC TA220</b>. Paper size = <b>{rollCfg.mediaW} × {rollCfg.labelH} mm</b> (gap labels),
                Scale <b>100% / Actual size</b>, Margins <b>None</b>. Print the test label first.
              </span>
            </div>

            {/* 4. Red validation problems */}
            {rollProblems.length > 0 && (
              <div className="bg-rose-50 p-2.5 rounded-lg text-xs text-rose-700 space-y-1">
                {rollProblems.map((m, i) => <p key={i}>⚠ {m}</p>)}
              </div>
            )}

            {/* 5. Product Quantities */}
            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-2">Product Quantities</h4>
              <div className="max-h-[32vh] overflow-y-auto space-y-2 pr-2">
                {printList.map(product => (
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
                        value={printCounts[product.id] ?? '1'}
                        onChange={(e) => setPrintCounts({ ...printCounts, [product.id]: e.target.value })}
                        onBlur={() => setPrintCounts(prev => ({ ...prev, [product.id]: String(qtyOf(product.id)) }))}
                        className="input-field w-20 text-center font-semibold"
                        disabled={printing}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* 6. Live summary */}
              <p className="text-xs text-slate-500 mt-2">
                Total labels: <b>{totalLabels}</b> → <b>{totalRows}</b> row{totalRows !== 1 ? 's' : ''} (pages) of {rollCfg.cols} labels
                {rollCfg.startRight && totalLabels > 0 && <span className="text-amber-600 ml-1">· first left slot left blank</span>}
              </p>
            </div>

            {/* 7. Collapsible Roll Settings */}
            <div className="border border-slate-200 rounded-xl">
              <button type="button" onClick={() => setShowRollSettings(v => !v)}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-600 flex items-center justify-between">
                <span>{showRollSettings ? '▾' : '▸'} Roll settings</span>
                <button type="button" className="text-[10px] text-indigo-600 hover:underline"
                  onClick={(e) => { e.stopPropagation(); setRollCfg({ ...DEFAULT_ROLL }); saveRollSettings(DEFAULT_ROLL); toast.success('Roll settings reset to defaults.'); }}>
                  Reset roll settings
                </button>
              </button>
              {showRollSettings && (
                <div className="p-3 pt-0 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Backing paper width (mm)</label>
                      <input type="number" step="0.125" min="50" max="120"
                        value={rollCfg.mediaW}
                        onChange={e => updateRollField('mediaW', e.target.value)}
                        className="input-field mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Gap between left and right label (mm)</label>
                      <input type="number" step="0.125" min="0" max="10"
                        value={rollCfg.gapX}
                        onChange={e => updateRollField('gapX', e.target.value)}
                        className="input-field mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Shift right (mm, negative = left)</label>
                      <input type="number" step="0.125"
                        value={rollCfg.offsetX}
                        onChange={e => updateRollField('offsetX', e.target.value)}
                        className="input-field mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-500">Shift down (mm, 0 to 3)</label>
                      <input type="number" step="0.125" min="0" max="3"
                        value={rollCfg.offsetY}
                        onChange={e => updateRollField('offsetY', e.target.value)}
                        className="input-field mt-1" />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Measure the full backing paper width and enter it above. The printer's paper size must be set to
                    that width × {rollCfg.labelH} mm. Use the shift fields if the test label sits off the stickers.
                    Values snap to 0.125 mm (one printer dot).
                  </p>
                </div>
              )}
            </div>

            {/* 8. Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={printTestLabel}
                  className="btn-secondary px-3 py-2 text-xs"
                  disabled={printing}
                >
                  Print Test Label
                </button>
                <button
                  type="button"
                  onClick={downloadPDF}
                  disabled={printing || totalLabels === 0 || rollProblems.length > 0}
                  className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
                  title="Save PDF file to disk"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save PDF
                </button>
              </div>
              <div className="flex items-center gap-2">
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
                  disabled={printing || totalLabels === 0 || rollProblems.length > 0}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  {printing ? 'Generating PDF...' : 'Print Labels'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}



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