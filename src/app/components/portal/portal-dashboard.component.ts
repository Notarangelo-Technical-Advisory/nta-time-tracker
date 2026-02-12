import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TimeEntryService } from '../../services/time-entry.service';
import { InvoiceService } from '../../services/invoice.service';
import { TimeEntry } from '../../models/time-entry.model';
import { Invoice } from '../../models/invoice.model';

@Component({
  selector: 'app-portal-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>My Dashboard</h1>
      </div>

      <div class="loading-state" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Loading your data...</p>
      </div>

      <div *ngIf="!loading">
        <!-- Summary Cards -->
        <div class="summary-cards">
          <div class="summary-card">
            <span class="card-label">Unbilled Hours</span>
            <span class="card-value warning">{{ unbilledHours }}</span>
          </div>
          <div class="summary-card">
            <span class="card-label">Billed Hours</span>
            <span class="card-value primary">{{ billedHours }}</span>
          </div>
          <div class="summary-card">
            <span class="card-label">Outstanding</span>
            <span class="card-value danger">\${{ outstandingTotal.toFixed(2) }}</span>
          </div>
          <div class="summary-card">
            <span class="card-label">Paid</span>
            <span class="card-value success">\${{ paidTotal.toFixed(2) }}</span>
          </div>
        </div>

        <!-- Recent Time Entries -->
        <div class="section">
          <h2>Recent Time Entries</h2>
          <div class="empty-hint" *ngIf="recentEntries.length === 0">
            <p>No time entries recorded yet.</p>
          </div>
          <table class="data-table" *ngIf="recentEntries.length > 0">
            <thead>
              <tr>
                <th>Date</th>
                <th>Hours</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let entry of recentEntries">
                <td class="date-cell">{{ formatDate(entry.date) }}</td>
                <td class="hours-cell">{{ entry.durationHours }}</td>
                <td>{{ entry.description || '—' }}</td>
                <td>
                  <span class="status-badge" [ngClass]="entry.status">
                    {{ entry.status | titlecase }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Recent Invoices -->
        <div class="section">
          <h2>Invoices</h2>
          <div class="empty-hint" *ngIf="invoices.length === 0">
            <p>No invoices yet.</p>
          </div>
          <table class="data-table" *ngIf="invoices.length > 0">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let invoice of invoices">
                <td class="invoice-number">{{ invoice.invoiceNumber }}</td>
                <td>{{ formatDate(invoice.issueDate) }}</td>
                <td>{{ formatDate(invoice.dueDate) }}</td>
                <td class="amount-cell">\${{ invoice.total.toFixed(2) }}</td>
                <td>
                  <span class="status-badge" [ngClass]="invoice.status">
                    {{ invoice.status | titlecase }}
                  </span>
                </td>
                <td>
                  <a [routerLink]="['/portal/invoices', invoice.id]" class="btn-action">View</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @import '../../../styles/tokens';
    @import '../../../styles/mixins';

    .page-container {
      max-width: $container-lg;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: $spacing-xl;

      h1 {
        font-size: $font-size-3xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
        margin: 0;
      }
    }

    .summary-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: $spacing-base;
      margin-bottom: $spacing-2xl;

      @media (max-width: $breakpoint-tablet) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (max-width: $breakpoint-mobile) {
        grid-template-columns: 1fr;
      }
    }

    .summary-card {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      padding: $spacing-xl;
      display: flex;
      flex-direction: column;
      gap: $spacing-sm;

      .card-label {
        font-size: $font-size-sm;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
        color: $color-text-muted;
      }

      .card-value {
        font-size: $font-size-2xl;
        font-weight: $font-weight-bold;

        &.warning { color: $color-warning; }
        &.primary { color: $color-primary; }
        &.danger { color: $color-danger; }
        &.success { color: $color-success; }
      }
    }

    .section {
      margin-bottom: $spacing-2xl;

      h2 {
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
        margin: 0 0 $spacing-base 0;
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

    .date-cell { font-weight: $font-weight-semibold; white-space: nowrap; }
    .hours-cell { font-weight: $font-weight-bold; color: $color-primary; }
    .invoice-number { font-family: monospace; font-weight: $font-weight-semibold; color: $color-primary; }
    .amount-cell { font-weight: $font-weight-bold; }

    .status-badge {
      @include badge-base;

      &.unbilled { background: $color-warning-light; color: $color-warning-text; }
      &.billed { background: $color-primary-light; color: $color-primary; }
      &.paid { background: $color-success-light; color: $color-success-text; }
      &.draft { background: $color-gray-100; color: $color-text-muted; }
      &.sent { background: $color-primary-light; color: $color-primary; }
      &.overdue { background: $color-danger-light; color: $color-danger-text; }
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

    .empty-hint {
      padding: $spacing-xl;
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      text-align: center;

      p { color: $color-text-muted; margin: 0; }
    }

    .loading-state {
      text-align: center;
      padding: $spacing-3xl;

      .loading-spinner { @include spinner-base; margin: 0 auto $spacing-base; }
      p { color: $color-text-muted; }
    }
  `]
})
export class PortalDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private timeEntryService = inject(TimeEntryService);
  private invoiceService = inject(InvoiceService);

  loading = true;
  recentEntries: TimeEntry[] = [];
  invoices: Invoice[] = [];

  unbilledHours = 0;
  billedHours = 0;
  outstandingTotal = 0;
  paidTotal = 0;

  async ngOnInit(): Promise<void> {
    const customerId = await this.authService.getCurrentUserCustomerId();
    if (!customerId) {
      this.loading = false;
      return;
    }

    this.timeEntryService.getTimeEntriesByCustomer(customerId).subscribe(entries => {
      this.recentEntries = entries.slice(0, 10);
      this.unbilledHours = Math.round(entries.filter(e => e.status === 'unbilled').reduce((sum, e) => sum + e.durationHours, 0) * 100) / 100;
      this.billedHours = Math.round(entries.filter(e => e.status !== 'unbilled').reduce((sum, e) => sum + e.durationHours, 0) * 100) / 100;
      this.loading = false;
    });

    this.invoiceService.getInvoicesByCustomer(customerId).subscribe(invoices => {
      this.invoices = invoices;
      this.outstandingTotal = invoices
        .filter(i => i.status === 'sent' || i.status === 'overdue')
        .reduce((sum, i) => sum + i.total, 0);
      this.paidTotal = invoices
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + i.total, 0);
    });
  }

  formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }
}
