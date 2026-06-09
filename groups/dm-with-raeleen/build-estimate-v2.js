import ExcelJS from '/workspace/agent/node_modules/exceljs/dist/es5/index.js';

const TEMPLATE = '/workspace/inbox/1780974109.416199:ag-1778215787818-bncghq/Mettro Estimate & Rate Card 2026 (1).xlsx';
const OUTPUT = '/workspace/agent/Swimming-NSW-Estimate-v2.xlsx';

function setItem(ws, r, desc, r1, h1, r2, h2, r3, h3, mat) {
  const row = ws.getRow(r);
  row.getCell('A').value = 'Item';
  row.getCell('B').value = desc || null;
  row.getCell('D').value = r1 !== undefined ? r1 : null;
  row.getCell('E').value = h1 !== undefined ? h1 : null;
  row.getCell('F').value = r2 !== undefined ? r2 : null;
  row.getCell('G').value = h2 !== undefined ? h2 : null;
  row.getCell('H').value = r3 !== undefined ? r3 : null;
  row.getCell('I').value = h3 !== undefined ? h3 : null;
  row.getCell('J').value = mat !== undefined ? mat : null;
  row.commit();
}

function clearRow(ws, r) {
  const row = ws.getRow(r);
  row.getCell('B').value = null;
  row.getCell('D').value = null;
  row.getCell('E').value = null;
  row.getCell('F').value = null;
  row.getCell('G').value = null;
  row.getCell('H').value = null;
  row.getCell('I').value = null;
  row.getCell('J').value = null;
  row.commit();
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE);

  // Rates & Settings: set contingency to 10%
  const rs = wb.getWorksheet('Rates & Settings');
  rs.getCell('B4').value = 0.1;

  const ws = wb.getWorksheet('Estimate');

  // Header fields (rows 3-5, col B)
  ws.getCell('B3').value = 'Swimming NSW';
  ws.getCell('B4').value = 'Swimming NSW Website Redevelopment';
  ws.getCell('B5').value = 'Mettro';

  // Contingency on Estimate sheet (G4 is a direct value, not a formula)
  ws.getCell('G4').value = 0.1;

  // ======================================================
  // SECTION 1: Blueprint Strategy (rows 12-20)
  // Header row 12, Items 13-19, Spacer 20
  // ======================================================
  ws.getRow(12).getCell('B').value = 'Blueprint Strategy';
  ws.getRow(12).commit();

  setItem(ws, 13, 'Project setup, brief documents, schedule and client material requests', 'Project Management', 4);
  setItem(ws, 14, 'Client and Mettro team kickoff meeting', 'Project Management', 2);
  setItem(ws, 15, 'Review of existing Swimming NSW sites, content and asset audit across two sites', 'Strategy', 4);
  setItem(ws, 16, 'Content architecture, CPT field definitions, component and template map', 'Strategy', 8);
  setItem(ws, 17, 'Blueprint Strategy document', 'Strategy', 3);
  setItem(ws, 18, 'Technical framework and plugin recommendations', 'Strategy', 2);
  setItem(ws, 19, 'Client sign-off and amendments', 'Project Management', 2);
  clearRow(ws, 20);

  // ======================================================
  // SECTION 2: Design: Artwork Adaptation (rows 21-32)
  // Header row 21, Items 22-31, Spacer 32
  // ======================================================
  ws.getRow(21).getCell('B').value = 'Design: Artwork Adaptation';
  ws.getRow(21).commit();

  setItem(ws, 22, 'Homepage design adaptation', 'Design', 10);
  setItem(ws, 23, 'Mega menu and primary navigation design', 'Design', 3);
  setItem(ws, 24, 'Interior and standard content page template', 'Design', 5);
  setItem(ws, 25, 'News listing and news article detail page', 'Design', 5);
  setItem(ws, 26, 'Events listing (grid, list and monthly calendar views) and event detail page', 'Design', 7);
  setItem(ws, 27, 'Resource Hub listing and resource detail page', 'Design', 6);
  setItem(ws, 28, 'Sponsors and partners section', 'Design', 3);
  setItem(ws, 29, 'Additional page templates (est. 3, confirmed at Blueprint stage)', 'Design', 7);
  clearRow(ws, 30);
  clearRow(ws, 31);
  clearRow(ws, 32);

  // ======================================================
  // SECTION 3: Development (rows 33-63)
  // Header row 33, Items 34-62, Spacer 63
  // ======================================================
  ws.getRow(33).getCell('B').value = 'Development';
  ws.getRow(33).commit();

  // Core WordPress build
  setItem(ws, 34, 'WordPress CMS environment setup', 'Development', 2);
  setItem(ws, 35, 'GreyboxPro theme and global style engine', 'Development', 6);
  setItem(ws, 36, 'Brand configuration: CSS custom properties, colours and typography', 'Development', 4);
  setItem(ws, 37, 'Mega menu and primary navigation build', 'Development', 8);
  setItem(ws, 38, 'Homepage build', 'Development', 10);
  setItem(ws, 39, 'Interior and standard page template build', 'Development', 6);
  setItem(ws, 40, 'Contact form (Gravity Forms)', 'Development', 3);
  setItem(ws, 41, 'Site search configuration', 'Development', 3);
  setItem(ws, 42, 'Google Analytics 4 and Google Search Console setup', 'Development', 2);
  setItem(ws, 43, 'reCAPTCHA integration', 'Development', 2);

  // Events CPT
  setItem(ws, 44, 'Events Custom Post Type setup', 'Development', 4);
  setItem(ws, 45, 'WordPress calendar plugin installation and configuration', 'Development', 4);
  setItem(ws, 46, 'Events grid view and list view', 'Development', 6);
  setItem(ws, 47, 'Events monthly calendar view', 'Development', 6);
  setItem(ws, 48, 'Event detail page template', 'Development', 5);

  // Resource Hub CPT
  setItem(ws, 49, 'Resource Hub CPT setup with dual taxonomy: Categories and Resource Types', 'Development', 5);
  setItem(ws, 50, 'Resource Hub listing page with filtering', 'Development', 6);
  setItem(ws, 51, 'Resource Hub detail page template', 'Development', 4);

  // Sponsor / Ad CPT
  setItem(ws, 52, 'Sponsor and Ad CPT component: adaptation and configuration for Swimming NSW', 'Development', 3);

  // Integrations
  setItem(ws, 53, 'Microsoft 365 Forms: embedding into nominated site pages', 'Integration & Technical', 6);
  setItem(ws, 54, 'OneDrive document library: linking from relevant pages', 'Integration & Technical', 4);

  // Clear remaining blank slots
  for (let r = 55; r <= 63; r++) clearRow(ws, r);

  // ======================================================
  // SECTION 4: Content and Training (rows 64-69)
  // Header row 64, Items 65-68, Spacer 69
  // ======================================================
  ws.getRow(64).getCell('B').value = 'Content and Training';
  ws.getRow(64).commit();

  setItem(ws, 65, 'Content entry: homepage and interior pages', 'Content Entry', 8);
  setItem(ws, 66, 'Content entry: news, events and Resource Hub', 'Content Entry', 8);
  setItem(ws, 67, 'Content entry: sponsors, forms and metadata', 'Content Entry', 4);
  setItem(ws, 68, 'CMS training session (online or in person)', 'Project Management', 3);
  clearRow(ws, 69);

  // ======================================================
  // SECTION 5: Golive and Delivery (rows 70-78)
  // Header row 70, Items 71-77, row 78 blank
  // ======================================================
  ws.getRow(70).getCell('B').value = 'Golive and Delivery';
  ws.getRow(70).commit();

  setItem(ws, 71, 'Pre-golive QA: cross-browser and device testing', 'Quality Assurance', 10);
  setItem(ws, 72, 'Forms, integrations and functionality testing', 'Quality Assurance', 4);
  setItem(ws, 73, '301 redirects: consolidating two existing sites into one', 'Development', 6);
  setItem(ws, 74, 'Golive execution', 'Quality Assurance', 2);
  setItem(ws, 75, 'Post-golive QA', 'Quality Assurance', 4);
  setItem(ws, 76, 'Handover documentation pack', 'Project Management', 2);
  clearRow(ws, 77);
  clearRow(ws, 78);

  // ======================================================
  // OPTIONAL ADD-ONS (rows 85-91)
  // These sit outside the SUMIFS range — prices entered directly in col C
  // ======================================================
  ws.getRow(85).getCell('B').value = 'Approximate annual plugin licensing per year (paid directly by client)';
  ws.getRow(85).getCell('C').value = 2000;
  ws.getRow(85).commit();

  ws.getRow(86).getCell('B').value = '*Includes Gravity Forms, calendar plugin. WP Engine hosting to be quoted separately. To be confirmed at Blueprint stage.';
  ws.getRow(86).commit();

  ws.getRow(88).getCell('B').value = 'Optional Add-Ons (ex GST, not included in base estimate above)';
  ws.getRow(88).commit();

  // Option A: News article migration
  ws.getRow(89).getCell('B').value = 'Option A: News Article Migration (800+ articles, Drupal to WordPress): data mapping, bulk import and post-import QA';
  ws.getRow(89).getCell('C').value = 5260;
  ws.getRow(89).commit();

  // Option B: Standard content page migration (export/import)
  ws.getRow(90).getCell('B').value = 'Option B: Standard Content Page Migration (export/import from existing Drupal site) — content audit, import setup, post-migration QA';
  ws.getRow(90).getCell('C').value = 2480;
  ws.getRow(90).commit();

  ws.getRow(91).getCell('B').value = 'All option prices are ex GST. Contingency not applied to optional add-ons.';
  ws.getRow(91).commit();

  await wb.xlsx.writeFile(OUTPUT);
  console.log('Done:', OUTPUT);
}

main().catch(console.error);
