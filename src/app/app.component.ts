import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './services/auth.service';
import { appVersion } from '../environments/version';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-layout" *ngIf="authService.user$ | async as user; else noAuth">
      <nav class="sidebar">
        <div class="sidebar-header">
          <h2>FTA Tracker</h2>
        </div>
        <ul class="nav-links">
          <li><a routerLink="/dashboard" routerLinkActive="active">Dashboard</a></li>
          <li><a routerLink="/time-entries" routerLinkActive="active">Time Entries</a></li>
          <li><a routerLink="/customers" routerLinkActive="active">Customers</a></li>
          <li><a routerLink="/projects" routerLinkActive="active">Projects</a></li>
          <li><a routerLink="/invoices" routerLinkActive="active">Invoices</a></li>
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
    <ng-template #noAuth>
      <router-outlet></router-outlet>
    </ng-template>
  `,
  styleUrl: './app.component.scss'
})
export class AppComponent {
  authService = inject(AuthService);
  version = appVersion;
}
