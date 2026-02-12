import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerService } from '../../services/customer.service';
import { Customer } from '../../models/customer.model';

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>{{ isEditMode ? 'Edit Customer' : 'New Customer' }}</h1>
        <a routerLink="/customers" class="btn-secondary">Cancel</a>
      </div>

      <div class="loading-state" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Loading customer...</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" *ngIf="!loading" class="form-card">
        <div class="form-section">
          <h2>Company Information</h2>

          <div class="form-group">
            <label class="form-label" for="companyName">Company Name <span class="required">*</span></label>
            <input class="form-control" id="companyName" formControlName="companyName" placeholder="e.g., Acme Corp">
            <div class="form-error" *ngIf="form.get('companyName')?.touched && form.get('companyName')?.hasError('required')">
              Company name is required
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="address">Address</label>
            <textarea class="form-control" id="address" formControlName="address" rows="2" placeholder="Street, City, State, ZIP"></textarea>
          </div>
        </div>

        <div class="form-section">
          <h2>Billable Contact</h2>

          <div class="form-group">
            <label class="form-label" for="billablePersonName">Contact Name <span class="required">*</span></label>
            <input class="form-control" id="billablePersonName" formControlName="billablePersonName" placeholder="e.g., Jane Smith">
            <div class="form-error" *ngIf="form.get('billablePersonName')?.touched && form.get('billablePersonName')?.hasError('required')">
              Billable contact name is required
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="email">Email</label>
              <input class="form-control" id="email" type="email" formControlName="email" placeholder="jane@acme.com">
              <div class="form-error" *ngIf="form.get('email')?.touched && form.get('email')?.hasError('email')">
                Enter a valid email address
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="phone">Phone</label>
              <input class="form-control" id="phone" formControlName="phone" placeholder="(555) 123-4567">
            </div>
          </div>
        </div>

        <div class="form-section">
          <h2>Billing</h2>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="hourlyRate">Hourly Rate ($)</label>
              <input class="form-control" id="hourlyRate" type="number" formControlName="hourlyRate" min="0" step="0.01" placeholder="0.00">
            </div>

            <div class="form-group" *ngIf="isEditMode">
              <label class="form-label" for="isActive">Status</label>
              <select class="form-control" id="isActive" formControlName="isActive">
                <option [ngValue]="true">Active</option>
                <option [ngValue]="false">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        <div class="error-message" *ngIf="error">
          <p>{{ error }}</p>
        </div>

        <div class="form-actions">
          <a routerLink="/customers" class="btn-secondary">Cancel</a>
          <button type="submit" class="btn-primary" [disabled]="form.invalid || saving">
            <span class="spinner-border-sm" *ngIf="saving"></span>
            {{ saving ? 'Saving...' : (isEditMode ? 'Update Customer' : 'Create Customer') }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    @import '../../../styles/tokens';
    @import '../../../styles/mixins';

    .page-container {
      max-width: $container-sm;
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

    .form-card {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      padding: $spacing-xl;
    }

    .form-section {
      margin-bottom: $spacing-xl;
      padding-bottom: $spacing-xl;
      border-bottom: $border-width-thin solid $color-border-light;

      &:last-of-type {
        border-bottom: none;
        margin-bottom: $spacing-base;
        padding-bottom: 0;
      }

      h2 {
        font-size: $font-size-lg;
        font-weight: $font-weight-semibold;
        color: $color-primary;
        margin: 0 0 $spacing-lg 0;
      }
    }

    .form-group { @include form-group; }
    .form-label { @include form-label; }
    .form-control { @include form-control; }
    .form-error { @include form-error; }

    .required { color: $color-danger; }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: $spacing-base;

      @media (max-width: $breakpoint-mobile) {
        grid-template-columns: 1fr;
      }
    }

    .form-actions {
      display: flex;
      gap: $spacing-sm;
      justify-content: flex-end;
      padding-top: $spacing-xl;
      border-top: $border-width-thin solid $color-border-light;
    }

    .error-message { @include message-error; margin-bottom: $spacing-base; }

    .spinner-border-sm { @include spinner-sm; margin-right: $spacing-sm; }

    select.form-control {
      appearance: auto;
    }

    textarea.form-control {
      resize: vertical;
      min-height: 60px;
    }

    .loading-state {
      text-align: center;
      padding: $spacing-3xl;

      .loading-spinner { @include spinner-base; margin: 0 auto $spacing-base; }
      p { color: $color-text-muted; }
    }
  `]
})
export class CustomerFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private customerService = inject(CustomerService);

  form!: FormGroup;
  isEditMode = false;
  loading = false;
  saving = false;
  error = '';
  private customerId = '';

  ngOnInit(): void {
    this.form = this.fb.group({
      companyName: ['', Validators.required],
      address: [''],
      billablePersonName: ['', Validators.required],
      email: ['', Validators.email],
      phone: [''],
      hourlyRate: [null],
      isActive: [true]
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.customerId = id;
      this.loading = true;
      this.customerService.getCustomer(id).subscribe(customer => {
        if (customer) {
          this.form.patchValue({
            companyName: customer.companyName,
            address: customer.address || '',
            billablePersonName: customer.billablePersonName,
            email: customer.email || '',
            phone: customer.phone || '',
            hourlyRate: customer.hourlyRate || null,
            isActive: customer.isActive
          });
        }
        this.loading = false;
      });
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.saving = true;
    this.error = '';

    const data: Partial<Customer> = {
      companyName: this.form.value.companyName.trim(),
      billablePersonName: this.form.value.billablePersonName.trim(),
      isActive: this.form.value.isActive
    };
    const address = this.form.value.address?.trim();
    if (address) data.address = address;
    const email = this.form.value.email?.trim();
    if (email) data.email = email;
    const phone = this.form.value.phone?.trim();
    if (phone) data.phone = phone;
    if (this.form.value.hourlyRate) data.hourlyRate = this.form.value.hourlyRate;

    try {
      if (this.isEditMode) {
        await this.customerService.updateCustomer(this.customerId, data);
      } else {
        await this.customerService.createCustomer(data);
      }
      this.router.navigate(['/customers']);
    } catch (err: any) {
      this.error = err.message || 'Failed to save customer';
      this.saving = false;
    }
  }
}
