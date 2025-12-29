import jsPDF from 'jspdf';
import type { Project, ImageJob } from '../types';

function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

async function toDataUrl(urlOrDataUrl: string): Promise<string> {
  if (urlOrDataUrl.startsWith('data:')) return urlOrDataUrl;

  const res = await fetch(urlOrDataUrl);
  if (!res.ok) throw new Error('Failed to fetch image');
  const blob = await res.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

function truncate(text: string, maxChars: number): string {
  const t = (text || '').trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars - 1) + '…';
}

function getBeforeAfter(job: ImageJob): { before?: string; after?: string } {
  const before = job.originalUrl || job.thumbnailUrl;
  const after = job.resultUrl;
  return { before, after };
}

export async function generateProjectPdfReport(project: Project): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const margin = 40;
  const gap = 18;

  // Cover
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('LightWork Report', margin, 70);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(`Project: ${project.name}`, margin, 96);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 114);
  doc.text(`Images: ${project.jobs.length}`, margin, 132);

  if (project.modulePrompt?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.text('Module Prompt', margin, 170);
    doc.setFont('helvetica', 'normal');
    const prompt = truncate(project.modulePrompt, 1200);
    const lines = doc.splitTextToSize(prompt, pageW - margin * 2);
    doc.text(lines, margin, 190);
  }

  const jobsWithAfter = project.jobs.filter(j => !!getBeforeAfter(j).after);

  for (let i = 0; i < jobsWithAfter.length; i++) {
    const job = jobsWithAfter[i];
    const { before, after } = getBeforeAfter(job);
    if (!after) continue;

    doc.addPage();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(truncate(job.fileName || 'Image', 80), margin, 48);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    if (job.localPrompt?.trim()) {
      const prompt = truncate(job.localPrompt, 500);
      const lines = doc.splitTextToSize(prompt, pageW - margin * 2);
      doc.text(lines, margin, 68);
    }

    const topY = 120;
    const boxW = (pageW - margin * 2 - gap) / 2;
    const boxH = Math.min(320, pageH - topY - 140);

    const beforeX = margin;
    const afterX = margin + boxW + gap;

    doc.setDrawColor(210);
    doc.rect(beforeX, topY, boxW, boxH);
    doc.rect(afterX, topY, boxW, boxH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Before', beforeX, topY - 8);
    doc.text('After', afterX, topY - 8);

    const addFitImage = async (dataUrl: string, x: number, y: number) => {
      const props = doc.getImageProperties(dataUrl);
      const iw = props.width || 1;
      const ih = props.height || 1;
      const scale = Math.min(boxW / iw, boxH / ih);
      const w = iw * scale;
      const h = ih * scale;
      const cx = x + (boxW - w) / 2;
      const cy = y + (boxH - h) / 2;
      doc.addImage(dataUrl, props.fileType || 'PNG', cx, cy, w, h);
    };

    if (before) {
      try {
        const b = await toDataUrl(before);
        await addFitImage(b, beforeX, topY);
      } catch {
        // ignore missing before
      }
    }

    try {
      const a = await toDataUrl(after);
      await addFitImage(a, afterX, topY);
    } catch {
      // ignore missing after
    }
  }

  const fileName = sanitizeFileName(`LightWork_Report_${project.name}_${new Date().toISOString().slice(0, 10)}.pdf`);
  doc.save(fileName);
}
