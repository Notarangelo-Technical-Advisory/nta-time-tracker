import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TimeEntryListComponent } from './time-entry-list.component';
import {
  EmulatorApp, clearEmulators, createEmulatorApp, provideEmulator, seedDocument, signInAs, waitFor
} from '../../../testing/emulator-testing';

// The summary panel must agree with the invoice: the project rate, else the customer rate,
// else $0, with each entry rounded to the cent.
describe('TimeEntryListComponent summary panel', () => {
  let emulator: EmulatorApp;
  let fixture: ComponentFixture<TimeEntryListComponent> | undefined;

  const entry = (over: Record<string, unknown>) => ({
    date: '2026-11-02', startTime: '09:00', endTime: '10:00', customerId: 'c-a', projectId: 'p-a1',
    durationHours: 1, status: 'unbilled', ...over,
  });

  async function open() {
    await TestBed.configureTestingModule({
      imports: [TimeEntryListComponent],
      providers: [provideRouter([]), ...provideEmulator(emulator)],
    }).compileComponents();
    fixture = TestBed.createComponent(TimeEntryListComponent);
    fixture.detectChanges();
    return fixture;
  }

  function panel(view: ComponentFixture<TimeEntryListComponent>): Record<string, string> {
    const result: Record<string, string> = {};
    view.nativeElement.querySelectorAll('.summary-item').forEach((item: HTMLElement) => {
      result[item.querySelector('.summary-label')!.textContent!.trim()] = item.querySelector('.summary-value')!.textContent!.trim();
    });
    return result;
  }

  beforeEach(async () => {
    await clearEmulators();
    emulator = createEmulatorApp();
    await signInAs(emulator, 'admin');
    await seedDocument('customers/c-a', { customerId: 'CUST-001', companyName: 'Customer A', hourlyRate: 100, isActive: true });
    await seedDocument('customers/c-b', { customerId: 'CUST-002', companyName: 'Customer B', isActive: true });
    await seedDocument('projects/p-a1', { projectId: 'PROJ-001', customerId: 'c-a', projectName: 'Uses customer rate', status: 'active' });
    await seedDocument('projects/p-a2', { projectId: 'PROJ-002', customerId: 'c-a', projectName: 'Own rate', hourlyRate: 150, status: 'active' });
    await seedDocument('projects/p-a3', { projectId: 'PROJ-004', customerId: 'c-a', projectName: 'Low rate', hourlyRate: 10, status: 'active' });
    await seedDocument('projects/p-b1', { projectId: 'PROJ-003', customerId: 'c-b', projectName: 'No rate anywhere', status: 'active' });
  });

  afterEach(async () => {
    fixture?.destroy();
    fixture = undefined;
    await emulator.dispose();
  });

  it('shows the entries, the hours and the unbilled hours and amount, and leaves billed entries out of the amount', async () => {
    await seedDocument('timeEntries/e1', entry({ durationHours: 2 }));                                  // customer rate: 2 x 100 = 200
    await seedDocument('timeEntries/e2', entry({ projectId: 'p-a2', durationHours: 1.5 }));             // project rate: 1.5 x 150 = 225
    await seedDocument('timeEntries/e3', entry({ status: 'billed', durationHours: 4 }));                // not counted in the amount
    await seedDocument('timeEntries/e4', entry({ customerId: 'c-b', projectId: 'p-b1', durationHours: 1 })); // no rate: $0

    const view = await open();
    await waitFor(() => view.componentInstance.unbilledAmount === 425);
    view.detectChanges();

    expect(panel(view)).toEqual({
      'Entries': '4',
      'Total Hours': '8.5',
      'Unbilled': '4.5 hrs',
      'Unbilled Amount': '$425.00',
    });
    expect(view.nativeElement.querySelector('.summary-note').textContent).toContain('1 unbilled entry has no hourly rate');
  });

  it('shows "…" and no rate note while the rates are still loading, then the amount', async () => {
    await seedDocument('timeEntries/e1', entry({ durationHours: 2 }));

    const view = await open();
    const page = view.componentInstance;
    await waitFor(() => page.ratesLoaded && page.filteredEntries.length === 1);

    // Put the page back in the state where the entries have arrived and the projects have not.
    (page as any).projectsLoaded = false;
    page.filterEntries();
    view.detectChanges();
    expect(panel(view)['Unbilled Amount']).toBe('…');
    expect(view.nativeElement.querySelector('.summary-note')).toBeNull();

    (page as any).projectsLoaded = true;
    view.detectChanges();
    expect(panel(view)['Unbilled Amount']).toBe('$200.00');
  });

  it('rounds each entry to the cent, as the invoice does', async () => {
    // The invoice rounds the hours to 2 places first: 0.333 hours at $10 is 0.33 x $10 = $3.30,
    // not $3.33. Two such entries: $6.60. Without the rounding the total would be $6.66.
    await seedDocument('timeEntries/e1', entry({ durationHours: 0.333, projectId: 'p-a3' }));
    await seedDocument('timeEntries/e2', entry({ durationHours: 0.333, projectId: 'p-a3' }));

    const view = await open();
    await waitFor(() => view.componentInstance.unbilledAmount === 6.6);
    view.detectChanges();

    expect(panel(view)['Unbilled Amount']).toBe('$6.60');
    expect(view.nativeElement.querySelector('.summary-note')).toBeNull();
  });
});
