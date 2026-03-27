import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TimeEntryService } from '../../services/time-entry.service';
import { CustomerService } from '../../services/customer.service';
import { TimeEntry } from '../../models/time-entry.model';
import { Customer } from '../../models/customer.model';
import jsPDF from 'jspdf';

interface WeekData {
  weekLabel: string;       // e.g. "Mar 3"
  weekStart: string;       // YYYY-MM-DD
  weekEnd: string;         // YYYY-MM-DD
  unbilled: number;
  billed: number;
  paid: number;
  total: number;
}

interface BarSegment {
  y: number;
  height: number;
  color: string;
  label: string;
  hours: number;
}

interface ChartBar {
  x: number;
  width: number;
  weekLabel: string;
  weekRange: string;
  total: number;
  segments: BarSegment[];
}

@Component({
  selector: 'app-hours-report',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Hours Report</h1>
          <p class="subtitle">Weekly hours breakdown by billing status</p>
        </div>
        <button class="btn-primary" (click)="exportPdf()" [disabled]="!weeks.length">
          Export PDF
        </button>
      </div>

      <!-- Filters -->
      <div class="filters">
        <div class="filter-row">
          <div class="filter-group">
            <label class="filter-label">Customer</label>
            <select class="form-control" [(ngModel)]="selectedCustomerId" (ngModelChange)="onFilterChange()">
              <option value="">All Customers</option>
              <option *ngFor="let c of customers" [value]="c.id">{{ c.companyName }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">From</label>
            <input type="date" class="form-control" [(ngModel)]="dateFrom" (ngModelChange)="onFilterChange()">
          </div>
          <div class="filter-group">
            <label class="filter-label">To</label>
            <input type="date" class="form-control" [(ngModel)]="dateTo" (ngModelChange)="onFilterChange()">
          </div>
          <div class="filter-group filter-group-actions">
            <label class="filter-label">&nbsp;</label>
            <div class="preset-buttons">
              <button class="btn-preset" [class.active]="activePeriod === 'last4w'" (click)="setPreset('last4w')">Last 4 Weeks</button>
              <button class="btn-preset" [class.active]="activePeriod === 'last3m'" (click)="setPreset('last3m')">Last 3 Months</button>
              <button class="btn-preset" [class.active]="activePeriod === 'ytd'" (click)="setPreset('ytd')">YTD</button>
              <button class="btn-preset" [class.active]="activePeriod === 'all'" (click)="setPreset('all')">All Time</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div class="loading-state" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Loading entries...</p>
      </div>

      <!-- Empty -->
      <div class="empty-state" *ngIf="!loading && !weeks.length">
        <h3>No data found</h3>
        <p>No time entries match the selected filters.</p>
      </div>

      <!-- Chart -->
      <div class="chart-card" *ngIf="!loading && weeks.length" id="chart-export-area">
        <div class="chart-header">
          <div class="chart-title-row">
            <h2 class="chart-title">Weekly Hours</h2>
            <span class="chart-subtitle" *ngIf="selectedCustomerName">{{ selectedCustomerName }}</span>
            <span class="chart-subtitle" *ngIf="!selectedCustomerId">All Customers</span>
          </div>
          <div class="chart-legend">
            <span class="legend-item unbilled"><span class="legend-swatch"></span>Unbilled</span>
            <span class="legend-item billed"><span class="legend-swatch"></span>Billed</span>
            <span class="legend-item paid"><span class="legend-swatch"></span>Paid</span>
          </div>
        </div>

        <!-- SVG Chart -->
        <div class="chart-container" #chartContainer>
          <svg [attr.width]="svgWidth" [attr.height]="svgHeight" class="chart-svg">
            <!-- Y-axis gridlines & labels -->
            <g *ngFor="let tick of yTicks">
              <line
                [attr.x1]="chartLeft"
                [attr.y1]="yScale(tick)"
                [attr.x2]="chartLeft + chartWidth"
                [attr.y2]="yScale(tick)"
                class="grid-line"
              />
              <text
                [attr.x]="chartLeft - 8"
                [attr.y]="yScale(tick) + 4"
                class="axis-label y-label">{{ tick }}</text>
            </g>

            <!-- Bars -->
            <g *ngFor="let bar of chartBars">
              <g *ngFor="let seg of bar.segments">
                <rect
                  [attr.x]="bar.x"
                  [attr.y]="seg.y"
                  [attr.width]="bar.width"
                  [attr.height]="seg.height"
                  [class]="'bar-seg bar-seg-' + seg.label"
                  rx="2"
                />
              </g>
              <!-- X-axis label -->
              <text
                [attr.x]="bar.x + bar.width / 2"
                [attr.y]="chartBottom + 16"
                class="axis-label x-label">{{ bar.weekLabel }}</text>
              <!-- Total label on top -->
              <text
                *ngIf="bar.total > 0"
                [attr.x]="bar.x + bar.width / 2"
                [attr.y]="yScale(bar.total) - 4"
                class="bar-total-label">{{ bar.total | number:'1.1-1' }}</text>
            </g>

            <!-- Axes -->
            <line [attr.x1]="chartLeft" [attr.y1]="chartTop" [attr.x2]="chartLeft" [attr.y2]="chartBottom" class="axis-line"/>
            <line [attr.x1]="chartLeft" [attr.y1]="chartBottom" [attr.x2]="chartLeft + chartWidth" [attr.y2]="chartBottom" class="axis-line"/>

            <!-- Y-axis title -->
            <text
              [attr.x]="14"
              [attr.y]="chartTop + chartHeight / 2"
              class="axis-title"
              [attr.transform]="'rotate(-90, 14, ' + (chartTop + chartHeight / 2) + ')'">Hours</text>
          </svg>
        </div>

        <!-- Summary Stats -->
        <div class="stats-row">
          <div class="stat-card">
            <span class="stat-label">Total Hours</span>
            <span class="stat-value">{{ totalHours | number:'1.1-1' }}</span>
          </div>
          <div class="stat-card unbilled">
            <span class="stat-label">Unbilled</span>
            <span class="stat-value">{{ unbilledTotal | number:'1.1-1' }}</span>
          </div>
          <div class="stat-card billed">
            <span class="stat-label">Billed</span>
            <span class="stat-value">{{ billedTotal | number:'1.1-1' }}</span>
          </div>
          <div class="stat-card paid">
            <span class="stat-label">Paid</span>
            <span class="stat-value">{{ paidTotal | number:'1.1-1' }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Weeks Shown</span>
            <span class="stat-value">{{ weeks.length }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Avg Hrs / Week</span>
            <span class="stat-value">{{ avgWeeklyHours | number:'1.1-1' }}</span>
          </div>
        </div>

        <!-- Weekly Data Table -->
        <div class="table-section">
          <h3 class="table-title">Weekly Breakdown</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Week of</th>
                <th>Unbilled</th>
                <th>Billed</th>
                <th>Paid</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let w of weeks">
                <td class="week-cell">{{ w.weekLabel }}</td>
                <td class="hours-cell unbilled-text">{{ w.unbilled > 0 ? (w.unbilled | number:'1.1-1') : '—' }}</td>
                <td class="hours-cell billed-text">{{ w.billed > 0 ? (w.billed | number:'1.1-1') : '—' }}</td>
                <td class="hours-cell paid-text">{{ w.paid > 0 ? (w.paid | number:'1.1-1') : '—' }}</td>
                <td class="hours-cell total-text">{{ w.total | number:'1.1-1' }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td>Total</td>
                <td class="unbilled-text">{{ unbilledTotal | number:'1.1-1' }}</td>
                <td class="billed-text">{{ billedTotal | number:'1.1-1' }}</td>
                <td class="paid-text">{{ paidTotal | number:'1.1-1' }}</td>
                <td class="total-text">{{ totalHours | number:'1.1-1' }}</td>
              </tr>
            </tfoot>
          </table>
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

    .btn-primary { @include button-primary; }

    .filters {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      padding: $spacing-base;
      margin-bottom: $spacing-xl;
    }

    .filter-row {
      display: flex;
      gap: $spacing-base;
      flex-wrap: wrap;
      align-items: flex-end;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: $spacing-xs;
      flex: 1;
      min-width: 150px;

      .filter-label {
        font-size: $font-size-sm;
        font-weight: $font-weight-semibold;
        color: $color-text-secondary;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
      }

      .form-control { @include form-control; }
      select.form-control { appearance: auto; }
    }

    .filter-group-actions {
      flex: 2;
      min-width: 280px;
    }

    .preset-buttons {
      display: flex;
      gap: $spacing-xs;
      flex-wrap: wrap;
    }

    .btn-preset {
      padding: $spacing-xs $spacing-sm;
      border: $border-width-thin solid $color-border;
      border-radius: $border-radius-sm;
      background: $color-white;
      color: $color-text-secondary;
      font-size: $font-size-sm;
      cursor: pointer;
      transition: $transition-all;
      white-space: nowrap;

      &:hover, &.active {
        background: $color-primary;
        color: $color-white;
        border-color: $color-primary;
      }
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
      p { color: $color-text-muted; }
    }

    .chart-card {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      padding: $spacing-xl;
    }

    .chart-header {
      @include flex-between;
      margin-bottom: $spacing-lg;
      flex-wrap: wrap;
      gap: $spacing-base;
    }

    .chart-title-row {
      display: flex;
      align-items: baseline;
      gap: $spacing-base;

      .chart-title {
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
        margin: 0;
      }

      .chart-subtitle {
        color: $color-text-muted;
        font-size: $font-size-base;
      }
    }

    .chart-legend {
      display: flex;
      gap: $spacing-lg;
      align-items: center;

      .legend-item {
        display: flex;
        align-items: center;
        gap: $spacing-xs;
        font-size: $font-size-sm;
        color: $color-text-secondary;

        .legend-swatch {
          width: 12px;
          height: 12px;
          border-radius: $border-radius-xs;
          display: inline-block;
        }

        &.unbilled .legend-swatch { background: #F59E0B; }
        &.billed .legend-swatch { background: #1E3A8A; }
        &.paid .legend-swatch { background: #10B981; }
      }
    }

    .chart-container {
      overflow-x: auto;
      margin-bottom: $spacing-xl;
    }

    .chart-svg {
      display: block;
      min-width: 100%;

      .grid-line {
        stroke: $color-border-light;
        stroke-width: 1;
      }

      .axis-line {
        stroke: $color-border;
        stroke-width: 1.5;
      }

      .axis-label {
        font-size: 11px;
        fill: $color-text-muted;
        text-anchor: middle;
        font-family: Inter, sans-serif;

        &.y-label {
          text-anchor: end;
        }
      }

      .axis-title {
        font-size: 11px;
        fill: $color-text-muted;
        text-anchor: middle;
        font-family: Inter, sans-serif;
      }

      .bar-total-label {
        font-size: 10px;
        fill: $color-text-secondary;
        text-anchor: middle;
        font-family: Inter, sans-serif;
        font-weight: 600;
      }

      .bar-seg-unbilled { fill: #F59E0B; }
      .bar-seg-billed   { fill: #1E3A8A; }
      .bar-seg-paid     { fill: #10B981; }
    }

    .stats-row {
      display: flex;
      gap: $spacing-base;
      flex-wrap: wrap;
      margin-bottom: $spacing-xl;
    }

    .stat-card {
      flex: 1;
      min-width: 100px;
      padding: $spacing-md $spacing-base;
      background: $color-gray-50;
      border-radius: $border-radius-md;
      display: flex;
      flex-direction: column;
      gap: $spacing-xs;

      .stat-label {
        font-size: $font-size-sm;
        color: $color-text-muted;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
      }

      .stat-value {
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
      }

      &.unbilled .stat-value { color: #D97706; }
      &.billed .stat-value   { color: $color-primary; }
      &.paid .stat-value     { color: $color-success; }
    }

    .table-section {
      .table-title {
        font-size: $font-size-lg;
        font-weight: $font-weight-semibold;
        color: $color-text-primary;
        margin: 0 0 $spacing-base 0;
      }
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;

      th, td {
        padding: $spacing-sm $spacing-base;
        text-align: left;
        border-bottom: $border-width-thin solid $color-border;
        font-size: $font-size-base;
      }

      th {
        font-weight: $font-weight-semibold;
        color: $color-text-secondary;
        font-size: $font-size-sm;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
        background: $color-gray-50;
      }

      .week-cell { font-weight: $font-weight-semibold; }

      .hours-cell { font-variant-numeric: tabular-nums; }
      .unbilled-text { color: #D97706; }
      .billed-text   { color: $color-primary; }
      .paid-text     { color: $color-success; }
      .total-text    { font-weight: $font-weight-bold; color: $color-text-primary; }

      tfoot .total-row {
        td {
          font-weight: $font-weight-bold;
          background: $color-gray-50;
          border-top: $border-width-base solid $color-border;
        }
      }
    }

    @include tablet {
      .page-header { flex-direction: column; gap: $spacing-base; align-items: flex-start; }
      .filter-row { flex-direction: column; }
      .stats-row { flex-wrap: wrap; }
    }
  `]
})
export class HoursReportComponent implements OnInit, OnDestroy {
  private timeEntryService = inject(TimeEntryService);
  private customerService = inject(CustomerService);
  private sub: Subscription | null = null;

  customers: Customer[] = [];
  selectedCustomerId = '';
  dateFrom = '';
  dateTo = '';
  activePeriod = 'last3m';
  loading = true;

  private allEntries: TimeEntry[] = [];
  weeks: WeekData[] = [];

  // Chart geometry
  svgWidth = 900;
  svgHeight = 340;
  chartLeft = 50;
  chartTop = 20;
  get chartBottom() { return this.svgHeight - 40; }
  get chartWidth() { return this.svgWidth - this.chartLeft - 20; }
  get chartHeight() { return this.chartBottom - this.chartTop; }

  yTicks: number[] = [];
  chartBars: ChartBar[] = [];

  // Totals
  totalHours = 0;
  unbilledTotal = 0;
  billedTotal = 0;
  paidTotal = 0;
  get avgWeeklyHours() {
    return this.weeks.length ? this.totalHours / this.weeks.length : 0;
  }

  get selectedCustomerName(): string {
    if (!this.selectedCustomerId) return '';
    return this.customers.find(c => c.id === this.selectedCustomerId)?.companyName ?? '';
  }

  ngOnInit(): void {
    this.customerService.getCustomers().subscribe(c => { this.customers = c; });
    this.setPreset('last3m');

    this.sub = this.timeEntryService.getTimeEntries().subscribe(entries => {
      this.allEntries = entries;
      this.buildReport();
      this.loading = false;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onFilterChange(): void {
    this.activePeriod = '';
    this.buildReport();
  }

  setPreset(period: string): void {
    this.activePeriod = period;
    const today = new Date();
    const yyyy = today.getFullYear();

    if (period === 'last4w') {
      const from = new Date(today);
      from.setDate(today.getDate() - 28);
      this.dateFrom = this.toDateStr(from);
      this.dateTo = this.toDateStr(today);
    } else if (period === 'last3m') {
      const from = new Date(today);
      from.setMonth(today.getMonth() - 3);
      this.dateFrom = this.toDateStr(from);
      this.dateTo = this.toDateStr(today);
    } else if (period === 'ytd') {
      this.dateFrom = `${yyyy}-01-01`;
      this.dateTo = this.toDateStr(today);
    } else {
      this.dateFrom = '';
      this.dateTo = '';
    }
    this.buildReport();
  }

  private toDateStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  private buildReport(): void {
    let entries = this.allEntries;

    if (this.selectedCustomerId) {
      entries = entries.filter(e => e.customerId === this.selectedCustomerId);
    }
    if (this.dateFrom) {
      entries = entries.filter(e => e.date >= this.dateFrom);
    }
    if (this.dateTo) {
      entries = entries.filter(e => e.date <= this.dateTo);
    }

    if (!entries.length) {
      this.weeks = [];
      this.chartBars = [];
      this.yTicks = [];
      this.totalHours = 0;
      this.unbilledTotal = 0;
      this.billedTotal = 0;
      this.paidTotal = 0;
      return;
    }

    // Determine date range
    const dates = entries.map(e => e.date).sort();
    const rangeFrom = this.dateFrom || dates[0];
    const rangeTo = this.dateTo || dates[dates.length - 1];

    // Generate weekly buckets (Monday-start)
    const weeks = this.generateWeeks(rangeFrom, rangeTo);

    // Bucket entries
    const weekMap = new Map<string, WeekData>();
    for (const w of weeks) {
      weekMap.set(w.weekStart, w);
    }

    for (const entry of entries) {
      const wStart = this.getMondayOf(entry.date);
      if (!weekMap.has(wStart)) continue;
      const w = weekMap.get(wStart)!;
      if (entry.status === 'unbilled') w.unbilled += entry.durationHours;
      else if (entry.status === 'billed') w.billed += entry.durationHours;
      else if (entry.status === 'paid') w.paid += entry.durationHours;
      w.total = Math.round((w.unbilled + w.billed + w.paid) * 100) / 100;
    }

    this.weeks = weeks;
    this.totalHours = weeks.reduce((s, w) => s + w.total, 0);
    this.unbilledTotal = Math.round(weeks.reduce((s, w) => s + w.unbilled, 0) * 100) / 100;
    this.billedTotal = Math.round(weeks.reduce((s, w) => s + w.billed, 0) * 100) / 100;
    this.paidTotal = Math.round(weeks.reduce((s, w) => s + w.paid, 0) * 100) / 100;
    this.totalHours = Math.round(this.totalHours * 100) / 100;

    this.buildChart();
  }

  private generateWeeks(fromDate: string, toDate: string): WeekData[] {
    const weeks: WeekData[] = [];
    let current = this.getMondayOf(fromDate);
    const end = this.getMondayOf(toDate);

    while (current <= end) {
      const weekEnd = this.addDays(current, 6);
      const d = new Date(current + 'T00:00:00');
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      weeks.push({
        weekLabel: label,
        weekStart: current,
        weekEnd: weekEnd,
        unbilled: 0,
        billed: 0,
        paid: 0,
        total: 0
      });
      current = this.addDays(current, 7);
    }
    return weeks;
  }

  private getMondayOf(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay(); // 0=Sun
    const diff = (day === 0) ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return this.toDateStr(d);
  }

  private addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return this.toDateStr(d);
  }

  private buildChart(): void {
    const maxTotal = Math.max(...this.weeks.map(w => w.total), 1);
    const niceMax = this.niceMax(maxTotal);

    // Y ticks: 5 ticks
    this.yTicks = [];
    const step = niceMax / 5;
    for (let i = 0; i <= 5; i++) {
      this.yTicks.push(Math.round(step * i * 10) / 10);
    }

    // Compute chart width based on number of weeks (min 40px per bar)
    const minBarWidth = 24;
    const barGap = 8;
    const totalBarsWidth = this.weeks.length * (minBarWidth + barGap);
    this.svgWidth = Math.max(totalBarsWidth + this.chartLeft + 20, 600);

    const availWidth = this.svgWidth - this.chartLeft - 20;
    const barWidth = Math.min(48, Math.max(minBarWidth, (availWidth / this.weeks.length) - barGap));

    this.chartBars = this.weeks.map((w, i) => {
      const totalPerBar = availWidth / this.weeks.length;
      const x = this.chartLeft + i * totalPerBar + (totalPerBar - barWidth) / 2;

      // Stack: unbilled at bottom, billed in middle, paid on top
      const segments: BarSegment[] = [];

      const order: { key: 'unbilled' | 'billed' | 'paid'; color: string }[] = [
        { key: 'unbilled', color: '#F59E0B' },
        { key: 'billed',   color: '#1E3A8A' },
        { key: 'paid',     color: '#10B981' },
      ];

      let stackBottom = this.chartBottom;
      for (const { key, color } of order) {
        const hrs = w[key];
        if (hrs > 0) {
          const h = (hrs / niceMax) * this.chartHeight;
          stackBottom -= h;
          segments.push({
            y: stackBottom,
            height: Math.max(h, 1),
            color,
            label: key,
            hours: hrs
          });
        }
      }

      return {
        x,
        width: barWidth,
        weekLabel: w.weekLabel,
        weekRange: `${w.weekStart} – ${w.weekEnd}`,
        total: w.total,
        segments
      };
    });
  }

  yScale(value: number): number {
    const niceMax = this.yTicks[this.yTicks.length - 1] || 1;
    return this.chartBottom - (value / niceMax) * this.chartHeight;
  }

  private niceMax(val: number): number {
    if (val <= 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(val)));
    const normalized = val / magnitude;
    let nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * magnitude * 1.1; // 10% headroom
  }

  async exportPdf(): Promise<void> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 15;

    // ── Branded header bar (matches invoice PDF style) ──────────────────────
    const headerH = 22;
    doc.setFillColor(30, 58, 138);          // $color-primary #1E3A8A
    doc.rect(0, 0, pageW, headerH, 'F');

    // NTA logo (top-left inside header)
    try {
      const response = await fetch('assets/nta-logo.jpg');
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      doc.addImage(base64, 'JPEG', margin, 3, 32, 11);
    } catch {
      // Logo unavailable — skip silently
    }

    // Report title in header (right side)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('HOURS REPORT', pageW - margin, 10, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 200, 240);
    doc.text('Notarangelo Technical Advisory', pageW - margin, 16, { align: 'right' });

    // ── Sub-header row below blue bar ────────────────────────────────────────
    let y = headerH + 8;
    const customerLabel = this.selectedCustomerName || 'All Customers';
    const periodLabel = this.dateFrom && this.dateTo
      ? `${this.dateFrom} to ${this.dateTo}`
      : this.dateFrom ? `From ${this.dateFrom}` : this.dateTo ? `To ${this.dateTo}` : 'All Time';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(44, 62, 80);
    doc.text(customerLabel, margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text(`Period: ${periodLabel}`, margin, y + 5);

    // Generated date (right)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageW - margin, y + 5, { align: 'right' });

    // Thin blue divider line
    y += 10;
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 5;

    // Summary stats box
    y += 10;
    const stats = [
      { label: 'Total Hours', value: this.totalHours.toFixed(1) },
      { label: 'Unbilled', value: this.unbilledTotal.toFixed(1) },
      { label: 'Billed', value: this.billedTotal.toFixed(1) },
      { label: 'Paid', value: this.paidTotal.toFixed(1) },
      { label: 'Weeks', value: String(this.weeks.length) },
      { label: 'Avg/Week', value: this.avgWeeklyHours.toFixed(1) },
    ];
    const statCols = stats.length;
    const statW = (pageW - margin * 2) / statCols;
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(margin, y, pageW - margin * 2, 18, 2, 2, 'F');

    stats.forEach((s, i) => {
      const cx = margin + i * statW + statW / 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(108, 117, 125);
      doc.text(s.label.toUpperCase(), cx, y + 6, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(44, 62, 80);
      doc.text(s.value, cx, y + 13, { align: 'center' });
    });

    y += 24;

    // Chart drawn with jsPDF primitives
    const chartH = 60;
    const chartL = margin + 20;
    const chartW = pageW - chartL - margin;
    const chartBottom = y + chartH;

    // Axes
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(chartL, y, chartL, chartBottom);
    doc.line(chartL, chartBottom, chartL + chartW, chartBottom);

    const maxTotal = Math.max(...this.weeks.map(w => w.total), 1);
    const niceMax = this.niceMax(maxTotal);
    const numTicks = 5;

    // Y gridlines and labels
    for (let t = 0; t <= numTicks; t++) {
      const val = (niceMax / numTicks) * t;
      const tickY = chartBottom - (val / niceMax) * chartH;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(chartL, tickY, chartL + chartW, tickY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(130, 130, 130);
      doc.text(val.toFixed(1), chartL - 2, tickY + 1, { align: 'right' });
    }

    // Bars
    const barSlot = chartW / this.weeks.length;
    const barW = Math.min(10, barSlot * 0.7);

    this.weeks.forEach((w, i) => {
      const bx = chartL + i * barSlot + (barSlot - barW) / 2;
      let stackBottom = chartBottom;

      const order: { key: 'unbilled' | 'billed' | 'paid'; r: number; g: number; b: number }[] = [
        { key: 'unbilled', r: 245, g: 158, b: 11 },
        { key: 'billed',   r: 30,  g: 58,  b: 138 },
        { key: 'paid',     r: 16,  g: 185, b: 129 },
      ];

      for (const { key, r, g, b } of order) {
        const hrs = w[key];
        if (hrs > 0) {
          const bh = (hrs / niceMax) * chartH;
          doc.setFillColor(r, g, b);
          doc.rect(bx, stackBottom - bh, barW, bh, 'F');
          stackBottom -= bh;
        }
      }

      // X label (every 2nd if many weeks)
      if (this.weeks.length <= 16 || i % 2 === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(130, 130, 130);
        doc.text(w.weekLabel, bx + barW / 2, chartBottom + 4, { align: 'center' });
      }
    });

    // Legend
    y = chartBottom + 10;
    const legend = [
      { label: 'Unbilled', r: 245, g: 158, b: 11 },
      { label: 'Billed',   r: 30,  g: 58,  b: 138 },
      { label: 'Paid',     r: 16,  g: 185, b: 129 },
    ];
    let lx = margin;
    for (const l of legend) {
      doc.setFillColor(l.r, l.g, l.b);
      doc.rect(lx, y - 3, 4, 4, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.text(l.label, lx + 6, y);
      lx += 28;
    }

    // Table
    y += 8;
    const colW = [38, 35, 35, 35, 35];
    const headers = ['Week of', 'Unbilled', 'Billed', 'Paid', 'Total'];
    const colColors: [number, number, number][] = [
      [44, 62, 80],
      [180, 100, 0],
      [30, 58, 138],
      [5, 100, 70],
      [44, 62, 80],
    ];

    // Header row
    doc.setFillColor(248, 249, 250);
    doc.rect(margin, y - 4, pageW - margin * 2, 7, 'F');
    let cx = margin;
    headers.forEach((h, ci) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.text(h, cx + (ci === 0 ? 0 : colW[ci] / 2), y, { align: ci === 0 ? 'left' : 'center' });
      cx += colW[ci];
    });

    y += 5;
    const rowH = 5.5;

    const rowsPerPage = Math.floor((pageH - y - margin) / rowH);

    this.weeks.forEach((w, idx) => {
      if (idx > 0 && idx % rowsPerPage === 0) {
        doc.addPage();
        y = margin;
      }
      if (idx % 2 === 0) {
        doc.setFillColor(252, 252, 252);
        doc.rect(margin, y - 3.5, pageW - margin * 2, rowH, 'F');
      }

      const cells = [
        w.weekLabel,
        w.unbilled > 0 ? w.unbilled.toFixed(1) : '—',
        w.billed > 0   ? w.billed.toFixed(1)   : '—',
        w.paid > 0     ? w.paid.toFixed(1)      : '—',
        w.total.toFixed(1),
      ];
      cx = margin;
      cells.forEach((cell, ci) => {
        doc.setFont(ci === 0 || ci === 4 ? 'helvetica' : 'helvetica', ci === 4 ? 'bold' : 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...colColors[ci]);
        doc.text(cell, cx + (ci === 0 ? 0 : colW[ci] / 2), y, { align: ci === 0 ? 'left' : 'center' });
        cx += colW[ci];
      });
      y += rowH;
    });

    // Total row
    doc.setFillColor(240, 244, 255);
    doc.rect(margin, y - 3.5, pageW - margin * 2, rowH, 'F');
    const totalCells = ['Total', this.unbilledTotal.toFixed(1), this.billedTotal.toFixed(1), this.paidTotal.toFixed(1), this.totalHours.toFixed(1)];
    cx = margin;
    totalCells.forEach((cell, ci) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...colColors[ci]);
      doc.text(cell, cx + (ci === 0 ? 0 : colW[ci] / 2), y, { align: ci === 0 ? 'left' : 'center' });
      cx += colW[ci];
    });

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    // Footer with branding line
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(108, 117, 125);
    doc.text('Notarangelo Technical Advisory  |  Hours Report  |  Confidential', pageW / 2, pageH - 7, { align: 'center' });

    const fileName = `hours-report-${this.selectedCustomerName ? this.selectedCustomerName.replace(/\s+/g, '-').toLowerCase() + '-' : ''}${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }
}
