import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { StatusReportService } from '../../services/status-report.service';
import { StatusReport, StatusReportSection } from '../../models/status-report.model';

@Component({
  selector: 'app-status-report-detail',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>{{ report?.reportNumber ?? 'Status Report' }}</h1>
          <p class="subtitle" *ngIf="report">
            {{ report.customerName }} &nbsp;·&nbsp;
            {{ formatDate(report.periodStart) }} – {{ formatDate(report.periodEnd) }}
          </p>
        </div>
        <a routerLink="/status-reports" class="btn-secondary">← Back to Reports</a>
      </div>

      <div class="loading-state" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Loading report...</p>
      </div>

      <div *ngIf="!loading && report">
        <!-- Report header card -->
        <div class="meta-card">
          <div class="meta-header">
            <img src="assets/nta-logo.jpg" alt="Notarangelo Technical Advisory" class="report-logo" />
            <h2 class="report-title">Status Report</h2>
          </div>
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Report Number</span>
              <span class="meta-value report-num">{{ report.reportNumber }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Customer</span>
              <span class="meta-value">{{ report.customerName }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Period</span>
              <span class="meta-value">{{ formatDate(report.periodStart) }} – {{ formatDate(report.periodEnd) }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Status</span>
              <span class="status-badge" [ngClass]="report.status">{{ report.status | titlecase }}</span>
            </div>
          </div>
        </div>

        <!-- AI-generated sections -->
        <div class="sections-list">
          <div class="report-section" *ngFor="let section of report.sections; let si = index">
            <h2 class="project-name">{{ section.projectName }}</h2>

            <div class="section-block">
              <h3 class="block-label">Activities</h3>
              <ul class="bullet-list">
                <li *ngFor="let item of section.activities; let ai = index" class="editable-item">
                  <span *ngIf="!isEditing(si, 'activity', ai)" (click)="startEdit(si, 'activity', ai, item)" class="item-text">{{ item }}</span>
                  <div *ngIf="isEditing(si, 'activity', ai)" class="edit-inline">
                    <textarea [(ngModel)]="editValue" rows="2" class="edit-input" (keydown.escape)="cancelEdit()" (keydown.enter)="$event.preventDefault(); saveEdit(si, 'activity', ai)"></textarea>
                    <div class="edit-actions">
                      <button class="btn-save-sm" (click)="saveEdit(si, 'activity', ai)">Save</button>
                      <button class="btn-cancel-sm" (click)="cancelEdit()">Cancel</button>
                      <button class="btn-delete-sm" (click)="deleteItem(si, 'activity', ai)">Delete</button>
                    </div>
                  </div>
                </li>
              </ul>
              <button class="btn-add-item" (click)="addItem(si, 'activity')">+ Add activity</button>
            </div>

            <div class="section-block">
              <h3 class="block-label">Outcomes</h3>
              <ul class="bullet-list outcomes">
                <li *ngFor="let item of section.outcomes; let oi = index" class="editable-item"
                    [class.actual]="item.startsWith('Actual:')"
                    [class.potential]="item.startsWith('Potential:')">
                  <span *ngIf="!isEditing(si, 'outcome', oi)" (click)="startEdit(si, 'outcome', oi, item)" class="item-text">{{ item }}</span>
                  <div *ngIf="isEditing(si, 'outcome', oi)" class="edit-inline">
                    <textarea [(ngModel)]="editValue" rows="2" class="edit-input" (keydown.escape)="cancelEdit()" (keydown.enter)="$event.preventDefault(); saveEdit(si, 'outcome', oi)"></textarea>
                    <div class="edit-actions">
                      <button class="btn-save-sm" (click)="saveEdit(si, 'outcome', oi)">Save</button>
                      <button class="btn-cancel-sm" (click)="cancelEdit()">Cancel</button>
                      <button class="btn-delete-sm" (click)="deleteItem(si, 'outcome', oi)">Delete</button>
                    </div>
                  </div>
                </li>
              </ul>
              <button class="btn-add-item" (click)="addItem(si, 'outcome')">+ Add outcome</button>
            </div>
          </div>
        </div>

        <!-- Actions toolbar -->
        <div class="actions-bar">
          <button
            class="btn-status"
            *ngIf="report.status === 'draft'"
            (click)="updateStatus('sent')">
            Mark as Sent
          </button>
          <button class="btn-export" (click)="downloadPDF()">
            <span *ngIf="exportingPDF" class="spinner-sm"></span>
            {{ exportingPDF ? 'Exporting...' : 'Export PDF' }}
          </button>
          <button class="btn-export" (click)="downloadDOCX()">
            <span *ngIf="exportingDOCX" class="spinner-sm"></span>
            {{ exportingDOCX ? 'Exporting...' : 'Export DOCX' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @import '../../../styles/tokens';
    @import '../../../styles/mixins';

    .page-container { max-width: $container-md; margin: 0 auto; }

    .page-header {
      @include flex-between;
      margin-bottom: $spacing-xl;
      align-items: flex-start;

      h1 {
        font-size: $font-size-3xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
        margin: 0 0 $spacing-xs 0;
      }
      .subtitle { color: $color-text-muted; margin: 0; font-size: $font-size-sm; }
    }

    .btn-secondary { @include button-secondary; text-decoration: none; white-space: nowrap; }

    /* Meta card */
    .meta-card {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      padding: $spacing-xl;
      margin-bottom: $spacing-xl;
    }
    .meta-header {
      display: flex;
      align-items: center;
      gap: $spacing-base;
      margin-bottom: $spacing-xl;
      padding-bottom: $spacing-base;
      border-bottom: $border-width-thin solid $color-border-light;
    }

    .report-logo {
      height: 40px;
      width: auto;
      object-fit: contain;
    }

    .report-title {
      font-size: $font-size-xl;
      font-weight: $font-weight-bold;
      color: $color-primary;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: $letter-spacing-wide;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: $spacing-base;

      @media (max-width: $breakpoint-tablet) { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: $breakpoint-mobile) { grid-template-columns: 1fr; }
    }
    .meta-item { display: flex; flex-direction: column; gap: $spacing-xs; }
    .meta-label {
      font-size: $font-size-sm;
      text-transform: uppercase;
      letter-spacing: $letter-spacing-wide;
      color: $color-text-muted;
    }
    .meta-value { font-weight: $font-weight-semibold; }
    .report-num { font-family: monospace; color: $color-primary; }

    .status-badge {
      @include badge-base;
      width: fit-content;
      &.draft { background: $color-gray-100; color: $color-text-muted; }
      &.sent  { background: $color-success-light; color: $color-success-text; }
    }

    /* Sections */
    .sections-list {
      display: flex;
      flex-direction: column;
      gap: $spacing-xl;
      margin-bottom: $spacing-xl;
    }

    .report-section {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      padding: $spacing-xl;
      border-left: 4px solid $color-primary;
    }

    .project-name {
      font-size: $font-size-xl;
      font-weight: $font-weight-bold;
      color: $color-primary;
      margin: 0 0 $spacing-base 0;
      padding-bottom: $spacing-sm;
      border-bottom: $border-width-thin solid $color-border-light;
    }

    .section-block {
      margin-bottom: $spacing-base;
      &:last-child { margin-bottom: 0; }
    }

    .block-label {
      font-size: $font-size-sm;
      font-weight: $font-weight-bold;
      text-transform: uppercase;
      letter-spacing: $letter-spacing-wide;
      color: $color-text-muted;
      margin: 0 0 $spacing-xs 0;
    }

    .bullet-list {
      list-style: disc;
      padding-left: $spacing-xl;
      margin: 0;
      color: $color-text-secondary;

      li {
        margin-bottom: $spacing-xs;
        line-height: $line-height-base;
        font-size: $font-size-base;
      }

      &.outcomes {
        li.actual   { color: $color-success-text; }
        li.potential { color: $color-primary; }
      }
    }

    /* Editable items */
    .editable-item {
      .item-text {
        cursor: pointer;
        border-radius: 4px;
        padding: 2px 4px;
        margin: -2px -4px;
        transition: background-color 0.15s;

        &:hover { background: $color-gray-100; }
      }
    }

    .edit-inline {
      display: flex;
      flex-direction: column;
      gap: $spacing-xs;
      margin: $spacing-xs 0;
    }

    .edit-input {
      width: 100%;
      padding: $spacing-sm;
      border: 1px solid $color-primary;
      border-radius: 4px;
      font-size: $font-size-base;
      font-family: inherit;
      line-height: $line-height-base;
      resize: vertical;
      outline: none;
      box-shadow: 0 0 0 2px rgba(30, 58, 138, 0.15);
    }

    .edit-actions {
      display: flex;
      gap: $spacing-xs;
    }

    .btn-save-sm, .btn-cancel-sm, .btn-delete-sm {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: $font-size-sm;
      border: none;
      cursor: pointer;
    }
    .btn-save-sm { background: $color-primary; color: white; &:hover { opacity: 0.9; } }
    .btn-cancel-sm { background: $color-gray-100; color: $color-text-secondary; &:hover { background: $color-gray-200; } }
    .btn-delete-sm { background: none; color: $color-danger; &:hover { background: rgba(239, 68, 68, 0.1); } }

    .btn-add-item {
      background: none;
      border: 1px dashed $color-border-light;
      color: $color-text-muted;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: $font-size-sm;
      cursor: pointer;
      margin-top: $spacing-xs;

      &:hover { border-color: $color-primary; color: $color-primary; }
    }

    /* Actions */
    .actions-bar {
      display: flex;
      gap: $spacing-sm;
      justify-content: flex-end;
      padding-top: $spacing-xl;
      border-top: $border-width-thin solid $color-border-light;
    }

    .btn-status {
      @include button-secondary;
    }

    .btn-export {
      @include button-primary;
      background: $color-success;
      border-color: $color-success;
      display: inline-flex;
      align-items: center;
      gap: $spacing-xs;

      &:hover { background: $color-success-text-dark; border-color: $color-success-text-dark; }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
    }

    .spinner-sm { @include spinner-sm; }

    .loading-state {
      text-align: center; padding: $spacing-3xl;
      .loading-spinner { @include spinner-base; margin: 0 auto $spacing-base; }
      p { color: $color-text-muted; }
    }
  `]
})
export class StatusReportDetailComponent implements OnInit {
  private statusReportService = inject(StatusReportService);
  private route = inject(ActivatedRoute);

  report: StatusReport | null = null;
  loading = true;
  exportingPDF = false;
  exportingDOCX = false;

  editKey: string | null = null;
  editValue = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.statusReportService.getStatusReport(id).subscribe(report => {
      this.report = report;
      this.loading = false;
    });
  }

  isEditing(sectionIdx: number, type: string, itemIdx: number): boolean {
    return this.editKey === `${sectionIdx}-${type}-${itemIdx}`;
  }

  startEdit(sectionIdx: number, type: string, itemIdx: number, value: string): void {
    this.editKey = `${sectionIdx}-${type}-${itemIdx}`;
    this.editValue = value;
  }

  cancelEdit(): void {
    this.editKey = null;
    this.editValue = '';
  }

  async saveEdit(sectionIdx: number, type: string, itemIdx: number): Promise<void> {
    if (!this.report || !this.editValue.trim()) return;
    const section = this.report.sections[sectionIdx];
    const arr = type === 'activity' ? section.activities : section.outcomes;
    arr[itemIdx] = this.editValue.trim();
    this.editKey = null;
    this.editValue = '';
    await this.statusReportService.updateSections(this.report.id, this.report.sections);
  }

  async deleteItem(sectionIdx: number, type: string, itemIdx: number): Promise<void> {
    if (!this.report) return;
    const section = this.report.sections[sectionIdx];
    const arr = type === 'activity' ? section.activities : section.outcomes;
    arr.splice(itemIdx, 1);
    this.editKey = null;
    this.editValue = '';
    await this.statusReportService.updateSections(this.report.id, this.report.sections);
  }

  async addItem(sectionIdx: number, type: string): Promise<void> {
    if (!this.report) return;
    const section = this.report.sections[sectionIdx];
    const arr = type === 'activity' ? section.activities : section.outcomes;
    const newIdx = arr.length;
    arr.push('');
    this.editKey = `${sectionIdx}-${type}-${newIdx}`;
    this.editValue = '';
  }

  async updateStatus(status: StatusReport['status']): Promise<void> {
    if (!this.report?.id) return;
    await this.statusReportService.updateStatus(this.report.id, status);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }

  async downloadPDF(): Promise<void> {
    if (!this.report) return;
    this.exportingPDF = true;
    try {
      await this.exportPDF(this.report);
    } finally {
      this.exportingPDF = false;
    }
  }

  async downloadDOCX(): Promise<void> {
    if (!this.report) return;
    this.exportingDOCX = true;
    try {
      await this.exportDOCX(this.report);
    } finally {
      this.exportingDOCX = false;
    }
  }

  private async exportPDF(report: StatusReport): Promise<void> {
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default ?? jsPDFModule;
    await import('jspdf-autotable');

    const doc = new jsPDF();

    // Header
    try {
      const response = await fetch('assets/nta-logo.jpg');
      const blob = await response.blob();
      const base64 = await new Promise<string>(res => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(blob);
      });
      doc.addImage(base64, 'JPEG', 14, 14, 40, 14);
    } catch {
      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
      doc.text('STATUS REPORT', 14, 22);
    }

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Notarangelo Technical Advisory', 14, 33);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Report #:', 140, 22);
    doc.text('Client:', 140, 29);
    doc.text('Period:', 140, 36);

    doc.setTextColor(30);
    doc.text(report.reportNumber, 165, 22);
    doc.text(report.customerName, 165, 29);
    doc.text(`${this.formatDate(report.periodStart)} – ${this.formatDate(report.periodEnd)}`, 165, 36);

    let yPos = 48;

    for (const section of report.sections) {
      if (yPos > 240) { doc.addPage(); yPos = 14; }

      (doc as any).autoTable({
        startY: yPos,
        head: [[section.projectName]],
        body: [],
        theme: 'plain',
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 11,
          cellPadding: 5
        },
        margin: { left: 14, right: 14 }
      });
      yPos = (doc as any).lastAutoTable.finalY + 5;

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text('ACTIVITIES', 14, yPos + 4);
      yPos += 8;

      for (const activity of section.activities) {
        if (yPos > 270) { doc.addPage(); yPos = 14; }
        doc.setFontSize(10);
        doc.setTextColor(50);
        const lines = doc.splitTextToSize(`• ${activity}`, 178);
        doc.text(lines, 18, yPos);
        yPos += lines.length * 5 + 2;
      }

      yPos += 4;

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text('OUTCOMES', 14, yPos + 4);
      yPos += 8;

      for (const outcome of section.outcomes) {
        if (yPos > 270) { doc.addPage(); yPos = 14; }
        doc.setFontSize(10);
        const isActual = outcome.startsWith('Actual:');
        doc.setTextColor(isActual ? 16 : 30, isActual ? 185 : 58, isActual ? 129 : 138);
        const lines = doc.splitTextToSize(`• ${outcome}`, 178);
        doc.text(lines, 18, yPos);
        yPos += lines.length * 5 + 2;
      }

      yPos += 10;
    }

    doc.save(`${report.reportNumber}.pdf`);
  }

  private async exportDOCX(report: StatusReport): Promise<void> {
    const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, ShadingType } =
      await import('docx');

    const children: InstanceType<typeof Paragraph>[] = [];

    // Logo
    try {
      const logoResponse = await fetch('assets/nta-logo.jpg');
      const logoBuffer = await logoResponse.arrayBuffer();
      children.push(new Paragraph({
        children: [
          new ImageRun({ data: logoBuffer, transformation: { width: 104, height: 50 }, type: 'jpg' }),
        ],
        spacing: { after: 120 }
      }));
    } catch {
      // fallback: no logo
    }

    // Title
    children.push(new Paragraph({
      children: [new TextRun({ text: 'STATUS REPORT', bold: true, color: '1E3A8A', size: 32 })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 80 }
    }));

    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'Report #: ', bold: true, size: 20 }),
        new TextRun({ text: report.reportNumber, size: 20 })
      ],
      spacing: { after: 40 }
    }));
    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'Client: ', bold: true, size: 20 }),
        new TextRun({ text: report.customerName, size: 20 })
      ],
      spacing: { after: 40 }
    }));
    children.push(new Paragraph({
      children: [
        new TextRun({ text: 'Period: ', bold: true, size: 20 }),
        new TextRun({
          text: `${this.formatDate(report.periodStart)} – ${this.formatDate(report.periodEnd)}`,
          size: 20
        })
      ],
      spacing: { after: 360 }
    }));

    for (const section of report.sections) {
      children.push(new Paragraph({
        children: [new TextRun({ text: section.projectName, bold: true, color: '1E3A8A', size: 24 })],
        heading: HeadingLevel.HEADING_1,
        shading: { type: ShadingType.SOLID, color: 'DBEAFE', fill: 'DBEAFE' },
        spacing: { before: 240, after: 120 }
      }));

      children.push(new Paragraph({
        children: [new TextRun({ text: 'Activities', bold: true, color: '334155', size: 20 })],
        spacing: { before: 120, after: 60 }
      }));

      for (const activity of section.activities) {
        children.push(new Paragraph({
          children: [new TextRun({ text: activity, size: 20, color: '0F172A' })],
          bullet: { level: 0 },
          spacing: { after: 60 }
        }));
      }

      children.push(new Paragraph({
        children: [new TextRun({ text: 'Outcomes', bold: true, color: '334155', size: 20 })],
        spacing: { before: 120, after: 60 }
      }));

      for (const outcome of section.outcomes) {
        const isActual = outcome.startsWith('Actual:');
        children.push(new Paragraph({
          children: [new TextRun({
            text: outcome,
            size: 20,
            color: isActual ? '065F46' : '1E3A8A'
          })],
          bullet: { level: 0 },
          spacing: { after: 60 }
        }));
      }

      children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
    }

    const docxDocument = new Document({ sections: [{ properties: {}, children }] });
    const blob = await Packer.toBlob(docxDocument);
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `${report.reportNumber}.docx`
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
