import { TestBed } from '@angular/core/testing';
import { CustomerService } from './customer.service';
import { ProjectService } from './project.service';
import { TimeEntryService } from './time-entry.service';
import { UserService } from './user.service';
import {
  EmulatorApp, clearEmulators, createEmulatorApp, provideEmulator, readDocument, seedDocument, signInAs, waitFor, watch
} from '../../testing/emulator-testing';

// Customers, projects, time entries and users against the emulators, signed
// in as an admin unless a test says otherwise.

describe('Admin records', () => {
  let emulator: EmulatorApp;

  beforeEach(async () => {
    await clearEmulators();
    emulator = createEmulatorApp();
    await signInAs(emulator, 'admin');
    TestBed.configureTestingModule({ providers: provideEmulator(emulator) });
  });

  afterEach(() => emulator.dispose());

  describe('CustomerService', () => {
    it('numbers new customers, lists them by name, and lists only active ones', async () => {
      const service = TestBed.inject(CustomerService);
      const all = watch(service.getCustomers());
      const active = watch(service.getActiveCustomers());

      const ihrdc = await service.createCustomer({ companyName: 'IHRDC', billablePersonName: 'Brad Donohue' });
      const cox = await service.createCustomer({ companyName: 'Cox Engineering', billablePersonName: 'Brendan Abbott' });
      await service.updateCustomer(cox, { isActive: false });

      await waitFor(() => all.latest()?.length === 2 && active.latest()?.length === 1);
      expect(all.latest()!.map((c) => [c.companyName, c.customerId])).toEqual([['Cox Engineering', 'CUST-002'], ['IHRDC', 'CUST-001']]);
      expect(active.latest()!.map((c) => c.id)).toEqual([ihrdc]);
      all.stop();
      active.stop();
    });

    it('reads and deletes one customer', async () => {
      const service = TestBed.inject(CustomerService);
      const id = await service.createCustomer({ companyName: 'IHRDC', billablePersonName: 'Brad Donohue' });
      const one = watch(service.getCustomer(id));
      await waitFor(() => !!one.latest());
      expect(one.latest()).toEqual(jasmine.objectContaining({ id, companyName: 'IHRDC', isActive: true }));
      one.stop();

      await service.deleteCustomer(id);
      expect(await readDocument(`customers/${id}`)).toBeNull();
    });
  });

  describe('ProjectService', () => {
    it('numbers new projects as active, and lists a customer\'s projects by name', async () => {
      const service = TestBed.inject(ProjectService);
      const migration = await service.createProject({ customerId: 'cust-1', projectName: 'GitHub migration' });
      await service.createProject({ customerId: 'cust-1', projectName: 'AI requirements', status: 'on-hold' });
      await service.createProject({ customerId: 'cust-2', projectName: 'Discovery' });

      const forCustomer = watch(service.getProjectsByCustomer('cust-1'));
      const activeForCustomer = watch(service.getActiveProjectsByCustomer('cust-1'));
      await waitFor(() => forCustomer.latest()?.length === 2 && activeForCustomer.latest()?.length === 1);

      expect(forCustomer.latest()!.map((p) => p.projectName)).toEqual(['AI requirements', 'GitHub migration']);
      expect(activeForCustomer.latest()![0].id).toBe(migration);
      expect((await readDocument(`projects/${migration}`))!['projectId']).toBe('PROJ-001');
      forCustomer.stop();
      activeForCustomer.stop();
    });
  });

  describe('TimeEntryService', () => {
    it('lists a customer\'s unbilled time, newest first', async () => {
      const service = TestBed.inject(TimeEntryService);
      const base = { userId: 'jack', customerId: 'cust-1', projectId: 'p', startTime: '09:00', endTime: '10:00', durationHours: 1 };
      await service.createTimeEntry({ ...base, date: '2026-09-01' });
      const billed = await service.createTimeEntry({ ...base, date: '2026-09-03' });
      await service.createTimeEntry({ ...base, date: '2026-09-02' });
      await service.createTimeEntry({ ...base, customerId: 'cust-2', date: '2026-09-04' });
      await service.markAsBilled([billed], 'inv-1');

      const unbilled = watch(service.getUnbilledByCustomer('cust-1'));
      await waitFor(() => unbilled.latest()?.length === 2);
      expect(unbilled.latest()!.map((e) => e.date)).toEqual(['2026-09-02', '2026-09-01']);
      unbilled.stop();
    });

    it('works out hours to two decimals, and none for an end before the start', () => {
      expect(TimeEntryService.calculateDuration('09:00', '10:30')).toBe(1.5);
      expect(TimeEntryService.calculateDuration('09:10', '09:30')).toBe(0.33);
      expect(TimeEntryService.calculateDuration('10:00', '09:00')).toBe(0);
    });

    it('offers every half hour of the day', () => {
      const slots = TimeEntryService.generateTimeSlots();
      expect(slots.length).toBe(48);
      expect(slots[0]).toEqual({ value: '00:00', label: '12:00 AM' });
      expect(slots[25]).toEqual({ value: '12:30', label: '12:30 PM' });
      expect(slots[47]).toEqual({ value: '23:30', label: '11:30 PM' });
    });
  });

  describe('UserService', () => {
    it('lists users by email, changes a role, and links a user to a customer', async () => {
      await seedDocument('userProfiles/zed', { uid: 'zed', email: 'zed@example.com', role: 'customer', isAdmin: false });
      await seedDocument('userProfiles/amy', { uid: 'amy', email: 'amy@example.com', role: 'customer', isAdmin: false });
      const service = TestBed.inject(UserService);
      const users = watch(service.getUsers());
      await waitFor(() => users.latest()?.length === 3);
      expect(users.latest()!.map((u) => u.email).filter((e) => !e.startsWith('admin'))).toEqual(['amy@example.com', 'zed@example.com']);
      expect(users.latest()!.find((u) => u.email === 'amy@example.com')!.uid).toBe('amy');
      users.stop();

      await service.updateUserRole('amy', 'admin');
      await service.linkUserToCustomer('zed', 'cust-1');
      await service.linkUserToCustomer('amy', null);

      expect(await readDocument('userProfiles/amy')).toEqual(jasmine.objectContaining({ role: 'admin', isAdmin: true, customerId: '' }));
      expect((await readDocument('userProfiles/zed'))!['customerId']).toBe('cust-1');
    });
  });

  it('a customer sees only their own projects and time', async () => {
    await seedDocument('projects/mine', { customerId: 'cust-1', projectName: 'Mine', status: 'active' });
    await seedDocument('projects/theirs', { customerId: 'cust-2', projectName: 'Theirs', status: 'active' });
    const customer = createEmulatorApp();
    await signInAs(customer, 'customer', 'cust-1');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: provideEmulator(customer) });
    const service = TestBed.inject(ProjectService);

    const mine = watch(service.getProjectsByCustomer('cust-1'));
    await waitFor(() => mine.latest()?.length === 1);
    mine.stop();
    const error = await new Promise<{ code?: string }>((resolve) =>
      service.getProjectsByCustomer('cust-2').subscribe({ next: () => resolve({}), error: resolve }));

    expect(error.code).toBe('permission-denied');
    await customer.dispose();
  });
});
