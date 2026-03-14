import { Component, inject, OnInit } from '@angular/core';
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
import { StatusReportSection } from '../../models/status-report.model';

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
        <div class="step" [class.active]="currentStep === 2" [class.completed]="currentStep > 2">
          <span class="step-number">2</span>
          <span class="step-label">Select Entries</span>
        </div>
        <div class="step-connector" [class.active]="currentStep > 2"></div>
        <div class="step" [class.active]="currentStep === 3">
          <span class="step-number">3</span>
          <span class="step-label">Review &amp; Generate</span>
        </div>
      </div>

      <!-- ─── Step 1: Select Customer ─── -->
      <div class="step-content" *ngIf="currentStep === 1">
        <div class="form-card">
          <h2>Select Customer</h2>
          <p class="step-desc">Choose the customer this status report is for.</p>
          <div class="customer-list">
            <div
              *ngFor="let c of customers"
              class="customer-option"
              [class.selected]="selectedCustomer?.id === c.id"
              (click)="selectCustomer(c)">
              <div class="customer-info">
                <span class="customer-name">{{ c.companyName }}</span>
                <span class="customer-contact">{{ c.billablePersonName }}</span>
              </div>
            </div>
          </div>
          <div class="step-actions">
            <button class="btn-primary" [disabled]="!selectedCustomer" (click)="goToStep2()">
              Next: Select Time Entries
            </button>
          </div>
        </div>
      </div>

      <!-- ─── Step 2: Select Entries ─── -->
      <div class="step-content" *ngIf="currentStep === 2">
        <div class="form-card">
          <h2>Time Entries for {{ selectedCustomer?.companyName }}</h2>
          <p class="step-desc">Select the entries to include. All billing statuses are shown.</p>

          <div class="loading-state" *ngIf="loadingEntries">
            <div class="loading-spinner"></div>
            <p>Loading entries...</p>
          </div>

          <div class="empty-state" *ngIf="!loadingEntries && allEntries.length === 0">
            <p>No time entries found for this customer.</p>
            <button class="btn-secondary" (click)="currentStep = 1">Back</button>
          </div>

          <div *ngIf="!loadingEntries && allEntries.length > 0">
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
              <button class="btn-ghost" *ngIf="filterFrom || filterTo" (click)="clearFilter()">Clear</button>
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
                <tr *ngFor="let entry of filteredEntries" (click)="toggleEntry(entry)">
                  <td><input type="checkbox" [checked]="isSelected(entry)" (click)="$event.stopPropagation()" (change)="toggleEntry(entry)"></td>
                  <td class="date-cell">{{ formatDate(entry.date) }}</td>
                  <td class="hours-cell">{{ entry.durationHours }}</td>
                  <td>{{ getProjectName(entry.projectId) }}</td>
                  <td class="desc-cell">{{ entry.description || '—' }}</td>
                  <td><span class="status-badge" [ngClass]="entry.status">{{ entry.status | titlecase }}</span></td>
                  <td class="invoice-ref">{{ getInvoiceNumber(entry.invoiceId) }}</td>
                </tr>
              </tbody>
            </table>

            <div class="selection-summary" *ngIf="selectedEntries.length > 0">
              <span>{{ selectedEntries.length }} entries selected ({{ selectedHours }} hours)</span>
            </div>

            <div class="step-actions">
              <button class="btn-secondary" (click)="currentStep = 1">Back</button>
              <button class="btn-primary" [disabled]="selectedEntries.length === 0" (click)="goToStep3()">
                Next: Review &amp; Generate
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Step 3: Review & Generate ─── -->
      <div class="step-content" *ngIf="currentStep === 3">
        <div class="form-card">

          <!-- Phase: preview (before generation) -->
          <ng-container *ngIf="phase === 'preview'">
            <h2>Ready to Generate</h2>
            <div class="report-meta">
              <div class="meta-item">
                <span class="meta-label">Customer</span>
                <span class="meta-value">{{ selectedCustomer?.companyName }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Period</span>
                <span class="meta-value">{{ formatDate(periodStart) }} – {{ formatDate(periodEnd) }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Entries</span>
                <span class="meta-value">{{ selectedEntries.length }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Total Hours</span>
                <span class="meta-value">{{ selectedHours }}</span>
              </div>
            </div>

            <table class="data-table preview-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Description</th>
                  <th>Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let entry of selectedEntries">
                  <td class="date-cell">{{ formatDate(entry.date) }}</td>
                  <td>{{ getProjectName(entry.projectId) }}</td>
                  <td class="desc-cell">{{ entry.description || '—' }}</td>
                  <td class="hours-cell">{{ entry.durationHours }}</td>
                  <td><span class="status-badge" [ngClass]="entry.status">{{ entry.status | titlecase }}</span></td>
                </tr>
              </tbody>
            </table>

            <div class="error-message" *ngIf="error">
              <p>{{ error }}</p>
            </div>

            <div class="step-actions">
              <button class="btn-secondary" (click)="currentStep = 2">Back</button>
              <button class="btn-primary" (click)="generateReport()">
                Generate Report with AI
              </button>
            </div>
          </ng-container>

          <!-- Phase: generating (spinner) -->
          <ng-container *ngIf="phase === 'generating'">
            <div class="generating-state">
              <div class="loading-spinner large"></div>
              <h2>Generating Report...</h2>
              <p>Claude is analyzing {{ selectedEntries.length }} time entries and writing your status report.</p>
            </div>
          </ng-container>

          <!-- Phase: result (show AI output) -->
          <ng-container *ngIf="phase === 'result'">
            <div class="result-header">
              <h2>Status Report Preview</h2>
              <div class="result-meta">
                <span>{{ selectedCustomer?.companyName }}</span>
                <span class="meta-sep">·</span>
                <span>{{ formatDate(periodStart) }} – {{ formatDate(periodEnd) }}</span>
              </div>
            </div>

            <div class="sections-list">
              <div class="report-section" *ngFor="let section of generatedSections">
                <h3 class="project-name">{{ section.projectName }}</h3>

                <div class="section-block">
                  <h4 class="block-label">Activities</h4>
                  <ul class="bullet-list">
                    <li *ngFor="let item of section.activities">{{ item }}</li>
                  </ul>
                </div>

                <div class="section-block">
                  <h4 class="block-label">Outcomes</h4>
                  <ul class="bullet-list outcomes">
                    <li *ngFor="let item of section.outcomes"
                        [class.actual]="item.startsWith('Actual:')"
                        [class.potential]="item.startsWith('Potential:')">
                      {{ item }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div class="error-message" *ngIf="saveError">
              <p>{{ saveError }}</p>
            </div>

            <div class="step-actions">
              <button class="btn-secondary" (click)="phase = 'preview'">Regenerate</button>
              <button class="btn-export" [disabled]="saving" (click)="saveAndExport('pdf')">
                <span *ngIf="saving && exportType === 'pdf'" class="spinner-sm"></span>
                {{ saving && exportType === 'pdf' ? 'Saving...' : 'Save & Export PDF' }}
              </button>
              <button class="btn-export" [disabled]="saving" (click)="saveAndExport('docx')">
                <span *ngIf="saving && exportType === 'docx'" class="spinner-sm"></span>
                {{ saving && exportType === 'docx' ? 'Saving...' : 'Save & Export DOCX' }}
              </button>
            </div>
          </ng-container>

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

    .preview-table tbody tr { cursor: default; }

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

    /* Report meta summary */
    .report-meta {
      display: flex;
      gap: $spacing-2xl;
      margin-bottom: $spacing-xl;
      padding: $spacing-base $spacing-xl;
      background: $color-bg-alt;
      border-radius: $border-radius-base;

      .meta-item { display: flex; flex-direction: column; gap: $spacing-xs; }
      .meta-label {
        font-size: $font-size-sm;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
        color: $color-text-muted;
      }
      .meta-value { font-weight: $font-weight-semibold; }
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

    /* Result sections */
    .result-header {
      margin-bottom: $spacing-xl;
      padding-bottom: $spacing-base;
      border-bottom: $border-width-thin solid $color-border;

      h2 { margin: 0 0 $spacing-xs 0; color: $color-text-primary; }
      .result-meta {
        font-size: $font-size-sm;
        color: $color-text-muted;
        display: flex;
        gap: $spacing-sm;
        align-items: center;
      }
      .meta-sep { color: $color-border; }
    }

    .sections-list {
      display: flex;
      flex-direction: column;
      gap: $spacing-xl;
      margin-bottom: $spacing-xl;
    }

    .report-section {
      padding: $spacing-xl;
      background: $color-bg-alt;
      border-radius: $border-radius-base;
      border-left: 4px solid $color-primary;
    }

    .project-name {
      font-size: $font-size-lg;
      font-weight: $font-weight-bold;
      color: $color-primary;
      margin: 0 0 $spacing-base 0;
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
      }

      &.outcomes {
        li.actual   { color: $color-success-text; }
        li.potential { color: $color-primary; }
      }
    }

    .error-message { @include message-error; margin-bottom: $spacing-base; }
    .spinner-sm { @include spinner-sm; margin-right: $spacing-xs; }

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
      .report-meta { flex-wrap: wrap; gap: $spacing-base; }
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
  phase: 'preview' | 'generating' | 'result' = 'preview';
  loadingEntries = false;

  filterFrom = '';
  filterTo = '';

  error = '';
  saveError = '';
  saving = false;
  exportType: 'pdf' | 'docx' = 'pdf';

  generatedSections: StatusReportSection[] = [];

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

  get periodStart(): string {
    if (!this.selectedEntries.length) return '';
    return [...this.selectedEntries].map(e => e.date).sort()[0];
  }

  get periodEnd(): string {
    if (!this.selectedEntries.length) return '';
    return [...this.selectedEntries].map(e => e.date).sort().reverse()[0];
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

  goToStep3(): void {
    this.currentStep = 3;
    this.phase = 'preview';
    this.error = '';
    this.saveError = '';
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

  async generateReport(): Promise<void> {
    if (!this.selectedCustomer || this.selectedEntries.length === 0) return;
    this.phase = 'generating';
    this.error = '';

    try {
      this.generatedSections = await this.statusReportService.generateWithAI(
        this.selectedCustomer.companyName,
        this.selectedEntries,
        this.projectMap
      );
      this.phase = 'result';
    } catch (err: any) {
      this.error = err?.message ?? 'Failed to generate report. Please try again.';
      this.phase = 'preview';
    }
  }

  async saveAndExport(format: 'pdf' | 'docx'): Promise<void> {
    if (!this.selectedCustomer) return;
    this.saving = true;
    this.exportType = format;
    this.saveError = '';

    try {
      const reportId = await this.statusReportService.saveReport(
        this.selectedCustomer.id,
        this.selectedCustomer.companyName,
        this.selectedEntries,
        this.generatedSections
      );

      // Build a minimal report object to pass to the export
      const report = {
        reportNumber: await this.getReportNumber(reportId),
        customerName: this.selectedCustomer.companyName,
        periodStart: this.periodStart,
        periodEnd: this.periodEnd,
        sections: this.generatedSections
      };

      if (format === 'pdf') {
        await this.exportPDF(report);
      } else {
        await this.exportDOCX(report);
      }

      this.router.navigate(['/status-reports', reportId]);
    } catch (err: any) {
      this.saveError = err?.message ?? 'Failed to save and export report.';
      this.saving = false;
    }
  }

  private async getReportNumber(reportId: string): Promise<string> {
    return new Promise(resolve => {
      this.statusReportService.getStatusReport(reportId).subscribe(r => resolve(r.reportNumber));
    });
  }

  async exportPDF(report: {
    reportNumber: string;
    customerName: string;
    periodStart: string;
    periodEnd: string;
    sections: StatusReportSection[];
  }): Promise<void> {
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default ?? jsPDFModule;
    const autoTableModule = await import('jspdf-autotable') as any;
    const autoTable = autoTableModule.default ?? autoTableModule;

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
      // Check page overflow
      if (yPos > 240) { doc.addPage(); yPos = 14; }

      // Project heading band
      autoTable(doc, {
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

      // Activities
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

      // Outcomes
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

  async exportDOCX(report: {
    reportNumber: string;
    customerName: string;
    periodStart: string;
    periodEnd: string;
    sections: StatusReportSection[];
  }): Promise<void> {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ShadingType } =
      await import('docx');

    const children: InstanceType<typeof Paragraph>[] = [];

    // Title
    children.push(new Paragraph({
      children: [new TextRun({ text: 'STATUS REPORT', bold: true, color: '1E3A8A', size: 32 })],
      heading: HeadingLevel.TITLE,
      spacing: { after: 80 }
    }));

    // Report metadata
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
      // Project heading
      children.push(new Paragraph({
        children: [new TextRun({ text: section.projectName, bold: true, color: '1E3A8A', size: 24 })],
        heading: HeadingLevel.HEADING_1,
        shading: { type: ShadingType.SOLID, color: 'DBEAFE', fill: 'DBEAFE' },
        spacing: { before: 240, after: 120 }
      }));

      // Activities sub-heading
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

      // Outcomes sub-heading
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

    const docxDocument = new Document({
      sections: [{
        properties: {},
        children
      }]
    });

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
