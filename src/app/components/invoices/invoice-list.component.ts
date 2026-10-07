import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InvoiceService } from '../../services/invoice.service';
import { Invoice } from '../../models/invoice.model';

@Component({
    selector: 'app-invoice-list',
    imports: [CommonModule, RouterLink, FormsModule],
    template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Invoices</h1>
          <p class="subtitle">Manage and track invoices</p>
        </div>
        <a routerLink="/invoices/generate" class="btn-primary">+ Generate Invoice</a>
      </div>
    
      <div class="filters">
        <select class="form-control filter-select" [(ngModel)]="statusFilter" (ngModelChange)="filterInvoices()">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="text"
          class="form-control search-input"
          placeholder="Search by customer or invoice #..."
          [(ngModel)]="searchTerm"
          (ngModelChange)="filterInvoices()"
          >
      </div>
    
      @if (loading) {
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading invoices...</p>
        </div>
      }
    
      @if (!loading && filteredInvoices.length === 0) {
        <div class="empty-state">
          <h3>No invoices found</h3>
          @if (statusFilter || searchTerm) {
            <p>Try adjusting your filters</p>
          }
          @if (!statusFilter && !searchTerm) {
            <p>Generate your first invoice from unbilled time entries</p>
          }
          @if (!statusFilter && !searchTerm) {
            <a routerLink="/invoices/generate" class="btn-primary">+ Generate Invoice</a>
          }
        </div>
      }
    
      @if (!loading && filteredInvoices.length > 0) {
        <table class="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Total</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (invoice of filteredInvoices; track invoice) {
              <tr>
                <td class="invoice-number">{{ invoice.invoiceNumber }}</td>
                <td class="customer-name">{{ invoice.customerName }}</td>
                <td>{{ formatDate(invoice.issueDate) }}</td>
                <td>{{ formatDate(invoice.dueDate) }}</td>
                <td class="amount-cell">\${{ invoice.total.toFixed(2) }}</td>
                <td>
                  <span class="status-badge" [ngClass]="invoice.status">
                    {{ invoice.status | titlecase }}
                  </span>
                </td>
                <td class="actions">
                  <a [routerLink]="['/invoices', invoice.id]" class="btn-action">View</a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
    `,
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: [`
    @import '../../../styles/tokens';
    @import '../../../styles/mixins';

    .page-container {
      max-width: $container-lg;
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
      }

      .subtitle {
        color: $color-text-muted;
        margin: $spacing-xs 0 0 0;
      }
    }

    .btn-primary { @include button-primary; text-decoration: none; }

    .filters {
      display: flex;
      gap: $spacing-base;
      margin-bottom: $spacing-xl;

      .filter-select {
        @include form-control;
        width: auto;
        min-width: 160px;
        appearance: auto;
      }

      .search-input {
        @include form-control;
        flex: 1;
        max-width: 300px;
      }

      @media (max-width: $breakpoint-mobile) {
        flex-direction: column;
        .search-input, .filter-select { max-width: 100%; }
      }
    }

    .data-table {
      width: 100%;
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      overflow: hidden;
      border-collapse: collapse;

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

      tbody tr {
        transition: $transition-background;
        &:hover { background: $color-bg-hover; }
        &:last-child td { border-bottom: none; }
      }
    }

    .invoice-number {
      font-family: monospace;
      font-weight: $font-weight-semibold;
      color: $color-primary;
    }

    .customer-name { font-weight: $font-weight-semibold; }

    .amount-cell {
      font-weight: $font-weight-bold;
    }

    .status-badge {
      @include badge-base;

      &.draft {
        background: $color-gray-100;
        color: $color-text-muted;
      }
      &.sent {
        background: $color-primary-light;
        color: $color-primary;
      }
      &.paid {
        background: $color-success-light;
        color: $color-success-text;
      }
      &.overdue {
        background: $color-danger-light;
        color: $color-danger-text;
      }
      &.cancelled {
        background: $color-gray-100;
        color: $color-text-muted;
        text-decoration: line-through;
      }
    }

    .actions {
      display: flex;
      gap: $spacing-sm;
    }

    .btn-action {
      padding: $spacing-xs $spacing-sm;
      border: $border-width-thin solid $color-border;
      border-radius: $border-radius-sm;
      background: $color-white;
      color: $color-text-secondary;
      font-size: $font-size-sm;
      cursor: pointer;
      text-decoration: none;
      transition: $transition-all;

      &:hover {
        background: $color-gray-50;
        color: $color-primary;
        border-color: $color-primary;
      }
    }

    .loading-state {
      text-align: center;
      padding: $spacing-3xl;

      .loading-spinner { @include spinner-base; margin: 0 auto $spacing-base; }
      p { color: $color-text-muted; }
    }

    .empty-state {
      text-align: center;
      padding: $spacing-4xl $spacing-xl;
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;

      h3 { color: $color-text-primary; margin-bottom: $spacing-base; }
      p { color: $color-text-muted; margin-bottom: $spacing-xl; }
    }

    @include tablet {
      .page-header { flex-direction: column; gap: $spacing-base; align-items: flex-start; }
      .data-table { font-size: $font-size-sm; }
    }
  `]
})
export class InvoiceListComponent implements OnInit {
  private invoiceService = inject(InvoiceService);

  invoices: Invoice[] = [];
  filteredInvoices: Invoice[] = [];
  statusFilter = '';
  searchTerm = '';
  loading = true;

  ngOnInit(): void {
    this.invoiceService.getInvoices().subscribe(invoices => {
      this.invoices = invoices;
      this.filterInvoices();
      this.loading = false;
    });
  }

  formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }

  filterInvoices(): void {
    let result = this.invoices;

    if (this.statusFilter) {
      result = result.filter(i => i.status === this.statusFilter);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(i =>
        i.invoiceNumber.toLowerCase().includes(term) ||
        i.customerName.toLowerCase().includes(term)
      );
    }

    this.filteredInvoices = result;
  }
}
