/**
 * Mettro ChatGPT Image Prompt Engine
 * Blog Post Feature Images
 *
 * HOW TO USE:
 * 1. In Google Sheets, go to Extensions > Apps Script
 * 2. Delete any existing code, paste this entire script
 * 3. Click Save, then click Run (select buildPromptEngine)
 * 4. Approve permissions when asked
 * 5. Done — the sheet is ready to use
 */

function buildPromptEngine() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── LISTS DATA ──────────────────────────────────────────────────────────────
  // Update these lists anytime — changes reflect in the dropdowns automatically

  const lists = {
    'Client / Brand': [
      'Mettro',
      'Queensland Capital',
      'La Petite Boudoir',
      'Business Lifers',
      'Carpet One',
      'Leap in!',
      'QSBC',
      'Arrow Energy',
      'Qld Capital',
      'Other (specify in main subject)',
    ],
    'Visual Style': [
      'Photographic',
      'Illustrated',
      'Abstract',
      'Flat design',
      'Editorial',
      '3D render',
      'Infographic',
      'Graphic design / collage',
    ],
    'Mood / Tone': [
      'Professional',
      'Warm',
      'Bold',
      'Calm',
      'Energetic',
      'Minimal',
      'Playful',
      'Sophisticated',
    ],
    'Colour Palette': [
      'Brand colours',
      'Warm neutrals',
      'Cool tones',
      'Monochrome',
      'Vibrant / bold',
      'Earthy tones',
      'Dark / moody',
      'Pastel',
    ],
    'Composition': [
      'Centred subject',
      'Text space left',
      'Text space right',
      'Text space bottom',
      'Split layout',
      'Wide landscape',
      'Close-up / macro',
      'Overhead / flat lay',
    ],
    'Aspect Ratio': [
      '16:9 Landscape',
      '1:1 Square',
      '4:5 Portrait',
      '9:16 Vertical',
    ],
    'Destination': [
      'Blog hero',
      'Social share card',
      'LinkedIn featured image',
      'Facebook / Instagram post',
      'Email header',
      'Website hero / banner',
      'Newsletter header',
      'Display ad creative',
      'Landing page hero',
      'Case study cover',
      'Presentation slide',
    ],
    'Text Space': [
      'No text in image',
      'Leave clear space left',
      'Leave clear space right',
      'Leave clear space bottom',
      'Leave clear space top',
    ],
    'Font Style': [
      'Bold modern sans-serif',
      'Clean minimal',
      'Editorial serif',
      'Friendly rounded',
      'Corporate formal',
      'Handwritten / organic',
      'No text in image',
    ],
  };

  const listKeys = Object.keys(lists);

  // ── BUILD LISTS SHEET ───────────────────────────────────────────────────────

  let listsSheet = ss.getSheetByName('Lists');
  if (!listsSheet) {
    listsSheet = ss.insertSheet('Lists');
  } else {
    listsSheet.clearContents();
    listsSheet.clearFormats();
  }

  // Write headers
  listsSheet.getRange(1, 1, 1, listKeys.length).setValues([listKeys]);
  listsSheet
    .getRange(1, 1, 1, listKeys.length)
    .setFontWeight('bold')
    .setBackground('#1a1a1a')
    .setFontColor('#ffffff');

  // Write list values
  listKeys.forEach((key, i) => {
    const col = i + 1;
    const values = lists[key].map(v => [v]);
    listsSheet.getRange(2, col, values.length, 1).setValues(values);
  });

  listsSheet.autoResizeColumns(1, listKeys.length);
  listsSheet.setFrozenRows(1);

  // ── BUILD PROMPT BUILDER SHEET ──────────────────────────────────────────────

  let builderSheet = ss.getSheetByName('Prompt Builder');
  if (!builderSheet) {
    builderSheet = ss.insertSheet('Prompt Builder', 0);
  } else {
    builderSheet.clearContents();
    builderSheet.clearFormats();
    // Remove existing data validations
    builderSheet.getRange(2, 1, 200, 20).clearDataValidations();
  }

  // Column definitions
  // col: 1-indexed column in Prompt Builder
  // listKey: key in lists object (null = free text)
  // required: show in red header
  const columns = [
    { header: 'Client / Brand',     listKey: 'Client / Brand',  required: true,  width: 150, hint: null },
    { header: 'Blog Topic',          listKey: null,               required: true,  width: 260, hint: 'e.g. PPC advertising for small business' },
    { header: 'Destination',         listKey: 'Destination',     required: false, width: 170, hint: null },
    { header: 'Visual Style',        listKey: 'Visual Style',    required: true,  width: 150, hint: null },
    { header: 'Mood / Tone',         listKey: 'Mood / Tone',     required: false, width: 130, hint: null },
    { header: 'Colour Palette',      listKey: 'Colour Palette',  required: false, width: 145, hint: null },
    { header: 'Composition',         listKey: 'Composition',     required: false, width: 160, hint: null },
    { header: 'Main Subject',        listKey: null,               required: true,  width: 220, hint: 'e.g. person at laptop in modern office' },
    { header: 'Text Space',          listKey: 'Text Space',      required: false, width: 175, hint: null },
    { header: 'Aspect Ratio',        listKey: 'Aspect Ratio',    required: false, width: 130, hint: null },
    { header: 'Font Style',          listKey: 'Font Style',      required: false, width: 190, hint: null },
    { header: 'Avoid',               listKey: null,               required: false, width: 200, hint: 'e.g. no hands, no text, no faces' },
    { header: 'Reference Image URL', listKey: null,               required: false, width: 220, hint: 'Paste URL of a style reference image' },
    { header: 'Generated Prompt',    listKey: null,               required: false, width: 520, hint: null },
  ];

  const numDataRows = 100;
  const numCols = columns.length;
  const promptCol = numCols; // last column

  // Write headers
  const headerValues = [columns.map(c => c.required ? c.header + ' *' : c.header)];
  builderSheet.getRange(1, 1, 1, numCols).setValues(headerValues);

  // Style headers
  columns.forEach((col, i) => {
    const cell = builderSheet.getRange(1, i + 1);
    if (i + 1 === promptCol) {
      cell.setBackground('#1B5E20').setFontColor('#ffffff').setFontWeight('bold');
    } else if (col.required) {
      cell.setBackground('#7f0000').setFontColor('#ffffff').setFontWeight('bold');
    } else {
      cell.setBackground('#1a1a1a').setFontColor('#ffffff').setFontWeight('bold');
    }
  });

  // Column widths
  columns.forEach((col, i) => {
    builderSheet.setColumnWidth(i + 1, col.width);
  });

  // Freeze header row and first column
  builderSheet.setFrozenRows(1);

  // Data validation dropdowns
  columns.forEach((col, i) => {
    if (!col.listKey) return;
    const listColIndex = listKeys.indexOf(col.listKey) + 1;
    const listLength = lists[col.listKey].length;
    const targetRange = builderSheet.getRange(2, i + 1, numDataRows, 1);
    const sourceRange = listsSheet.getRange(2, listColIndex, listLength, 1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(sourceRange, true)
      .setAllowInvalid(false)
      .setHelpText('Select from the list. Update options in the Lists sheet.')
      .build();
    targetRange.setDataValidation(rule);
  });

  // Generated Prompt formula (row 2)
  // Uses IFERROR + IF chain — skips blank optional fields cleanly
  const f = (col, prefix, suffix) =>
    `IF(${col}2<>"","${prefix}"&${col}2&"${suffix}","")`;

  const A='A', B='B', C='C', D='D', E='E', F='F', G='G', H='H', I='I', J='J', K='K', L='L', M='M', N='N';

  const formula = `=IF(OR(A2="",B2="",D2="",H2=""),` +
    `"⚠️ Fill all required fields (starred columns) to generate prompt",` +
    `"Create a "&D2&" style feature image for "&A2&". Topic: "&B2&". "` +
    `&${f(C,'Destination: ','. ')}` +
    `&"Main subject: "&H2&". "` +
    `&${f(E,'Mood: ','. ')}` +
    `&${f(F,'Colour palette: ','. ')}` +
    `&${f(G,'Composition: ','. ')}` +
    `&IF(I2<>"",I2&". ","")` +
    `&${f(J,'Aspect ratio: ','. ')}` +
    `&${f(K,'Typography style (if text is included): ','. ')}` +
    `&${f(L,'Avoid: ','. ')}` +
    `&${f(M,'Visual reference style: ','. ')}` +
    `&"Professional graphic design quality. Commercial photography standard. Not stock imagery.")`;

  builderSheet.getRange(2, promptCol).setFormula(formula);

  // Copy formula down
  builderSheet.getRange(2, promptCol).copyTo(
    builderSheet.getRange(3, promptCol, numDataRows - 1, 1),
    SpreadsheetApp.CopyPasteType.PASTE_FORMULA,
    false
  );

  // Format generated prompt column
  builderSheet
    .getRange(2, promptCol, numDataRows, 1)
    .setWrap(true)
    .setBackground('#f1f8e9')
    .setVerticalAlignment('top');

  // Format all data rows — wrap and top-align
  builderSheet
    .getRange(2, 1, numDataRows, numCols - 1)
    .setWrap(false)
    .setVerticalAlignment('middle');

  // Hint text in row 2 for free-text fields
  columns.forEach((col, i) => {
    if (col.hint) {
      const cell = builderSheet.getRange(2, i + 1);
      cell.setValue(col.hint).setFontStyle('italic').setFontColor('#aaaaaa');
    }
  });

  // Alternate row shading
  for (let r = 3; r <= numDataRows; r++) {
    if (r % 2 === 0) {
      builderSheet.getRange(r, 1, 1, numCols - 1).setBackground('#f8f8f8');
    }
  }

  // Move Lists sheet to end
  ss.setActiveSheet(builderSheet);
  ss.moveActiveSheet(1);

  SpreadsheetApp.getUi().alert(
    '✅ Prompt Engine ready!\n\n' +
    'HOW TO USE:\n' +
    '• Fill in the starred (*) columns — these are required\n' +
    '• Optional columns: skip anything you don\'t need\n' +
    '• The Generated Prompt column assembles automatically\n' +
    '• Copy the prompt and paste into ChatGPT Images\n\n' +
    'UPDATE DROPDOWNS:\n' +
    '• Open the Lists sheet to add/edit any picklist options\n\n' +
    'ADD MORE ROWS:\n' +
    '• Just type in the next empty row — the formula copies down'
  );
}
