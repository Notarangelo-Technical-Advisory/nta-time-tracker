import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TimeEntryService } from '../../services/time-entry.service';
import { CustomerService } from '../../services/customer.service';
import { ProjectService } from '../../services/project.service';
import { TimeEntry } from '../../models/time-entry.model';
import { Customer } from '../../models/customer.model';
import { Project } from '../../models/project.model';

@Component({
    selector: 'app-time-entry-form',
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    template: `
    <div class="page-container">
      <div class="page-header">
        <h1>{{ isEditMode ? 'Edit Time Entry' : 'New Time Entry' }}</h1>
        <a routerLink="/time-entries" class="btn-secondary">Cancel</a>
      </div>

      <div class="loading-state" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Loading time entry...</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" *ngIf="!loading" class="form-card">
        <div class="form-section">
          <h2>Date & Time</h2>

          <div class="form-group">
            <label class="form-label" for="date">Date <span class="required">*</span></label>
            <input class="form-control" id="date" type="date" formControlName="date">
            <div class="form-error" *ngIf="form.get('date')?.touched && form.get('date')?.hasError('required')">
              Date is required
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="startTime">Start Time <span class="required">*</span></label>
              <select class="form-control" id="startTime" formControlName="startTime" (ngModelChange)="onTimeChange()">
                <option value="">Select start time...</option>
                <option *ngFor="let slot of timeSlots" [value]="slot.value">{{ slot.label }}</option>
              </select>
              <div class="form-error" *ngIf="form.get('startTime')?.touched && form.get('startTime')?.hasError('required')">
                Start time is required
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="endTime">End Time <span class="required">*</span></label>
              <select class="form-control" id="endTime" formControlName="endTime" (ngModelChange)="onTimeChange()">
                <option value="">Select end time...</option>
                <option *ngFor="let slot of timeSlots" [value]="slot.value">{{ slot.label }}</option>
              </select>
              <div class="form-error" *ngIf="form.get('endTime')?.touched && form.get('endTime')?.hasError('required')">
                End time is required
              </div>
            </div>
          </div>

          <div class="duration-display" *ngIf="calculatedDuration > 0">
            <span class="duration-label">Duration:</span>
            <span class="duration-value">{{ calculatedDuration }} {{ calculatedDuration === 1 ? 'hour' : 'hours' }}</span>
          </div>
          <div class="duration-warning" *ngIf="form.get('startTime')?.value && form.get('endTime')?.value && calculatedDuration <= 0">
            End time must be after start time
          </div>
        </div>

        <div class="form-section">
          <h2>Customer & Project</h2>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="customerId">Customer <span class="required">*</span></label>
              <select class="form-control" id="customerId" formControlName="customerId" (change)="onCustomerChange()">
                <option value="">Select a customer...</option>
                <option *ngFor="let c of customers" [value]="c.id">{{ c.companyName }}</option>
              </select>
              <div class="form-error" *ngIf="form.get('customerId')?.touched && form.get('customerId')?.hasError('required')">
                Customer is required
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="projectId">Project <span class="required">*</span></label>
              <select class="form-control" id="projectId" formControlName="projectId" [attr.disabled]="!form.get('customerId')?.value ? '' : null">
                <option value="">{{ form.get('customerId')?.value ? 'Select a project...' : 'Select a customer first' }}</option>
                <option *ngFor="let p of filteredProjects" [value]="p.id">{{ p.projectName }}</option>
              </select>
              <div class="form-error" *ngIf="form.get('projectId')?.touched && form.get('projectId')?.hasError('required')">
                Project is required
              </div>
            </div>
          </div>
        </div>

        <div class="form-section">
          <h2>Details</h2>

          <div class="form-group">
            <label class="form-label" for="description">Description</label>
            <textarea class="form-control" id="description" formControlName="description" rows="3" placeholder="What did you work on?"></textarea>
          </div>
        </div>

        <div class="error-message" *ngIf="error">
          <p>{{ error }}</p>
        </div>

        <div class="form-actions">
          <a routerLink="/time-entries" class="btn-secondary">Cancel</a>
          <button type="submit" class="btn-primary" [disabled]="form.invalid || saving || calculatedDuration <= 0">
            <span class="spinner-border-sm" *ngIf="saving"></span>
            {{ saving ? 'Saving...' : (isEditMode ? 'Update Entry' : 'Log Time') }}
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

    .duration-display {
      display: flex;
      align-items: center;
      gap: $spacing-sm;
      padding: $spacing-md;
      background: $color-secondary-lighter;
      border-radius: $border-radius-base;
      margin-top: $spacing-base;

      .duration-label {
        font-weight: $font-weight-semibold;
        color: $color-text-secondary;
      }

      .duration-value {
        font-size: $font-size-lg;
        font-weight: $font-weight-bold;
        color: $color-secondary-dark;
      }
    }

    .duration-warning {
      padding: $spacing-md;
      background: $color-danger-light;
      color: $color-danger-text;
      border-radius: $border-radius-base;
      margin-top: $spacing-base;
      font-size: $font-size-sm;
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
      min-height: 80px;
    }

    .loading-state {
      text-align: center;
      padding: $spacing-3xl;

      .loading-spinner { @include spinner-base; margin: 0 auto $spacing-base; }
      p { color: $color-text-muted; }
    }
  `]
})
export class TimeEntryFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private timeEntryService = inject(TimeEntryService);
  private customerService = inject(CustomerService);
  private projectService = inject(ProjectService);

  form!: FormGroup;
  customers: Customer[] = [];
  allProjects: Project[] = [];
  filteredProjects: Project[] = [];
  timeSlots = TimeEntryService.generateTimeSlots();
  calculatedDuration = 0;

  isEditMode = false;
  loading = false;
  saving = false;
  error = '';
  private entryId = '';

  ngOnInit(): void {
    const today = new Date().toISOString().split('T')[0];

    this.form = this.fb.group({
      date: [today, Validators.required],
      startTime: ['', Validators.required],
      endTime: ['', Validators.required],
      customerId: ['', Validators.required],
      projectId: ['', Validators.required],
      description: ['']
    });

    this.customerService.getActiveCustomers().subscribe(customers => {
      this.customers = customers;
    });

    // Listen to start/end time changes for duration calculation
    this.form.get('startTime')?.valueChanges.subscribe(() => this.onTimeChange());
    this.form.get('endTime')?.valueChanges.subscribe(() => this.onTimeChange());

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.entryId = id;
      this.loading = true;
      this.timeEntryService.getTimeEntry(id).subscribe(entry => {
        if (entry) {
          // Load projects for the entry's customer first
          this.projectService.getActiveProjectsByCustomer(entry.customerId).subscribe(projects => {
            this.filteredProjects = projects;
            this.form.patchValue({
              date: entry.date,
              startTime: entry.startTime,
              endTime: entry.endTime,
              customerId: entry.customerId,
              projectId: entry.projectId,
              description: entry.description || ''
            });
            this.onTimeChange();
          });
        }
        this.loading = false;
      });
    }
  }

  onCustomerChange(): void {
    const customerId = this.form.get('customerId')?.value;
    this.form.get('projectId')?.setValue('');
    this.filteredProjects = [];

    if (customerId) {
      this.projectService.getActiveProjectsByCustomer(customerId).subscribe(projects => {
        this.filteredProjects = projects;
      });
    }
  }

  onTimeChange(): void {
    const start = this.form.get('startTime')?.value;
    const end = this.form.get('endTime')?.value;
    if (start && end) {
      this.calculatedDuration = TimeEntryService.calculateDuration(start, end);
    } else {
      this.calculatedDuration = 0;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.calculatedDuration <= 0) return;

    this.saving = true;
    this.error = '';

    const data: Partial<TimeEntry> = {
      date: this.form.value.date,
      startTime: this.form.value.startTime,
      endTime: this.form.value.endTime,
      customerId: this.form.value.customerId,
      projectId: this.form.value.projectId,
      durationHours: this.calculatedDuration
    };
    const desc = this.form.value.description?.trim();
    if (desc) data.description = desc;

    try {
      if (this.isEditMode) {
        await this.timeEntryService.updateTimeEntry(this.entryId, data);
      } else {
        await this.timeEntryService.createTimeEntry(data);
      }
      this.router.navigate(['/time-entries']);
    } catch (err: any) {
      this.error = err.message || 'Failed to save time entry';
      this.saving = false;
    }
  }
}
