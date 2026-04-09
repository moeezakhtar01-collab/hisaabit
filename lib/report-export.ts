import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Paths, File } from 'expo-file-system';
import { Expense, getCategoryLabel, formatPKR } from './storage';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDateReadable(dateString: string): string {
  const dateOnly = dateString.includes('T') ? dateString.split('T')[0] : dateString;
  const [year, month, day] = dateOnly.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── PDF Report (for weekly hisaab share) ──────────────────────

export async function generateWeeklyPdf(
  expenses: Expense[],
  weekLabel: string,
  totalSpent: number,
): Promise<void> {
  const sorted = [...expenses].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Category summary
  const catMap = new Map<string, { count: number; total: number }>();
  for (const e of sorted) {
    const prev = catMap.get(e.category) || { count: 0, total: 0 };
    catMap.set(e.category, { count: prev.count + 1, total: prev.total + e.amount });
  }
  const catSummary = Array.from(catMap.entries())
    .map(([key, v]) => ({ label: getCategoryLabel(key), ...v }))
    .sort((a, b) => b.total - a.total);

  const tableRows = sorted
    .map(
      (e, i) => `
      <tr style="${i % 2 === 0 ? '' : 'background-color: #F9FAFB;'}">
        <td style="padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 13px;">${formatDateReadable(e.date)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 13px;">${escapeHtml(getCategoryLabel(e.category))}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 13px;">${escapeHtml(e.note || '-')}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #E5E7EB; font-size: 13px; text-align: right; font-weight: 600;">${formatPKR(e.amount)}</td>
      </tr>`,
    )
    .join('');

  const catRows = catSummary
    .map(
      (c) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-size: 13px;">${escapeHtml(c.label)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-size: 13px; text-align: center;">${c.count}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-size: 13px; text-align: right; font-weight: 600;">${formatPKR(c.total)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #E5E7EB; font-size: 13px; text-align: right; color: #6B7280;">${totalSpent > 0 ? Math.round((c.total / totalSpent) * 100) : 0}%</td>
      </tr>`,
    )
    .join('');

  const html = `
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 32px 24px; color: #1A1A2E; }
        h1 { font-size: 24px; margin: 0 0 4px 0; color: #1E3A5F; }
        .subtitle { font-size: 14px; color: #6B7280; margin-bottom: 24px; }
        .summary-box { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .summary-label { font-size: 13px; color: #6B7280; }
        .summary-value { font-size: 20px; font-weight: 700; color: #1E3A5F; }
        h2 { font-size: 16px; margin: 24px 0 10px 0; color: #1A1A2E; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; background: #F3F4F6; border-bottom: 2px solid #E5E7EB; }
        th:last-child { text-align: right; }
        .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #9CA3AF; }
      </style>
    </head>
    <body>
      <h1>Weekly Hisaab</h1>
      <div class="subtitle">${escapeHtml(weekLabel)}</div>

      <div class="summary-box">
        <div class="summary-label">Total Spent</div>
        <div class="summary-value">${formatPKR(totalSpent)}</div>
        <div class="summary-label" style="margin-top: 8px;">${sorted.length} expense${sorted.length !== 1 ? 's' : ''} across ${catSummary.length} categor${catSummary.length !== 1 ? 'ies' : 'y'}</div>
      </div>

      <h2>Category Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th style="text-align: center;">Count</th>
            <th style="text-align: right;">Amount</th>
            <th style="text-align: right;">Share</th>
          </tr>
        </thead>
        <tbody>${catRows}</tbody>
      </table>

      <h2>All Expenses</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Note</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr style="background: #F3F4F6;">
            <td colspan="3" style="padding: 10px 12px; font-weight: 700; font-size: 13px;">Total</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; font-size: 13px;">${formatPKR(totalSpent)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="footer">Generated by Hisaabit</div>
    </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share Weekly Hisaab',
    UTI: 'com.adobe.pdf',
  });
}

// ─── CSV Export (for history screen download) ──────────────────

export async function generateCsvReport(
  expenses: Expense[],
  startDate: Date,
  endDate: Date,
): Promise<void> {
  const filtered = expenses.filter((e) => {
    const dateOnly = e.date.includes('T') ? e.date.split('T')[0] : e.date;
    const [y, m, d] = dateOnly.split('-').map(Number);
    const expDate = new Date(y, m - 1, d);
    expDate.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return expDate >= start && expDate <= end;
  });

  const sorted = filtered.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const escapeCsv = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const headers = ['Date', 'Category', 'Note', 'Amount (PKR)'];
  const rows = sorted.map((e) =>
    [
      formatDateReadable(e.date),
      getCategoryLabel(e.category),
      e.note || '',
      e.amount.toString(),
    ]
      .map(escapeCsv)
      .join(','),
  );

  const total = sorted.reduce((s, e) => s + e.amount, 0);
  rows.push(['', '', 'TOTAL', total.toString()].map(escapeCsv).join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  const startLabel = startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  const endLabel = endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
  const filename = `Hisaabit-${startLabel}-to-${endLabel}.csv`;

  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(csv);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Download Expense Report',
    UTI: 'public.comma-separated-values-text',
  });
}
