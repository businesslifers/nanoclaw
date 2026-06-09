const ExcelJS = require('exceljs');

const wb = new ExcelJS.Workbook();
wb.creator = 'Mettro';
wb.created = new Date();

// ─── Colours ────────────────────────────────────────────────
const RED     = 'FFE63329';   // Mettro red
const DARKGRY = 'FF1A1A1A';   // near black
const MIDGRY  = 'FF4A4A4A';
const LTGRY   = 'FFF2F2F2';
const WHITE   = 'FFFFFFFF';
const BLKTEXT = 'FF1A1A1A';

// ─── Data ────────────────────────────────────────────────────
const blocks = [
  {
    name: 'Block 1: Project Setup & Blueprint Strategy',
    items: [
      { task: "Project setup, brief documents, 'Let's Get Started' questionnaire", role: 'PM', hrs: 10, rate: 210 },
      { task: 'Kickoff meeting (client + Mettro team)', role: 'PM', hrs: 2, rate: 210 },
      { task: 'Blueprint Strategy document (CPT field definitions, component map, sitemap review, content architecture)', role: 'Strategy', hrs: 18, rate: 270 },
    ]
  },
  {
    name: 'Block 2: Website Design — Artwork Adaptation',
    note: 'Working from client-supplied JPEG artworks. Mettro will translate to responsive, production-ready artwork. Where source files are unavailable, AI image generation will be used where possible (results may require manual refinement).',
    items: [
      { task: 'Homepage + mega menu design', role: 'Design', hrs: 10, rate: 210 },
      { task: 'Interior / standard content page template', role: 'Design', hrs: 5, rate: 210 },
      { task: 'News listing + news article detail', role: 'Design', hrs: 5, rate: 210 },
      { task: 'Events listing (grid, list, monthly calendar views) + event detail', role: 'Design', hrs: 8, rate: 210 },
      { task: 'Resource Hub listing + resource detail', role: 'Design', hrs: 6, rate: 210 },
      { task: 'Sponsors / partners section', role: 'Design', hrs: 4, rate: 210 },
      { task: 'Additional page templates TBC at Blueprint (est. 3)', role: 'Design', hrs: 9, rate: 210 },
    ]
  },
  {
    name: 'Block 3: Core Website Development',
    items: [
      { task: 'WordPress CMS + GreyboxPro setup + global style engine (brand configuration)', role: 'Dev', hrs: 10, rate: 230 },
      { task: 'Mega menu / navigation build', role: 'Dev', hrs: 8, rate: 230 },
      { task: 'Homepage build', role: 'Dev', hrs: 10, rate: 230 },
      { task: 'Interior / standard page templates (all standard content pages)', role: 'Dev', hrs: 8, rate: 230 },
      { task: 'Contact form (Gravity Forms)', role: 'Dev', hrs: 3, rate: 230 },
      { task: 'Site search setup', role: 'Dev', hrs: 4, rate: 230 },
      { task: 'Google Analytics 4 + Search Console + reCAPTCHA', role: 'Dev', hrs: 3, rate: 230 },
    ]
  },
  {
    name: 'Block 4: Custom Development — CPTs & Features',
    items: [
      { task: 'Events CPT + WordPress calendar plugin + 3 display views (grid, list, monthly) + event detail page', role: 'Dev', hrs: 18, rate: 230 },
      { task: 'Resource Hub CPT (dual taxonomy: Categories + Resource Types) + listing + detail pages — fields defined at Blueprint', role: 'Dev', hrs: 14, rate: 230 },
      { task: 'Sponsor / Ad CPT (existing Mettro component) — adapted + configured for Swimming NSW', role: 'Dev', hrs: 6, rate: 230 },
    ]
  },
  {
    name: 'Block 5: Integrations',
    items: [
      { task: 'Microsoft 365 Forms embedding (nominated pages)', role: 'Integration/Tech', hrs: 6, rate: 250 },
      { task: 'OneDrive document library linking', role: 'Integration/Tech', hrs: 4, rate: 250 },
    ]
  },
  {
    name: 'Block 6: Content Entry',
    note: 'Client to supply all content fully written, edited and approved before entry begins.',
    items: [
      { task: 'Content entry allowance', role: 'Content Entry', hrs: 24, rate: 170 },
    ]
  },
  {
    name: 'Block 7: QA, Golive & Delivery',
    items: [
      { task: 'Pre-golive QA (browsers, devices, functionality, forms)', role: 'QA', hrs: 12, rate: 170 },
      { task: 'Golive execution + 301 redirects (consolidating 2 existing sites into 1)', role: 'QA', hrs: 8, rate: 170 },
      { task: 'Post-golive QA', role: 'QA', hrs: 4, rate: 170 },
      { task: 'CMS training session + handover documentation', role: 'PM', hrs: 6, rate: 210 },
    ]
  },
];

const options = [
  {
    name: 'Option A: News Article Migration (Drupal → WordPress)',
    note: 'Mettro has deep experience with Drupal-to-WordPress migrations. 800+ news articles — bulk import exercise. Data mapping, import execution, QA and formatting review. Outside base scope.',
    items: [
      { task: 'Data mapping (Drupal fields → WordPress post fields)', role: 'Integration/Tech', hrs: 8, rate: 250 },
      { task: 'Bulk import execution + validation', role: 'Integration/Tech', hrs: 8, rate: 250 },
      { task: 'Post-import QA + formatting review', role: 'QA', hrs: 8, rate: 170 },
    ]
  },
  {
    name: 'Option B: 12-Month Website Support Plan',
    note: 'TBC — to be discussed with client based on their post-launch support requirements.',
    items: []
  },
];

// ─── Sheet 1: Estimate ───────────────────────────────────────
const ws = wb.addWorksheet('Swimming NSW Estimate', {
  pageSetup: { paperSize: 9, orientation: 'landscape' },
  views: [{ state: 'frozen', ySplit: 5 }]
});

ws.columns = [
  { key: 'block', width: 30 },
  { key: 'task',  width: 58 },
  { key: 'role',  width: 18 },
  { key: 'hrs',   width: 8 },
  { key: 'rate',  width: 14 },
  { key: 'amount',width: 16 },
];

const col = { block: 1, task: 2, role: 3, hrs: 4, rate: 5, amount: 6 };

function hdrStyle(bg, fgColor = WHITE, sz = 11, bold = true) {
  return {
    font: { bold, color: { argb: fgColor }, size: sz, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } },
    alignment: { vertical: 'middle', wrapText: true },
    border: {
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    }
  };
}

function dataStyle(bg = WHITE, bold = false, right = false) {
  return {
    font: { bold, color: { argb: BLKTEXT }, size: 10, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } },
    alignment: { vertical: 'middle', wrapText: true, horizontal: right ? 'right' : 'left' },
    border: {
      bottom: { style: 'thin', color: { argb: 'FFEEEEEE' } }
    }
  };
}

function moneyStyle(bg = WHITE, bold = false) {
  return {
    ...dataStyle(bg, bold, true),
    numFmt: '"$"#,##0.00'
  };
}

// Row 1: Title
const titleRow = ws.addRow(['Swimming NSW — Website Redevelopment', '', '', '', '', '']);
ws.mergeCells(`A1:F1`);
Object.assign(titleRow.getCell(1), {
  value: 'Swimming NSW — Website Redevelopment',
  style: {
    font: { bold: true, size: 16, color: { argb: WHITE }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } },
    alignment: { vertical: 'middle', horizontal: 'left', indent: 1 }
  }
});
titleRow.height = 32;

// Row 2: Subtitle
const subRow = ws.addRow(['Project Estimate — 2026 Rates (ex GST)', '', '', '', '', '']);
ws.mergeCells(`A2:F2`);
Object.assign(subRow.getCell(1), {
  value: 'Project Estimate — 2026 Rates (ex GST)',
  style: {
    font: { italic: true, size: 10, color: { argb: MIDGRY }, name: 'Calibri' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } },
    alignment: { vertical: 'middle', horizontal: 'left', indent: 1 }
  }
});
subRow.height = 18;

// Row 3: blank spacer
ws.addRow([]);

// Row 4: column headers
const hdrRow = ws.addRow(['Block', 'Task / Deliverable', 'Role', 'Hrs', 'Rate ($/hr)', 'Amount (ex GST)']);
hdrRow.height = 22;
[1,2,3,4,5,6].forEach(c => {
  Object.assign(hdrRow.getCell(c), { style: hdrStyle(DARKGRY) });
});
hdrRow.getCell(4).style = { ...hdrStyle(DARKGRY), alignment: { ...hdrStyle(DARKGRY).alignment, horizontal: 'center' } };
hdrRow.getCell(5).style = { ...hdrStyle(DARKGRY), alignment: { ...hdrStyle(DARKGRY).alignment, horizontal: 'right' } };
hdrRow.getCell(6).style = { ...hdrStyle(DARKGRY), alignment: { ...hdrStyle(DARKGRY).alignment, horizontal: 'right' } };

let grandTotal = 0;

blocks.forEach((block, bi) => {
  const blockTotal = block.items.reduce((s, i) => s + i.hrs * i.rate, 0);
  grandTotal += blockTotal;
  const isEven = bi % 2 === 0;
  const rowBg = isEven ? 'FFFAFAFA' : WHITE;

  // Block header row
  const bRow = ws.addRow([block.name, block.note || '', '', '', '', blockTotal]);
  bRow.height = block.note ? 36 : 22;
  bRow.getCell(1).style = hdrStyle('FFE8E8E8', DARKGRY, 10, true);
  bRow.getCell(2).style = { ...dataStyle('FFE8E8E8', false), font: { italic: true, size: 9, color: { argb: MIDGRY }, name: 'Calibri' } };
  bRow.getCell(3).style = dataStyle('FFE8E8E8');
  bRow.getCell(4).style = dataStyle('FFE8E8E8');
  bRow.getCell(5).style = dataStyle('FFE8E8E8');
  bRow.getCell(6).style = { ...moneyStyle('FFE8E8E8', true) };

  block.items.forEach(item => {
    const amount = item.hrs * item.rate;
    const r = ws.addRow(['', item.task, item.role, item.hrs, item.rate, amount]);
    r.height = 18;
    r.getCell(1).style = dataStyle(rowBg);
    r.getCell(2).style = dataStyle(rowBg);
    r.getCell(3).style = { ...dataStyle(rowBg), alignment: { horizontal: 'center', vertical: 'middle' } };
    r.getCell(4).style = { ...dataStyle(rowBg), alignment: { horizontal: 'center', vertical: 'middle' } };
    r.getCell(5).style = moneyStyle(rowBg);
    r.getCell(6).style = moneyStyle(rowBg);
  });
});

// Spacer
ws.addRow([]);

// ─── Summary ─────────────────────────────────────────────────
const contingency = grandTotal * 0.10;
const totalExGst  = grandTotal + contingency;
const gst         = totalExGst * 0.10;
const totalIncGst = totalExGst + gst;

function addSummaryRow(label, value, bold = false, topBorder = false) {
  const r = ws.addRow(['', '', '', '', label, value]);
  r.height = 20;
  const bg = bold ? LTGRY : WHITE;
  r.getCell(5).style = {
    font: { bold, size: 10, name: 'Calibri', color: { argb: BLKTEXT } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } },
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: topBorder ? { top: { style: 'medium', color: { argb: DARKGRY } } } : {}
  };
  r.getCell(6).style = {
    font: { bold, size: 10, name: 'Calibri', color: { argb: bold && value === totalIncGst ? RED : BLKTEXT } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } },
    numFmt: '"$"#,##0.00',
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: topBorder ? { top: { style: 'medium', color: { argb: DARKGRY } } } : {}
  };
  [1,2,3,4].forEach(c => {
    r.getCell(c).style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } } };
  });
}

addSummaryRow('Section subtotal (ex GST)', grandTotal, false, false);
addSummaryRow('Contingency (10%)', contingency, false, false);
addSummaryRow('Total ex GST', totalExGst, true, true);
addSummaryRow('GST (10%)', gst, false, false);
addSummaryRow('TOTAL inc GST', totalIncGst, true, false);

// Spacer
ws.addRow([]);
ws.addRow([]);

// ─── Options ─────────────────────────────────────────────────
const optHdrRow = ws.addRow(['OPTIONS', '', '', '', '', '']);
ws.mergeCells(`A${optHdrRow.number}:F${optHdrRow.number}`);
optHdrRow.getCell(1).style = hdrStyle(DARKGRY, WHITE, 11);
optHdrRow.height = 22;

options.forEach((opt, oi) => {
  const optTotal = opt.items.reduce((s, i) => s + i.hrs * i.rate, 0);

  const oRow = ws.addRow([opt.name, opt.note || '', '', '', '', optTotal || null]);
  oRow.height = 36;
  oRow.getCell(1).style = hdrStyle('FFE8E8E8', DARKGRY, 10, true);
  oRow.getCell(2).style = { ...dataStyle('FFE8E8E8', false), font: { italic: true, size: 9, color: { argb: MIDGRY }, name: 'Calibri' } };
  [3,4,5].forEach(c => oRow.getCell(c).style = dataStyle('FFE8E8E8'));
  oRow.getCell(6).style = optTotal ? { ...moneyStyle('FFE8E8E8', true) } : { ...dataStyle('FFE8E8E8'), font: { italic: true, size: 9, color: { argb: MIDGRY }, name: 'Calibri' } };
  if (!optTotal) oRow.getCell(6).value = 'TBC';

  opt.items.forEach(item => {
    const amount = item.hrs * item.rate;
    const r = ws.addRow(['', item.task, item.role, item.hrs, item.rate, amount]);
    r.height = 18;
    r.getCell(1).style = dataStyle(WHITE);
    r.getCell(2).style = dataStyle(WHITE);
    r.getCell(3).style = { ...dataStyle(WHITE), alignment: { horizontal: 'center', vertical: 'middle' } };
    r.getCell(4).style = { ...dataStyle(WHITE), alignment: { horizontal: 'center', vertical: 'middle' } };
    r.getCell(5).style = moneyStyle(WHITE);
    r.getCell(6).style = moneyStyle(WHITE);
  });

  if (opt.items.length > 0) {
    const contingencyOpt = optTotal * 0.10;
    const totalExGstOpt = optTotal + contingencyOpt;
    const gstOpt = totalExGstOpt * 0.10;
    const totalIncGstOpt = totalExGstOpt + gstOpt;
    addSummaryRow('Contingency (10%)', contingencyOpt, false, false);
    addSummaryRow('Total ex GST', totalExGstOpt, true, false);
    addSummaryRow('GST (10%)', gstOpt, false, false);
    addSummaryRow('Option total inc GST', totalIncGstOpt, true, false);
  }

  ws.addRow([]);
});

// ─── Notes ───────────────────────────────────────────────────
const notesHdr = ws.addRow(['NOTES & ASSUMPTIONS', '', '', '', '', '']);
ws.mergeCells(`A${notesHdr.number}:F${notesHdr.number}`);
notesHdr.getCell(1).style = hdrStyle(DARKGRY, WHITE, 11);
notesHdr.height = 22;

const notes = [
  'All prices are estimates only, based on information available at time of writing. Blueprint phase will confirm final scope and any adjustments will be discussed before proceeding.',
  'Design is based on artwork adaptation from client-supplied JPEG files — not original design from scratch. If additional original design work is required beyond adapting provided assets, this will require a revised scope.',
  'Sitemap is assumed to be client-supplied. No sitemap development is included in this estimate.',
  'Content entry allowance assumes client provides all content fully written, edited and approved before entry begins. Entry of images, videos and other media is included within the allocated hours.',
  'Hosting is not included. Client to arrange with their preferred provider. Mettro recommends WP Engine (Australian data centre) — signup link provided at Blueprint stage.',
  'Resource Hub CPT field structure and taxonomy terms to be finalised at Blueprint stage.',
  'Event calendar plugin to be confirmed at Blueprint stage (e.g. The Events Calendar or similar).',
  'M365 integration is embed-only (Microsoft Forms embedded via iframe or widget). No SSO or deep API integration is included.',
  'News article migration (Option A) is outside base scope and can be engaged separately.',
  'Estimate is valid for 30 days from date of issue.',
];

notes.forEach((note, i) => {
  const r = ws.addRow([`${i + 1}.`, note, '', '', '', '']);
  ws.mergeCells(`B${r.number}:F${r.number}`);
  r.height = 20;
  r.getCell(1).style = { font: { bold: true, size: 10, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'top' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? LTGRY : WHITE } } };
  r.getCell(2).style = { font: { size: 10, name: 'Calibri', color: { argb: MIDGRY } }, alignment: { wrapText: true, vertical: 'top' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? LTGRY : WHITE } } };
});

// ─── Save ─────────────────────────────────────────────────────
wb.xlsx.writeFile('/workspace/agent/Swimming-NSW-Estimate-Draft.xlsx')
  .then(() => {
    // Print summary for verification
    const contingency2 = grandTotal * 0.10;
    const totalEx = grandTotal + contingency2;
    const gst2 = totalEx * 0.10;
    const totalInc = totalEx + gst2;
    console.log('✓ File written: Swimming-NSW-Estimate-Draft.xlsx');
    console.log(`  Section subtotal: $${grandTotal.toFixed(2)}`);
    console.log(`  Contingency 10%:  $${contingency2.toFixed(2)}`);
    console.log(`  Total ex GST:     $${totalEx.toFixed(2)}`);
    console.log(`  GST:              $${gst2.toFixed(2)}`);
    console.log(`  TOTAL inc GST:    $${totalInc.toFixed(2)}`);
  });
