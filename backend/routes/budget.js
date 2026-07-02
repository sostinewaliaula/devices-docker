import express from 'express';
import { executeQuery } from '../config/database.js';
import { requireAdmin } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } from 'docx';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

router.use(requireAdmin);

const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || 'KES';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGO_PATH = path.resolve(__dirname, '../assets/logo.png');

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeRecent(rows = []) {
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    status: row.status,
    estimated_cost:
      row.estimated_cost === null || row.estimated_cost === undefined ? null : Number(row.estimated_cost),
    updated_at: row.updated_at
  }));
}

async function buildBudgetSummary(filters = {}) {
  const { issueStatuses = [], assetStatuses = [] } = filters;

  let issueWhereClause = 'WHERE 1=1';
  let issueParams = [];
  if (issueStatuses.length > 0) {
    issueWhereClause += ` AND status IN (${issueStatuses.map(() => '?').join(',')})`;
    issueParams = [...issueStatuses];
  }

  const issueTotalsResult = await executeQuery(
    `SELECT 
       COUNT(*) as total_count,
       COALESCE(SUM(estimated_cost), 0) as total_cost,
       COALESCE(SUM(CASE WHEN LOWER(status) = 'open' THEN estimated_cost ELSE 0 END), 0) as open_cost,
       COALESCE(SUM(CASE WHEN LOWER(status) = 'in_progress' THEN estimated_cost ELSE 0 END), 0) as in_progress_cost,
       COALESCE(SUM(CASE WHEN LOWER(status) = 'resolved' THEN estimated_cost ELSE 0 END), 0) as resolved_cost,
       COALESCE(SUM(CASE WHEN LOWER(status) = 'closed' THEN estimated_cost ELSE 0 END), 0) as closed_cost,
       COALESCE(SUM(CASE WHEN LOWER(status) = 'scheduled' THEN estimated_cost ELSE 0 END), 0) as scheduled_cost
     FROM issues
     ${issueWhereClause}`,
    issueParams
  );

  if (!issueTotalsResult.success) {
    throw new Error(issueTotalsResult.error || 'Failed to retrieve issue totals');
  }

  const issueTotals = issueTotalsResult.data?.[0] || {};

  const issueSummary = {
    total_cost: toNumber(issueTotals.total_cost),
    total_count: toNumber(issueTotals.total_count),
    by_status: {
      open: toNumber(issueTotals.open_cost),
      in_progress: toNumber(issueTotals.in_progress_cost),
      resolved: toNumber(issueTotals.resolved_cost),
      closed: toNumber(issueTotals.closed_cost),
      scheduled: toNumber(issueTotals.scheduled_cost)
    }
  };

  let assetWhereClause = 'WHERE 1=1';
  let assetParams = [];
  if (assetStatuses.length > 0) {
    assetWhereClause += ` AND status IN (${assetStatuses.map(() => '?').join(',')})`;
    assetParams = [...assetStatuses];
  }

  const assetTotalsResult = await executeQuery(
    `SELECT 
       COUNT(*) as total_count,
       COALESCE(SUM(estimated_cost), 0) as total_cost,
       COALESCE(SUM(CASE WHEN LOWER(status) = 'pending' THEN estimated_cost ELSE 0 END), 0) as pending_cost,
       COALESCE(SUM(CASE WHEN LOWER(status) = 'approved' THEN estimated_cost ELSE 0 END), 0) as approved_cost,
       COALESCE(SUM(CASE WHEN LOWER(status) = 'rejected' THEN estimated_cost ELSE 0 END), 0) as rejected_cost,
       COALESCE(SUM(CASE WHEN LOWER(status) = 'fulfilled' THEN estimated_cost ELSE 0 END), 0) as fulfilled_cost
     FROM asset_requests
     ${assetWhereClause}`,
    assetParams
  );

  if (!assetTotalsResult.success) {
    throw new Error(assetTotalsResult.error || 'Failed to retrieve asset request totals');
  }

  const assetTotals = assetTotalsResult.data?.[0] || {};

  const assetSummary = {
    total_cost: toNumber(assetTotals.total_cost),
    total_count: toNumber(assetTotals.total_count),
    by_status: {
      pending: toNumber(assetTotals.pending_cost),
      approved: toNumber(assetTotals.approved_cost),
      rejected: toNumber(assetTotals.rejected_cost),
      fulfilled: toNumber(assetTotals.fulfilled_cost)
    }
  };

  const recentIssuesResult = await executeQuery(
    `SELECT id, title as name, status, estimated_cost, updated_at
     FROM issues
     ${issueWhereClause}
     ORDER BY updated_at DESC
     LIMIT 5`,
    issueParams
  );

  const recentRequestsResult = await executeQuery(
    `SELECT id, asset_name as name, status, estimated_cost, updated_at
     FROM asset_requests
     ${assetWhereClause}
     ORDER BY updated_at DESC
     LIMIT 5`,
    assetParams
  );

  const combinedTotals = {
    total_issue_cost: issueSummary.total_cost,
    total_asset_request_cost: assetSummary.total_cost,
    overall_total: issueSummary.total_cost + assetSummary.total_cost
  };

  return {
    currency: DEFAULT_CURRENCY,
    combined: combinedTotals,
    issues: {
      ...issueSummary,
      recent: recentIssuesResult.success ? normalizeRecent(recentIssuesResult.data) : []
    },
    asset_requests: {
      ...assetSummary,
      recent: recentRequestsResult.success ? normalizeRecent(recentRequestsResult.data) : []
    }
  };
}

router.get('/summary', async (req, res) => {
  try {
    const summary = await buildBudgetSummary();
    res.json(summary);
  } catch (error) {
    console.error('Budget summary error:', error);
    res.status(500).json({
      error: 'Failed to fetch budget summary',
      message: error.message
    });
  }
});

router.get('/export', async (req, res) => {
  try {
    const format = (req.query.format || 'pdf').toString().toLowerCase();
    const isGeneral = req.query.general === 'true';

    let issueStatuses = req.query.issueStatuses ? req.query.issueStatuses.split(',') : [];
    let assetStatuses = req.query.assetStatuses ? req.query.assetStatuses.split(',') : [];

    if (isGeneral) {
      // For general export, we specifically exclude some statuses
      const allIssueStatuses = ['open', 'in_progress', 'resolved', 'closed', 'scheduled'];
      const allAssetStatuses = ['pending', 'approved', 'rejected', 'fulfilled'];

      const excludedIssueStatuses = ['resolved', 'closed'];
      const excludedAssetStatuses = ['rejected', 'approved', 'fulfilled'];

      issueStatuses = allIssueStatuses.filter(s => !excludedIssueStatuses.includes(s));
      assetStatuses = allAssetStatuses.filter(s => !excludedAssetStatuses.includes(s));
    }

    const filters = { issueStatuses, assetStatuses };
    const summary = await buildBudgetSummary(filters);
    const timestamp = new Date().toISOString().split('T')[0];

    // Build WHERE clauses for detailed data
    let issueWhereClause = 'WHERE i.estimated_cost > 0';
    let issueParams = [];
    if (issueStatuses.length > 0) {
      issueWhereClause += ` AND i.status IN (${issueStatuses.map(() => '?').join(',')})`;
      issueParams = [...issueStatuses];
    }

    let assetWhereClause = 'WHERE ar.estimated_cost > 0';
    let assetParams = [];
    if (assetStatuses.length > 0) {
      assetWhereClause += ` AND ar.status IN (${assetStatuses.map(() => '?').join(',')})`;
      assetParams = [...assetStatuses];
    }

    // Fetch detailed data for exports
    const issuesResult = await executeQuery(
      `SELECT i.title, i.status, i.estimated_cost, u.name as reported_by, d.name as department_name
       FROM issues i
       LEFT JOIN users u ON i.reported_by = u.id
       LEFT JOIN departments d ON i.department_id = d.id
       ${issueWhereClause}
       ORDER BY i.estimated_cost DESC`,
      issueParams
    );

    const requestsResult = await executeQuery(
      `SELECT ar.asset_name, ar.status, ar.estimated_cost, u.name as requester, d.name as department_name
       FROM asset_requests ar
       JOIN users u ON ar.user_id = u.id
       LEFT JOIN departments d ON u.department_id = d.id
       ${assetWhereClause}
       ORDER BY ar.estimated_cost DESC`,
      assetParams
    );

    const detailedIssues = issuesResult.success ? issuesResult.data : [];
    const detailedRequests = requestsResult.success ? requestsResult.data : [];

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="budget-summary-${timestamp}.pdf"`);

      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(res);

      if (fs.existsSync(LOGO_PATH)) {
        try {
          doc.image(LOGO_PATH, doc.page.width - 150, 40, { width: 80 });
        } catch (err) {
          console.warn('Failed to load logo for PDF export:', err.message);
        }
      }

      doc
        .fontSize(22)
        .fillColor('#219653')
        .text('Budget Summary', { align: 'left' });
      doc
        .fontSize(12)
        .fillColor('#6B7280')
        .text(`Generated: ${new Date().toLocaleString()}`, { align: 'left' })
        .moveDown();

      const summaryBoxTop = doc.y;
      doc
        .roundedRect(50, summaryBoxTop, doc.page.width - 100, 90, 12)
        .fill('#F0FDF4')
        .stroke('#BBF7D0');
      const formatCurrency = (value) =>
        new Intl.NumberFormat('en-KE', {
          style: 'currency',
          currency: summary.currency || DEFAULT_CURRENCY,
          minimumFractionDigits: 2
        }).format(value || 0);
      doc
        .fillColor('#065F46')
        .fontSize(16)
        .text(`Overall Total: ${formatCurrency(summary.combined.overall_total)}`, 70, summaryBoxTop + 20);
      doc
        .fontSize(12)
        .fillColor('#047857')
        .text(
          `Issues: ${formatCurrency(summary.combined.total_issue_cost)}   |   Requests: ${formatCurrency(summary.combined.total_asset_request_cost)}`,
          { continued: false }
        )
        .moveDown(2);

      const renderSection = (title, total, count, data) => {
        doc
          .fontSize(16)
          .fillColor('#1F2937')
          .text(title, { underline: true })
          .moveDown(0.5);
        doc
          .fontSize(12)
          .fillColor('#374151')
          .text(`Total Cost: ${formatCurrency(total)}    |    Total Count: ${count}`)
          .moveDown(0.5);
        doc
          .rect(50, doc.y, doc.page.width - 100, 0.5)
          .fill('#E5E7EB')
          .stroke('#E5E7EB');
        doc.moveDown(0.5);
        Object.entries(data).forEach(([status, value]) => {
          doc
            .fontSize(11)
            .fillColor('#4B5563')
            .text(`${status.replace(/_/g, ' ').toUpperCase()}`, { continued: true })
            .fillColor('#111827')
            .text(`  ${formatCurrency(value)}`);
        });
        doc.moveDown();
      };

      // Issues Summary Header & Totals
      doc
        .fontSize(16)
        .fillColor('#1F2937')
        .text('Issues Summary', { underline: true })
        .moveDown(0.5);
      doc
        .fontSize(12)
        .fillColor('#374151')
        .text(`Total Cost: ${formatCurrency(summary.issues.total_cost)}    |    Total Count: ${summary.issues.total_count}`)
        .moveDown(0.5);
      doc
        .rect(50, doc.y, doc.page.width - 100, 0.5)
        .fill('#E5E7EB')
        .stroke('#E5E7EB');
      doc.moveDown(1);

      // Detailed Issues Table (Merged)
      let y = doc.y;
      doc.fontSize(10).fillColor('#6B7280');
      doc.text('Issue Title', 50, y);
      doc.text('Department', 190, y);
      doc.text('Reported By', 310, y);
      doc.text('Status', 410, y);
      doc.text('Cost', 500, y, { align: 'right' });

      doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke('#E5E7EB');
      y += 25;

      detailedIssues.forEach((issue) => {
        const titleWidth = 135;
        const titleHeight = doc.heightOfString(issue.title, { width: titleWidth });
        const rowHeight = Math.max(titleHeight, 20);

        if (y + rowHeight > 700) {
          doc.addPage();
          y = 50;
        }

        doc.fontSize(9).fillColor('#111827');
        doc.text(issue.title, 50, y, { width: titleWidth });
        doc.text(issue.department_name || 'N/A', 190, y, { width: 115 });
        doc.text(issue.reported_by || 'Unknown', 310, y, { width: 95 });
        doc.text(issue.status, 410, y);
        doc.text(formatCurrency(issue.estimated_cost), 500, y, { align: 'right' });
        y += rowHeight + 10;
      });

      doc.y = y;
      doc.moveDown(2);
      doc.x = 50;

      // Asset Requests Summary Header & Totals
      doc
        .fontSize(16)
        .fillColor('#1F2937')
        .text('Asset Requests Summary', { underline: true })
        .moveDown(0.5);
      doc
        .fontSize(12)
        .fillColor('#374151')
        .text(`Total Cost: ${formatCurrency(summary.asset_requests.total_cost)}    |    Total Count: ${summary.asset_requests.total_count}`)
        .moveDown(0.5);
      doc
        .rect(50, doc.y, doc.page.width - 100, 0.5)
        .fill('#E5E7EB')
        .stroke('#E5E7EB');
      doc.moveDown(1);

      // Detailed Asset Requests Table (Merged)
      y = doc.y;
      doc.fontSize(10).fillColor('#6B7280');
      doc.text('Asset Name', 50, y);
      doc.text('Department', 190, y);
      doc.text('Requester', 310, y);
      doc.text('Status', 410, y);
      doc.text('Cost', 500, y, { align: 'right' });

      doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke('#E5E7EB');
      y += 25;

      detailedRequests.forEach((req) => {
        const nameWidth = 135;
        const nameHeight = doc.heightOfString(req.asset_name, { width: nameWidth });
        const rowHeight = Math.max(nameHeight, 20);

        if (y + rowHeight > 700) {
          doc.addPage();
          y = 50;
        }

        doc.fontSize(9).fillColor('#111827');
        doc.text(req.asset_name, 50, y, { width: nameWidth });
        doc.text(req.department_name || 'N/A', 190, y, { width: 115 });
        doc.text(req.requester || 'Unknown', 310, y, { width: 95 });
        doc.text(req.status, 410, y);
        doc.text(formatCurrency(req.estimated_cost), 500, y, { align: 'right' });
        y += rowHeight + 10;
      });

      doc.end();
      return;
    }

    if (format === 'word') {
      const formatWordCurrency = (value) =>
        new Intl.NumberFormat('en-KE', {
          style: 'currency',
          currency: summary.currency || DEFAULT_CURRENCY,
          minimumFractionDigits: 2
        }).format(value || 0);

      let logoParagraph = null;
      if (fs.existsSync(LOGO_PATH)) {
        try {
          const logoBuffer = fs.readFileSync(LOGO_PATH);
          logoParagraph = new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new ImageRun({
                data: logoBuffer,
                transformation: {
                  width: 160,
                  height: 55
                }
              })
            ]
          });
        } catch (err) {
          console.warn('Failed to embed logo in Word export:', err.message);
        }
      }

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: { top: 720, right: 720, bottom: 720, left: 720 }
              }
            },
            children: [
              ...(logoParagraph ? [logoParagraph, new Paragraph({ text: '' })] : []),
              new Paragraph({
                children: [new TextRun({ text: 'Caava Group Budget Summary', bold: true, color: '219653', size: 36 })]
              }),
              new Paragraph({
                children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, color: '666666' })]
              }),
              new Paragraph({ text: '' }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Overall Total: ', bold: true }),
                  new TextRun({ text: `${formatWordCurrency(summary.combined.overall_total)}` })
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Issues: ', bold: true }),
                  new TextRun({ text: `${formatWordCurrency(summary.combined.total_issue_cost)}` }),
                  new TextRun({ text: '    Requests: ', bold: true }),
                  new TextRun({ text: `${formatWordCurrency(summary.combined.total_asset_request_cost)}` })
                ]
              }),
              new Paragraph({ text: '' }),

              // Issues Summary
              new Paragraph({ children: [new TextRun({ text: 'Issues Summary', bold: true, size: 28, color: '1F2937' })] }),
              ...Object.entries(summary.issues.by_status).map(
                ([status, value]) =>
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${status.replace(/_/g, ' ')}: `, bold: true, color: '374151' }),
                      new TextRun({ text: `${formatWordCurrency(value)}`, color: '111827' })
                    ]
                  })
              ),
              new Paragraph({ text: '' }),

              // Asset Requests Summary
              new Paragraph({
                children: [new TextRun({ text: 'Asset Requests Summary', bold: true, size: 28, color: '1F2937' })]
              }),
              ...Object.entries(summary.asset_requests.by_status).map(
                ([status, value]) =>
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${status.replace(/_/g, ' ')}: `, bold: true, color: '374151' }),
                      new TextRun({ text: `${formatWordCurrency(value)}`, color: '111827' })
                    ]
                  })
              ),
              new Paragraph({ text: '' }),

              // Detailed Issues
              new Paragraph({ children: [new TextRun({ text: 'Detailed Issues', bold: true, size: 28, color: '1F2937' })] }),
              ...detailedIssues.map(issue =>
                new Paragraph({
                  children: [
                    new TextRun({ text: `• ${issue.title} `, bold: true }),
                    new TextRun({ text: `[${issue.department_name || 'Unassigned'}] `, color: '555555' }),
                    new TextRun({ text: `by ${issue.reported_by || 'Unknown'} `, italics: true }),
                    new TextRun({ text: `(${issue.status}): ` }),
                    new TextRun({ text: formatWordCurrency(issue.estimated_cost) })
                  ]
                })
              ),
              new Paragraph({ text: '' }),

              // Detailed Asset Requests
              new Paragraph({ children: [new TextRun({ text: 'Detailed Asset Requests', bold: true, size: 28, color: '1F2937' })] }),
              ...detailedRequests.map(req =>
                new Paragraph({
                  children: [
                    new TextRun({ text: `• ${req.asset_name} `, bold: true }),
                    new TextRun({ text: `[${req.department_name || 'Unassigned'}] `, color: '555555' }),
                    new TextRun({ text: `by ${req.requester || 'Unknown'} `, italics: true }),
                    new TextRun({ text: `(${req.status}): ` }),
                    new TextRun({ text: formatWordCurrency(req.estimated_cost) })
                  ]
                })
              )
            ]
          }
        ]
      });

      const buffer = await Packer.toBuffer(doc);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="budget-summary-${timestamp}.docx"`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      return res.send(buffer);
    }

    if (format === 'excel' || format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [
        { header: 'Section', key: 'section', width: 20 },
        { header: 'Metric', key: 'metric', width: 25 },
        { header: `Value (${summary.currency})`, key: 'value', width: 20 }
      ];
      summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      const formatExcelCurrency = (value) =>
        new Intl.NumberFormat('en-KE', {
          style: 'currency',
          currency: summary.currency || DEFAULT_CURRENCY,
          minimumFractionDigits: 2
        }).format(value || 0);
      summarySheet.addRow({
        section: 'Combined',
        metric: 'Issue Total',
        value: formatExcelCurrency(summary.combined.total_issue_cost)
      });
      summarySheet.addRow({
        section: 'Combined',
        metric: 'Request Total',
        value: formatExcelCurrency(summary.combined.total_asset_request_cost)
      });
      summarySheet.addRow({
        section: 'Combined',
        metric: 'Overall Total',
        value: formatExcelCurrency(summary.combined.overall_total)
      });
      summarySheet.getRows(2, 3).forEach((row) => {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      });

      const issueSheet = workbook.addWorksheet('Issues');
      issueSheet.columns = [
        { header: 'Title', key: 'title', width: 40 },
        { header: 'Department', key: 'department', width: 25 },
        { header: 'Reported By', key: 'reported_by', width: 25 },
        { header: 'Status', key: 'status', width: 20 },
        { header: `Estimated Cost (${summary.currency})`, key: 'cost', width: 20 }
      ];
      issueSheet.getRow(1).font = { bold: true };

      // Add detailed issues
      detailedIssues.forEach(issue => {
        issueSheet.addRow({
          title: issue.title,
          department: issue.department_name || 'N/A',
          reported_by: issue.reported_by || 'Unknown',
          status: issue.status,
          cost: formatExcelCurrency(issue.estimated_cost)
        });
      });

      const requestSheet = workbook.addWorksheet('Asset Requests');
      requestSheet.columns = [
        { header: 'Asset Name', key: 'name', width: 40 },
        { header: 'Department', key: 'department', width: 25 },
        { header: 'Requester', key: 'requester', width: 25 },
        { header: 'Status', key: 'status', width: 20 },
        { header: `Estimated Cost (${summary.currency})`, key: 'cost', width: 20 }
      ];
      requestSheet.getRow(1).font = { bold: true };

      // Add detailed requests
      detailedRequests.forEach(req => {
        requestSheet.addRow({
          name: req.asset_name,
          department: req.department_name || 'N/A',
          requester: req.requester || 'Unknown',
          status: req.status,
          cost: formatExcelCurrency(req.estimated_cost)
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="budget-summary-${timestamp}.xlsx"`
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      return res.send(Buffer.from(buffer));
    }

    return res.status(400).json({ error: 'Unsupported export format' });
  } catch (error) {
    console.error('Budget export error:', error);
    res.status(500).json({
      error: 'Failed to export budget summary',
      message: error.message
    });
  }
});

export default router;
