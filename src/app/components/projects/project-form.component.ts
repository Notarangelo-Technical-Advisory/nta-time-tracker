import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { CustomerService } from '../../services/customer.service';
import { Project } from '../../models/project.model';
import { Customer } from '../../models/customer.model';

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>{{ isEditMode ? 'Edit Project' : 'New Project' }}</h1>
        <a routerLink="/projects" class="btn-secondary">Cancel</a>
      </div>

      <div class="loading-state" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Loading project...</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" *ngIf="!loading" class="form-card">
        <div class="form-section">
          <h2>Project Details</h2>

          <div class="form-group">
            <label class="form-label" for="customerId">Customer <span class="required">*</span></label>
            <select class="form-control" id="customerId" formControlName="customerId">
              <option value="">Select a customer...</option>
              <option *ngFor="let c of customers" [value]="c.id">{{ c.companyName }}</option>
            </select>
            <div class="form-error" *ngIf="form.get('customerId')?.touched && form.get('customerId')?.hasError('required')">
              Customer is required
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="projectName">Project Name <span class="required">*</span></label>
            <input class="form-control" id="projectName" formControlName="projectName" placeholder="e.g., Website Redesign">
            <div class="form-error" *ngIf="form.get('projectName')?.touched && form.get('projectName')?.hasError('required')">
              Project name is required
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="description">Description</label>
            <textarea class="form-control" id="description" formControlName="description" rows="3" placeholder="Brief description of the project scope"></textarea>
          </div>
        </div>

        <div class="form-section">
          <h2>Billing & Status</h2>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="hourlyRate">Hourly Rate Override ($)</label>
              <input class="form-control" id="hourlyRate" type="number" formControlName="hourlyRate" min="0" step="0.01" placeholder="Leave blank to use customer rate">
            </div>

            <div class="form-group">
              <label class="form-label" for="status">Status</label>
              <select class="form-control" id="status" formControlName="status">
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="on-hold">On Hold</option>
              </select>
            </div>
          </div>
        </div>

        <div class="error-message" *ngIf="error">
          <p>{{ error }}</p>
        </div>

        <div class="form-actions">
          <a routerLink="/projects" class="btn-secondary">Cancel</a>
          <button type="submit" class="btn-primary" [disabled]="form.invalid || saving">
            <span class="spinner-border-sm" *ngIf="saving"></span>
            {{ saving ? 'Saving...' : (isEditMode ? 'Update Project' : 'Create Project') }}
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
export class ProjectFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectService = inject(ProjectService);
  private customerService = inject(CustomerService);

  form!: FormGroup;
  customers: Customer[] = [];
  isEditMode = false;
  loading = false;
  saving = false;
  error = '';
  private projectId = '';

  ngOnInit(): void {
    this.form = this.fb.group({
      customerId: ['', Validators.required],
      projectName: ['', Validators.required],
      description: [''],
      hourlyRate: [null],
      status: ['active']
    });

    this.customerService.getActiveCustomers().subscribe(customers => {
      this.customers = customers;
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.projectId = id;
      this.loading = true;
      this.projectService.getProject(id).subscribe(project => {
        if (project) {
          this.form.patchValue({
            customerId: project.customerId,
            projectName: project.projectName,
            description: project.description || '',
            hourlyRate: project.hourlyRate || null,
            status: project.status
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

    const data: Partial<Project> = {
      customerId: this.form.value.customerId,
      projectName: this.form.value.projectName.trim(),
      status: this.form.value.status
    };
    const description = this.form.value.description?.trim();
    if (description) data.description = description;
    if (this.form.value.hourlyRate) data.hourlyRate = this.form.value.hourlyRate;

    try {
      if (this.isEditMode) {
        await this.projectService.updateProject(this.projectId, data);
      } else {
        await this.projectService.createProject(data);
      }
      this.router.navigate(['/projects']);
    } catch (err: any) {
      this.error = err.message || 'Failed to save project';
      this.saving = false;
    }
  }
}
