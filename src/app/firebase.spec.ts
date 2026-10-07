import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appConfig } from './app.config';
import { AUTH, FIREBASE_APP, FIRESTORE, FUNCTIONS } from './firebase';
import { environment } from '../environments/environment';
import { AuthService } from './services/auth.service';
import { CustomerService } from './services/customer.service';
import { InviteService } from './services/invite.service';
import { InvoiceService } from './services/invoice.service';
import { ProjectService } from './services/project.service';
import { StatusReportService } from './services/status-report.service';
import { TimeEntryService } from './services/time-entry.service';
import { UserService } from './services/user.service';

// The app's real providers, as main.ts starts them. Nothing here reads or
// writes data: creating the SDK objects does not contact Firebase.

describe('provideFirebase', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: appConfig.providers }));

  it('connects Auth, Firestore and Functions to the one live project', () => {
    const app = TestBed.inject(FIREBASE_APP);
    expect(app.options.projectId).toBe(environment.firebase.projectId);
    expect(TestBed.inject(AUTH).app).toBe(app);
    expect(TestBed.inject(FIRESTORE).app).toBe(app);
    expect(TestBed.inject(FUNCTIONS).app).toBe(app);
  });

  it('gives every service the Firebase objects it needs', () => {
    const services: Type<unknown>[] = [
      AuthService, CustomerService, InviteService, InvoiceService, ProjectService, StatusReportService,
      TimeEntryService, UserService,
    ];
    for (const service of services) {
      expect(() => TestBed.inject(service)).withContext(service.name).not.toThrow();
    }
  });
});
