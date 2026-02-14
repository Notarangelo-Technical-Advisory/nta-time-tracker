import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { CustomerService } from '../../services/customer.service';
import { InviteService } from '../../services/invite.service';
import { UserProfile } from '../../models/user.model';
import { Customer } from '../../models/customer.model';
import { Invite } from '../../models/invite.model';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Users</h1>
          <p class="subtitle">Manage user accounts and roles</p>
        </div>
      </div>

      <div class="loading-state" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Loading users...</p>
      </div>

      <div class="empty-state" *ngIf="!loading && users.length === 0">
        <h3>No users found</h3>
        <p>Users appear here after they sign up.</p>
      </div>

      <table class="data-table" *ngIf="!loading && users.length > 0">
        <thead>
          <tr>
            <th>Email</th>
            <th>Display Name</th>
            <th>Role</th>
            <th>Linked Customer</th>
            <th>Last Login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let user of users">
            <td class="email-cell">{{ user.email }}</td>
            <td>{{ user.displayName || '—' }}</td>
            <td>
              <span class="status-badge" [ngClass]="user.role">
                {{ user.role | titlecase }}
              </span>
            </td>
            <td>
              <select
                class="customer-select"
                [ngModel]="user.customerId || ''"
                (ngModelChange)="onCustomerLink(user, $event)"
                [disabled]="user.role === 'admin'"
              >
                <option value="">— None —</option>
                <option *ngFor="let c of customers" [value]="c.id">{{ c.companyName }}</option>
              </select>
            </td>
            <td class="date-cell">{{ formatDate(user.lastLogin) }}</td>
            <td class="actions">
              <button
                class="btn-action"
                (click)="toggleRole(user)"
                [title]="user.role === 'admin' ? 'Switch to Customer' : 'Switch to Admin'"
              >
                {{ user.role === 'admin' ? 'Make Customer' : 'Make Admin' }}
              </button>
              <button class="btn-action btn-action-danger" (click)="confirmDelete(user)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Invite Customer Section -->
      <div class="section-header">
        <h2>Invite Customer</h2>
        <p class="subtitle">Create an invite link for a new customer user</p>
      </div>

      <div class="invite-form-card">
        <div class="invite-form">
          <div class="form-field">
            <label for="inviteEmail">Email Address</label>
            <input
              id="inviteEmail"
              type="email"
              class="form-input"
              placeholder="user@example.com"
              [(ngModel)]="inviteEmail"
            />
          </div>
          <div class="form-field">
            <label for="inviteCustomer">Assign to Customer</label>
            <select
              id="inviteCustomer"
              class="form-input"
              [(ngModel)]="inviteCustomerId"
            >
              <option value="">— Select Customer —</option>
              <option *ngFor="let c of customers" [value]="c.id">{{ c.companyName }}</option>
            </select>
          </div>
          <button
            class="btn-primary"
            (click)="createInvite()"
            [disabled]="!inviteEmail || !inviteCustomerId || creatingInvite"
          >
            {{ creatingInvite ? 'Creating...' : 'Create Invite' }}
          </button>
        </div>

        <div class="invite-error" *ngIf="inviteError">{{ inviteError }}</div>

        <div class="invite-link-result" *ngIf="generatedLink">
          <label>Invite Link (copy and share):</label>
          <div class="link-copy-row">
            <input type="text" class="form-input link-input" [value]="generatedLink" readonly />
            <button class="btn-action" (click)="copyLink()">{{ linkCopied ? 'Copied!' : 'Copy' }}</button>
          </div>
        </div>
      </div>

      <!-- Pending Invites Section -->
      <div class="section-header" *ngIf="invites.length > 0">
        <h2>Invites</h2>
      </div>

      <table class="data-table" *ngIf="invites.length > 0">
        <thead>
          <tr>
            <th>Email</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Created</th>
            <th>Expires</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let invite of invites">
            <td class="email-cell">{{ invite.email }}</td>
            <td>{{ invite.customerName }}</td>
            <td>
              <span class="status-badge" [ngClass]="invite.status">
                {{ invite.status | titlecase }}
              </span>
            </td>
            <td class="date-cell">{{ formatDate(invite.createdAt) }}</td>
            <td class="date-cell">{{ formatDate(invite.expiresAt) }}</td>
            <td class="actions">
              <button
                class="btn-action"
                *ngIf="invite.status === 'pending'"
                (click)="copyInviteLink(invite)"
              >
                Copy Link
              </button>
              <button
                class="btn-action btn-action-danger"
                *ngIf="invite.status === 'pending'"
                (click)="revokeInvite(invite)"
              >
                Revoke
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="modal-overlay" *ngIf="userToDelete" (click)="userToDelete = null">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Delete User</h3>
          <p>Are you sure you want to delete <strong>{{ userToDelete.email }}</strong>? This removes their profile but not their Firebase Auth account.</p>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="userToDelete = null">Cancel</button>
            <button class="btn-danger" (click)="deleteUser()">Delete</button>
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

    .btn-secondary { @include button-secondary; }
    .btn-danger { @include button-danger; }

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

    .email-cell { font-weight: $font-weight-semibold; }
    .date-cell { white-space: nowrap; color: $color-text-secondary; font-size: $font-size-sm; }

    .customer-select {
      @include form-control;
      padding: $spacing-xs $spacing-sm;
      font-size: $font-size-sm;
      min-width: 160px;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
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
      white-space: nowrap;

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

    .section-header {
      margin: $spacing-2xl 0 $spacing-base;

      h2 {
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
        margin: 0;
      }

      .subtitle {
        color: $color-text-muted;
        margin: $spacing-xs 0 0 0;
      }
    }

    .invite-form-card {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      padding: $spacing-xl;
      margin-bottom: $spacing-xl;
    }

    .invite-form {
      display: flex;
      gap: $spacing-base;
      align-items: flex-end;
    }

    .form-field {
      flex: 1;

      label {
        display: block;
        font-size: $font-size-sm;
        font-weight: $font-weight-semibold;
        color: $color-text-secondary;
        margin-bottom: $spacing-xs;
      }
    }

    .form-input {
      @include form-control;
      width: 100%;
    }

    .btn-primary { @include button-primary; white-space: nowrap; }

    .invite-error {
      margin-top: $spacing-base;
      padding: $spacing-sm $spacing-base;
      background: $color-danger-lighter;
      color: $color-danger;
      border-radius: $border-radius-sm;
      font-size: $font-size-sm;
    }

    .invite-link-result {
      margin-top: $spacing-base;
      padding-top: $spacing-base;
      border-top: $border-width-thin solid $color-border;

      label {
        display: block;
        font-size: $font-size-sm;
        font-weight: $font-weight-semibold;
        color: $color-text-secondary;
        margin-bottom: $spacing-xs;
      }
    }

    .link-copy-row {
      display: flex;
      gap: $spacing-sm;

      .link-input {
        flex: 1;
        font-family: monospace;
        font-size: $font-size-sm;
      }
    }

    .status-badge {
      @include badge-base;
      &.admin { background: $color-primary-light; color: $color-primary; }
      &.customer { background: $color-success-light; color: $color-success-text; }
      &.pending { background: #fef3c7; color: #92400e; }
      &.accepted { background: $color-success-light; color: $color-success-text; }
      &.expired { background: $color-gray-50; color: $color-text-muted; }
      &.revoked { background: $color-danger-lighter; color: $color-danger; }
    }

    @include tablet {
      .page-header { flex-direction: column; gap: $spacing-base; align-items: flex-start; }
      .data-table { font-size: $font-size-sm; }
      .invite-form { flex-direction: column; align-items: stretch; }
    }
  `]
})
export class UserListComponent implements OnInit {
  private userService = inject(UserService);
  private customerService = inject(CustomerService);
  private inviteService = inject(InviteService);

  users: UserProfile[] = [];
  customers: Customer[] = [];
  invites: Invite[] = [];
  loading = true;
  userToDelete: UserProfile | null = null;

  inviteEmail = '';
  inviteCustomerId = '';
  creatingInvite = false;
  inviteError = '';
  generatedLink = '';
  linkCopied = false;

  ngOnInit(): void {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
      this.loading = false;
    });

    this.customerService.getCustomers().subscribe(customers => {
      this.customers = customers;
    });

    this.inviteService.getInvites().subscribe(invites => {
      this.invites = invites;
    });
  }

  async toggleRole(user: UserProfile): Promise<void> {
    const newRole = user.role === 'admin' ? 'customer' : 'admin';
    await this.userService.updateUserRole(user.uid, newRole);
  }

  async onCustomerLink(user: UserProfile, customerId: string): Promise<void> {
    await this.userService.linkUserToCustomer(user.uid, customerId || null);
  }

  confirmDelete(user: UserProfile): void {
    this.userToDelete = user;
  }

  async deleteUser(): Promise<void> {
    if (!this.userToDelete) return;
    await this.userService.deleteUser(this.userToDelete.uid);
    this.userToDelete = null;
  }

  async createInvite(): Promise<void> {
    this.inviteError = '';
    this.generatedLink = '';
    this.creatingInvite = true;

    const customer = this.customers.find(c => c.id === this.inviteCustomerId);
    if (!customer) {
      this.inviteError = 'Please select a customer.';
      this.creatingInvite = false;
      return;
    }

    try {
      const invite = await this.inviteService.createInvite(
        this.inviteEmail,
        this.inviteCustomerId,
        customer.companyName
      );
      this.generatedLink = this.inviteService.getInviteLink(invite.token);
      this.inviteEmail = '';
      this.inviteCustomerId = '';
    } catch (err: any) {
      this.inviteError = err.message || 'Failed to create invite.';
    } finally {
      this.creatingInvite = false;
    }
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.generatedLink);
    this.linkCopied = true;
    setTimeout(() => this.linkCopied = false, 2000);
  }

  copyInviteLink(invite: Invite): void {
    const link = this.inviteService.getInviteLink(invite.token);
    navigator.clipboard.writeText(link);
  }

  async revokeInvite(invite: Invite): Promise<void> {
    await this.inviteService.revokeInvite(invite.id);
  }

  formatDate(date: any): string {
    if (!date) return '—';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
