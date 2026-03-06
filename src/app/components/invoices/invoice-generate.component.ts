import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InvoiceService } from '../../services/invoice.service';
import { TimeEntryService } from '../../services/time-entry.service';
import { CustomerService } from '../../services/customer.service';
import { ProjectService } from '../../services/project.service';
import { TimeEntry } from '../../models/time-entry.model';
import { Customer } from '../../models/customer.model';
import { Project } from '../../models/project.model';

@Component({
    selector: 'app-invoice-generate',
    imports: [CommonModule, FormsModule, RouterLink],
    template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Generate Invoice</h1>
        <a routerLink="/invoices" class="btn-secondary">Cancel</a>
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
          <span class="step-label">Review & Generate</span>
        </div>
      </div>

      <!-- Step 1: Select Customer -->
      <div class="step-content" *ngIf="currentStep === 1">
        <div class="form-card">
          <h2>Select Customer</h2>
          <p class="step-desc">Choose a customer to generate an invoice for.</p>

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
              <span class="customer-rate" *ngIf="c.hourlyRate">\${{ c.hourlyRate }}/hr</span>
            </div>
          </div>

          <div class="step-actions">
            <button class="btn-primary" [disabled]="!selectedCustomer" (click)="goToStep2()">
              Next: Select Time Entries
            </button>
          </div>
        </div>
      </div>

      <!-- Step 2: Select Time Entries -->
      <div class="step-content" *ngIf="currentStep === 2">
        <div class="form-card">
          <h2>Unbilled Time Entries for {{ selectedCustomer?.companyName }}</h2>

          <div class="loading-state" *ngIf="loadingEntries">
            <div class="loading-spinner"></div>
            <p>Loading unbilled entries...</p>
          </div>

          <div class="empty-state" *ngIf="!loadingEntries && unbilledEntries.length === 0">
            <p>No unbilled time entries found for this customer.</p>
            <button class="btn-secondary" (click)="currentStep = 1">Back to Customer Selection</button>
          </div>

          <div *ngIf="!loadingEntries && unbilledEntries.length > 0">
            <div class="select-all">
              <label>
                <input type="checkbox" [checked]="allSelected" (change)="toggleSelectAll()">
                Select All ({{ unbilledEntries.length }} entries, {{ totalUnbilledHours }} hours)
              </label>
            </div>

            <table class="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Hours</th>
                  <th>Project</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let entry of unbilledEntries" (click)="toggleEntry(entry)">
                  <td><input type="checkbox" [checked]="isSelected(entry)" (click)="$event.stopPropagation();" (change)="toggleEntry(entry)"></td>
                  <td>{{ formatDate(entry.date) }}</td>
                  <td class="time-cell">{{ formatTime(entry.startTime) }} - {{ formatTime(entry.endTime) }}</td>
                  <td class="hours-cell">{{ entry.durationHours }}</td>
                  <td>{{ getProjectName(entry.projectId) }}</td>
                  <td class="desc-cell">{{ entry.description || '—' }}</td>
                </tr>
              </tbody>
            </table>

            <div class="selection-summary" *ngIf="selectedEntries.length > 0">
              <span>{{ selectedEntries.length }} entries selected ({{ selectedHours }} hours)</span>
            </div>

            <div class="step-actions">
              <button class="btn-secondary" (click)="currentStep = 1">Back</button>
              <button class="btn-primary" [disabled]="selectedEntries.length === 0" (click)="goToStep3()">
                Next: Review Invoice
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: Review & Generate -->
      <div class="step-content" *ngIf="currentStep === 3">
        <div class="form-card">
          <h2>Invoice Preview</h2>

          <div class="invoice-meta">
            <div class="meta-row">
              <div class="meta-group">
                <label class="form-label">Customer</label>
                <span class="meta-value">{{ selectedCustomer?.companyName }}</span>
              </div>
              <div class="meta-group">
                <label class="form-label">Invoice Number</label>
                <span class="meta-value preview-number">Will be auto-generated</span>
              </div>
            </div>
            <div class="meta-row">
              <div class="meta-group">
                <label class="form-label">Issue Date</label>
                <input type="date" class="form-control" [(ngModel)]="issueDate">
              </div>
              <div class="meta-group">
                <label class="form-label">Due Date</label>
                <input type="date" class="form-control" [(ngModel)]="dueDate">
              </div>
            </div>
          </div>

          <table class="data-table preview-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Description</th>
                <th>Hours</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of previewLineItems">
                <td>{{ item.projectName }}</td>
                <td class="desc-cell">{{ item.description || '—' }}</td>
                <td>{{ item.hours }}</td>
                <td>\${{ item.rate }}/hr</td>
                <td class="amount-cell">\${{ item.amount.toFixed(2) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="4">Total</td>
                <td class="amount-cell">\${{ previewTotal.toFixed(2) }}</td>
              </tr>
            </tfoot>
          </table>

          <div class="form-group notes-group">
            <label class="form-label">Notes (optional)</label>
            <textarea class="form-control" [(ngModel)]="invoiceNotes" rows="2" placeholder="Payment terms, additional notes..."></textarea>
          </div>

          <div class="error-message" *ngIf="error">
            <p>{{ error }}</p>
          </div>

          <div class="step-actions">
            <button class="btn-secondary" (click)="currentStep = 2">Back</button>
            <button class="btn-primary" [disabled]="generating" (click)="generateInvoice()">
              <span class="spinner-border-sm" *ngIf="generating"></span>
              {{ generating ? 'Generating...' : 'Generate Invoice' }}
            </button>
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
      }
    }

    .btn-primary { @include button-primary; text-decoration: none; }
    .btn-secondary { @include button-secondary; text-decoration: none; }

    .steps {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: $spacing-2xl;
      gap: 0;
    }

    .step {
      display: flex;
      align-items: center;
      gap: $spacing-sm;
      padding: $spacing-sm $spacing-base;
      color: $color-text-muted;

      .step-number {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: $color-gray-200;
        color: $color-text-muted;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: $font-weight-bold;
        font-size: $font-size-sm;
      }

      .step-label {
        font-size: $font-size-sm;
        font-weight: $font-weight-semibold;
      }

      &.active {
        color: $color-primary;
        .step-number {
          background: $color-primary;
          color: $color-white;
        }
      }

      &.completed {
        color: $color-success;
        .step-number {
          background: $color-success;
          color: $color-white;
        }
      }
    }

    .step-connector {
      width: 40px;
      height: 2px;
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

      .step-desc {
        color: $color-text-muted;
        margin-bottom: $spacing-xl;
      }
    }

    .customer-list {
      display: flex;
      flex-direction: column;
      gap: $spacing-sm;
      margin-bottom: $spacing-xl;
    }

    .customer-option {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: $spacing-base;
      border: $border-width-thin solid $color-border;
      border-radius: $border-radius-base;
      cursor: pointer;
      transition: $transition-all;

      &:hover { border-color: $color-primary; background: $color-bg-hover; }

      &.selected {
        border-color: $color-primary;
        background: $color-primary-light;
      }

      .customer-info {
        display: flex;
        flex-direction: column;
        gap: $spacing-xs;
      }

      .customer-name { font-weight: $font-weight-semibold; }
      .customer-contact { font-size: $font-size-sm; color: $color-text-muted; }
      .customer-rate { font-weight: $font-weight-semibold; color: $color-primary; }
    }

    .select-all {
      padding: $spacing-base;
      background: $color-gray-50;
      border-radius: $border-radius-base;
      margin-bottom: $spacing-base;

      label {
        display: flex;
        align-items: center;
        gap: $spacing-sm;
        cursor: pointer;
        font-weight: $font-weight-semibold;
      }
    }

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

    .time-cell { font-family: monospace; font-size: $font-size-sm; white-space: nowrap; }
    .hours-cell { font-weight: $font-weight-bold; color: $color-primary; }
    .desc-cell {
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: $color-text-muted;
    }
    .amount-cell { font-weight: $font-weight-bold; text-align: right; }

    .preview-table {
      tbody tr { cursor: default; }

      tfoot .total-row {
        td {
          font-size: $font-size-lg;
          font-weight: $font-weight-bold;
          border-top: 2px solid $color-primary;
          padding-top: $spacing-base;
        }
      }
    }

    .selection-summary {
      padding: $spacing-base;
      background: $color-secondary-lighter;
      border-radius: $border-radius-base;
      color: $color-secondary-dark;
      font-weight: $font-weight-semibold;
      margin-bottom: $spacing-xl;
    }

    .invoice-meta {
      margin-bottom: $spacing-xl;
    }

    .meta-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: $spacing-base;
      margin-bottom: $spacing-base;

      @media (max-width: $breakpoint-mobile) {
        grid-template-columns: 1fr;
      }
    }

    .meta-group {
      .form-label { @include form-label; }
      .form-control { @include form-control; }
      .meta-value {
        display: block;
        font-weight: $font-weight-semibold;
        padding: $spacing-sm 0;
      }
      .preview-number {
        color: $color-text-muted;
        font-style: italic;
        font-weight: $font-weight-normal;
      }
    }

    .notes-group {
      @include form-group;
      margin-top: $spacing-xl;

      .form-label { @include form-label; }
      .form-control { @include form-control; resize: vertical; }
    }

    .step-actions {
      display: flex;
      gap: $spacing-sm;
      justify-content: flex-end;
      padding-top: $spacing-xl;
      border-top: $border-width-thin solid $color-border-light;
    }

    .error-message { @include message-error; margin-bottom: $spacing-base; }
    .spinner-border-sm { @include spinner-sm; margin-right: $spacing-sm; }

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
    }
  `]
})
export class InvoiceGenerateComponent implements OnInit {
  private invoiceService = inject(InvoiceService);
  private timeEntryService = inject(TimeEntryService);
  private customerService = inject(CustomerService);
  private projectService = inject(ProjectService);
  private router = inject(Router);

  customers: Customer[] = [];
  selectedCustomer: Customer | null = null;
  unbilledEntries: TimeEntry[] = [];
  selectedEntries: TimeEntry[] = [];
  projectMap = new Map<string, Project>();

  currentStep = 1;
  loadingEntries = false;
  generating = false;
  error = '';

  issueDate = '';
  dueDate = '';
  invoiceNotes = '';

  previewLineItems: { projectName: string; description: string; hours: number; rate: number; amount: number }[] = [];
  previewTotal = 0;

  get totalUnbilledHours(): number {
    return Math.round(this.unbilledEntries.reduce((sum, e) => sum + e.durationHours, 0) * 100) / 100;
  }

  get selectedHours(): number {
    return Math.round(this.selectedEntries.reduce((sum, e) => sum + e.durationHours, 0) * 100) / 100;
  }

  get allSelected(): boolean {
    return this.unbilledEntries.length > 0 && this.selectedEntries.length === this.unbilledEntries.length;
  }

  ngOnInit(): void {
    this.customerService.getActiveCustomers().subscribe(customers => {
      this.customers = customers;
    });

    // Set default dates
    const today = new Date();
    this.issueDate = today.toISOString().split('T')[0];
    const due = new Date(today);
    due.setDate(due.getDate() + 30);
    this.dueDate = due.toISOString().split('T')[0];
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer = customer;
  }

  goToStep2(): void {
    if (!this.selectedCustomer) return;
    this.currentStep = 2;
    this.loadingEntries = true;
    this.selectedEntries = [];

    this.projectService.getProjectsByCustomer(this.selectedCustomer.id).subscribe(projects => {
      this.projectMap.clear();
      projects.forEach(p => this.projectMap.set(p.id, p));
    });

    this.timeEntryService.getUnbilledByCustomer(this.selectedCustomer.id).subscribe(entries => {
      this.unbilledEntries = entries;
      this.loadingEntries = false;
    });
  }

  goToStep3(): void {
    this.currentStep = 3;
    this.buildPreview();
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
      this.selectedEntries = [...this.unbilledEntries];
    }
  }

  getProjectName(projectId: string): string {
    return this.projectMap.get(projectId)?.projectName || projectId;
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

  private buildPreview(): void {
    this.previewLineItems = [];
    this.previewTotal = 0;

    for (const entry of this.selectedEntries) {
      const project = this.projectMap.get(entry.projectId);
      const rate = project?.hourlyRate || this.selectedCustomer?.hourlyRate || 0;
      const hours = Math.round(entry.durationHours * 100) / 100;
      const amount = Math.round(hours * rate * 100) / 100;
      this.previewTotal += amount;

      this.previewLineItems.push({
        projectName: project?.projectName || entry.projectId,
        description: entry.description ? `${entry.date} — ${entry.description}` : entry.date,
        hours,
        rate,
        amount
      });
    }

    this.previewTotal = Math.round(this.previewTotal * 100) / 100;
  }

  async generateInvoice(): Promise<void> {
    if (!this.selectedCustomer || this.selectedEntries.length === 0) return;

    this.generating = true;
    this.error = '';

    const projectRates = new Map<string, { name: string; rate: number }>();
    this.projectMap.forEach((project, id) => {
      projectRates.set(id, {
        name: project.projectName,
        rate: project.hourlyRate || this.selectedCustomer!.hourlyRate || 0
      });
    });

    try {
      const invoiceId = await this.invoiceService.generateInvoice(
        this.selectedCustomer.id,
        this.selectedCustomer.companyName,
        this.selectedEntries,
        projectRates,
        this.issueDate,
        this.dueDate,
        this.invoiceNotes || undefined
      );
      this.router.navigate(['/invoices', invoiceId]);
    } catch (err: any) {
      this.error = err.message || 'Failed to generate invoice';
      this.generating = false;
    }
  }
}
