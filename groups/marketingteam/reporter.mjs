/**
 * Reporter Agent
 * Reads the Analyst's structured analysis JSON and formats a grouped,
 * scannable Slack report. Groups flags by issue type rather than client.
 * Does no calculation — formats and posts only.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

const DATA_DIR = '/workspace/agent/data';

// ─── Date / Time Helpers ──────────────────────────────────────────────────────

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]} ${d} ${months[m - 1]}`;
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  const aest = new Date(d.getTime() + 10 * 60 * 60 * 1000);
  let h = aest.getUTCHours();
  const min = String(aest.getUTCMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${min}${ampm} AEST`;
}

// ─── Name Helpers ─────────────────────────────────────────────────────────────

function shortClientName(clientName) {
  // "Carpet One - Redcliffe" → "Redcliffe", "Haus Of Rattan" → "Haus of Rattan"
  return clientName.replace(/^Carpet One\s*[-–]\s*/i, '').trim();
}

function shortCampaignName(campaignName) {
  if (!campaignName) return '';
  let n = campaignName
    // Strip "| Mettro | 20260212" suffix
    .replace(/\s*\|\s*Mettro\s*\|\s*\d{8}\s*$/i, '')
    // Strip "• MM.YYYY • (Mettro Build)" and variants
    .replace(/\s*[•]\s*\d{2}\.\d{4}.*$/i, '')
    // Strip " (Mettro Build)" or "(Mettro Buiid)"
    .replace(/\s*\(Mettro\s+Bui+d\)\s*$/i, '')
    // Strip "Carpet One StoreName •" prefix
    .replace(/^Carpet One\s+[\w\s-]+?\s*[•]\s*/i, '')
    // Strip "Haus of Rattan |" prefix
    .replace(/^Haus of Rattan\s*\|\s*/i, '')
    // Strip "QLD Capital |" prefix
    .replace(/^QLD Capital\s*\|\s*/i, '')
    // "Sponsored Listing • " is noise
    .replace(/Sponsored Listing\s*[•|]\s*/gi, '')
    // Trailing separator cleanup
    .replace(/\s*[•|]\s*$/, '')
    .replace(/Performance Max/gi, 'PMax')
    .replace(/\s+/g, ' ')
    .trim();

  return n.length > 40 ? n.slice(0, 37).replace(/\s\S*$/, '') + '…' : n;
}

// ─── Regex Extractors ─────────────────────────────────────────────────────────

function extract(detail, pattern, fallback = '?') {
  const m = detail?.match(pattern);
  return m ? m[1] : fallback;
}

// ─── Flag Grouping ────────────────────────────────────────────────────────────

function groupFlags(clients) {
  const critical = [];
  const byMetric = {};
  const positives = [];

  for (const client of clients) {
    if (!client.dataAvailable) continue;
    for (const f of (client.flags || [])) {
      const e = { ...f, clientName: client.clientName };
      if (f.severity === 'critical') {
        critical.push(e);
      } else if (f.severity === 'positive') {
        positives.push(e);
      } else {
        if (!byMetric[f.metric]) byMetric[f.metric] = [];
        byMetric[f.metric].push(e);
      }
    }
  }

  return { critical, byMetric, positives };
}

// ─── Critical Formatters ──────────────────────────────────────────────────────

function formatCritical(f) {
  const c = shortClientName(f.clientName);
  switch (f.metric) {
    case 'budget_exhausted': {
      const m = f.detail.match(/spent \$([0-9.]+) of its \$([0-9.]+)\/day budget and lost (\d+)%/);
      const camp = f.campaignName ? ` (${shortCampaignName(f.campaignName)})` : '';
      if (m) return `• *${c}*${camp} — $${m[1]}/$${m[2]} budget, ${m[3]}% IS lost`;
      break;
    }
    case 'campaign_paused': {
      const camp = shortCampaignName(f.campaignName);
      return `• *${c}* — "${camp}" was enabled recently and is now paused`;
    }
    case 'ads_disapproved': {
      const count = extract(f.detail, /^All (\d+) ad/);
      const camp = shortCampaignName(f.campaignName);
      return `• *${c}* — all ${count} ads in "${camp}" disapproved, campaign not serving`;
    }
    case 'all_campaigns_paused':
      return `• *${c}* — all campaigns paused, no active serving`;
  }
  return `• *${c}* — ${f.detail}`;
}

// ─── Warning Section Builders ─────────────────────────────────────────────────

function impressionShareSection(byMetric) {
  const flags = [
    ...(byMetric.budget_exhausted || []),
    ...(byMetric.lost_is_budget || []),
    ...(byMetric.lost_is_combined || []),
  ];
  if (!flags.length) return null;

  // Group by client — if a client has multiple flags, show campaign distinguisher
  const byClient = {};
  for (const f of flags) {
    const c = shortClientName(f.clientName);
    if (!byClient[c]) byClient[c] = [];
    byClient[c].push(f);
  }

  const items = [];
  for (const [client, fList] of Object.entries(byClient)) {
    if (fList.length === 1) {
      const pct = extract(fList[0].detail, /lost (\d+)%/);
      items.push(`${client} ${pct}%`);
    } else {
      for (const f of fList) {
        const pct = extract(f.detail, /lost (\d+)%/);
        const camp = shortCampaignName(f.campaignName);
        items.push(`${client} ${camp} ${pct}%`);
      }
    }
  }

  return {
    label: `*Impression share lost* — ${flags.length} campaign${flags.length > 1 ? 's' : ''}`,
    lines: [`• ${items.join(', ')}`],
  };
}

function spendSection(byMetric) {
  const devFlags = byMetric.spend_deviation || [];
  const cpcFlags = byMetric.cpc_spike || [];
  const mtdFlags = byMetric.mtd_spend_pace || [];

  const limited = (f) => f.detail.includes('limited history');
  const allLimited = [...devFlags, ...cpcFlags].every(limited);
  const total = devFlags.length + cpcFlags.length + mtdFlags.length;
  if (!total) return null;

  const lines = [];

  if (mtdFlags.length) {
    const items = mtdFlags.map(f => {
      const c = shortClientName(f.clientName);
      const m = f.detail.match(/(\d+)% (above|below) last month/);
      if (m) return `${c} ${m[2] === 'above' ? '↑' : '↓'}${m[1]}%`;
      return c;
    });
    lines.push(`• _MTD pace:_ ${items.join(', ')}`);
  }

  if (devFlags.length || cpcFlags.length) {
    if (allLimited) {
      lines.push(`• _${devFlags.length + cpcFlags.length} daily spend/CPC anomalies — baselines stabilise after 7 days of data_`);
    } else {
      const items = [...devFlags, ...cpcFlags].filter(f => !limited(f)).map(f => {
        const c = shortClientName(f.clientName);
        const m = f.detail.match(/(\d+)% (above|below)/);
        const label = f.metric === 'cpc_spike' ? 'CPC' : 'spend';
        if (m) return `${c} ${label} ${m[2] === 'above' ? '↑' : '↓'}${m[1]}%`;
        return c;
      });
      if (items.length) lines.push(`• _Spend/CPC:_ ${items.join(', ')}`);
      const limitedCount = [...devFlags, ...cpcFlags].filter(limited).length;
      if (limitedCount) lines.push(`• _+${limitedCount} more anomalies excluded (limited history)_`);
    }
  }

  if (!lines.length) return null;
  return { label: `*Spend* — ${total} flag${total > 1 ? 's' : ''}`, lines };
}

function conversionSection(byMetric) {
  const trailingFlags = byMetric.mtd_conversions_trailing || [];
  const dropFlags = byMetric.conversion_rate_drop || [];
  const zeroFlags = byMetric.zero_contact_conversions || [];
  const formFlags = byMetric.form_engagement_gap || [];
  const total = trailingFlags.length + dropFlags.length + zeroFlags.length + formFlags.length;

  if (!total) return null;
  const lines = [];

  if (trailingFlags.length) {
    const items = trailingFlags.map(f => {
      const c = shortClientName(f.clientName);
      const m = f.detail.match(/is ([\d.]+) — \d+% below last month's daily average of ([\d.]+)/);
      if (m) {
        const cur = m[1].replace(/\.$/, '');
        const prev = m[2].replace(/\.$/, '');
        return `${c} ${cur}→${prev}/day`;
      }
      return c;
    });
    lines.push(`• _MTD below prior month:_ ${items.join(', ')}`);
  }

  if (formFlags.length) {
    const items = formFlags.map(f => {
      const c = shortClientName(f.clientName);
      const views = extract(f.detail, /^(\d+) contact form views/);
      const calls = extract(f.detail, /(\d+) phone clicks/, null);
      return calls ? `${c} (${views} views, ${calls} calls)` : `${c} (${views} views)`;
    });
    lines.push(`• _Form views, no submissions:_ ${items.join(', ')}`);
  }

  if (zeroFlags.length) {
    const items = zeroFlags.map(f => shortClientName(f.clientName));
    lines.push(`• _No paid contact actions this month:_ ${items.join(', ')}`);
  }

  if (dropFlags.length) {
    const limited = dropFlags.filter(f => f.detail.includes('limited history'));
    const real = dropFlags.filter(f => !f.detail.includes('limited history'));
    if (real.length) {
      const items = real.map(f => {
        const c = shortClientName(f.clientName);
        const pct = extract(f.detail, /(\d+)% below its/);
        return `${c} -${pct}%`;
      });
      lines.push(`• _Conversion rate drop:_ ${items.join(', ')}`);
    }
    if (limited.length) lines.push(`• _+${limited.length} CR drops excluded (limited history)_`);
  }

  return { label: `*Conversions* — ${total} flag${total > 1 ? 's' : ''}`, lines };
}

function trackingQualitySection(byMetric) {
  const gapFlags = byMetric.tracking_gap || [];
  const bounceFlags = byMetric.high_bounce_rate || [];
  const disapprovedFlags = byMetric.ads_disapproved_partial || [];
  const total = gapFlags.length + bounceFlags.length + disapprovedFlags.length;

  if (!total) return null;
  const lines = [];

  if (gapFlags.length) {
    const items = gapFlags.map(f => {
      const c = shortClientName(f.clientName);
      const pct = extract(f.detail, /\((\d+)% match rate\)/);
      return `${c} ${pct}%`;
    });
    lines.push(`• _GA4 tracking gaps:_ ${items.join(', ')}`);
  }

  if (bounceFlags.length) {
    const items = bounceFlags.map(f => {
      const c = shortClientName(f.clientName);
      const pct = extract(f.detail, /(\d+)% bounce rate/);
      return `${c} ${pct}%`;
    });
    lines.push(`• _High bounce rate:_ ${items.join(', ')}`);
  }

  if (disapprovedFlags.length) {
    const items = disapprovedFlags.map(f => {
      const c = shortClientName(f.clientName);
      const count = extract(f.detail, /^(\d+) ad/);
      return `${c} (${count} ad${count !== '1' ? 's' : ''})`;
    });
    lines.push(`• _Disapproved ads:_ ${items.join(', ')}`);
  }

  return { label: `*Tracking & ad quality* — ${total} flag${total > 1 ? 's' : ''}`, lines };
}

// ─── Positive Formatters ──────────────────────────────────────────────────────

function formatPositive(f) {
  const c = shortClientName(f.clientName);
  switch (f.metric) {
    case 'impression_share_gain': {
      const m = f.detail.match(/was (\d+)% — (\d+) percentage points above/);
      return m ? `${c} — IS up ${m[2]}pp to ${m[1]}%` : `${c} — ${f.detail}`;
    }
    case 'conversion_uptick': {
      const m = f.detail.match(/recorded ([\d.]+) conversion.*?(\d+)% above/);
      return m ? `${c} — ${m[1]} convs (+${m[2]}% vs avg)` : `${c} — ${f.detail}`;
    }
    case 'cpc_efficiency': {
      const m = f.detail.match(/(\d+)% more efficient/);
      return m ? `${c} — CPC ${m[1]}% more efficient` : `${c} — ${f.detail}`;
    }
    case 'mtd_conversion_growth': {
      const m = f.detail.match(/(\d+)% ahead/);
      return m ? `${c} — MTD convs +${m[1]}% vs prior month` : `${c} — ${f.detail}`;
    }
  }
  return `${c} — ${f.detail}`;
}

// ─── Report Builder ───────────────────────────────────────────────────────────

function buildReport(analysis) {
  const { meta, clients } = analysis;
  const { critical, byMetric, positives } = groupFlags(clients);

  const lines = [];

  // Header
  lines.push(`:bar_chart: *Google Ads — ${formatDate(meta.runDate)}*`);
  lines.push('');

  // Summary counts
  const parts = [];
  if (meta.criticalCount > 0) parts.push(`:red_circle: ${meta.criticalCount} critical`);
  if (meta.warningCount > 0) parts.push(`:large_yellow_circle: ${meta.warningCount} warning`);
  if (meta.positiveCount > 0) parts.push(`:large_green_circle: ${meta.positiveCount} positive`);
  parts.push(`${meta.accountsAnalysed} accounts`);
  lines.push(`>${parts.join('   ')}`);

  const missing = clients.filter(c => !c.dataAvailable);
  if (missing.length) {
    lines.push(`>:grey_question: No data: ${missing.map(c => shortClientName(c.clientName)).join(', ')}`);
  }
  lines.push('');

  // All clear?
  if (!critical.length && !Object.keys(byMetric).length) {
    lines.push(':white_check_mark: *All clear* — no issues flagged today.');
  } else {

    // ── Criticals ──────────────────────────────────────────────────────────
    if (critical.length) {
      lines.push('*:red_circle: Needs action today*');
      for (const f of critical) lines.push(formatCritical(f));
      lines.push('');
    }

    // ── Warning sections ───────────────────────────────────────────────────
    const warningSections = [
      impressionShareSection(byMetric),
      spendSection(byMetric),
      conversionSection(byMetric),
      trackingQualitySection(byMetric),
    ].filter(Boolean);

    for (const section of warningSections) {
      lines.push(`:large_yellow_circle: ${section.label}`);
      lines.push(...section.lines);
      lines.push('');
    }
  }

  // ── Positives ────────────────────────────────────────────────────────────
  if (positives.length) {
    lines.push(':large_green_circle: *Positives*');
    for (const f of positives) lines.push(`• ${formatPositive(f)}`);
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`:clock6: _${formatTime(meta.generatedAt)} — Ask @Janet about a specific account for detail._`);

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const statusPath = `${DATA_DIR}/collector-status.json`;
  let runDate;

  if (existsSync(statusPath)) {
    runDate = JSON.parse(readFileSync(statusPath, 'utf8')).runDate;
  } else {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const pad = x => String(x).padStart(2, '0');
    runDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  const analysisPath = `${DATA_DIR}/analysis/${runDate}.json`;

  if (!existsSync(analysisPath)) {
    console.log(`ERROR: Analysis file not found: ${analysisPath}`);
    process.exit(1);
  }

  const analysis = JSON.parse(readFileSync(analysisPath, 'utf8'));
  const report = buildReport(analysis);

  // Write to file for the orchestrator to post
  mkdirSync(`${DATA_DIR}/reports`, { recursive: true });
  writeFileSync(`${DATA_DIR}/reports/${runDate}.txt`, report, 'utf8');

  console.log('=== REPORT ===');
  console.log(report);
  console.log('=== END REPORT ===');
}

main().catch(err => {
  console.error('Reporter error:', err);
  process.exit(1);
});
