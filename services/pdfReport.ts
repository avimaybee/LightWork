import jsPDF from 'jspdf';
import type { Project, ImageJob } from '../types';

export interface ReportOptions {
  title?: string;
  subtitle?: string;
  notes?: string;
  includeModulePrompt?: boolean;
  selectedJobIds?: string[];
  orientation?: 'portrait' | 'landscape';
}

function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

async function toDataUrl(urlOrDataUrl: string): Promise<string> {
  if (urlOrDataUrl.startsWith('data:')) return urlOrDataUrl;

  try {
    const res = await fetch(urlOrDataUrl);
    if (!res.ok) throw new Error('Failed to fetch image');
    const blob = await res.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read image blob'));
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Image fetch failed', e);
    return ''; // Return empty string on failure to prevent report crash
  }
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

// Internal generator
async function createPdfDoc(project: Project, options: ReportOptions = {}): Promise<jsPDF> {
  const {
    title = `LightWork Report: ${project.name}`,
    subtitle = `Generated: ${new Date().toLocaleString()}`,
    notes = '',
    includeModulePrompt = true,
    selectedJobIds,
    orientation = 'portrait'
  } = options;

  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const gap = 18;

  // --- Title Page ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(title, margin, 70);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(subtitle, margin, 96);

  doc.setTextColor(0);

  let currentY = 150;

  if (notes) {
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(notes, pageW - margin * 2);
    doc.text(lines, margin, currentY);
    currentY += lines.length * 14 + 20;
  }

  if (includeModulePrompt && project.modulePrompt?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text('MODULE INSTRUCTIONS', margin, currentY);
    currentY += 14;

    doc.setFont('helvetica', 'normal');
    const prompt = truncate(project.modulePrompt, 1200);
    const lines = doc.splitTextToSize(prompt, pageW - margin * 2);
    doc.text(lines, margin, currentY);
    currentY += lines.length * 12 + 20;
  }

  // Filter jobs
  let jobs = project.jobs;
  if (selectedJobIds) {
    jobs = jobs.filter(j => selectedJobIds.includes(j.id));
  }
  // Only completed jobs usually
  const jobsWithAfter = jobs.filter(j => !!getBeforeAfter(j).after);

  doc.setFontSize(12);
  doc.text(`${jobsWithAfter.length} Processed Items`, margin, currentY + 10);
  currentY += 40;


  // --- Job Pages ---
  for (let i = 0; i < jobsWithAfter.length; i++) {
    const job = jobsWithAfter[i];
    const { before, after } = getBeforeAfter(job);
    if (!after) continue;

    doc.addPage();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(truncate(job.fileName || 'Image', 80), margin, 48);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    if (job.localPrompt?.trim()) {
      const prompt = truncate(job.localPrompt, 500);
      const lines = doc.splitTextToSize(prompt, pageW - margin * 2);
      doc.text(lines, margin, 66);
    }

    const topY = 100;
    // Calculate layout based on orientation? For now stick to side-by-side
    const boxW = (pageW - margin * 2 - gap) / 2;
    // Let's maximize height available
    const boxH = pageH - topY - 60;

    const beforeX = margin;
    const afterX = margin + boxW + gap;

    doc.setDrawColor(230);
    doc.setFillColor(250);
    doc.rect(beforeX, topY, boxW, boxH, 'F');
    doc.rect(afterX, topY, boxW, boxH, 'F');
    doc.rect(beforeX, topY, boxW, boxH, 'S');
    doc.rect(afterX, topY, boxW, boxH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text('ORIGINAL', beforeX + 5, topY - 6);
    doc.text('PROCESSED', afterX + 5, topY - 6);

    const addFitImage = async (dataUrl: string, x: number, y: number, wBox: number, hBox: number) => {
      if (!dataUrl) return;
      const props = doc.getImageProperties(dataUrl);
      const iw = props.width || 1;
      const ih = props.height || 1;
      const scale = Math.min(wBox / iw, hBox / ih);
      const w = iw * scale;
      const h = ih * scale;
      const cx = x + (wBox - w) / 2;
      const cy = y + (hBox - h) / 2;
      doc.addImage(dataUrl, props.fileType || 'PNG', cx, cy, w, h);
    };

    if (before) {
      const b = await toDataUrl(before);
      await addFitImage(b, beforeX, topY, boxW, boxH);
    }

    const a = await toDataUrl(after);
    await addFitImage(a, afterX, topY, boxW, boxH);
  }

  return doc;
}

export async function generateProjectPdfReport(project: Project, options?: ReportOptions): Promise<void> {
  const doc = await createPdfDoc(project, options);
  const fileName = sanitizeFileName(`LightWork_Report_${options?.title || project.name}.pdf`);
  doc.save(fileName);
}

export async function generateReportBlob(project: Project, options?: ReportOptions): Promise<string> {
  const doc = await createPdfDoc(project, options);
  return doc.output('bloburl');
}
