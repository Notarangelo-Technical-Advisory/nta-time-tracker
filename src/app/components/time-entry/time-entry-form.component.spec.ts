import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TimeEntryFormComponent } from './time-entry-form.component';
import {
  EmulatorApp, clearEmulators, createEmulatorApp, listDocuments, provideEmulator, readDocument, seedDocument, signInAs, waitFor
} from '../../../testing/emulator-testing';

@Component({ template: '' })
class TimeEntriesPage {}

// Time is logged to the minute: Maisie posts entries from Jack's work journal
// with their exact start and end times, and this form has to show and keep them.
describe('TimeEntryFormComponent', () => {
  let emulator: EmulatorApp;
  let fixture: ComponentFixture<TimeEntryFormComponent> | undefined;

  async function open(entryId: string | null) {
    await TestBed.configureTestingModule({
      imports: [TimeEntryFormComponent],
      providers: [
        provideRouter([{ path: 'time-entries', component: TimeEntriesPage }]), ...provideEmulator(emulator),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(entryId ? { id: entryId } : {}) } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TimeEntryFormComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    await clearEmulators();
    emulator = createEmulatorApp();
    await signInAs(emulator, 'admin');
    await seedDocument('customers/c-ihrdc', { customerId: 'CUST-001', companyName: 'IHRDC', isActive: true });
    await seedDocument('projects/p-ai', { projectId: 'PROJ-001', customerId: 'c-ihrdc', projectName: 'AI Enablement', status: 'active' });
  });

  afterEach(async () => {
    // Close the page first, so its live listeners stop before Firestore does.
    fixture?.destroy();
    fixture = undefined;
    await emulator.dispose();
  });

  it('logs time to the minute and works out the hours from it', async () => {
    const view = await open(null);
    const page = view.componentInstance;
    page.form.patchValue({ date: '2026-10-13', startTime: '09:12', endTime: '10:05', customerId: 'c-ihrdc', projectId: 'p-ai', description: 'Friday demo' });
    view.detectChanges();

    expect(view.nativeElement.querySelector('.duration-value').textContent).toContain('0.88 hours');
    await page.onSubmit();

    const [saved] = await listDocuments('timeEntries');
    expect(saved).toEqual(jasmine.objectContaining({
      date: '2026-10-13', startTime: '09:12', endTime: '10:05', durationHours: 0.88, status: 'unbilled', description: 'Friday demo',
    }));
  });

  it('offers start and end as time fields that accept any minute, not half-hour lists', async () => {
    const view = await open(null);
    for (const id of ['startTime', 'endTime']) {
      const field: HTMLInputElement = view.nativeElement.querySelector(`#${id}`);
      expect(field.type).toBe('time');
      expect(field.step).toBe('60');
    }
  });

  it('opens an entry Maisie posted at 9:12 with its times intact, and keeps them on save', async () => {
    await seedDocument('timeEntries/e1', {
      date: '2026-10-13', startTime: '09:12', endTime: '10:05', customerId: 'c-ihrdc', projectId: 'p-ai', durationHours: 0.88,
      description: 'Friday demo', status: 'unbilled', source: 'maisie',
    });
    const view = await open('e1');
    const page = view.componentInstance;
    await waitFor(() => page.form.value.startTime === '09:12');
    view.detectChanges();

    expect((view.nativeElement.querySelector('#startTime') as HTMLInputElement).value).toBe('09:12');
    expect((view.nativeElement.querySelector('#endTime') as HTMLInputElement).value).toBe('10:05');

    page.form.patchValue({ description: 'Friday demo and follow-up' });
    await page.onSubmit();

    expect(await readDocument('timeEntries/e1')).toEqual(jasmine.objectContaining({
      startTime: '09:12', endTime: '10:05', durationHours: 0.88, description: 'Friday demo and follow-up',
    }));
  });
});
