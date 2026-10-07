import { TestBed } from '@angular/core/testing';
import { InviteService } from './invite.service';
import {
  EmulatorApp, clearEmulators, createEmulatorApp, listDocuments, provideEmulator, readDocument, rejectionOf,
  seedDocument, signInAs, waitFor, watch
} from '../../testing/emulator-testing';

// Customer invites against the emulators: an admin creates them, and a
// visitor who is not signed in opens one by its token.

describe('InviteService', () => {
  let emulator: EmulatorApp;
  let service: InviteService;
  let adminUid: string;

  beforeEach(async () => {
    await clearEmulators();
    emulator = createEmulatorApp();
    adminUid = await signInAs(emulator, 'admin');
    TestBed.configureTestingModule({ providers: provideEmulator(emulator) });
    service = TestBed.inject(InviteService);
  });

  afterEach(() => emulator.dispose());

  /** The same service, used by a visitor who is not signed in. */
  async function asVisitor<T>(use: (visitor: InviteService) => Promise<T>): Promise<T> {
    const visitor = createEmulatorApp();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: provideEmulator(visitor) });
    try {
      return await use(TestBed.inject(InviteService));
    } finally {
      await visitor.dispose();
    }
  }

  it('creates a pending invite for a week, with a normalised email, and lists it', async () => {
    const invites = watch(service.getInvites());
    const invite = await service.createInvite('  Brad@IHRDC.com ', 'cust-1', 'IHRDC');

    expect(invite).toEqual(jasmine.objectContaining({ email: 'brad@ihrdc.com', status: 'pending', createdBy: adminUid, customerName: 'IHRDC' }));
    expect(invite.token).toMatch(/^[0-9a-f-]{36}$/);
    expect(invite.id).toBe(invite.token);
    const days = (invite.expiresAt.getTime() - invite.createdAt.getTime()) / 86_400_000;
    expect(days).toBe(7);
    await waitFor(() => invites.latest()?.length === 1);
    invites.stop();
  });

  it('refuses a second pending invite for the same email', async () => {
    await service.createInvite('brad@ihrdc.com', 'cust-1', 'IHRDC');
    const error = await rejectionOf(service.createInvite('BRAD@ihrdc.com', 'cust-1', 'IHRDC'));
    expect(error.message).toContain('pending invite already exists');
  });

  it('allows a new invite once the old one has expired, and marks the old one expired', async () => {
    await seedDocument('invites/old-token', {
      email: 'brad@ihrdc.com', customerId: 'cust-1', customerName: 'IHRDC', token: 'old-token', status: 'pending',
      createdBy: adminUid, createdAt: new Date(Date.now() - 9 * 86_400_000), expiresAt: new Date(Date.now() - 2 * 86_400_000),
    });

    await service.createInvite('brad@ihrdc.com', 'cust-1', 'IHRDC');

    expect((await readDocument('invites/old-token'))!['status']).toBe('expired');
    expect((await listDocuments('invites')).length).toBe(2);
  });

  it('lets a visitor who is not signed in open a pending invite by its token', async () => {
    const created = await service.createInvite('brad@ihrdc.com', 'cust-1', 'IHRDC');
    const opened = await asVisitor((visitor) => visitor.getInviteByToken(created.token));
    expect(opened).toEqual(jasmine.objectContaining({ id: created.id, email: 'brad@ihrdc.com', customerId: 'cust-1' }));
  });

  it('opens nothing for an unknown, revoked or accepted token', async () => {
    const revoked = await service.createInvite('a@example.com', 'cust-1', 'IHRDC');
    await service.revokeInvite(revoked.id);
    const accepted = await service.createInvite('b@example.com', 'cust-1', 'IHRDC');
    await service.acceptInvite(accepted.id);

    expect(await service.getInviteByToken('no-such-token')).toBeNull();
    expect(await service.getInviteByToken(revoked.token)).toBeNull();
    expect(await service.getInviteByToken(accepted.token)).toBeNull();
    expect((await readDocument(`invites/${accepted.id}`))!['acceptedAt']).toEqual(jasmine.any(Date));
  });

  it('opens nothing for an expired token, and shows it to the admin as expired', async () => {
    await seedDocument('invites/old-token', {
      email: 'brad@ihrdc.com', customerId: 'cust-1', customerName: 'IHRDC', token: 'old-token', status: 'pending',
      createdBy: adminUid, createdAt: new Date(Date.now() - 9 * 86_400_000), expiresAt: new Date(Date.now() - 2 * 86_400_000),
    });

    expect(await asVisitor((visitor) => visitor.getInviteByToken('old-token'))).toBeNull();
    expect((await readDocument('invites/old-token'))!['status']).toBe('pending');

    const invites = watch(service.getInvites());
    await waitFor(() => invites.latest()?.length === 1);
    expect(invites.latest()![0].status).toBe('expired');
    invites.stop();
  });

  it('builds the link from the site address', () => {
    expect(service.getInviteLink('abc')).toBe(`${window.location.origin}/invite/abc`);
  });

  it('a customer cannot create an invite', async () => {
    const customer = createEmulatorApp();
    await signInAs(customer, 'customer', 'cust-1');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: provideEmulator(customer) });

    const error = await rejectionOf(TestBed.inject(InviteService).createInvite('x@example.com', 'cust-1', 'IHRDC'));

    expect(error.code).toBe('permission-denied');
    await customer.dispose();
  });
});
