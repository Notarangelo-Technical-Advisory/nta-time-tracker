import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, catchError, of } from 'rxjs';
import { StatusReportService } from '../../services/status-report.service';
import { TimeEntryService } from '../../services/time-entry.service';
import { CustomerService } from '../../services/customer.service';
import { ProjectService } from '../../services/project.service';
import { InvoiceService } from '../../services/invoice.service';
import { TimeEntry } from '../../models/time-entry.model';
import { Customer } from '../../models/customer.model';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-status-report-generate',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Generate Status Report</h1>
        <a routerLink="/status-reports" class="btn-secondary">Cancel</a>
      </div>
    
      <!-- Step indicators -->
      <div class="steps">
        <div class="step" [class.active]="currentStep === 1" [class.completed]="currentStep > 1">
          <span class="step-number">1</span>
          <span class="step-label">Select Customer</span>
        </div>
        <div class="step-connector" [class.active]="currentStep > 1"></div>
        <div class="step" [class.active]="currentStep === 2">
          <span class="step-number">2</span>
          <span class="step-label">Select Entries &amp; Generate</span>
        </div>
      </div>
    
      <!-- ─── Step 1: Select Customer ─── -->
      @if (currentStep === 1) {
        <div class="step-content">
          <div class="form-card">
            <h2>Select Customer</h2>
            <p class="step-desc">Choose the customer this status report is for.</p>
            <div class="customer-list">
              @for (c of customers; track c) {
                <div
                  class="customer-option"
                  [class.selected]="selectedCustomer?.id === c.id"
                  (click)="selectCustomer(c)">
                  <div class="customer-info">
                    <span class="customer-name">{{ c.companyName }}</span>
                    <span class="customer-contact">{{ c.billablePersonName }}</span>
                  </div>
                </div>
              }
            </div>
            <div class="step-actions">
              <button class="btn-primary" [disabled]="!selectedCustomer" (click)="goToStep2()">
                Next: Select Time Entries
              </button>
            </div>
          </div>
        </div>
      }
    
      <!-- ─── Step 2: Select Entries ─── -->
      @if (currentStep === 2) {
        <div class="step-content">
          <div class="form-card">
            <h2>Time Entries for {{ selectedCustomer?.companyName }}</h2>
            <p class="step-desc">Select the entries to include, then generate the report. You can edit it as soon as it is ready. All billing statuses are shown.</p>
            @if (generating) {
              <div class="generating-state">
                <div class="loading-spinner large"></div>
                <h2>Generating Report...</h2>
                <p>Claude is analyzing {{ selectedEntries.length }} time entries and writing your status report.</p>
              </div>
            }
            @if (!generating && loadingEntries) {
              <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading entries...</p>
              </div>
            }
            @if (!generating && !loadingEntries && allEntries.length === 0) {
              <div class="empty-state">
                <p>No time entries found for this customer.</p>
                <button class="btn-secondary" (click)="currentStep = 1">Back</button>
              </div>
            }
            @if (!generating && !loadingEntries && allEntries.length > 0) {
              <div>
                <!-- Date range filter -->
                <div class="date-filters">
                  <div class="filter-group">
                    <label class="form-label">From</label>
                    <input type="date" class="form-control" [(ngModel)]="filterFrom" (ngModelChange)="applyFilter()">
                  </div>
                  <div class="filter-group">
                    <label class="form-label">To</label>
                    <input type="date" class="form-control" [(ngModel)]="filterTo" (ngModelChange)="applyFilter()">
                  </div>
                  @if (filterFrom || filterTo) {
                    <button class="btn-ghost" (click)="clearFilter()">Clear</button>
                  }
                </div>
                <div class="select-all">
                  <label>
                    <input type="checkbox" [checked]="allSelected" (change)="toggleSelectAll()">
                    Select All ({{ filteredEntries.length }} entries, {{ totalFilteredHours }} hours)
                  </label>
                </div>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Date</th>
                      <th>Hours</th>
                      <th>Project</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (entry of filteredEntries; track entry) {
                      <tr (click)="toggleEntry(entry)">
                        <td><input type="checkbox" [checked]="isSelected(entry)" (click)="$event.stopPropagation()" (change)="toggleEntry(entry)"></td>
                        <td class="date-cell">{{ formatDate(entry.date) }}</td>
                        <td class="hours-cell">{{ entry.durationHours }}</td>
                        <td>{{ getProjectName(entry.projectId) }}</td>
                        <td class="desc-cell">{{ entry.description || '—' }}</td>
                        <td><span class="status-badge" [ngClass]="entry.status">{{ entry.status | titlecase }}</span></td>
                        <td class="invoice-ref">{{ getInvoiceNumber(entry.invoiceId) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
                @if (selectedEntries.length > 0) {
                  <div class="selection-summary">
                    <span>{{ selectedEntries.length }} entries selected ({{ selectedHours }} hours)</span>
                  </div>
                }
                @if (error) {
                  <div class="error-message">
                    <p>{{ error }}</p>
                  </div>
                }
                <div class="step-actions">
                  <button class="btn-secondary" (click)="currentStep = 1">Back</button>
                  <button class="btn-primary" [disabled]="selectedEntries.length === 0" (click)="generateReport()">
                    Generate Report with AI
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }
    
    </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    @import '../../../styles/tokens';
    @import '../../../styles/mixins';

    .page-container { max-width: $container-md; margin: 0 auto; }

    .page-header {
      @include flex-between;
      margin-bottom: $spacing-xl;

      h1 {
        font-size: $font-size-3xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
        margin: 0;
      }
    }

    .btn-primary  { @include button-primary; text-decoration: none; }
    .btn-secondary { @include button-secondary; text-decoration: none; }
    .btn-ghost {
      background: none;
      border: none;
      color: $color-primary;
      cursor: pointer;
      font-size: $font-size-sm;
      padding: $spacing-xs $spacing-sm;
      border-radius: $border-radius-base;
      &:hover { background: $color-bg-hover; }
    }

    /* Steps */
    .steps {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: $spacing-2xl;
    }
    .step {
      display: flex;
      align-items: center;
      gap: $spacing-sm;
      padding: $spacing-sm $spacing-base;
      color: $color-text-muted;

      .step-number {
        width: 28px; height: 28px;
        border-radius: 50%;
        background: $color-gray-200;
        color: $color-text-muted;
        display: flex; align-items: center; justify-content: center;
        font-weight: $font-weight-bold;
        font-size: $font-size-sm;
      }
      .step-label { font-size: $font-size-sm; font-weight: $font-weight-semibold; }

      &.active {
        color: $color-primary;
        .step-number { background: $color-primary; color: $color-white; }
      }
      &.completed {
        color: $color-success;
        .step-number { background: $color-success; color: $color-white; }
      }
    }
    .step-connector {
      width: 40px; height: 2px;
      background: $color-gray-200;
      &.active { background: $color-success; }
    }

    .step-content { margin-bottom: $spacing-xl; }

    .form-card {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      padding: $spacing-xl;

      h2 {
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
        margin: 0 0 $spacing-sm 0;
      }
      .step-desc { color: $color-text-muted; margin-bottom: $spacing-xl; }
    }

    /* Customer list */
    .customer-list {
      display: flex; flex-direction: column; gap: $spacing-sm;
      margin-bottom: $spacing-xl;
    }
    .customer-option {
      display: flex; justify-content: space-between; align-items: center;
      padding: $spacing-base;
      border: $border-width-thin solid $color-border;
      border-radius: $border-radius-base;
      cursor: pointer;
      transition: $transition-all;

      &:hover { border-color: $color-primary; background: $color-bg-hover; }
      &.selected { border-color: $color-primary; background: $color-primary-light; }

      .customer-name { font-weight: $font-weight-semibold; }
      .customer-contact { font-size: $font-size-sm; color: $color-text-muted; }
      .customer-info { display: flex; flex-direction: column; gap: $spacing-xs; }
    }

    /* Date filters */
    .date-filters {
      display: flex;
      gap: $spacing-base;
      align-items: flex-end;
      margin-bottom: $spacing-base;

      .filter-group {
        display: flex; flex-direction: column; gap: $spacing-xs;
        .form-label { @include form-label; }
        .form-control { @include form-control; }
      }
    }

    /* Select all */
    .select-all {
      padding: $spacing-base;
      background: $color-gray-50;
      border-radius: $border-radius-base;
      margin-bottom: $spacing-base;

      label {
        display: flex; align-items: center; gap: $spacing-sm;
        cursor: pointer;
        font-weight: $font-weight-semibold;
      }
    }

    /* Data table */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: $spacing-base;

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
        cursor: pointer;
        transition: $transition-background;
        &:hover { background: $color-bg-hover; }
      }
    }

    .date-cell { white-space: nowrap; font-weight: $font-weight-semibold; }
    .hours-cell { font-weight: $font-weight-bold; color: $color-primary; }
    .desc-cell {
      max-width: 220px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: $color-text-muted;
      font-size: $font-size-sm;
    }
    .invoice-ref {
      font-family: monospace;
      font-size: $font-size-sm;
      color: $color-text-muted;
    }

    .status-badge {
      @include badge-base;
      &.unbilled { background: $color-warning-light; color: $color-warning-text; }
      &.billed   { background: $color-primary-light; color: $color-primary; }
      &.paid     { background: $color-success-light; color: $color-success-text; }
    }

    .selection-summary {
      padding: $spacing-base;
      background: $color-secondary-lighter;
      border-radius: $border-radius-base;
      color: $color-secondary-dark;
      font-weight: $font-weight-semibold;
      margin-bottom: $spacing-xl;
    }

    /* Step actions */
    .step-actions {
      display: flex;
      gap: $spacing-sm;
      justify-content: flex-end;
      padding-top: $spacing-xl;
      border-top: $border-width-thin solid $color-border-light;
    }

    /* Generating spinner */
    .generating-state {
      text-align: center;
      padding: $spacing-3xl $spacing-xl;

      h2 { margin: $spacing-xl 0 $spacing-sm 0; color: $color-text-primary; }
      p { color: $color-text-muted; }
    }
    .loading-spinner { @include spinner-base; margin: 0 auto; }
    .loading-spinner.large {
      width: 48px; height: 48px;
      border-width: 4px;
    }

    .error-message { @include message-error; margin-bottom: $spacing-base; }

    .loading-state {
      text-align: center;
      padding: $spacing-2xl;
      .loading-spinner { @include spinner-base; margin: 0 auto $spacing-base; }
      p { color: $color-text-muted; }
    }
    .empty-state {
      text-align: center;
      padding: $spacing-2xl;
      p { color: $color-text-muted; margin-bottom: $spacing-xl; }
    }

    @include tablet {
      .steps { flex-wrap: wrap; gap: $spacing-xs; }
      .step-connector { width: 20px; }
      .date-filters { flex-wrap: wrap; }
    }
  `]
})
export class StatusReportGenerateComponent implements OnInit {
  private statusReportService = inject(StatusReportService);
  private timeEntryService = inject(TimeEntryService);
  private customerService = inject(CustomerService);
  private projectService = inject(ProjectService);
  private invoiceService = inject(InvoiceService);
  private router = inject(Router);

  customers: Customer[] = [];
  selectedCustomer: Customer | null = null;

  allEntries: TimeEntry[] = [];
  filteredEntries: TimeEntry[] = [];
  selectedEntries: TimeEntry[] = [];

  projectMap = new Map<string, Project>();
  invoiceNumberMap = new Map<string, string>(); // invoiceId → invoiceNumber

  currentStep = 1;
  generating = false;
  loadingEntries = false;

  filterFrom = '';
  filterTo = '';

  error = '';

  get totalFilteredHours(): number {
    return Math.round(this.filteredEntries.reduce((s, e) => s + e.durationHours, 0) * 100) / 100;
  }

  get selectedHours(): number {
    return Math.round(this.selectedEntries.reduce((s, e) => s + e.durationHours, 0) * 100) / 100;
  }

  get allSelected(): boolean {
    return this.filteredEntries.length > 0 &&
      this.filteredEntries.every(e => this.isSelected(e));
  }

  ngOnInit(): void {
    this.customerService.getActiveCustomers().subscribe(customers => {
      this.customers = customers;
    });
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer = customer;
  }

  goToStep2(): void {
    if (!this.selectedCustomer) return;
    this.currentStep = 2;
    this.error = '';
    this.loadingEntries = true;
    this.selectedEntries = [];
    this.filterFrom = '';
    this.filterTo = '';

    combineLatest([
      this.projectService.getProjectsByCustomer(this.selectedCustomer.id).pipe(catchError(() => of([]))),
      this.timeEntryService.getTimeEntriesByCustomer(this.selectedCustomer.id),
      this.invoiceService.getInvoicesByCustomer(this.selectedCustomer.id).pipe(catchError(() => of([])))
    ]).subscribe(([projects, entries, invoices]) => {
      this.projectMap.clear();
      projects.forEach(p => this.projectMap.set(p.id, p));

      this.invoiceNumberMap.clear();
      invoices.forEach(inv => {
        if (inv.id) this.invoiceNumberMap.set(inv.id, inv.invoiceNumber);
      });

      this.allEntries = entries;
      this.filteredEntries = [...entries];
      this.loadingEntries = false;
    });
  }

  applyFilter(): void {
    this.filteredEntries = this.allEntries.filter(e => {
      if (this.filterFrom && e.date < this.filterFrom) return false;
      if (this.filterTo && e.date > this.filterTo) return false;
      return true;
    });
    // Deselect any entries no longer in filtered list
    const filteredIds = new Set(this.filteredEntries.map(e => e.id));
    this.selectedEntries = this.selectedEntries.filter(e => filteredIds.has(e.id));
  }

  clearFilter(): void {
    this.filterFrom = '';
    this.filterTo = '';
    this.filteredEntries = [...this.allEntries];
  }

  isSelected(entry: TimeEntry): boolean {
    return this.selectedEntries.some(e => e.id === entry.id);
  }

  toggleEntry(entry: TimeEntry): void {
    if (this.isSelected(entry)) {
      this.selectedEntries = this.selectedEntries.filter(e => e.id !== entry.id);
    } else {
      this.selectedEntries = [...this.selectedEntries, entry];
    }
  }

  toggleSelectAll(): void {
    if (this.allSelected) {
      this.selectedEntries = [];
    } else {
      const alreadySelectedIds = new Set(this.selectedEntries.map(e => e.id));
      const toAdd = this.filteredEntries.filter(e => !alreadySelectedIds.has(e.id));
      this.selectedEntries = [...this.selectedEntries, ...toAdd];
    }
  }

  getProjectName(projectId: string): string {
    return this.projectMap.get(projectId)?.projectName ?? projectId;
  }

  getInvoiceNumber(invoiceId?: string): string {
    if (!invoiceId) return '—';
    return this.invoiceNumberMap.get(invoiceId) ?? invoiceId;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }

  /**
   * Generates the report with AI, saves it as a draft, and opens it. Every line
   * item is editable on the report page straight away; exporting is a separate
   * step there.
   */
  async generateReport(): Promise<void> {
    const customer = this.selectedCustomer;
    if (!customer || this.selectedEntries.length === 0 || this.generating) return;
    this.generating = true;
    this.error = '';

    try {
      const priorOutcomes = await this.statusReportService.getOutcomesByCustomer(customer.id);
      const sections = await this.statusReportService.generateWithAI(
        customer.companyName,
        this.selectedEntries,
        this.projectMap,
        priorOutcomes
      );
      const reportId = await this.statusReportService.saveReport(
        customer.id,
        customer.companyName,
        this.selectedEntries,
        sections
      );
      // Keep the cumulative outcomes in step with the saved report
      await this.statusReportService.upsertOutcomes(customer.id, sections);

      this.router.navigate(['/status-reports', reportId]);
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to generate report. Please try again.';
      this.generating = false;
    }
  }
}
