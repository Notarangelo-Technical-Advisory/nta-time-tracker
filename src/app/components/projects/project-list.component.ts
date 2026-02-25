import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';
import { CustomerService } from '../../services/customer.service';
import { Project } from '../../models/project.model';
import { Customer } from '../../models/customer.model';

@Component({
    selector: 'app-project-list',
    imports: [CommonModule, RouterLink, FormsModule],
    template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Projects</h1>
          <p class="subtitle">Manage client projects</p>
        </div>
        <a routerLink="/projects/new" class="btn-primary">+ New Project</a>
      </div>

      <div class="filters">
        <input
          type="text"
          class="form-control search-input"
          placeholder="Search projects..."
          [(ngModel)]="searchTerm"
          (ngModelChange)="filterProjects()"
        >
        <select class="form-control filter-select" [(ngModel)]="customerFilter" (ngModelChange)="filterProjects()">
          <option value="">All Customers</option>
          <option *ngFor="let c of customers" [value]="c.id">{{ c.companyName }}</option>
        </select>
        <select class="form-control filter-select" [(ngModel)]="statusFilter" (ngModelChange)="filterProjects()">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="on-hold">On Hold</option>
        </select>
      </div>

      <div class="loading-state" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Loading projects...</p>
      </div>

      <div class="empty-state" *ngIf="!loading && filteredProjects.length === 0">
        <h3>No projects found</h3>
        <p *ngIf="searchTerm || customerFilter || statusFilter">Try adjusting your filters</p>
        <p *ngIf="!searchTerm && !customerFilter && !statusFilter">Get started by adding your first project</p>
        <a routerLink="/projects/new" class="btn-primary" *ngIf="!searchTerm && !customerFilter && !statusFilter">+ Add Project</a>
      </div>

      <table class="data-table" *ngIf="!loading && filteredProjects.length > 0">
        <thead>
          <tr>
            <th>ID</th>
            <th>Project</th>
            <th>Customer</th>
            <th>Rate</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let project of filteredProjects">
            <td class="project-id">{{ project.projectId }}</td>
            <td>
              <div class="project-name">{{ project.projectName }}</div>
              <div class="project-desc" *ngIf="project.description">{{ project.description }}</div>
            </td>
            <td>{{ getCustomerName(project.customerId) }}</td>
            <td>
              <span *ngIf="project.hourlyRate">\${{ project.hourlyRate }}/hr</span>
              <span class="text-muted" *ngIf="!project.hourlyRate">Customer rate</span>
            </td>
            <td>
              <span class="status-badge"
                [class.active]="project.status === 'active'"
                [class.completed]="project.status === 'completed'"
                [class.on-hold]="project.status === 'on-hold'">
                {{ project.status === 'on-hold' ? 'On Hold' : (project.status === 'active' ? 'Active' : 'Completed') }}
              </span>
            </td>
            <td class="actions">
              <a [routerLink]="['/projects', project.id, 'edit']" class="btn-action">Edit</a>
              <button class="btn-action btn-action-danger" (click)="confirmDelete(project)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Delete confirmation modal -->
      <div class="modal-overlay" *ngIf="projectToDelete" (click)="projectToDelete = null">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Delete Project</h3>
          <p>Are you sure you want to delete <strong>{{ projectToDelete.projectName }}</strong>? This action cannot be undone.</p>
          <div class="modal-actions">
            <button class="btn-secondary" (click)="projectToDelete = null">Cancel</button>
            <button class="btn-danger" (click)="deleteProject()">Delete</button>
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
      display: flex;
      gap: $spacing-base;
      margin-bottom: $spacing-xl;

      .search-input {
        @include form-control;
        flex: 1;
        max-width: 300px;
      }

      .filter-select {
        @include form-control;
        width: auto;
        min-width: 160px;
      }

      @media (max-width: $breakpoint-mobile) {
        flex-direction: column;
        .search-input, .filter-select { max-width: 100%; }
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

    .project-id {
      font-family: monospace;
      font-size: $font-size-sm;
      color: $color-text-muted;
    }

    .project-name { font-weight: $font-weight-semibold; }
    .project-desc {
      font-size: $font-size-sm;
      color: $color-text-muted;
      margin-top: $spacing-xs;
      max-width: 300px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .text-muted { color: $color-text-muted; font-style: italic; }

    .status-badge {
      @include badge-base;

      &.active { @include badge-status-active; }
      &.completed {
        background: $color-primary-light;
        color: $color-primary;
      }
      &.on-hold {
        background: $color-warning-light;
        color: $color-warning-dark;
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
      .data-table { font-size: $font-size-sm; }
    }
  `]
})
export class ProjectListComponent implements OnInit {
  private projectService = inject(ProjectService);
  private customerService = inject(CustomerService);

  projects: Project[] = [];
  filteredProjects: Project[] = [];
  customers: Customer[] = [];
  private customerMap = new Map<string, string>();

  searchTerm = '';
  customerFilter = '';
  statusFilter = '';
  loading = true;
  projectToDelete: Project | null = null;

  ngOnInit(): void {
    this.customerService.getCustomers().subscribe(customers => {
      this.customers = customers;
      this.customerMap.clear();
      customers.forEach(c => this.customerMap.set(c.id, c.companyName));
    });

    this.projectService.getProjects().subscribe(projects => {
      this.projects = projects;
      this.filterProjects();
      this.loading = false;
    });
  }

  getCustomerName(customerId: string): string {
    return this.customerMap.get(customerId) || customerId;
  }

  filterProjects(): void {
    let result = this.projects;

    if (this.customerFilter) {
      result = result.filter(p => p.customerId === this.customerFilter);
    }

    if (this.statusFilter) {
      result = result.filter(p => p.status === this.statusFilter);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(p =>
        p.projectName.toLowerCase().includes(term) ||
        p.projectId.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term)) ||
        this.getCustomerName(p.customerId).toLowerCase().includes(term)
      );
    }

    this.filteredProjects = result;
  }

  confirmDelete(project: Project): void {
    this.projectToDelete = project;
  }

  async deleteProject(): Promise<void> {
    if (!this.projectToDelete) return;
    await this.projectService.deleteProject(this.projectToDelete.id);
    this.projectToDelete = null;
  }
}
