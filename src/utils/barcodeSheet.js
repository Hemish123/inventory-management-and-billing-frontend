/*
 * src/utils/barcodeSheet.js
 *
 * Barcode sticker sheet engine for A4 label sheets.
 * - Single source of truth for all sheet profiles (mm)
 * - Everything is drawn in millimetres directly into the PDF (no px, no scaling)
 * - Barcode is drawn as vector rectangles, snapped to the printer dot grid
 * - Text is auto-fitted / wrapped / ellipsized, nothing can leave the safe area
 */
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';

export const PAGE_W = 210;
export const PAGE_H = 297;
export const MIN_MODULE = 0.19;            // mm, thinnest bar most scanners read reliably
const PT = 25.4 / 72;                      // 1 pt in mm
const DOT = 25.4 / 600;                    // 1 printer dot @ 600 dpi in mm
const BASELINE = 0.77;                     // baseline offset inside a font's em box
const MIN_FONT = 4;                        // pt

/*
 * Profiles. padX / padY are PHYSICAL paddings (left-right / top-bottom of the
 * sticker on paper) between the die-cut edge and the printable content.
 * For the rotated 40P sheet the long side (73 mm) is the text direction.
 */
export const STICKER_CONFIGS = {
  l48: {
    title: '48L', cols: 4, rows: 12, labelW: 48, labelH: 24, gapX: 2, gapY: 0.25,
    marginTop: 3.125, marginLeft: 6, padX: 2, padY: 1.5, layout: 'normal',
    barMaxW: 38, barMaxH: 8, barMinH: 5, maxModule: 0.45,
    companySize: 6, nameSize: 7, priceSize: 7, numberSize: 5, nameLines: 1, gap: 0.8,
    showCompany: true, showName: true, showPrice: true,
  },
  l16: {
    title: '16L', cols: 2, rows: 8, labelW: 99, labelH: 34, gapX: 2, gapY: 1.28,
    marginTop: 8.02, marginLeft: 5, padX: 4, padY: 2.5, layout: 'normal',
    barMaxW: 46, barMaxH: 14, barMinH: 8, maxModule: 0.5,
    companySize: 9, nameSize: 10, priceSize: 12, numberSize: 7, nameLines: 2, gap: 1,
    showCompany: true, showName: true, showPrice: true,
  },
  l40: {
    title: '40P', cols: 10, rows: 4, labelW: 18, labelH: 73, gapX: 1, gapY: 1,
    marginTop: 1, marginLeft: 10.5, padX: 1.2, padY: 3.5, layout: 'rotated',
    barMaxW: 48, barMaxH: 7, barMinH: 4, maxModule: 0.45,
    companySize: 6, nameSize: 6.5, priceSize: 7, numberSize: 5, nameLines: 1, gap: 0.7,
    showCompany: true, showName: true, showPrice: true,
  },
  l110: {
    // Unverified: no physical sheet was available to test this profile.
    title: '110L', cols: 5, rows: 22, labelW: 35, labelH: 10, gapX: 2, gapY: 2.5,
    marginTop: 12.25, marginLeft: 13.5, padX: 1, padY: 0.8, layout: 'normal',
    barMaxW: 28, barMaxH: 5, barMinH: 4, maxModule: 0.45,
    companySize: 4, nameSize: 4.5, priceSize: 4.5, numberSize: 4, nameLines: 1, gap: 0.4,
    showCompany: true, showName: true, showPrice: true, unverified: true,
  },
};

export const STICKER_OPTIONS = Object.entries(STICKER_CONFIGS).map(([key, c]) => ({
  key,
  shortLabel: c.title,
  size: `${c.labelW} × ${c.labelH} mm`,
  count: `${c.cols * c.rows} labels / page`,
  unverified: !!c.unverified,
}));

/* ───────────── geometry & printable-area check ───────────── */

const num = (v, d) => (v === '' || v == null || Number.isNaN(parseFloat(v)) ? d : parseFloat(v));

/** calib = { offsetX, offsetY, pitchX, pitchY } (strings or numbers, '' = default) */
export function getGeometry(cfg, calib = {}) {
  return {
    x0: cfg.marginLeft + num(calib?.offsetX, 0),
    y0: cfg.marginTop + num(calib?.offsetY, 0),
    pitchX: num(calib?.pitchX, cfg.labelW + cfg.gapX),
    pitchY: num(calib?.pitchY, cfg.labelH + cfg.gapY),
  };
}

/** Distance from every paper edge to the nearest printed content, and warnings. */
export function checkPrintable(cfg, geo, printerSafe = 3) {
  const m = {
    left: geo.x0 + cfg.padX,
    top: geo.y0 + cfg.padY,
    right: PAGE_W - (geo.x0 + (cfg.cols - 1) * geo.pitchX + cfg.labelW - cfg.padX),
    bottom: PAGE_H - (geo.y0 + (cfg.rows - 1) * geo.pitchY + cfg.labelH - cfg.padY),
  };
  const problems = Object.entries(m)
    .filter(([, v]) => v < printerSafe)
    .map(([side, v]) =>
      v < 0
        ? `Content falls off the ${side} edge of the page (${v.toFixed(2)} mm). Check offset/pitch.`
        : `Content is only ${v.toFixed(2)} mm from the ${side} edge; most printers clip inside ${printerSafe} mm.`
    );
  return { margins: m, problems };
}

/* ───────────── barcode encoding (vector) ───────────── */

function detectFormat(v) {
  if (/^\d{12}$/.test(v)) return 'UPC';
  if (/^\d{13}$/.test(v)) return 'EAN13';
  if (/^\d{8}$/.test(v)) return 'EAN8';
  return 'CODE128';
}

const barCache = new Map();

/** Returns the barcode as a string of 1/0 modules, e.g. "1101001...". */
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
    while (w.length > 1 && pdf.getTextWidth(w) > maxW) {      // break very long words
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
  // Helvetica has no rupee glyph, so "Rs." is used.
  return `Rs.${Number.isInteger(n) ? n : n.toFixed(2).replace(/\.?0+$/, '')}`;
}

/* ───────────── label layout ───────────── */

function buildPlan(pdf, cfg, p, companyName, W, H, use) {
  const rows = [];
  if (use.company) {
    const f = fitLines(pdf, companyName, W, cfg.companySize, MIN_FONT, 1, 'bold');
    rows.push({ type: 'company', ...f, h: f.lines.length * f.size * PT });
  }
  if (use.name) {
    const price = cfg.showPrice ? formatPrice(p.selling_price) : '';
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(cfg.priceSize);
    const priceW = price ? pdf.getTextWidth(price) : 0;
    const f = fitLines(pdf, p.name, W - (price ? priceW + 1 : 0), cfg.nameSize, MIN_FONT, cfg.nameLines, 'bold');
    rows.push({ type: 'name', ...f, price, h: Math.max(f.lines.length * f.size, price ? cfg.priceSize : 0) * PT });
  }
  const num = fitLines(pdf, String(p.barcode).trim(), W, cfg.numberSize, 3.5, 1, 'normal');
  const numH = num.size * PT;
  const numGap = Math.min(cfg.gap, 0.6);
  const fixed = rows.reduce((s, r) => s + r.h, 0) + rows.length * cfg.gap + numGap + numH;
  const barH = Math.max(0, Math.min(cfg.barMaxH, H - fixed));
  const startY = Math.max(0, (H - (fixed + barH)) / 2);       // centre block vertically
  return { rows, num, numH, numGap, barH, startY, gap: cfg.gap };
}

/** Try full layout first; drop company line, then product name, until the bars are tall enough. */
function planLabel(pdf, cfg, p, companyName, W, H) {
  const hasName = cfg.showName && !!String(p.name || '').trim();
  const attempts = [
    { company: cfg.showCompany && !!companyName, name: hasName },
    { company: false, name: hasName },
    { company: false, name: false },
  ];
  let plan;
  for (const a of attempts) {
    plan = buildPlan(pdf, cfg, p, companyName, W, H, a);
    if (plan.barH >= cfg.barMinH) break;
  }
  return plan;
}

/* Maps logical label coordinates (origin top-left of the safe area) to paper. */
function makeCanvas(pdf, rotated, ox, oy, W) {
  return {
    rect(x, y, w, h) {
      if (rotated) pdf.rect(ox + y, oy + W - x - w, h, w, 'F');
      else pdf.rect(ox + x, oy + y, w, h, 'F');
    },
    text(str, x, y, align = 'left') {
      const tw = align === 'left' ? 0 : pdf.getTextWidth(str);
      const lx = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
      if (rotated) pdf.text(str, ox + y, oy + W - lx, { angle: 90 });
      else pdf.text(str, ox + lx, oy + y);
    },
  };
}

function drawPlan(pdf, v, cfg, p, plan, W, warnings) {
  let y = plan.startY;
  pdf.setTextColor(0, 0, 0);
  for (const r of plan.rows) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(r.size);
    const lh = r.size * PT;
    r.lines.forEach((ln, i) => {
      const by = y + i * lh + lh * BASELINE;
      if (r.type === 'company') v.text(ln, W / 2, by, 'center');
      else v.text(ln, 0, by, 'left');
    });
    if (r.type === 'name' && r.price) {
      pdf.setFontSize(cfg.priceSize);
      v.text(r.price, W, y + cfg.priceSize * PT * BASELINE, 'right');
    }
    y += r.h + plan.gap;
  }

  // Barcode bars
  const binary = getBarcodeBinary(String(p.barcode).trim());
  const quiet = cfg.quiet ?? 2;
  const maxBarW = Math.min(cfg.barMaxW, W - 2 * quiet);
  let module = Math.min(maxBarW / binary.length, cfg.maxModule);
  module = Math.max(Math.floor(module / DOT) * DOT, DOT);      // snap down to printer dots
  if (module < MIN_MODULE - 1e-6) warnings.add(`Barcode ${p.barcode} is too dense for this sticker size and may not scan.`);
  if (plan.barH < cfg.barMinH - 1e-6) warnings.add('Some labels are crowded, so barcode height was reduced.');
  const startX = (W - binary.length * module) / 2;
  pdf.setFillColor(0, 0, 0);
  for (let i = 0; i < binary.length;) {
    if (binary[i] === '1') {
      let j = i;
      while (j < binary.length && binary[j] === '1') j++;
      v.rect(startX + i * module, y, (j - i) * module, plan.barH);
      i = j;
    } else i++;
  }
  y += plan.barH + plan.numGap;

  // Human-readable number
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(plan.num.size);
  v.text(plan.num.lines[0] || '', W / 2, y + plan.num.size * PT * BASELINE, 'center');
}

/* ───────────── public: barcode sheet ───────────── */

/**
 * items: [{ name, barcode, selling_price }] already expanded by quantity.
 * startSlot: 1-based slot on the first sheet (to reuse a partly used sheet).
 */
export function generateBarcodePDF({ sizeKey, items, companyName = '', calib, startSlot = 1, cutGuides = false }) {
  const cfg = STICKER_CONFIGS[sizeKey] || STICKER_CONFIGS.l48;
  const geo = getGeometry(cfg, calib);
  const perPage = cfg.cols * cfg.rows;
  const skipped = Math.min(Math.max(1, Math.floor(startSlot) || 1), perPage) - 1;
  const rotated = cfg.layout === 'rotated';
  const W = rotated ? cfg.labelH - 2 * cfg.padY : cfg.labelW - 2 * cfg.padX;   // text direction
  const H = rotated ? cfg.labelW - 2 * cfg.padX : cfg.labelH - 2 * cfg.padY;

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const warnings = new Set();
  const planCache = new Map();

  items.forEach((p, i) => {
    const g = skipped + i;
    const pageIdx = Math.floor(g / perPage);
    const idx = g % perPage;
    while (pdf.getNumberOfPages() <= pageIdx) pdf.addPage('a4', 'portrait');

    const x = geo.x0 + (idx % cfg.cols) * geo.pitchX;
    const y = geo.y0 + Math.floor(idx / cfg.cols) * geo.pitchY;

    if (cutGuides) {
      pdf.setDrawColor(150, 150, 150);
      pdf.setLineWidth(0.1);
      pdf.rect(x, y, cfg.labelW, cfg.labelH);
    }

    const key = `${p.name}|${p.selling_price}|${p.barcode}`;
    if (!planCache.has(key)) planCache.set(key, planLabel(pdf, cfg, p, companyName, W, H));
    const v = makeCanvas(pdf, rotated, x + cfg.padX, y + cfg.padY, W);
    drawPlan(pdf, v, cfg, p, planCache.get(key), W, warnings);
  });

  return { pdf, pages: pdf.getNumberOfPages(), warnings: [...warnings] };
}

/* ───────────── public: calibration sheet ───────────── */

export function generateCalibrationPDF({ sizeKey, calib, printerSafe = 3 }) {
  const cfg = STICKER_CONFIGS[sizeKey] || STICKER_CONFIGS.l48;
  const geo = getGeometry(cfg, calib);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  pdf.setLineWidth(0.1);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(Math.min(7, cfg.labelH * 0.3));

  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const x = geo.x0 + c * geo.pitchX;
      const y = geo.y0 + r * geo.pitchY;
      const corner = (r === 0 && c === 0) || (r === cfg.rows - 1 && c === cfg.cols - 1);
      pdf.setDrawColor(0, 0, 0);
      pdf.setFillColor(255, 228, 228);
      pdf.rect(x, y, cfg.labelW, cfg.labelH, corner ? 'FD' : 'S');
      // safe area (where content is printed)
      pdf.setDrawColor(120, 120, 255);
      pdf.rect(x + cfg.padX, y + cfg.padY, cfg.labelW - 2 * cfg.padX, cfg.labelH - 2 * cfg.padY);
      // crosshair at centre
      pdf.setDrawColor(0, 0, 0);
      const cx = x + cfg.labelW / 2, cy = y + cfg.labelH / 2;
      pdf.line(cx - 2, cy, cx + 2, cy);
      pdf.line(cx, cy - 2, cx, cy + 2);
      pdf.text(`R${r + 1} C${c + 1}`, cx, cy - 3, { align: 'center' });
    }
  }

  // printer non-printable margin (red dashed)
  pdf.setDrawColor(255, 0, 0);
  pdf.setLineDashPattern([1, 1], 0);
  pdf.rect(printerSafe, printerSafe, PAGE_W - 2 * printerSafe, PAGE_H - 2 * printerSafe);
  pdf.setLineDashPattern([], 0);

  // 100 mm rulers: must measure exactly 100.0 mm on paper, otherwise the printer is scaling
  pdf.setLineWidth(0.4);
  pdf.line(55, PAGE_H - 4.5, 155, PAGE_H - 4.5);
  pdf.line(55, PAGE_H - 7, 55, PAGE_H - 2);
  pdf.line(155, PAGE_H - 7, 155, PAGE_H - 2);
  pdf.setFontSize(7);
  pdf.setTextColor(255, 0, 0);
  pdf.text('100 mm: measure me. Must be exactly 100.0 mm (print at Actual size)', 105, PAGE_H - 8, { align: 'center' });
  pdf.setTextColor(0, 0, 0);
  return pdf;
}