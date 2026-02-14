import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { customerGuard } from './guards/customer.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/auth', pathMatch: 'full' },

  { path: 'auth', loadComponent: () => import('./components/auth/auth.component').then(m => m.AuthComponent), canActivate: [noAuthGuard] },

  { path: 'dashboard', loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent), canActivate: [authGuard, adminGuard] },

  { path: 'time-entries', loadComponent: () => import('./components/time-entry/time-entry-list.component').then(m => m.TimeEntryListComponent), canActivate: [authGuard, adminGuard] },
  { path: 'time-entries/new', loadComponent: () => import('./components/time-entry/time-entry-form.component').then(m => m.TimeEntryFormComponent), canActivate: [authGuard, adminGuard] },
  { path: 'time-entries/:id/edit', loadComponent: () => import('./components/time-entry/time-entry-form.component').then(m => m.TimeEntryFormComponent), canActivate: [authGuard, adminGuard] },

  { path: 'customers', loadComponent: () => import('./components/customers/customer-list.component').then(m => m.CustomerListComponent), canActivate: [authGuard, adminGuard] },
  { path: 'customers/new', loadComponent: () => import('./components/customers/customer-form.component').then(m => m.CustomerFormComponent), canActivate: [authGuard, adminGuard] },
  { path: 'customers/:id/edit', loadComponent: () => import('./components/customers/customer-form.component').then(m => m.CustomerFormComponent), canActivate: [authGuard, adminGuard] },

  { path: 'projects', loadComponent: () => import('./components/projects/project-list.component').then(m => m.ProjectListComponent), canActivate: [authGuard, adminGuard] },
  { path: 'projects/new', loadComponent: () => import('./components/projects/project-form.component').then(m => m.ProjectFormComponent), canActivate: [authGuard, adminGuard] },
  { path: 'projects/:id/edit', loadComponent: () => import('./components/projects/project-form.component').then(m => m.ProjectFormComponent), canActivate: [authGuard, adminGuard] },

  { path: 'invoices', loadComponent: () => import('./components/invoices/invoice-list.component').then(m => m.InvoiceListComponent), canActivate: [authGuard, adminGuard] },
  { path: 'invoices/generate', loadComponent: () => import('./components/invoices/invoice-generate.component').then(m => m.InvoiceGenerateComponent), canActivate: [authGuard, adminGuard] },
  { path: 'invoices/:id', loadComponent: () => import('./components/invoices/invoice-detail.component').then(m => m.InvoiceDetailComponent), canActivate: [authGuard, adminGuard] },

  { path: 'users', loadComponent: () => import('./components/users/user-list.component').then(m => m.UserListComponent), canActivate: [authGuard, adminGuard] },

  { path: 'portal', loadComponent: () => import('./components/portal/portal-dashboard.component').then(m => m.PortalDashboardComponent), canActivate: [authGuard, customerGuard] },
  { path: 'portal/invoices/:id', loadComponent: () => import('./components/portal/portal-invoice-view.component').then(m => m.PortalInvoiceViewComponent), canActivate: [authGuard, customerGuard] },

  { path: 'invite/:token', loadComponent: () => import('./components/auth/invite-signup.component').then(m => m.InviteSignupComponent), canActivate: [noAuthGuard] },

  { path: '**', redirectTo: '/auth' }
];
