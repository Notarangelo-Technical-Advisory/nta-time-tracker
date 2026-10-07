import { TestBed } from '@angular/core/testing';
import { StatusReportService } from './status-report.service';
import { TimeEntry } from '../models/time-entry.model';
import { Project } from '../models/project.model';
import {
  EmulatorApp, clearEmulators, createEmulatorApp, listDocuments, provideEmulator, readDocument, seedDocument, signInAs,
  waitFor, watch
} from '../../testing/emulator-testing';

describe('StatusReportService', () => {
  let emulator: EmulatorApp;
  let service: StatusReportService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    await clearEmulators();
    emulator = createEmulatorApp();
    await signInAs(emulator, 'admin');
    TestBed.configureTestingModule({ providers: provideEmulator(emulator) });
    service = TestBed.inject(StatusReportService);
  });

  afterEach(() => emulator.dispose());

  const entry = (id: string, date: string, projectId = 'proj-1'): TimeEntry => ({
    id, userId: 'jack', customerId: 'cust-1', projectId, date, startTime: '09:00', endTime: '10:00',
    durationHours: 1, description: `Work on ${date}`, status: 'unbilled', createdAt: new Date(), updatedAt: new Date(),
  });

  it('saves a draft report numbered within the year, covering its earliest to latest entry', async () => {
    await seedDocument('statusReports/old', { reportNumber: `RPT-${year - 1}-004` });
    const sections = [{ projectName: 'GitHub migration', activities: ['Moved repos'], outcomes: ['Actual: Done'] }];

    const id = await service.saveReport('cust-1', 'IHRDC', [entry('b', '2026-09-09'), entry('a', '2026-09-01')], sections);

    expect(await readDocument(`statusReports/${id}`)).toEqual(jasmine.objectContaining({
      reportNumber: `RPT-${year}-001`, customerName: 'IHRDC', periodStart: '2026-09-01', periodEnd: '2026-09-09',
      timeEntryIds: ['b', 'a'], sections, status: 'draft',
    }));
  });

  it('lists reports newest first, edits sections and status, and deletes one', async () => {
    const reports = watch(service.getStatusReports());
    const first = await service.saveReport('cust-1', 'IHRDC', [entry('a', '2026-09-01')], []);
    const second = await service.saveReport('cust-1', 'IHRDC', [entry('b', '2026-09-08')], []);
    await waitFor(() => reports.latest()?.length === 2);
    expect(reports.latest()!.map((r) => r.id)).toEqual([second, first]);
    reports.stop();

    await service.updateSections(first, [{ projectName: 'X', activities: ['Edited'], outcomes: [] }]);
    await service.updateStatus(first, 'sent');
    const one = watch(service.getStatusReport(first));
    await waitFor(() => one.latest()?.status === 'sent');
    expect(one.latest()!.sections[0].activities).toEqual(['Edited']);
    one.stop();

    await service.deleteReport(second);
    expect(await readDocument(`statusReports/${second}`)).toBeNull();
  });

  it('updates a project\'s outcome record, and starts one for a new project', async () => {
    await seedDocument('outcomes/existing', { customerId: 'cust-1', projectName: 'GitHub migration', outcomes: ['Potential: Faster reviews'] });
    await seedDocument('outcomes/other', { customerId: 'cust-2', projectName: 'GitHub migration', outcomes: ['Untouched'] });

    await service.upsertOutcomes('cust-1', [
      { projectName: 'GitHub migration', activities: [], outcomes: ['Actual: Faster reviews'] },
      { projectName: 'AI requirements', activities: [], outcomes: ['Potential: Clear scope'] },
    ]);

    expect((await readDocument('outcomes/existing'))!['outcomes']).toEqual(['Actual: Faster reviews']);
    expect((await readDocument('outcomes/other'))!['outcomes']).toEqual(['Untouched']);
    const records = await service.getOutcomesByCustomer('cust-1');
    expect(records.map((r) => r.projectName).sort()).toEqual(['AI requirements', 'GitHub migration']);
    expect((await listDocuments('outcomes')).length).toBe(3);
  });

  it('asks the generateStatusReport function for sections, naming each project', async () => {
    const realFetch = window.fetch.bind(window);
    let sent: { data: Record<string, unknown> } | undefined;
    spyOn(window, 'fetch').and.callFake(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).endsWith('/generateStatusReport')) return realFetch(input, init);
      sent = JSON.parse(String(init!.body));
      const sections = [{ projectName: 'GitHub migration', activities: ['Moved repos'], outcomes: ['Actual: Done'] }];
      return new Response(JSON.stringify({ result: { sections } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const projects = new Map<string, Project>([['proj-1', { projectName: 'GitHub migration' } as Project]]);

    const sections = await service.generateWithAI('IHRDC', [entry('a', '2026-09-01'), entry('b', '2026-09-02', 'proj-gone')], projects,
      [{ customerId: 'cust-1', projectName: 'GitHub migration', outcomes: ['Potential: X'], updatedAt: new Date() }]);

    expect(sections.map((s) => s.projectName)).toEqual(['GitHub migration']);
    expect(sent!.data).toEqual({
      customerName: 'IHRDC',
      entries: [
        { date: '2026-09-01', description: 'Work on 2026-09-01', durationHours: 1, projectName: 'GitHub migration', status: 'unbilled', invoiceId: null },
        { date: '2026-09-02', description: 'Work on 2026-09-02', durationHours: 1, projectName: 'proj-gone', status: 'unbilled', invoiceId: null },
      ],
      priorOutcomes: [{ projectName: 'GitHub migration', outcomes: ['Potential: X'] }],
    });
  });
});
