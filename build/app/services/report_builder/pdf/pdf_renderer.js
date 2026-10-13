import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { REPORT_BLOC_TYPE } from '#constants/report_builder.constants';
import { drawChart } from '#services/report_builder/pdf/pdf_charts';
import { formatKpiUnit, formatKpiValue, formatTableCell, getPdfCopy, } from '#services/report_builder/pdf/pdf_copy';
import { contentBottom, contentLeft, contentWidth, fitPdfText, PDF_THEME, } from '#services/report_builder/pdf/pdf_theme';
const isGraphContent = (content) => 'charts' in content && Array.isArray(content.charts);
const isKpiContent = (content) => 'groups' in content && Array.isArray(content.groups);
const isTableContent = (content) => 'rows' in content && Array.isArray(content.rows) && 'columns' in content;
const isTextContent = (content) => 'text' in content &&
    typeof content.text === 'string' &&
    !('charts' in content) &&
    !('columns' in content);
const slugify = (value) => {
    const slug = value
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 48)
        .toLowerCase();
    return slug || 'report';
};
export const buildReportPdfFilename = (title, dateRange) => `${slugify(title?.trim() || 'report')}-${dateRange.from}_${dateRange.to}.pdf`;
const toBuffer = (doc) => new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
});
const WATERMARK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'rapport-watermark-a4.png');
const drawWatermark = (doc) => {
    doc.save();
    doc.image(WATERMARK_PATH, 0, 0, {
        width: PDF_THEME.pageWidth,
        height: PDF_THEME.pageHeight,
    });
    doc.restore();
};
const drawHeader = (session) => {
    const { doc, copy, clubName } = session;
    doc.rect(0, 0, PDF_THEME.pageWidth, PDF_THEME.headerHeight).fillColor(PDF_THEME.navy).fill();
    doc
        .rect(0, PDF_THEME.headerHeight - 3, PDF_THEME.pageWidth, 3)
        .fillColor(PDF_THEME.gold)
        .fill();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(PDF_THEME.white);
    const club = fitPdfText(doc, clubName.trim() || copy.brand, 240);
    doc.text(club, PDF_THEME.marginX, 16, { lineBreak: false });
    doc.font('Helvetica').fontSize(8);
    const right = `${copy.brand}  |  ${copy.confidential}`;
    const rightWidth = doc.widthOfString(right);
    doc.fillColor('#D6DEE8').text(right, PDF_THEME.pageWidth - PDF_THEME.marginX - rightWidth, 18, {
        lineBreak: false,
    });
};
const drawFooter = (session, current, total) => {
    const { doc, copy, generatedAt } = session;
    const y = PDF_THEME.pageHeight - PDF_THEME.footerHeight;
    doc
        .moveTo(PDF_THEME.marginX, y)
        .lineTo(PDF_THEME.pageWidth - PDF_THEME.marginX, y)
        .strokeColor(PDF_THEME.line)
        .lineWidth(0.6)
        .stroke();
    doc.font('Helvetica').fontSize(8).fillColor(PDF_THEME.muted);
    doc.text(copy.generatedAt(generatedAt), PDF_THEME.marginX, y + 10, { lineBreak: false });
    const pageLabel = copy.page(current, total);
    const pageWidth = doc.widthOfString(pageLabel);
    doc.text(pageLabel, PDF_THEME.pageWidth - PDF_THEME.marginX - pageWidth, y + 10, {
        lineBreak: false,
    });
};
const addPage = (session) => {
    session.doc.addPage();
    drawWatermark(session.doc);
    drawHeader(session);
    session.y = PDF_THEME.headerHeight + 18;
};
const ensureSpace = (session, height) => {
    if (session.y + height <= contentBottom())
        return;
    addPage(session);
};
const drawTitleBlock = (session, document) => {
    const title = document.title?.trim() || session.copy.untitled;
    session.doc.font('Helvetica-Bold').fontSize(18).fillColor(PDF_THEME.text);
    session.doc.text(fitPdfText(session.doc, title, contentWidth()), contentLeft(), session.y, {
        lineBreak: false,
    });
    session.y += 24;
    session.doc.font('Helvetica').fontSize(10).fillColor(PDF_THEME.muted);
    session.doc.text(session.copy.dateRange(document.dateRange), contentLeft(), session.y, {
        lineBreak: false,
    });
    session.y += 18;
    session.doc
        .moveTo(contentLeft(), session.y)
        .lineTo(contentLeft() + contentWidth(), session.y)
        .strokeColor(PDF_THEME.line)
        .lineWidth(0.8)
        .stroke();
    session.y += PDF_THEME.titleGap;
};
const drawChartTitle = (session, title, x, width) => {
    if (!title.trim())
        return;
    session.doc.font('Helvetica-Bold').fontSize(9).fillColor(PDF_THEME.text);
    session.doc.text(fitPdfText(session.doc, title, width), x, session.y, { lineBreak: false });
};
const drawEmptyHint = (session) => {
    ensureSpace(session, 28);
    session.doc.font('Helvetica').fontSize(9).fillColor(PDF_THEME.muted);
    session.doc.text(session.copy.noData, contentLeft(), session.y);
    session.y += 24;
};
const drawCartesianCharts = (session, charts) => {
    const height = PDF_THEME.chartTitleHeight + PDF_THEME.cartesianHeight;
    for (const chart of charts) {
        ensureSpace(session, height);
        drawChartTitle(session, chart.title, contentLeft(), contentWidth());
        const chartY = session.y + PDF_THEME.chartTitleHeight;
        drawChart(session.doc, chart, {
            x: contentLeft(),
            y: chartY,
            width: contentWidth(),
            height: PDF_THEME.cartesianHeight,
        }, session.copy.noData, session.language);
        session.y = chartY + PDF_THEME.cartesianHeight + PDF_THEME.blocGap;
    }
};
const drawPieCharts = (session, charts) => {
    const cols = charts.length > 1 ? 2 : 1;
    const gap = 16;
    const cellWidth = cols === 1 ? contentWidth() : (contentWidth() - gap) / 2;
    const cellHeight = PDF_THEME.chartTitleHeight + PDF_THEME.pieHeight;
    for (let index = 0; index < charts.length; index += cols) {
        ensureSpace(session, cellHeight);
        const rowY = session.y;
        const row = charts.slice(index, index + cols);
        row.forEach((chart, col) => {
            const x = contentLeft() + col * (cellWidth + gap);
            session.y = rowY;
            drawChartTitle(session, chart.title, x, cellWidth);
            drawChart(session.doc, chart, {
                x,
                y: rowY + PDF_THEME.chartTitleHeight,
                width: cellWidth,
                height: PDF_THEME.pieHeight,
            }, session.copy.noData, session.language);
        });
        session.y = rowY + cellHeight + PDF_THEME.blocGap;
    }
};
const drawKpiCard = (session, x, y, width, label, value, unit) => {
    const { doc } = session;
    doc.roundedRect(x, y, width, PDF_THEME.kpiCardHeight, 4).fillColor(PDF_THEME.card).fill();
    doc
        .roundedRect(x, y, width, PDF_THEME.kpiCardHeight, 4)
        .strokeColor(PDF_THEME.cardBorder)
        .lineWidth(0.6)
        .stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(PDF_THEME.muted);
    doc.text(fitPdfText(doc, label, width - 16), x + 8, y + 8, {
        width: width - 16,
        lineBreak: false,
    });
    doc.font('Helvetica-Bold').fontSize(13).fillColor(PDF_THEME.text);
    const valueWidth = doc.widthOfString(value);
    doc.text(value, x + 8, y + 24, { lineBreak: false });
    if (unit) {
        doc.font('Helvetica').fontSize(8).fillColor(PDF_THEME.muted);
        doc.text(unit, x + 10 + valueWidth, y + 28, { lineBreak: false });
    }
};
const drawKpiGroup = (session, group) => {
    const items = group.items;
    if (items.length === 0)
        return;
    if (group.label) {
        ensureSpace(session, 16 + PDF_THEME.kpiCardHeight);
        session.doc.font('Helvetica-Bold').fontSize(9).fillColor(PDF_THEME.text);
        session.doc.text(fitPdfText(session.doc, group.label, contentWidth()), contentLeft(), session.y, {
            lineBreak: false,
        });
        session.y += 16;
    }
    const cols = 3;
    const gap = PDF_THEME.kpiGap;
    const cardWidth = (contentWidth() - gap * (cols - 1)) / cols;
    for (let index = 0; index < items.length; index += cols) {
        ensureSpace(session, PDF_THEME.kpiCardHeight + gap);
        const row = items.slice(index, index + cols);
        row.forEach((item, col) => {
            const x = contentLeft() + col * (cardWidth + gap);
            drawKpiCard(session, x, session.y, cardWidth, item.label, formatKpiValue(item.value, session.language, item.unit), formatKpiUnit(item.value, item.unit, session.language));
        });
        session.y += PDF_THEME.kpiCardHeight + gap;
    }
    session.y += 6;
};
const drawGraphBloc = (session, bloc) => {
    if (!isGraphContent(bloc.content) || bloc.content.charts.length === 0) {
        drawEmptyHint(session);
        return;
    }
    const charts = bloc.content.charts;
    if (bloc.type === REPORT_BLOC_TYPE.PIE_CHART) {
        drawPieCharts(session, charts);
        return;
    }
    drawCartesianCharts(session, charts);
};
const drawKpiBloc = (session, bloc) => {
    if (!isKpiContent(bloc.content)) {
        drawEmptyHint(session);
        return;
    }
    const groups = bloc.content.groups.filter((group) => group.items.length > 0);
    if (groups.length === 0) {
        drawEmptyHint(session);
        return;
    }
    for (const group of groups)
        drawKpiGroup(session, group);
};
const TABLE_COL_WEIGHTS = {
    player: 1.4,
    injury: 1.6,
    location: 1.1,
    from: 0.9,
    to: 0.9,
    status: 0.8,
    context: 0.9,
};
const drawTableBloc = (session, bloc) => {
    if (!isTableContent(bloc.content) || bloc.content.rows.length === 0) {
        drawEmptyHint(session);
        return;
    }
    const { columns, rows, title } = bloc.content;
    const weights = columns.map((column) => TABLE_COL_WEIGHTS[column.key] ?? 1);
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    const widths = weights.map((weight) => (contentWidth() * weight) / weightSum);
    const rowHeight = 16;
    if (title) {
        ensureSpace(session, 16 + rowHeight * 2);
        session.doc.font('Helvetica-Bold').fontSize(9).fillColor(PDF_THEME.text);
        session.doc.text(fitPdfText(session.doc, title, contentWidth()), contentLeft(), session.y, {
            lineBreak: false,
        });
        session.y += 14;
    }
    const drawRow = (cells, header) => {
        ensureSpace(session, rowHeight);
        let x = contentLeft();
        session.doc
            .font(header ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(7)
            .fillColor(header ? PDF_THEME.muted : PDF_THEME.text);
        for (let index = 0; index < columns.length; index++) {
            const width = widths[index] ?? 0;
            session.doc.text(fitPdfText(session.doc, cells[index] ?? '', width - 6), x + 2, session.y, {
                width: width - 6,
                lineBreak: false,
            });
            x += width;
        }
        session.y += rowHeight;
        session.doc
            .moveTo(contentLeft(), session.y - 3)
            .lineTo(contentLeft() + contentWidth(), session.y - 3)
            .strokeColor(PDF_THEME.line)
            .lineWidth(0.4)
            .stroke();
    };
    drawRow(columns.map((column) => session.copy.table.columns[column.key] ?? column.label), true);
    for (const row of rows) {
        drawRow(columns.map((column) => formatTableCell(session.copy, session.language, column.key, row.cells[column.key] ?? '')), false);
    }
    session.y += 8;
};
const drawTextBloc = (session, bloc) => {
    const raw = isTextContent(bloc.content) ? bloc.content.text : (bloc.text ?? '');
    const text = raw
        .replace(/\*\*/g, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\r\n/g, '\n')
        .trim();
    if (!text)
        return;
    const width = contentWidth();
    session.doc.font('Helvetica').fontSize(9).fillColor(PDF_THEME.text);
    const lineHeight = 12;
    const paragraphs = text.split('\n');
    for (const paragraph of paragraphs) {
        if (!paragraph.trim()) {
            session.y += 6;
            continue;
        }
        const words = paragraph.split(/\s+/);
        let current = '';
        for (const word of words) {
            const next = current ? `${current} ${word}` : word;
            if (session.doc.widthOfString(next) <= width) {
                current = next;
                continue;
            }
            ensureSpace(session, lineHeight);
            session.doc.text(current, contentLeft(), session.y, { lineBreak: false });
            session.y += lineHeight;
            current = word;
        }
        if (current) {
            ensureSpace(session, lineHeight);
            session.doc.text(current, contentLeft(), session.y, { lineBreak: false });
            session.y += lineHeight;
        }
    }
    session.y += 10;
};
const drawBloc = (session, bloc) => {
    if (bloc.type === REPORT_BLOC_TYPE.TEXT) {
        drawTextBloc(session, bloc);
        return;
    }
    if (bloc.type === REPORT_BLOC_TYPE.KPI) {
        drawKpiBloc(session, bloc);
        return;
    }
    if (bloc.type === REPORT_BLOC_TYPE.TABLE) {
        drawTableBloc(session, bloc);
        return;
    }
    drawGraphBloc(session, bloc);
};
const paintFooters = (session) => {
    const range = session.doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        session.doc.switchToPage(range.start + i);
        drawFooter(session, i + 1, range.count);
    }
};
export const renderReportPdf = async (document, context) => {
    const copy = getPdfCopy(context.language);
    const title = document.title?.trim() || copy.untitled;
    const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        bufferPages: true,
        info: {
            Title: title,
            Author: copy.brand,
            Creator: copy.brand,
            CreationDate: context.generatedAt.toJSDate(),
        },
    });
    const pending = toBuffer(doc);
    const session = {
        doc,
        copy,
        language: context.language,
        clubName: context.clubName,
        generatedAt: context.generatedAt,
        y: PDF_THEME.headerHeight + 20,
    };
    drawWatermark(session.doc);
    drawHeader(session);
    drawTitleBlock(session, document);
    if (document.blocs.length === 0) {
        drawEmptyHint(session);
    }
    else {
        for (const bloc of document.blocs)
            drawBloc(session, bloc);
    }
    paintFooters(session);
    doc.end();
    return {
        buffer: await pending,
        filename: buildReportPdfFilename(title, document.dateRange),
    };
};
//# sourceMappingURL=pdf_renderer.js.map