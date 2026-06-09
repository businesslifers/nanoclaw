const XLSX = require('/tmp/node_modules/xlsx');

const RATES = {
  'Strategy': 270,
  'Project Management': 210,
  'Design': 210,
  'Development': 230,
  'Integration & Technical': 250,
  'Quality Assurance': 170,
  'Content Entry': 170,
  'Standard Support': 200,
  'External Contractor': 200,
};

const GST = 0.1;
const CONTINGENCY = 0;
const DISCOUNT = 0;

function calcLine(r1='', h1=0, r2='', h2=0, r3='', h3=0, mat=0) {
  return (r1 && h1 ? (RATES[r1]||0) * h1 : 0) +
         (r2 && h2 ? (RATES[r2]||0) * h2 : 0) +
         (r3 && h3 ? (RATES[r3]||0) * h3 : 0) + mat;
}

const sections = [
  {
    name: 'Blueprint Strategy',
    items: [
      { desc: 'Project setup, brief documents, schedule, client material requests', r1: 'Project Management', h1: 3 },
      { desc: 'Project kickoff x 2 team members', r1: 'Strategy', h1: 1, r2: 'Project Management', h2: 1 },
      { desc: 'Review existing DTET site content and assets', r1: 'Strategy', h1: 2 },
      { desc: 'Strategy workshops, user journeys, UI/UX, content types, taxonomy, filtering and site structure', r1: 'Strategy', h1: 9, r2: 'Project Management', h2: 5 },
      { desc: 'User journey and taxonomy analysis', r1: 'Strategy', h1: 4 },
      { desc: 'Technical framework and plugin recommendations', r1: 'Strategy', h1: 3 },
      { desc: 'Blueprint strategy document', r1: 'Strategy', h1: 8 },
      { desc: 'Client sign-off and approval', r1: 'Project Management', h1: 1 },
    ]
  },
  {
    name: 'Design',
    items: [
      { desc: 'Homepage and one internal page, initial concept design', r1: 'Design', h1: 10 },
      { desc: 'Login / authentication screen', r1: 'Design', h1: 1 },
      { desc: 'Taxonomy landing page design', r1: 'Design', h1: 4 },
      { desc: 'Resource library view, 2 layout options', r1: 'Design', h1: 6 },
      { desc: 'Resource detail view', r1: 'Design', h1: 4 },
      { desc: 'Standard pages x 2', r1: 'Design', h1: 3 },
      { desc: 'Content format display design (video, PDF, article, tool)', r1: 'Design', h1: 3 },
      { desc: 'Design system setup, colour palette, typography, buttons and components', r1: 'Design', h1: 6 },
      { desc: 'Responsive layouts across key templates (mobile, tablet, desktop)', r1: 'Design', h1: 3 },
      { desc: 'WCAG AA design review across all templates', r1: 'Design', h1: 2 },
      { desc: 'Two rounds of design feedback', r1: 'Design', h1: 4, r2: 'Project Management', h2: 2 },
      { desc: 'Client sign-off and approval', r1: 'Project Management', h1: 1 },
    ]
  },
  {
    name: 'Development',
    items: [
      { desc: 'WordPress install and dev, staging environment setup', r1: 'Development', h1: 2 },
      { desc: 'Install and configure core plugins', r1: 'Development', h1: 3 },
      { desc: 'Apply custom WordPress theme from approved designs', r1: 'Development', h1: 6 },
      { desc: 'Navigation and footer setup', r1: 'Development', h1: 6 },
      { desc: 'Favicon and breadcrumbs (schema markup if required per QLD government guidelines)', r1: 'Development', h1: 2 },
      { desc: 'User roles (Admin, Author, Standard)', r1: 'Development', h1: 5 },
      { desc: 'Custom post types (structure confirmed post-blueprint)', r1: 'Development', h1: 5 },
      { desc: 'Taxonomy structure and setup (e.g. content type, topic and journey level)', r1: 'Development', h1: 6 },
      { desc: 'Post-login homepage, journey selection interface', r1: 'Development', h1: 3 },
      { desc: 'Taxonomy landing pages, content aggregated by topic and category', r1: 'Development', h1: 4 },
      { desc: 'Resource library, filterable browse and search by content type, topic and level', r1: 'Development', h1: 8 },
      { desc: 'Resource detail view', r1: 'Development', h1: 3 },
      { desc: 'Section pages, auto-populate content by taxonomy', r1: 'Development', h1: 3 },
      { desc: 'Site search, filtered and taxonomy-aware', r1: 'Development', h1: 4 },
      { desc: 'Last updated timestamps on all content', r1: 'Development', h1: 1 },
      { desc: 'Content revision history, versioning for all content types', r1: 'Development', h1: 4 },
      { desc: 'Access logging and automated log pruning configuration', r1: 'Development', h1: 4 },
      { desc: 'Content feedback, relevance rating on resources', r1: 'Development', h1: 2 },
      { desc: 'User feedback form (Gravity Forms)', r1: 'Development', h1: 3 },
      { desc: 'Responsive build and testing across all breakpoints', r1: 'Development', h1: 4 },
      { desc: 'Print CSS', r1: 'Development', h1: 8 },
      { desc: 'WCAG AA implementation throughout', r1: 'Development', h1: 5 },
      { desc: 'Standard pages x 2', r1: 'Development', h1: 6 },
      { desc: 'SSO via Active Directory integration (subject to DTET IT cooperation)', r1: 'Integration & Technical', h1: 8 },
      { desc: 'Content search and bulk replace tool', r1: 'Development', h1: 2 },
      { desc: 'Link sharing on resources (shareable URLs, copy link)', r1: 'Development', h1: 2 },
      { desc: 'Quick links navigation panel', r1: 'Development', h1: 3 },
      { desc: 'Project management throughout build', r1: 'Project Management', h1: 12 },
    ]
  },
  {
    name: 'Content and Training',
    items: [
      { desc: 'Sample content entry during handover (up to 6hrs)', r1: 'Content Entry', h1: 6 },
      { desc: 'Training materials and site-specific documentation', r1: 'Project Management', h1: 2 },
      { desc: 'Training session 1 via Zoom (1.5hrs)', r1: 'Project Management', h1: 1.5 },
      { desc: 'Training session 2 via Zoom if required (1.5hrs)', r1: 'Project Management', h1: 1.5 },
    ]
  },
  {
    name: 'Golive and Delivery',
    items: [
      { desc: 'QA across target browsers and devices', r1: 'Quality Assurance', h1: 8 },
      { desc: 'WCAG AA accessibility checks (12 key pages)', r1: 'Quality Assurance', h1: 4 },
      { desc: 'Post-golive QA', r1: 'Quality Assurance', h1: 3 },
      { desc: 'Client access for user acceptance testing (UAT)', r1: 'Project Management', h1: 1 },
      { desc: 'Golive procedures and final security checks', r1: 'Development', h1: 2 },
      { desc: 'Handover and delivery documentation', r1: 'Project Management', h1: 3 },
    ]
  },
];

// Pre-calculate all section totals
const sectionData = sections.map(sec => {
  const items = sec.items.map(item => {
    const { desc, r1='', h1=0, r2='', h2=0, r3='', h3=0, mat=0 } = item;
    const total = calcLine(r1, h1, r2, h2, r3, h3, mat);
    const hrs = (h1||0) + (h2||0) + (h3||0);
    return { desc, r1, h1, r2, h2, r3, h3, mat, total, hrs };
  });
  const sectionTotal = items.reduce((a, b) => a + b.total, 0);
  const sectionHrs = items.reduce((a, b) => a + b.hrs, 0);
  return { name: sec.name, items, sectionTotal, sectionHrs };
});

const labourTotal = sectionData.reduce((a, b) => a + b.sectionTotal, 0);
const contingencyAmt = Math.round(labourTotal * CONTINGENCY);
const discountAmt = Math.round((labourTotal + contingencyAmt) * DISCOUNT);
const subtotal = labourTotal + contingencyAmt - discountAmt;
const gstAmt = Math.round(subtotal * GST);
const totalIncGST = subtotal + gstAmt;

const E = '';

// Build AOA
const aoa = [];
aoa.push(['Mettro Estimate Builder', E, E, E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, E, E, E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push(['Client', 'DTET (Department of Trade, Employment and Training)', E, E, E, 'GST %', GST, E, 'Live quote summary', E, E, E, E, E, E]);
aoa.push(['Project', 'DTET High Performance Website, Phase 1', E, E, E, 'Contingency %', CONTINGENCY, E, 'Labour & materials', E, labourTotal, E, E, E, E]);
aoa.push(['Prepared by', 'Mettro Digital', E, E, E, 'Discount %', DISCOUNT, E, 'Contingency', E, contingencyAmt, E, E, E, E]);
aoa.push([E, E, E, E, E, E, E, E, 'Discount', E, discountAmt, E, E, E, E]);
aoa.push([E, E, E, E, E, E, E, E, 'Subtotal', E, subtotal, E, E, E, E]);
aoa.push([E, E, E, E, E, E, E, E, 'Total inc GST', E, totalIncGST, E, E, E, E]);
aoa.push([E, E, E, E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push(['Type', 'Scope / inclusion', 'Price', 'Role 1', 'Hrs', 'Role 2', 'Hrs', 'Role 3', 'Hrs', 'Material cost', 'Line total', 'Section key', E, E, E]);
aoa.push([E, E, E, E, E, E, E, E, E, E, E, E, E, E, E]);

for (const sec of sectionData) {
  aoa.push(['Header', sec.name, sec.sectionTotal, E, E, E, E, E, E, E, E, sec.name, E, E, E]);
  for (const item of sec.items) {
    aoa.push([
      'Item', item.desc, E,
      item.r1 || E, item.h1 || E,
      item.r2 || E, item.h2 || E,
      item.r3 || E, item.h3 || E,
      item.mat || E, item.total,
      sec.name, E, E, E
    ]);
  }
  aoa.push(['Spacer', E, E, E, E, E, E, E, E, E, E, E, E, E, E]);
}

aoa.push([E, E, E, E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, 'SUBTOTAL (ex GST)', subtotal, E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, E, E, E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, 'Optional / Phase 2 (indicative, not included above)', E, E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, 'AI conversation capability, to be scoped separately', 'TBC', E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, 'SharePoint integration or full intranet migration (subject to future scoping)', 'TBC', E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, E, E, E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, 'Optional Add-ons (indicative, not included above)', E, E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, 'Per-page content entry', '$85 to $170 per page', E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, 'Bulk resource import via spreadsheet, CSV upload with taxonomy mapping', 1380, 'Development', 6, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, E, E, E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, 'SUBTOTAL', subtotal, E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, 'GST', gstAmt, E, E, E, E, E, E, E, E, E, E, E, E]);
aoa.push([E, 'TOTAL INC GST', totalIncGST, E, E, E, E, E, E, E, E, E, E, E, E]);

const wsEstimate = XLSX.utils.aoa_to_sheet(aoa);
wsEstimate['!cols'] = [
  {wch:10}, {wch:65}, {wch:14},
  {wch:22}, {wch:6}, {wch:22}, {wch:6}, {wch:22}, {wch:6},
  {wch:14}, {wch:12}, {wch:26},
];

// Rates & Settings sheet
const ratesAoa = [
  ['Mettro Estimating Guide & Rates', E, E, E],
  [E, E, E, E],
  ['GST %', GST, E, E],
  ['Contingency %', CONTINGENCY, E, E],
  ['Retainer / commitment discount %', DISCOUNT, E, E],
  ['After-hours multiplier', 2, E, E],
  [E, E, E, E],
  ['Role / category', 'Rate ex GST', E, 'Row Types'],
  ['Strategy', 270, E, 'Header'],
  ['Project Management', 210, E, 'Item'],
  ['Design', 210, E, 'Spacer'],
  ['Development', 230, E, E],
  ['Integration & Technical', 250, E, E],
  ['Quality Assurance', 170, E, E],
  ['Content Entry', 170, E, E],
  ['Standard Support', 200, E, E],
  ['External Contractor', 200, E, E],
];
const wsRates = XLSX.utils.aoa_to_sheet(ratesAoa);
wsRates['!cols'] = [{wch:32}, {wch:14}, {wch:4}, {wch:16}];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, wsEstimate, 'Estimate');
XLSX.utils.book_append_sheet(wb, wsRates, 'Rates & Settings');

const outPath = '/workspace/agent/drafts/DTET-Estimate-June2026.xlsx';
XLSX.writeFile(wb, outPath);

console.log('Done:', outPath);
console.log('Subtotal ex GST: $' + subtotal.toLocaleString());
console.log('GST: $' + gstAmt.toLocaleString());
console.log('Total inc GST: $' + totalIncGST.toLocaleString());
let totalH = 0;
for (const sec of sectionData) {
  console.log(sec.name + ': $' + sec.sectionTotal.toLocaleString() + ' / ' + sec.sectionHrs + 'hrs');
  totalH += sec.sectionHrs;
}
console.log('Total hours:', totalH);
