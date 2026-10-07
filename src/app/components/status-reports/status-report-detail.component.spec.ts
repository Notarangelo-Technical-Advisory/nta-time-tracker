import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { StatusReportDetailComponent } from './status-report-detail.component';
import {
  EmulatorApp, clearEmulators, createEmulatorApp, provideEmulator, readDocument, seedDocument, signInAs, waitFor
} from '../../../testing/emulator-testing';

// The status report page against the emulators, signed in as an admin.
// See "Status Reports — zero-activity sections are orphans" in AGENTS.md.

describe('StatusReportDetailComponent', () => {
  let emulator: EmulatorApp;
  let fixture: ComponentFixture<StatusReportDetailComponent>;

  beforeEach(async () => {
    await clearEmulators();
    emulator = createEmulatorApp();
    await signInAs(emulator, 'admin');
    await seedDocument('statusReports/rpt-1', {
      reportNumber: 'RPT-2026-001', customerId: 'cust-1', customerName: 'IHRDC',
      periodStart: '2026-09-01', periodEnd: '2026-09-05', timeEntryIds: [], status: 'draft',
      createdAt: new Date(), updatedAt: new Date(),
      sections: [
        // An orphan: an old outcome record left behind by a project rename.
        { projectName: 'Old name', activities: [], outcomes: ['Actual: Repos moved'] },
        { projectName: 'GitHub migration', activities: ['Moved 40 repos', 'Set up branch rules'], outcomes: ['Actual: Repos moved'] },
      ],
    });
    await TestBed.configureTestingModule({
      imports: [StatusReportDetailComponent],
      providers: [
        provideRouter([]), ...provideEmulator(emulator),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'rpt-1' }) } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(StatusReportDetailComponent);
    fixture.autoDetectChanges();
    await waitFor(() => fixture.componentInstance.report !== null && fixture.nativeElement.textContent.includes('Moved 40 repos'));
  });

  afterEach(async () => {
    // Close the page first, so its live listeners stop before Firestore does.
    fixture.destroy();
    await emulator.dispose();
  });

  const text = (): string => fixture.nativeElement.textContent;

  it('shows the sections with activities and hides the orphan', () => {
    expect(text()).toContain('GitHub migration');
    expect(text()).not.toContain('Old name');
  });

  it('saves an edit to the section shown, not to the hidden orphan before it', async () => {
    const items = fixture.nativeElement.querySelectorAll('.item-text') as NodeListOf<HTMLElement>;
    const second = Array.from(items).find((el) => el.textContent!.trim() === 'Set up branch rules')!;
    second.click();
    fixture.componentInstance.editValue = 'Set up branch protection rules';

    await fixture.componentInstance.saveEdit(1, 'activity', 1);

    const stored = await readDocument('statusReports/rpt-1');
    expect(stored!['sections'][0]['activities']).toEqual([]);
    expect(stored!['sections'][1]['activities']).toEqual(['Moved 40 repos', 'Set up branch protection rules']);
    expect(fixture.componentInstance.isEditing(1, 'activity', 1)).toBeFalse();
  });

  it('opens the editor on the clicked item with its section\'s true index', () => {
    const items = fixture.nativeElement.querySelectorAll('.item-text') as NodeListOf<HTMLElement>;
    Array.from(items).find((el) => el.textContent!.trim() === 'Moved 40 repos')!.click();
    expect(fixture.componentInstance.isEditing(1, 'activity', 0)).toBeTrue();
  });
});
