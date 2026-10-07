import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './services/auth.service';
import { appVersion } from '../environments/version';

@Component({
    selector: 'app-root',
    imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
    template: `
    @if (authService.user$ | async; as user) {
      <div class="app-layout">
        <nav class="sidebar">
          <div class="sidebar-header">
            <img src="assets/nta-logo.jpg" alt="NTA logo" class="sidebar-logo">
            <h2>Notarangelo Technical Advisory</h2>
            <span class="sidebar-subtitle">Time & Invoicing</span>
          </div>
          <ul class="nav-links">
            @if (isAdmin) {
              <li><a routerLink="/dashboard" routerLinkActive="active">Dashboard</a></li>
              <li><a routerLink="/time-entries" routerLinkActive="active">Time Entries</a></li>
              <li><a routerLink="/customers" routerLinkActive="active">Customers</a></li>
              <li><a routerLink="/projects" routerLinkActive="active">Projects</a></li>
              <li><a routerLink="/invoices" routerLinkActive="active">Invoices</a></li>
              <li><a routerLink="/status-reports" routerLinkActive="active">Status Reports</a></li>
              <li><a routerLink="/reports/hours" routerLinkActive="active">Hours Report</a></li>
              <li><a routerLink="/users" routerLinkActive="active">Users</a></li>
            }
            @if (!isAdmin && userRole === 'customer') {
              <li><a routerLink="/portal" routerLinkActive="active">My Dashboard</a></li>
            }
          </ul>
          <div class="sidebar-footer">
            <button class="btn-logout" (click)="authService.signOutUser()">Sign Out</button>
            <span class="version-label">v{{ version }}</span>
          </div>
        </nav>
        <main class="main-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    } @else {
      <router-outlet></router-outlet>
    }
    `,
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  authService = inject(AuthService);
  version = appVersion;
  isAdmin = false;
  userRole: 'admin' | 'customer' | null = null;

  ngOnInit(): void {
    this.authService.user$.subscribe(async user => {
      if (user) {
        this.userRole = await this.authService.getCurrentUserRole();
        this.isAdmin = this.userRole === 'admin';
      } else {
        this.userRole = null;
        this.isAdmin = false;
      }
    });
  }
}
