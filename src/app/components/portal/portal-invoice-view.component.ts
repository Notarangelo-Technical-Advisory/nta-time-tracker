import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { InvoiceService } from '../../services/invoice.service';
import { Invoice } from '../../models/invoice.model';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
    selector: 'app-portal-invoice-view',
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
          <a routerLink="/portal" class="btn-secondary">Back to Dashboard</a>
        </div>
      </div>

      <div class="loading-state" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Loading invoice...</p>
      </div>

      <div *ngIf="!loading && invoice" class="invoice-card">
        <div class="invoice-header">
          <div class="invoice-from">
            <h3>Fractional Tech Advisory</h3>
            <p>Jack Notarangelo</p>
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

        <table class="line-items-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Hours</th>
              <th>Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of invoice.lineItems">
              <td>{{ item.projectName }}</td>
              <td>{{ item.hours }}</td>
              <td>\${{ item.rate.toFixed(2) }}/hr</td>
              <td class="text-right">\${{ item.amount.toFixed(2) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="subtotal-row">
              <td colspan="3">Subtotal</td>
              <td class="text-right">\${{ invoice.subtotal.toFixed(2) }}</td>
            </tr>
            <tr class="total-row">
              <td colspan="3">Total</td>
              <td class="text-right">\${{ invoice.total.toFixed(2) }}</td>
            </tr>
          </tfoot>
        </table>

        <div class="invoice-notes" *ngIf="invoice.notes">
          <h4>Notes</h4>
          <p>{{ invoice.notes }}</p>
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

      .meta-value { font-weight: $font-weight-semibold; }
    }

    .line-items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: $spacing-2xl;

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

      .subtotal-row td {
        font-weight: $font-weight-semibold;
        border-bottom: $border-width-thin solid $color-border;
      }

      .total-row td {
        font-size: $font-size-lg;
        font-weight: $font-weight-bold;
        border-top: 2px solid $color-primary;
        border-bottom: none;
      }
    }

    .invoice-notes {
      padding: $spacing-base;
      background: $color-gray-50;
      border-radius: $border-radius-base;

      h4 {
        font-size: $font-size-sm;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
        color: $color-text-muted;
        margin: 0 0 $spacing-sm 0;
      }

      p { margin: 0; color: $color-text-secondary; }
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
export class PortalInvoiceViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private invoiceService = inject(InvoiceService);

  invoice: Invoice | null = null;
  loading = true;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.invoiceService.getInvoice(id).subscribe(invoice => {
        this.invoice = invoice;
        this.loading = false;
      });
    }
  }

  formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }

  downloadPDF(): void {
    if (!this.invoice) return;

    const doc = new jsPDF();
    const invoice = this.invoice;

    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138);
    doc.text('INVOICE', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Fractional Tech Advisory', 14, 32);
    doc.text('Jack Notarangelo', 14, 37);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Invoice #:', 140, 22);
    doc.text('Issue Date:', 140, 29);
    doc.text('Due Date:', 140, 36);

    doc.setTextColor(30);
    doc.text(invoice.invoiceNumber, 170, 22);
    doc.text(this.formatDate(invoice.issueDate), 170, 29);
    doc.text(this.formatDate(invoice.dueDate), 170, 36);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('BILL TO', 14, 52);
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text(invoice.customerName, 14, 59);

    const tableData = invoice.lineItems.map(item => [
      item.projectName,
      String(item.hours),
      `$${item.rate.toFixed(2)}/hr`,
      `$${item.amount.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 68,
      head: [['Project', 'Hours', 'Rate', 'Amount']],
      body: tableData,
      foot: [
        ['', '', 'Subtotal', `$${invoice.subtotal.toFixed(2)}`],
        ['', '', 'Total', `$${invoice.total.toFixed(2)}`]
      ],
      theme: 'striped',
      headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 3: { halign: 'right' } }
    });

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
