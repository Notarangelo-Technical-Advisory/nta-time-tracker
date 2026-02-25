import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { CustomerService } from '../../services/customer.service';
import { Customer } from '../../models/customer.model';

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
            <td>
              <span class="status-badge" [class.active]="customer.isActive" [class.inactive]="!customer.isActive">
                {{ customer.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="actions">
              <a [routerLink]="['/customers', customer.id, 'edit']" class="btn-action">Edit</a>
              <button class="btn-action btn-action-danger" (click)="confirmDelete(customer)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

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

    a { color: $color-secondary; text-decoration: none; &:hover { text-decoration: underline; } }

    @include tablet {
      .page-header { flex-direction: column; gap: $spacing-base; align-items: flex-start; }
      .data-table { font-size: $font-size-sm; }
    }
  `]
})
export class CustomerListComponent implements OnInit {
  private customerService = inject(CustomerService);

  customers: Customer[] = [];
  filteredCustomers: Customer[] = [];
  searchTerm = '';
  loading = true;
  customerToDelete: Customer | null = null;

  ngOnInit(): void {
    this.customerService.getCustomers().subscribe(customers => {
      this.customers = customers;
      this.filterCustomers();
      this.loading = false;
    });
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
