import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { StatusReportService } from '../../services/status-report.service';
import { StatusReport } from '../../models/status-report.model';

@Component({
  selector: 'app-status-report-list',
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Status Reports</h1>
          <p class="subtitle">AI-generated client status reports</p>
        </div>
        <a routerLink="/status-reports/generate" class="btn-primary">+ Generate Report</a>
      </div>
    
      <div class="filters">
        <select class="form-control filter-select" [(ngModel)]="statusFilter" (ngModelChange)="filterReports()">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
        </select>
        <input
          type="text"
          class="form-control search-input"
          placeholder="Search by customer or report #..."
          [(ngModel)]="searchTerm"
          (ngModelChange)="filterReports()">
      </div>
    
      @if (loading) {
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Loading reports...</p>
        </div>
      }
    
      @if (!loading && filteredReports.length === 0) {
        <div class="empty-state">
          <h3>No status reports found</h3>
          @if (statusFilter || searchTerm) {
            <p>Try adjusting your filters</p>
          }
          @if (!statusFilter && !searchTerm) {
            <p>Generate your first AI-powered status report</p>
          }
          @if (!statusFilter && !searchTerm) {
            <a routerLink="/status-reports/generate" class="btn-primary">
              + Generate Report
            </a>
          }
        </div>
      }
    
      @if (!loading && filteredReports.length > 0) {
        <table class="data-table">
          <thead>
            <tr>
              <th>Report #</th>
              <th>Customer</th>
              <th>Period</th>
              <th>Projects</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (report of filteredReports; track report) {
              <tr>
                <td class="report-number">{{ report.reportNumber }}</td>
                <td class="customer-name">{{ report.customerName }}</td>
                <td class="period-cell">{{ formatDate(report.periodStart) }} – {{ formatDate(report.periodEnd) }}</td>
                <td class="projects-cell">{{ report.sections?.length ?? 0 }} project{{ (report.sections?.length ?? 0) === 1 ? '' : 's' }}</td>
                <td>
                  <span class="status-badge" [ngClass]="report.status">
                    {{ report.status | titlecase }}
                  </span>
                </td>
                <td class="actions">
                  <a [routerLink]="['/status-reports', report.id]" class="btn-action">View</a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
    `,
  styles: [`
    @import '../../../styles/tokens';
    @import '../../../styles/mixins';

    .page-container { max-width: $container-lg; margin: 0 auto; }

    .page-header {
      @include flex-between;
      margin-bottom: $spacing-xl;

      h1 {
        font-size: $font-size-3xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
        margin: 0;
      }
      .subtitle { color: $color-text-muted; margin: $spacing-xs 0 0 0; }
    }

    .btn-primary { @include button-primary; text-decoration: none; }

    .filters {
      display: flex;
      gap: $spacing-base;
      margin-bottom: $spacing-xl;

      .filter-select { @include form-control; width: auto; min-width: 140px; appearance: auto; }
      .search-input { @include form-control; flex: 1; max-width: 300px; }

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

    .report-number {
      font-family: monospace;
      font-weight: $font-weight-semibold;
      color: $color-primary;
    }
    .customer-name { font-weight: $font-weight-semibold; }
    .period-cell { white-space: nowrap; color: $color-text-muted; font-size: $font-size-sm; }
    .projects-cell { color: $color-text-secondary; font-size: $font-size-sm; }

    .status-badge {
      @include badge-base;
      &.draft { background: $color-gray-100; color: $color-text-muted; }
      &.sent  { background: $color-success-light; color: $color-success-text; }
    }

    .btn-action { @include button-secondary; font-size: $font-size-sm; padding: $spacing-xs $spacing-sm; text-decoration: none; }
    .actions { white-space: nowrap; }

    .loading-state {
      text-align: center; padding: $spacing-3xl;
      .loading-spinner { @include spinner-base; margin: 0 auto $spacing-base; }
      p { color: $color-text-muted; }
    }
    .empty-state {
      text-align: center; padding: $spacing-3xl;
      h3 { color: $color-text-primary; margin-bottom: $spacing-sm; }
      p { color: $color-text-muted; margin-bottom: $spacing-xl; }
    }
  `]
})
export class StatusReportListComponent implements OnInit {
  private statusReportService = inject(StatusReportService);

  reports: StatusReport[] = [];
  filteredReports: StatusReport[] = [];
  loading = true;
  statusFilter = '';
  searchTerm = '';

  ngOnInit(): void {
    this.statusReportService.getStatusReports().subscribe(reports => {
      this.reports = reports;
      this.filterReports();
      this.loading = false;
    });
  }

  filterReports(): void {
    this.filteredReports = this.reports.filter(r => {
      if (this.statusFilter && r.status !== this.statusFilter) return false;
      if (this.searchTerm) {
        const term = this.searchTerm.toLowerCase();
        return r.customerName.toLowerCase().includes(term) ||
          r.reportNumber.toLowerCase().includes(term);
      }
      return true;
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }
}
