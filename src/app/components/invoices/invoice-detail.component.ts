import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InvoiceService, ReopenBlocker } from '../../services/invoice.service';
import { Invoice, InvoiceLineItem } from '../../models/invoice.model';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
    selector: 'app-invoice-detail',
    imports: [CommonModule, RouterLink],
    template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>{{ invoice?.invoiceNumber || 'Invoice' }}</h1>
          <span class="status-badge" *ngIf="invoice" [ngClass]="invoice.status">
            {{ invoice.status | titlecase }}
          </span>
        </div>
        <div class="header-actions">
          <button class="btn-secondary" (click)="downloadPDF()" *ngIf="invoice">Download PDF</button>
          <a routerLink="/invoices" class="btn-secondary">Back to Invoices</a>
        </div>
      </div>

      <div class="loading-state" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Loading invoice...</p>
      </div>

      <div *ngIf="!loading && invoice" class="invoice-card">
        <div class="invoice-header">
          <div class="invoice-from">
            <img src="assets/nta-logo.jpg" alt="NTA Logo" class="invoice-logo">
            <p>Notarangelo Technical Advisory</p>
          </div>
          <div class="invoice-to">
            <h4>Bill To</h4>
            <p class="customer-name">{{ invoice.customerName }}</p>
          </div>
        </div>

        <div class="invoice-meta">
          <div class="meta-item">
            <span class="meta-label">Invoice #</span>
            <span class="meta-value">{{ invoice.invoiceNumber }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Issue Date</span>
            <span class="meta-value">{{ formatDate(invoice.issueDate) }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Due Date</span>
            <span class="meta-value">{{ formatDate(invoice.dueDate) }}</span>
          </div>
        </div>

        <div class="invoice-section-header">
          <h3>Summary</h3>
        </div>
        <table class="line-items-table summary-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Total Hours</th>
              <th>Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of invoiceSummaryRows">
              <td>{{ row.projectName }}</td>
              <td>{{ row.hours }}</td>
              <td>\${{ row.rate.toFixed(2) }}/hr</td>
              <td class="text-right">\${{ row.amount.toFixed(2) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3">Total</td>
              <td class="text-right">\${{ invoice.total.toFixed(2) }}</td>
            </tr>
          </tfoot>
        </table>

        <div class="invoice-section-header">
          <h3>Details</h3>
        </div>
        <table class="line-items-table details-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Hours</th>
              <th>Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <ng-container *ngFor="let group of groupedLineItems">
              <tr class="project-header-row">
                <td colspan="4">{{ group.projectName }}</td>
              </tr>
              <ng-container *ngFor="let item of group.items">
                <tr>
                  <td class="date-cell">{{ getDatePart(item.description) }}</td>
                  <td>{{ item.hours }}</td>
                  <td>\${{ item.rate.toFixed(2) }}/hr</td>
                  <td class="text-right">\${{ item.amount.toFixed(2) }}</td>
                </tr>
                <tr *ngIf="getDescriptionPart(item.description)" class="desc-row">
                  <td colspan="4" class="desc-cell">{{ getDescriptionPart(item.description) }}</td>
                </tr>
              </ng-container>
            </ng-container>
          </tbody>
        </table>

        <div class="invoice-notes" *ngIf="invoice.notes">
          <h4>Notes</h4>
          <p>{{ invoice.notes }}</p>
        </div>

        <div class="invoice-actions" *ngIf="invoice.status !== 'cancelled' && invoice.status !== 'paid'">
          <button class="btn-action-status" *ngIf="invoice.status === 'draft'" (click)="updateStatus('sent')">
            Mark as Sent
          </button>
          <button class="btn-action-status btn-success" *ngIf="invoice.status === 'sent' || invoice.status === 'overdue'" (click)="updateStatus('paid')">
            Mark as Paid
          </button>
          <button class="btn-action-status btn-danger-outline" (click)="showCancelConfirm = true">
            Cancel Invoice
          </button>
        </div>

        <div class="invoice-actions" *ngIf="invoice.status === 'cancelled'">
          <button class="btn-action-status" (click)="reopen()" [disabled]="reopening">
            {{ reopening ? 'Reopening...' : 'Reopen Invoice' }}
          </button>
          <span class="action-hint">Returns this invoice to draft and re-bills its time entries.</span>
        </div>
      </div>

      <!-- Cancel confirmation -->
      <div class="modal-overlay" *ngIf="showCancelConfirm && invoice" (click)="showCancelConfirm = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Cancel Invoice</h3>
          <p>
            This voids <strong>{{ invoice.invoiceNumber }}</strong> and returns its
            {{ invoice.timeEntryIds.length }}
            {{ invoice.timeEntryIds.length === 1 ? 'time entry' : 'time entries' }}
            ({{ totalHours }} hrs) to the unbilled pool, where they can be put on a new invoice.
          </p>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="showCancelConfirm = false">Keep Invoice</button>
            <button class="btn-danger" (click)="cancelInvoice()" [disabled]="cancelling">
              {{ cancelling ? 'Cancelling...' : 'Cancel Invoice' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Reopen refused: entries are no longer free to re-bill -->
      <div class="modal-overlay" *ngIf="reopenBlockers" (click)="reopenBlockers = null">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Can't Reopen This Invoice</h3>
          <p>
            {{ reopenBlockers.length }} of its
            {{ reopenBlockers.length === 1 ? 'time entry is' : 'time entries are' }}
            no longer free to bill. Reopening would charge the same hours twice.
          </p>
          <ul class="blocker-list">
            <li *ngFor="let blocker of reopenBlockers">
              <ng-container *ngIf="blocker.date; else unknownEntry">
                {{ formatDate(blocker.date) }} ({{ blocker.hours }} hrs)
              </ng-container>
              <ng-template #unknownEntry>This invoice's entry</ng-template>
              <ng-container [ngSwitch]="blocker.reason">
                <span *ngSwitchCase="'missing'">was deleted.</span>
                <span *ngSwitchCase="'claimed'">
                  <ng-container *ngIf="blocker.claimedBy; else notUnbilled">
                    is already on {{ blocker.claimedBy }}.
                  </ng-container>
                  <ng-template #notUnbilled>is no longer unbilled.</ng-template>
                </span>
              </ng-container>
            </li>
          </ul>
          <p class="modal-footnote">
            To rebill this work, remove those entries from the other invoice first, or
            generate a new invoice for whatever is still unbilled.
          </p>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="reopenBlockers = null">Close</button>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    @import '../../../styles/tokens';
    @import '../../../styles/mixins';

    .page-container {
      max-width: $container-md;
      margin: 0 auto;
    }

    .page-header {
      @include flex-between;
      margin-bottom: $spacing-xl;

      h1 {
        font-size: $font-size-3xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
        margin: 0;
        display: inline;
        margin-right: $spacing-base;
      }
    }

    .header-actions {
      display: flex;
      gap: $spacing-sm;
    }

    .btn-secondary { @include button-secondary; text-decoration: none; }

    .status-badge {
      @include badge-base;
      font-size: $font-size-sm;
      vertical-align: middle;

      &.draft { background: $color-gray-100; color: $color-text-muted; }
      &.sent { background: $color-primary-light; color: $color-primary; }
      &.paid { background: $color-success-light; color: $color-success-text; }
      &.overdue { background: $color-danger-light; color: $color-danger-text; }
      &.cancelled { background: $color-gray-100; color: $color-text-muted; text-decoration: line-through; }
    }

    .invoice-card {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      padding: $spacing-2xl;
    }

    .invoice-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: $spacing-2xl;
      padding-bottom: $spacing-xl;
      border-bottom: 2px solid $color-primary;

      .invoice-from { text-align: center; }

      .invoice-logo {
        max-height: 48px;
        width: auto;
        display: block;
        margin: 0 auto $spacing-xs;
      }

      h3 {
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
        color: $color-primary;
        margin: 0 0 $spacing-xs 0;
      }

      h4 {
        font-size: $font-size-sm;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
        color: $color-text-muted;
        margin: 0 0 $spacing-xs 0;
      }

      p { margin: 0; color: $color-text-secondary; }

      .customer-name {
        font-weight: $font-weight-semibold;
        font-size: $font-size-lg;
        color: $color-text-primary;
      }
    }

    .invoice-meta {
      display: flex;
      gap: $spacing-2xl;
      margin-bottom: $spacing-2xl;

      .meta-item {
        display: flex;
        flex-direction: column;
        gap: $spacing-xs;
      }

      .meta-label {
        font-size: $font-size-sm;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
        color: $color-text-muted;
      }

      .meta-value {
        font-weight: $font-weight-semibold;
      }
    }

    .invoice-section-header {
      margin: $spacing-2xl 0 $spacing-base 0;

      h3 {
        font-size: $font-size-base;
        font-weight: $font-weight-bold;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
        color: $color-text-muted;
        margin: 0;
        padding-bottom: $spacing-xs;
        border-bottom: 2px solid $color-primary;
        display: inline-block;
      }
    }

    .line-items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: $spacing-xl;

      th, td {
        padding: $spacing-md $spacing-base;
        text-align: left;
        border-bottom: $border-width-thin solid $color-border;
      }

      th {
        font-weight: $font-weight-semibold;
        color: $color-text-secondary;
        font-size: $font-size-sm;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
        background: $color-gray-50;
      }

      .text-right { text-align: right; }
      .date-cell { white-space: nowrap; color: $color-text-secondary; font-size: $font-size-sm; }

      .desc-row td {
        padding-top: 0;
        padding-bottom: $spacing-md;
        border-bottom: $border-width-thin solid $color-border;
      }

      .desc-cell {
        color: $color-text-secondary;
        font-size: $font-size-sm;
        font-style: italic;
        padding-left: $spacing-2xl;
      }

      .total-row td {
        font-size: $font-size-lg;
        font-weight: $font-weight-bold;
        border-top: 2px solid $color-primary;
        border-bottom: none;
      }
    }

    .project-header-row td {
      background: $color-gray-50;
      font-weight: $font-weight-semibold;
      color: $color-primary;
      font-size: $font-size-sm;
      padding: $spacing-sm $spacing-base;
      border-bottom: 2px solid $color-primary;
    }

    .details-table {
      margin-bottom: $spacing-2xl;
    }

    .invoice-notes {
      padding: $spacing-base;
      background: $color-gray-50;
      border-radius: $border-radius-base;
      margin-bottom: $spacing-2xl;

      h4 {
        font-size: $font-size-sm;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
        color: $color-text-muted;
        margin: 0 0 $spacing-sm 0;
      }

      p { margin: 0; color: $color-text-secondary; }
    }

    .invoice-actions {
      display: flex;
      gap: $spacing-sm;
      justify-content: flex-end;
      align-items: center;
      padding-top: $spacing-xl;
      border-top: $border-width-thin solid $color-border-light;
    }

    .action-hint {
      color: $color-text-muted;
      font-size: $font-size-sm;
    }

    .modal-actions {
      display: flex;
      gap: $spacing-sm;
      justify-content: flex-end;
    }

    .modal-content p {
      margin: $spacing-base 0 $spacing-lg 0;
      color: $color-text-secondary;
    }

    .modal-footnote {
      font-size: $font-size-sm;
    }

    .blocker-list {
      margin: 0 0 $spacing-lg 0;
      padding-left: $spacing-lg;
      color: $color-text-secondary;
      font-size: $font-size-sm;

      li { margin-bottom: $spacing-xs; }
    }

    .btn-action-status {
      @include button-secondary;
    }

    .btn-success {
      background: $color-success;
      color: $color-white;
      border-color: $color-success;

      &:hover {
        background: $color-success-text-dark;
        border-color: $color-success-text-dark;
      }
    }

    .btn-danger-outline {
      color: $color-danger;
      border-color: $color-danger;

      &:hover {
        background: $color-danger-light;
      }
    }

    .loading-state {
      text-align: center;
      padding: $spacing-3xl;

      .loading-spinner { @include spinner-base; margin: 0 auto $spacing-base; }
      p { color: $color-text-muted; }
    }

    @include tablet {
      .page-header { flex-direction: column; gap: $spacing-base; align-items: flex-start; }
      .header-actions { flex-wrap: wrap; }
      .invoice-header { flex-direction: column; gap: $spacing-xl; }
      .invoice-meta { flex-wrap: wrap; gap: $spacing-base; }
    }
  `]
})
export class InvoiceDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private invoiceService = inject(InvoiceService);

  invoice: Invoice | null = null;
  loading = true;
  showCancelConfirm = false;
  cancelling = false;
  reopening = false;
  reopenBlockers: ReopenBlocker[] | null = null;

  get totalHours(): number {
    if (!this.invoice) return 0;
    return Math.round(this.invoice.lineItems.reduce((sum, item) => sum + item.hours, 0) * 100) / 100;
  }

  get groupedLineItems(): { projectName: string; items: InvoiceLineItem[] }[] {
    if (!this.invoice) return [];
    const map = new Map<string, typeof this.invoice.lineItems>();
    for (const item of this.invoice.lineItems) {
      if (!map.has(item.projectName)) map.set(item.projectName, []);
      map.get(item.projectName)!.push(item);
    }
    return Array.from(map.entries()).map(([projectName, items]) => ({ projectName, items }));
  }

  get invoiceSummaryRows(): { projectName: string; hours: number; rate: number; amount: number }[] {
    if (!this.invoice) return [];
    const map = new Map<string, { projectName: string; hours: number; rate: number; amount: number }>();
    for (const item of this.invoice.lineItems) {
      const existing = map.get(item.projectName);
      if (existing) {
        existing.hours = Math.round((existing.hours + item.hours) * 100) / 100;
        existing.amount = Math.round((existing.amount + item.amount) * 100) / 100;
      } else {
        map.set(item.projectName, { projectName: item.projectName, hours: item.hours, rate: item.rate, amount: item.amount });
      }
    }
    return Array.from(map.values());
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.invoiceService.getInvoice(id).subscribe(invoice => {
        this.invoice = invoice;
        this.loading = false;
      });
    }
  }

  getDatePart(description?: string): string {
    if (!description) return '—';
    const sep = description.indexOf(' — ');
    return sep === -1 ? description : description.slice(0, sep);
  }

  getDescriptionPart(description?: string): string {
    if (!description) return '';
    const sep = description.indexOf(' — ');
    return sep === -1 ? '' : description.slice(sep + 3);
  }

  formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }

  async updateStatus(status: Invoice['status']): Promise<void> {
    if (!this.invoice) return;
    await this.invoiceService.updateInvoiceStatus(this.invoice.id, status);
  }

  async cancelInvoice(): Promise<void> {
    if (!this.invoice || this.cancelling) return;
    this.cancelling = true;
    try {
      await this.invoiceService.updateInvoiceStatus(this.invoice.id, 'cancelled');
      this.showCancelConfirm = false;
    } finally {
      this.cancelling = false;
    }
  }

  async reopen(): Promise<void> {
    if (!this.invoice || this.reopening) return;
    this.reopening = true;
    try {
      const result = await this.invoiceService.reopenInvoice(this.invoice.id);
      if (!result.ok && result.reason === 'entries-unavailable') {
        this.reopenBlockers = result.blockers;
      }
    } finally {
      this.reopening = false;
    }
  }

  async downloadPDF(): Promise<void> {
    if (!this.invoice) return;

    const doc = new jsPDF();
    const invoice = this.invoice;

    // Load logo
    let logoY = 37;
    try {
      const response = await fetch('assets/nta-logo.jpg');
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      // Draw logo: max 40mm wide, proportional height, top-left
      doc.addImage(base64, 'JPEG', 14, 14, 40, 14);
      logoY = 32;
    } catch {
      // Logo unavailable — fall back to text header
      doc.setFontSize(20);
      doc.setTextColor(30, 58, 138);
      doc.text('INVOICE', 14, 22);
      logoY = 32;
    }

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Notarangelo Technical Advisory', 14, logoY + 5);

    // Invoice details (right side)
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Invoice #:', 140, 22);
    doc.text('Issue Date:', 140, 29);
    doc.text('Due Date:', 140, 36);

    doc.setTextColor(30);
    doc.text(invoice.invoiceNumber, 170, 22);
    doc.text(this.formatDate(invoice.issueDate), 170, 29);
    doc.text(this.formatDate(invoice.dueDate), 170, 36);

    // Bill To
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('BILL TO', 14, 52);
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text(invoice.customerName, 14, 59);

    // Status
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Status: ${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}`, 140, 52);

    // Summary table
    const summaryData = this.invoiceSummaryRows.map(row => [
      row.projectName,
      String(row.hours),
      `$${row.rate.toFixed(2)}/hr`,
      `$${row.amount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 68,
      head: [['Project', 'Total Hours', 'Rate', 'Amount']],
      body: summaryData,
      foot: [
        ['', '', 'Total', `$${invoice.total.toFixed(2)}`]
      ],
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 3: { halign: 'right' } }
    });

    // Details section header
    const summaryEndY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('DETAILS', 14, summaryEndY);

    // Details table — grouped by project, with project header rows
    const detailsBody: string[][] = [];
    const projectHeaderIndices = new Set<number>();
    const descRowIndices = new Set<number>();
    for (const group of this.groupedLineItems) {
      projectHeaderIndices.add(detailsBody.length);
      detailsBody.push([group.projectName, '', '', '']);
      for (const item of group.items) {
        const datePart = this.getDatePart(item.description);
        const descPart = this.getDescriptionPart(item.description);
        detailsBody.push([datePart, String(item.hours), `$${item.rate.toFixed(2)}/hr`, `$${item.amount.toFixed(2)}`]);
        if (descPart) {
          descRowIndices.add(detailsBody.length);
          detailsBody.push([descPart, '', '', '']);
        }
      }
    }

    autoTable(doc, {
      startY: summaryEndY + 5,
      head: [['Date', 'Hours', 'Rate', 'Amount']],
      body: detailsBody,
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 3: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.section === 'body' && projectHeaderIndices.has(data.row.index)) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [30, 58, 138];
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontSize = 10;
          if (data.column.index === 0) {
            data.cell.colSpan = 4;
          }
        }
        if (data.section === 'body' && descRowIndices.has(data.row.index)) {
          data.cell.styles.fontStyle = 'italic';
          data.cell.styles.textColor = [100, 116, 139];
          data.cell.styles.fontSize = 9;
          data.cell.styles.fillColor = [255, 255, 255];
          if (data.column.index === 0) {
            data.cell.styles.cellPadding = { top: 0, right: 5, bottom: 4, left: 14 };
          } else {
            data.cell.styles.cellPadding = { top: 0, right: 5, bottom: 4, left: 5 };
          }
        }
      }
    });

    // Notes
    if (invoice.notes) {
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text('NOTES', 14, finalY);
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(invoice.notes, 14, finalY + 7, { maxWidth: 180 });
    }

    doc.save(`${invoice.invoiceNumber}.pdf`);
  }
}
