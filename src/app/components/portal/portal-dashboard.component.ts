import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TimeEntryService } from '../../services/time-entry.service';
import { InvoiceService } from '../../services/invoice.service';
import { CustomerService } from '../../services/customer.service';
import { ProjectService } from '../../services/project.service';
import { TimeEntry } from '../../models/time-entry.model';
import { Invoice } from '../../models/invoice.model';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-portal-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
          <div class="summary-card estimate-card">
            <span class="card-label">Est. Next Invoice</span>
            <span class="card-value danger">\${{ estimatedInvoice.toFixed(2) }}</span>
            <span class="card-subtitle">Based on {{ unbilledHours }} unbilled hrs</span>
          </div>
          <div class="summary-card">
            <span class="card-label">Outstanding</span>
            <span class="card-value primary">\${{ outstandingTotal.toFixed(2) }}</span>
          </div>
          <div class="summary-card">
            <span class="card-label">Total Paid</span>
            <span class="card-value success">\${{ paidTotal.toFixed(2) }}</span>
          </div>
        </div>

        <!-- Time Entries with Filters -->
        <div class="section">
          <div class="section-header">
            <h2>Time Entries</h2>
          </div>
          <div class="filters">
            <div class="filter-group">
              <label>From</label>
              <input type="date" class="filter-input" [(ngModel)]="filterStartDate" (ngModelChange)="applyFilters()">
            </div>
            <div class="filter-group">
              <label>To</label>
              <input type="date" class="filter-input" [(ngModel)]="filterEndDate" (ngModelChange)="applyFilters()">
            </div>
            <div class="filter-group">
              <label>Status</label>
              <select class="filter-input" [(ngModel)]="filterStatus" (ngModelChange)="applyFilters()">
                <option value="">All</option>
                <option value="unbilled">Unbilled</option>
                <option value="billed">Billed</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <button class="btn-clear" *ngIf="filterStartDate || filterEndDate || filterStatus" (click)="clearFilters()">Clear</button>
          </div>
          <div class="empty-hint" *ngIf="filteredEntries.length === 0">
            <p>No time entries found.</p>
          </div>
          <table class="data-table" *ngIf="filteredEntries.length > 0">
            <thead>
              <tr>
                <th>Date</th>
                <th>Hours</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let entry of displayedEntries">
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
          <div class="show-more" *ngIf="filteredEntries.length > displayLimit">
            <button class="btn-show-more" (click)="showMore()">
              Show more ({{ filteredEntries.length - displayLimit }} remaining)
            </button>
          </div>
        </div>

        <!-- Invoices -->
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

      .card-subtitle {
        font-size: $font-size-xs;
        color: $color-text-muted;
      }
    }

    .estimate-card {
      border: 2px solid $color-danger-light;
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

    .section-header {
      @include flex-between;
      margin-bottom: $spacing-base;

      h2 { margin: 0; }
    }

    .filters {
      display: flex;
      gap: $spacing-base;
      align-items: flex-end;
      margin-bottom: $spacing-base;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: $spacing-xs;

      label {
        font-size: $font-size-xs;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
        color: $color-text-muted;
        font-weight: $font-weight-semibold;
      }
    }

    .filter-input {
      @include form-control;
      padding: $spacing-xs $spacing-sm;
      font-size: $font-size-sm;
      min-width: 140px;
    }

    .btn-clear {
      padding: $spacing-xs $spacing-sm;
      border: $border-width-thin solid $color-border;
      border-radius: $border-radius-sm;
      background: $color-white;
      color: $color-text-muted;
      font-size: $font-size-sm;
      cursor: pointer;
      transition: $transition-all;

      &:hover {
        background: $color-gray-50;
        color: $color-text-primary;
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

    .show-more {
      text-align: center;
      padding: $spacing-base;
    }

    .btn-show-more {
      padding: $spacing-sm $spacing-xl;
      border: $border-width-thin solid $color-border;
      border-radius: $border-radius-sm;
      background: $color-white;
      color: $color-primary;
      font-size: $font-size-sm;
      font-weight: $font-weight-semibold;
      cursor: pointer;
      transition: $transition-all;

      &:hover {
        background: $color-primary-light;
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
  private customerService = inject(CustomerService);
  private projectService = inject(ProjectService);

  loading = true;
  allEntries: TimeEntry[] = [];
  filteredEntries: TimeEntry[] = [];
  invoices: Invoice[] = [];
  projects: Project[] = [];

  unbilledHours = 0;
  billedHours = 0;
  outstandingTotal = 0;
  paidTotal = 0;
  estimatedInvoice = 0;

  filterStartDate = '';
  filterEndDate = '';
  filterStatus = '';
  displayLimit = 20;

  private defaultRate = 0;

  get displayedEntries(): TimeEntry[] {
    return this.filteredEntries.slice(0, this.displayLimit);
  }

  async ngOnInit(): Promise<void> {
    const customerId = await this.authService.getCurrentUserCustomerId();
    if (!customerId) {
      this.loading = false;
      return;
    }

    this.customerService.getCustomer(customerId).subscribe(customer => {
      this.defaultRate = customer?.hourlyRate || 0;
      this.calculateEstimate();
    });

    this.projectService.getProjectsByCustomer(customerId).subscribe(projects => {
      this.projects = projects;
      this.calculateEstimate();
    });

    this.timeEntryService.getTimeEntriesByCustomer(customerId).subscribe(entries => {
      this.allEntries = entries;
      this.applyFilters();
      this.unbilledHours = Math.round(entries.filter(e => e.status === 'unbilled').reduce((sum, e) => sum + e.durationHours, 0) * 100) / 100;
      this.billedHours = Math.round(entries.filter(e => e.status !== 'unbilled').reduce((sum, e) => sum + e.durationHours, 0) * 100) / 100;
      this.calculateEstimate();
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

  applyFilters(): void {
    let entries = this.allEntries;

    if (this.filterStartDate) {
      entries = entries.filter(e => e.date >= this.filterStartDate);
    }
    if (this.filterEndDate) {
      entries = entries.filter(e => e.date <= this.filterEndDate);
    }
    if (this.filterStatus) {
      entries = entries.filter(e => e.status === this.filterStatus);
    }

    this.filteredEntries = entries;
  }

  clearFilters(): void {
    this.filterStartDate = '';
    this.filterEndDate = '';
    this.filterStatus = '';
    this.applyFilters();
  }

  showMore(): void {
    this.displayLimit += 20;
  }

  private calculateEstimate(): void {
    const unbilledEntries = this.allEntries.filter(e => e.status === 'unbilled');
    if (unbilledEntries.length === 0 || (this.defaultRate === 0 && this.projects.length === 0)) {
      this.estimatedInvoice = 0;
      return;
    }

    const projectRateMap = new Map<string, number>();
    for (const p of this.projects) {
      projectRateMap.set(p.id, p.hourlyRate || this.defaultRate);
    }

    this.estimatedInvoice = Math.round(
      unbilledEntries.reduce((sum, e) => {
        const rate = projectRateMap.get(e.projectId) || this.defaultRate;
        return sum + (e.durationHours * rate);
      }, 0) * 100
    ) / 100;
  }

  formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }
}
