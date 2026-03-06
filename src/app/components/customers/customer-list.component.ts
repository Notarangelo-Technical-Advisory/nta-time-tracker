import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CustomerService } from '../../services/customer.service';
import { TimeEntryService } from '../../services/time-entry.service';
import { ProjectService } from '../../services/project.service';
import { Customer } from '../../models/customer.model';
import { Project } from '../../models/project.model';

@Component({
    selector: 'app-customer-list',
    imports: [CommonModule, RouterLink, FormsModule],
    template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Customers</h1>
          <p class="subtitle">Manage your client accounts</p>
        </div>
        <a routerLink="/customers/new" class="btn-primary">+ New Customer</a>
      </div>

      <div class="search-bar">
        <input
          type="text"
          class="form-control search-input"
          placeholder="Search customers..."
          [(ngModel)]="searchTerm"
          (ngModelChange)="filterCustomers()"
        >
      </div>

      <div class="loading-state" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Loading customers...</p>
      </div>

      <div class="empty-state" *ngIf="!loading && filteredCustomers.length === 0">
        <h3>No customers found</h3>
        <p *ngIf="searchTerm">Try adjusting your search term</p>
        <p *ngIf="!searchTerm">Get started by adding your first customer</p>
        <a routerLink="/customers/new" class="btn-primary" *ngIf="!searchTerm">+ Add Customer</a>
      </div>

      <table class="data-table" *ngIf="!loading && filteredCustomers.length > 0">
        <thead>
          <tr>
            <th>ID</th>
            <th>Company</th>
            <th>Billable Contact</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Rate</th>
            <th>Unbilled Hrs</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let customer of filteredCustomers">
            <td class="customer-id">{{ customer.customerId }}</td>
            <td class="company-name">{{ customer.companyName }}</td>
            <td>{{ customer.billablePersonName }}</td>
            <td>
              <a *ngIf="customer.email" [href]="'mailto:' + customer.email">{{ customer.email }}</a>
              <span class="text-muted" *ngIf="!customer.email">—</span>
            </td>
            <td>
              <span *ngIf="customer.phone">{{ customer.phone }}</span>
              <span class="text-muted" *ngIf="!customer.phone">—</span>
            </td>
            <td>
              <span *ngIf="customer.hourlyRate">\${{ customer.hourlyRate }}/hr</span>
              <span class="text-muted" *ngIf="!customer.hourlyRate">—</span>
            </td>
            <td class="unbilled-cell">
              <span *ngIf="getUnbilledHours(customer.id) > 0" class="unbilled-hours">{{ getUnbilledHours(customer.id) }}</span>
              <span class="text-muted" *ngIf="getUnbilledHours(customer.id) === 0">—</span>
            </td>
            <td>
              <span class="status-badge" [class.active]="customer.isActive" [class.inactive]="!customer.isActive">
                {{ customer.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="actions">
              <button class="btn-action" (click)="openPreview(customer)">Preview Invoice</button>
              <a [routerLink]="['/customers', customer.id, 'edit']" class="btn-action">Edit</a>
              <button class="btn-action btn-action-danger" (click)="confirmDelete(customer)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Invoice Preview Modal -->
      <div class="modal-overlay" *ngIf="previewCustomer" (click)="closePreview()">
        <div class="modal-content modal-content-wide" (click)="$event.stopPropagation()">
          <div class="modal-top-bar">
            <h3>Invoice Preview — {{ previewCustomer.companyName }}</h3>
            <button class="modal-close" (click)="closePreview()">&#x2715;</button>
          </div>

          <div class="modal-scroll-body">
            <div class="loading-state" *ngIf="previewLoading">
              <div class="loading-spinner"></div>
              <p>Loading unbilled entries...</p>
            </div>

            <div *ngIf="!previewLoading && previewLineItems.length === 0" class="no-unbilled">
              <p>No unbilled time entries for {{ previewCustomer.companyName }}.</p>
            </div>

            <div *ngIf="!previewLoading && previewLineItems.length > 0">
              <!-- Invoice card: identical layout to invoice-detail -->
              <div class="invoice-card">
                <div class="invoice-header">
                  <div class="invoice-from">
                    <img src="assets/nta-logo.jpg" alt="NTA Logo" class="invoice-logo">
                    <p>Notarangelo Technical Advisory</p>
                  </div>
                  <div class="invoice-to">
                    <h4>Bill To</h4>
                    <p class="customer-name">{{ previewCustomer.companyName }}</p>
                  </div>
                </div>

                <div class="invoice-meta">
                  <div class="meta-item">
                    <span class="meta-label">Invoice #</span>
                    <span class="meta-value meta-pending">Auto-generated</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Issue Date</span>
                    <span class="meta-value">{{ previewIssueDate }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Due Date</span>
                    <span class="meta-value">{{ previewDueDate }}</span>
                  </div>
                </div>

                <table class="line-items-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Description</th>
                      <th>Hours</th>
                      <th>Rate</th>
                      <th class="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let line of previewLineItems">
                      <td>{{ line.projectName }}</td>
                      <td class="desc-cell">{{ line.description || '—' }}</td>
                      <td>{{ line.hours }}</td>
                      <td>\${{ line.rate.toFixed(2) }}/hr</td>
                      <td class="text-right">\${{ line.amount.toFixed(2) }}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr class="subtotal-row">
                      <td colspan="4">Subtotal</td>
                      <td class="text-right">\${{ previewTotal.toFixed(2) }}</td>
                    </tr>
                    <tr class="total-row">
                      <td colspan="4">Total</td>
                      <td class="text-right">\${{ previewTotal.toFixed(2) }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div class="modal-actions">
                <button class="btn-secondary" (click)="closePreview()">Close</button>
                <a [routerLink]="['/invoices/generate']" class="btn-primary" (click)="closePreview()">Generate Invoice</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete confirmation modal -->
      <div class="modal-overlay" *ngIf="customerToDelete" (click)="customerToDelete = null">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Delete Customer</h3>
          <p>Are you sure you want to delete <strong>{{ customerToDelete.companyName }}</strong>? This action cannot be undone.</p>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="customerToDelete = null">Cancel</button>
            <button class="btn-danger" (click)="deleteCustomer()">Delete</button>
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

    .search-bar {
      margin-bottom: $spacing-xl;

      .search-input {
        @include form-control;
        max-width: 400px;
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

    .customer-id {
      font-family: monospace;
      font-size: $font-size-sm;
      color: $color-text-muted;
    }

    .company-name { font-weight: $font-weight-semibold; }

    .text-muted { color: $color-text-muted; }

    .status-badge {
      @include badge-base;

      &.active { @include badge-status-active; }
      &.inactive { @include badge-status-inactive; }
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

    .unbilled-cell { white-space: nowrap; }
    .unbilled-hours {
      font-weight: $font-weight-bold;
      color: $color-warning;
    }

    .modal-overlay { @include modal-overlay; }
    .modal-content {
      @include modal-content;

      p { margin: $spacing-base 0 $spacing-xl 0; color: $color-text-secondary; }
    }
    .modal-content-wide {
      max-width: 640px;
      width: 100%;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      padding: 0;
    }
    .modal-top-bar {
      @include flex-between;
      padding: $spacing-xl;
      border-bottom: $border-width-thin solid $color-border;
      flex-shrink: 0;

      h3 { margin: 0; font-size: $font-size-lg; font-weight: $font-weight-bold; color: $color-text-primary; }

      .modal-close {
        background: none;
        border: none;
        font-size: $font-size-lg;
        cursor: pointer;
        color: $color-text-muted;
        padding: $spacing-xs;
        line-height: 1;
        &:hover { color: $color-text-primary; }
      }
    }
    .modal-scroll-body {
      padding: $spacing-xl;
      overflow-y: auto;
    }
    .no-unbilled {
      text-align: center;
      padding: $spacing-2xl 0;
      p { color: $color-text-muted; }
    }

    /* Exact replica of invoice-detail styles */
    .invoice-card {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      padding: $spacing-2xl;
      margin-bottom: $spacing-xl;
    }

    .invoice-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: $spacing-2xl;
      padding-bottom: $spacing-xl;
      border-bottom: 2px solid $color-primary;

      .invoice-from { text-align: center; }
      .invoice-logo { max-height: 48px; width: auto; display: block; margin: 0 auto $spacing-xs; }
      h3 { font-size: $font-size-xl; font-weight: $font-weight-bold; color: $color-primary; margin: 0 0 $spacing-xs 0; }
      h4 { font-size: $font-size-sm; text-transform: uppercase; letter-spacing: $letter-spacing-wide; color: $color-text-muted; margin: 0 0 $spacing-xs 0; }
      p { margin: 0; color: $color-text-secondary; }
      .customer-name { font-weight: $font-weight-semibold; font-size: $font-size-lg; color: $color-text-primary; }
    }

    .invoice-meta {
      display: flex;
      gap: $spacing-2xl;
      margin-bottom: $spacing-2xl;

      .meta-item { display: flex; flex-direction: column; gap: $spacing-xs; }
      .meta-label { font-size: $font-size-sm; text-transform: uppercase; letter-spacing: $letter-spacing-wide; color: $color-text-muted; }
      .meta-value { font-weight: $font-weight-semibold; }
      .meta-pending { color: $color-text-muted; font-style: italic; font-weight: $font-weight-normal; }
    }

    .line-items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: $spacing-2xl;

      th, td { padding: $spacing-md $spacing-base; text-align: left; border-bottom: $border-width-thin solid $color-border; }
      th { font-weight: $font-weight-semibold; color: $color-text-secondary; font-size: $font-size-sm; text-transform: uppercase; letter-spacing: $letter-spacing-wide; background: $color-gray-50; }
      .text-right { text-align: right; }
      .subtotal-row td { font-weight: $font-weight-semibold; border-bottom: $border-width-thin solid $color-border; }
      .total-row td { font-size: $font-size-lg; font-weight: $font-weight-bold; border-top: 2px solid $color-primary; border-bottom: none; }
    }
    .modal-actions {
      display: flex;
      gap: $spacing-sm;
      justify-content: flex-end;
      padding-top: $spacing-base;
      border-top: $border-width-thin solid $color-border-light;
    }
    .btn-primary { @include button-primary; text-decoration: none; }

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

    a { color: $color-secondary; text-decoration: none; &:hover { text-decoration: underline; } }

    @include tablet {
      .page-header { flex-direction: column; gap: $spacing-base; align-items: flex-start; }
      .data-table { font-size: $font-size-sm; }
    }
  `]
})
export class CustomerListComponent implements OnInit {
  private customerService = inject(CustomerService);
  private timeEntryService = inject(TimeEntryService);
  private projectService = inject(ProjectService);

  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  searchTerm = '';
  loading = true;
  customerToDelete: Customer | null = null;

  private unbilledHoursMap = new Map<string, number>();
  private projectMap = new Map<string, Project>();

  previewCustomer: Customer | null = null;
  previewLoading = false;
  previewLineItems: { projectName: string; description: string; hours: number; rate: number; amount: number }[] = [];
  previewTotal = 0;
  previewIssueDate = '';
  previewDueDate = '';

  ngOnInit(): void {
    this.projectService.getProjects().subscribe(projects => {
      projects.forEach(p => this.projectMap.set(p.id, p));
    });

    this.timeEntryService.getTimeEntries().subscribe(entries => {
      this.unbilledHoursMap.clear();
      for (const e of entries.filter(e => e.status === 'unbilled')) {
        this.unbilledHoursMap.set(e.customerId, Math.round(((this.unbilledHoursMap.get(e.customerId) || 0) + e.durationHours) * 100) / 100);
      }
    });

    this.customerService.getCustomers().subscribe(customers => {
      this.customers = customers;
      this.filterCustomers();
      this.loading = false;
    });
  }

  getUnbilledHours(customerId: string): number {
    return this.unbilledHoursMap.get(customerId) || 0;
  }

  openPreview(customer: Customer): void {
    this.previewCustomer = customer;
    this.previewLoading = true;
    this.previewLineItems = [];
    this.previewTotal = 0;

    const today = new Date();
    this.previewIssueDate = this.formatDate(today.toISOString().split('T')[0]);
    const due = new Date(today);
    due.setDate(due.getDate() + 30);
    this.previewDueDate = this.formatDate(due.toISOString().split('T')[0]);

    this.timeEntryService.getUnbilledByCustomer(customer.id).subscribe(entries => {
      this.previewLineItems = [];
      this.previewTotal = 0;

      for (const entry of entries) {
        const project = this.projectMap.get(entry.projectId);
        const rate = project?.hourlyRate || customer.hourlyRate || 0;
        const hours = Math.round(entry.durationHours * 100) / 100;
        const amount = Math.round(hours * rate * 100) / 100;
        this.previewTotal += amount;
        this.previewLineItems.push({
          projectName: project?.projectName || entry.projectId,
          description: (() => { const [y,m,d] = entry.date.split('-'); const fd = `${m}/${d}/${y}`; return entry.description ? `${fd} — ${entry.description}` : fd; })(),
          hours,
          rate,
          amount
        });
      }

      this.previewTotal = Math.round(this.previewTotal * 100) / 100;
      this.previewLoading = false;
    });
  }

  closePreview(): void {
    this.previewCustomer = null;
  }

  private formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }

  filterCustomers(): void {
    if (!this.searchTerm.trim()) {
      this.filteredCustomers = this.customers;
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredCustomers = this.customers.filter(c =>
      c.companyName.toLowerCase().includes(term) ||
      c.billablePersonName.toLowerCase().includes(term) ||
      c.customerId.toLowerCase().includes(term) ||
      (c.email && c.email.toLowerCase().includes(term))
    );
  }

  confirmDelete(customer: Customer): void {
    this.customerToDelete = customer;
  }

  async deleteCustomer(): Promise<void> {
    if (!this.customerToDelete) return;
    await this.customerService.deleteCustomer(this.customerToDelete.id);
    this.customerToDelete = null;
  }
}
