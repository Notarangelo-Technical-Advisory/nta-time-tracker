import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TimeEntryService } from '../../services/time-entry.service';
import { CustomerService } from '../../services/customer.service';
import { ProjectService } from '../../services/project.service';
import { TimeEntry } from '../../models/time-entry.model';
import { Customer } from '../../models/customer.model';
import { Project } from '../../models/project.model';

@Component({
    selector: 'app-time-entry-list',
    imports: [CommonModule, RouterLink, FormsModule],
    template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Time Entries</h1>
          <p class="subtitle">Track and manage your billable hours</p>
        </div>
        <a routerLink="/time-entries/new" class="btn-primary">+ Log Time</a>
      </div>

      <div class="filters">
        <div class="filter-row">
          <div class="filter-group">
            <label class="filter-label">From</label>
            <input type="date" class="form-control" [(ngModel)]="dateFrom" (ngModelChange)="filterEntries()">
          </div>
          <div class="filter-group">
            <label class="filter-label">To</label>
            <input type="date" class="form-control" [(ngModel)]="dateTo" (ngModelChange)="filterEntries()">
          </div>
          <div class="filter-group">
            <label class="filter-label">Customer</label>
            <select class="form-control" [(ngModel)]="customerFilter" (ngModelChange)="filterEntries()">
              <option value="">All Customers</option>
              <option *ngFor="let c of customers" [value]="c.id">{{ c.companyName }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Status</label>
            <select class="form-control" [(ngModel)]="statusFilter" (ngModelChange)="filterEntries()">
              <option value="">All Statuses</option>
              <option value="unbilled">Unbilled</option>
              <option value="billed">Billed</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
      </div>

      <div class="summary-bar" *ngIf="!loading && filteredEntries.length > 0">
        <div class="summary-item">
          <span class="summary-label">Entries</span>
          <span class="summary-value">{{ filteredEntries.length }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Total Hours</span>
          <span class="summary-value">{{ totalHours }}</span>
        </div>
        <div class="summary-item unbilled">
          <span class="summary-label">Unbilled</span>
          <span class="summary-value">{{ unbilledHours }} hrs</span>
        </div>
      </div>

      <div class="loading-state" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Loading time entries...</p>
      </div>

      <div class="empty-state" *ngIf="!loading && filteredEntries.length === 0">
        <h3>No time entries found</h3>
        <p *ngIf="dateFrom || dateTo || customerFilter || statusFilter">Try adjusting your filters</p>
        <p *ngIf="!dateFrom && !dateTo && !customerFilter && !statusFilter">Start logging your billable hours</p>
        <a routerLink="/time-entries/new" class="btn-primary" *ngIf="!dateFrom && !dateTo && !customerFilter && !statusFilter">+ Log Time</a>
      </div>

      <table class="data-table" *ngIf="!loading && filteredEntries.length > 0">
        <thead>
          <tr>
            <th>Date</th>
            <th>Time</th>
            <th>Hours</th>
            <th>Customer</th>
            <th>Project</th>
            <th>Description</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let entry of filteredEntries">
            <td class="date-cell">{{ formatDate(entry.date) }}</td>
            <td class="time-cell">{{ formatTime(entry.startTime) }} - {{ formatTime(entry.endTime) }}</td>
            <td class="hours-cell">{{ entry.durationHours }}</td>
            <td>{{ getCustomerName(entry.customerId) }}</td>
            <td>{{ getProjectName(entry.projectId) }}</td>
            <td class="desc-cell">
              <span *ngIf="entry.description">{{ entry.description }}</span>
              <span class="text-muted" *ngIf="!entry.description">—</span>
            </td>
            <td>
              <span class="status-badge"
                [class.unbilled]="entry.status === 'unbilled'"
                [class.billed]="entry.status === 'billed'"
                [class.paid]="entry.status === 'paid'">
                {{ entry.status | titlecase }}
              </span>
            </td>
            <td class="actions">
              <a [routerLink]="['/time-entries', entry.id, 'edit']" class="btn-action" *ngIf="entry.status === 'unbilled'">Edit</a>
              <button class="btn-action btn-action-danger" (click)="confirmDelete(entry)" *ngIf="entry.status === 'unbilled'">Delete</button>
              <span class="text-muted" *ngIf="entry.status !== 'unbilled'">Locked</span>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Delete confirmation modal -->
      <div class="modal-overlay" *ngIf="entryToDelete" (click)="entryToDelete = null">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Delete Time Entry</h3>
          <p>Are you sure you want to delete the time entry for <strong>{{ formatDate(entryToDelete.date) }}</strong> ({{ entryToDelete.durationHours }} hrs)?</p>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="entryToDelete = null">Cancel</button>
            <button class="btn-danger" (click)="deleteEntry()">Delete</button>
          </div>
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
    .btn-secondary { @include button-secondary; }
    .btn-danger { @include button-danger; }

    .filters {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      padding: $spacing-base;
      margin-bottom: $spacing-xl;
    }

    .filter-row {
      display: flex;
      gap: $spacing-base;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: $spacing-xs;
      flex: 1;
      min-width: 150px;

      .filter-label {
        font-size: $font-size-sm;
        font-weight: $font-weight-semibold;
        color: $color-text-secondary;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
      }

      .form-control {
        @include form-control;
      }

      select.form-control {
        appearance: auto;
      }
    }

    .summary-bar {
      display: flex;
      gap: $spacing-xl;
      padding: $spacing-base $spacing-xl;
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      margin-bottom: $spacing-xl;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      gap: $spacing-xs;

      .summary-label {
        font-size: $font-size-sm;
        color: $color-text-muted;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
      }

      .summary-value {
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
      }

      &.unbilled .summary-value {
        color: $color-warning;
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

    .date-cell {
      font-weight: $font-weight-semibold;
      white-space: nowrap;
    }

    .time-cell {
      font-family: monospace;
      font-size: $font-size-sm;
      white-space: nowrap;
    }

    .hours-cell {
      font-weight: $font-weight-bold;
      color: $color-primary;
    }

    .desc-cell {
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .text-muted { color: $color-text-muted; }

    .status-badge {
      @include badge-base;

      &.unbilled {
        background: $color-warning-light;
        color: $color-warning-text;
      }
      &.billed {
        background: $color-primary-light;
        color: $color-primary;
      }
      &.paid {
        background: $color-success-light;
        color: $color-success-text;
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

    .btn-action-danger {
      &:hover {
        background: $color-danger-lighter;
        color: $color-danger;
        border-color: $color-danger;
      }
    }

    .modal-overlay { @include modal-overlay; }
    .modal-content {
      @include modal-content;

      p { margin: $spacing-base 0 $spacing-xl 0; color: $color-text-secondary; }
    }
    .modal-actions {
      display: flex;
      gap: $spacing-sm;
      justify-content: flex-end;
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
      .filter-row { flex-direction: column; }
      .summary-bar { flex-wrap: wrap; gap: $spacing-base; }
      .data-table { font-size: $font-size-sm; }
    }
  `]
})
export class TimeEntryListComponent implements OnInit {
  private timeEntryService = inject(TimeEntryService);
  private customerService = inject(CustomerService);
  private projectService = inject(ProjectService);

  entries: TimeEntry[] = [];
  filteredEntries: TimeEntry[] = [];
  customers: Customer[] = [];
  private customerMap = new Map<string, string>();
  private projectMap = new Map<string, string>();

  dateFrom = '';
  dateTo = '';
  customerFilter = '';
  statusFilter = '';
  loading = true;
  entryToDelete: TimeEntry | null = null;

  totalHours = 0;
  unbilledHours = 0;

  ngOnInit(): void {
    this.customerService.getCustomers().subscribe(customers => {
      this.customers = customers;
      this.customerMap.clear();
      customers.forEach(c => this.customerMap.set(c.id, c.companyName));
    });

    this.projectService.getProjects().subscribe(projects => {
      this.projectMap.clear();
      projects.forEach(p => this.projectMap.set(p.id, p.projectName));
    });

    this.timeEntryService.getTimeEntries().subscribe(entries => {
      this.entries = entries;
      this.filterEntries();
      this.loading = false;
    });
  }

  getCustomerName(customerId: string): string {
    return this.customerMap.get(customerId) || customerId;
  }

  getProjectName(projectId: string): string {
    return this.projectMap.get(projectId) || projectId;
  }

  formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }

  formatTime(time24: string): string {
    const [h, m] = time24.split(':').map(Number);
    const period = h < 12 ? 'AM' : 'PM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  }

  filterEntries(): void {
    let result = this.entries;

    if (this.dateFrom) {
      result = result.filter(e => e.date >= this.dateFrom);
    }

    if (this.dateTo) {
      result = result.filter(e => e.date <= this.dateTo);
    }

    if (this.customerFilter) {
      result = result.filter(e => e.customerId === this.customerFilter);
    }

    if (this.statusFilter) {
      result = result.filter(e => e.status === this.statusFilter);
    }

    this.filteredEntries = result;
    this.totalHours = Math.round(result.reduce((sum, e) => sum + e.durationHours, 0) * 100) / 100;
    this.unbilledHours = Math.round(result.filter(e => e.status === 'unbilled').reduce((sum, e) => sum + e.durationHours, 0) * 100) / 100;
  }

  confirmDelete(entry: TimeEntry): void {
    this.entryToDelete = entry;
  }

  async deleteEntry(): Promise<void> {
    if (!this.entryToDelete) return;
    await this.timeEntryService.deleteTimeEntry(this.entryToDelete.id);
    this.entryToDelete = null;
  }
}
