// Builds a downloadable PDF score report from a graded result.
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { LETTERS, formatDate, formatDuration } from './format.js';

const NAVY = [30, 42, 90];
const GOLD = [242, 193, 78];
const GREEN = [21, 128, 61];
const RED = [185, 28, 28];
const GREY = [100, 116, 139];

// The built-in PDF fonts only cover Latin-1, so swap typographic characters
// for plain equivalents instead of letting them render as garbage.
function clean(text) {
  return String(text ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

function answerText(q, optionId) {
  if (optionId === null || optionId === undefined) return 'Not answered';
  const i = q.options.findIndex((o) => o.id === optionId);
  return `${LETTERS[i]}. ${clean(q.options[i].text)}`;
}

export function exportResultPdf(result, { includeReview = true } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  const isMock = result.mode === 'mock';

  // Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 86, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 86, W, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Notary Exam Score Report', M, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(clean(`${result.stateName} notary public - ${isMock ? 'Timed mock exam' : 'Topic practice'}`), M, 64);

  // Score summary
  let y = 124;
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.text(`${result.percent}%`, M, y + 8);
  const scoreW = doc.getTextWidth(`${result.percent}%`);
  if (isMock) {
    const label = result.passed ? 'PASSED' : 'NOT PASSED';
    doc.setFontSize(11);
    const lw = doc.getTextWidth(label) + 20;
    doc.setFillColor(...(result.passed ? GREEN : RED));
    doc.roundedRect(M + scoreW + 16, y - 14, lw, 22, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(label, M + scoreW + 26, y + 1);
  }

  const facts = [
    ['Score', `${result.correct} of ${result.total} correct`],
    ['Answered', `${result.answered} of ${result.total}`],
    isMock ? ['Passing score', `${result.passPercent}%`] : ['Topics', result.topics.length > 3 ? `${result.topics.length} topics` : clean(result.topics.map((t) => t.name).join(', '))],
    ['Time used', `${formatDuration(result.timeUsedSeconds)}${isMock ? ` of ${formatDuration(result.durationSeconds)}` : ''}${result.timedOut ? ' (time expired)' : ''}`],
    ['Completed', formatDate(result.submittedAt)],
  ];
  autoTable(doc, {
    startY: y + 26,
    margin: { left: M, right: M },
    theme: 'plain',
    body: facts,
    styles: { fontSize: 10, cellPadding: { top: 3, bottom: 3, left: 0, right: 8 } },
    columnStyles: { 0: { textColor: GREY, cellWidth: 110 }, 1: { fontStyle: 'bold', textColor: [31, 41, 55] } },
  });

  // Topic breakdown
  y = doc.lastAutoTable.finalY + 24;
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Results by topic', M, y);
  autoTable(doc, {
    startY: y + 8,
    margin: { left: M, right: M },
    head: [['Topic', 'Correct', 'Questions', 'Score']],
    body: result.byTopic.map((t) => [clean(t.name), t.correct, t.total, `${t.percent}%`]),
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: { 1: { halign: 'center', cellWidth: 70 }, 2: { halign: 'center', cellWidth: 80 }, 3: { halign: 'right', cellWidth: 70, fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [246, 247, 251] },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 3) {
        const pct = result.byTopic[d.row.index].percent;
        d.cell.styles.textColor = pct >= (result.passPercent ?? 70) ? GREEN : RED;
      }
    },
  });

  // Question review
  if (includeReview) {
    doc.addPage();
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Question review', M, 50);
    const body = [];
    result.questions.forEach((q, n) => {
      const status = q.selected === null ? 'Skipped' : q.isCorrect ? 'Correct' : 'Incorrect';
      body.push([
        String(n + 1),
        { content: `${clean(q.text)}\n\n${clean(q.topicName)}`, styles: { fontStyle: 'normal' } },
        answerText(q, q.selected),
        answerText(q, q.correctOptionId),
        status,
      ]);
      body.push([
        '',
        { content: [
          `Why: ${clean(q.explanation)}${q.source ? `  [${clean(q.source)}]` : ''}`,
          ...(q.refs ?? []).map((r) => `Read: ${clean(r.title)} ${r.url}`),
          // Per-option notes, in the order the options were shown (older results may not have them).
          ...(q.optionExplanations ? q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${clean(q.optionExplanations[o.id])}`) : []),
        ].join('\n'), colSpan: 4, styles: { fontSize: 8, textColor: GREY, fontStyle: 'italic', cellPadding: { top: 0, bottom: 8, left: 6, right: 6 } } },
      ]);
    });
    autoTable(doc, {
      startY: 62,
      margin: { left: M, right: M, top: 50 },
      head: [['#', 'Question', 'Your answer', 'Correct answer', 'Result']],
      body,
      headStyles: { fillColor: NAVY, textColor: 255 },
      styles: { fontSize: 9, cellPadding: 6, valign: 'top', overflow: 'linebreak' },
      columnStyles: { 0: { cellWidth: 24, halign: 'center' }, 1: { cellWidth: 190 }, 4: { cellWidth: 58, fontStyle: 'bold' } },
      rowPageBreak: 'avoid',
      didParseCell: (d) => {
        if (d.section !== 'body') return;
        // Keep each question and its explanation visually grouped.
        d.cell.styles.fillColor = Math.floor(d.row.index / 2) % 2 ? [246, 247, 251] : [255, 255, 255];
        if (d.column.index === 4 && d.row.index % 2 === 0) {
          d.cell.styles.textColor = d.cell.raw === 'Correct' ? GREEN : d.cell.raw === 'Skipped' ? GREY : RED;
        }      },
    });
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  const H = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text('Study aid only - not legal advice. Confirm rules against your state\'s current official notary publications.', M, H - 24);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 24, { align: 'right' });
  }

  const stamp = result.submittedAt.slice(0, 10);
  doc.save(`notary-${result.state.toLowerCase()}-${result.mode}-${stamp}.pdf`);
}
