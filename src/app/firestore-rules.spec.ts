import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import {
  EmulatorApp, SeedValue, clearEmulators, createEmulatorApp, readDocument, seedDocument, signInAs
} from '../testing/emulator-testing';

// firestore.rules against the emulator, acting as the people each rule is
// meant to stop. Every other permission depends on a profile's role and
// customerId, and invite tokens let a stranger join as a customer.

describe('Security rules', () => {
  const apps: EmulatorApp[] = [];

  beforeEach(() => clearEmulators());
  afterEach(async () => { await Promise.all(apps.splice(0).map((a) => a.dispose())); });

  function app(): EmulatorApp {
    const created = createEmulatorApp();
    apps.push(created);
    return created;
  }

  /** Signs up with an email, as anyone can through the Auth API. */
  async function signUp(email: string): Promise<{ app: EmulatorApp; uid: string }> {
    const a = app();
    const { user } = await createUserWithEmailAndPassword(a.auth, email, 'password123');
    return { app: a, uid: user.uid };
  }

  function invite(token: string, fields: { [field: string]: SeedValue } = {}): Promise<void> {
    return seedDocument(`invites/${token}`, {
      email: 'brad@ihrdc.com', customerId: 'cust-1', customerName: 'IHRDC', token, status: 'pending',
      createdBy: 'admin', createdAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000), ...fields,
    });
  }

  const outcome = (write: Promise<unknown>): Promise<string> => write.then(() => 'allowed', (e) => e.code);

  function customerProfile(uid: string, fields: { [field: string]: unknown } = {}) {
    return { uid, email: 'brad@ihrdc.com', role: 'customer', isAdmin: false, customerId: 'cust-1', inviteId: 'tok-1',
      createdAt: new Date(), lastLogin: new Date(), ...fields };
  }

  describe('a new account', () => {
    it('cannot make itself an admin', async () => {
      const { app: a, uid } = await signUp('stranger@example.com');
      expect(await outcome(setDoc(doc(a.firestore, 'userProfiles', uid), { uid, email: 'stranger@example.com', role: 'admin', isAdmin: true })))
        .toBe('permission-denied');
    });

    it('cannot make itself a customer without an invite', async () => {
      const { app: a, uid } = await signUp('stranger@example.com');
      expect(await outcome(setDoc(doc(a.firestore, 'userProfiles', uid), customerProfile(uid, { email: 'stranger@example.com', inviteId: 'made-up' }))))
        .toBe('permission-denied');
    });

    it('cannot use an invite sent to another email', async () => {
      await invite('tok-1');
      const { app: a, uid } = await signUp('stranger@example.com');
      expect(await outcome(setDoc(doc(a.firestore, 'userProfiles', uid), customerProfile(uid, { email: 'stranger@example.com' }))))
        .toBe('permission-denied');
      expect(await outcome(setDoc(doc(a.firestore, 'userProfiles', uid), customerProfile(uid))))
        .toBe('permission-denied');
    });

    it('with an invite, can join only the invited customer, only as a customer', async () => {
      await invite('tok-1');
      const { app: a, uid } = await signUp('brad@ihrdc.com');
      const ref = doc(a.firestore, 'userProfiles', uid);

      expect(await outcome(setDoc(ref, customerProfile(uid, { customerId: 'cust-2' })))).toBe('permission-denied');
      expect(await outcome(setDoc(ref, customerProfile(uid, { role: 'admin', isAdmin: true })))).toBe('permission-denied');
      expect(await outcome(setDoc(ref, customerProfile(uid)))).toBe('allowed');
    });

    it('cannot use an invite that has expired, been accepted or been revoked', async () => {
      await invite('tok-1', { expiresAt: new Date(Date.now() - 1000) });
      await invite('tok-2', { status: 'accepted' });
      await invite('tok-3', { status: 'revoked' });
      const { app: a, uid } = await signUp('brad@ihrdc.com');
      for (const token of ['tok-1', 'tok-2', 'tok-3']) {
        expect(await outcome(setDoc(doc(a.firestore, 'userProfiles', uid), customerProfile(uid, { inviteId: token }))))
          .withContext(token).toBe('permission-denied');
      }
    });
  });

  describe('a customer', () => {
    let customer: EmulatorApp;
    let uid: string;

    beforeEach(async () => {
      customer = app();
      uid = await signInAs(customer, 'customer', 'cust-1');
    });

    it('cannot change their own role, admin flag or customer', async () => {
      const ref = doc(customer.firestore, 'userProfiles', uid);
      expect(await outcome(updateDoc(ref, { role: 'admin' }))).toBe('permission-denied');
      expect(await outcome(updateDoc(ref, { isAdmin: true }))).toBe('permission-denied');
      expect(await outcome(updateDoc(ref, { customerId: 'cust-2' }))).toBe('permission-denied');
      expect((await readDocument(`userProfiles/${uid}`))!['role']).toBe('customer');
    });

    it('can still record when they last signed in', async () => {
      expect(await outcome(updateDoc(doc(customer.firestore, 'userProfiles', uid), { lastLogin: new Date() }))).toBe('allowed');
    });

    it('cannot list invites', async () => {
      await invite('tok-1');
      expect(await outcome(getDocs(collection(customer.firestore, 'invites')))).toBe('permission-denied');
    });
  });

  describe('invites', () => {
    beforeEach(() => invite('tok-1'));

    it('a visitor cannot list them, but can open one with its token', async () => {
      const visitor = app();
      expect(await outcome(getDocs(collection(visitor.firestore, 'invites')))).toBe('permission-denied');
      const snap = await getDoc(doc(visitor.firestore, 'invites', 'tok-1'));
      expect(snap.data()!['email']).toBe('brad@ihrdc.com');
    });

    it('the invited person can accept their own invite, and change nothing else', async () => {
      const { app: a } = await signUp('brad@ihrdc.com');
      const ref = doc(a.firestore, 'invites', 'tok-1');

      expect(await outcome(updateDoc(ref, { status: 'accepted', customerId: 'cust-2' }))).toBe('permission-denied');
      expect(await outcome(updateDoc(ref, { status: 'pending', expiresAt: new Date(Date.now() + 9e9) }))).toBe('permission-denied');
      expect(await outcome(updateDoc(ref, { status: 'accepted', acceptedAt: new Date() }))).toBe('allowed');
      expect(await outcome(updateDoc(ref, { status: 'pending' }))).toBe('permission-denied');
    });

    it('nobody else can accept it', async () => {
      const { app: a } = await signUp('stranger@example.com');
      expect(await outcome(updateDoc(doc(a.firestore, 'invites', 'tok-1'), { status: 'accepted', acceptedAt: new Date() })))
        .toBe('permission-denied');
    });

    it('an admin must file a new invite under its own token', async () => {
      const admin = app();
      await signInAs(admin, 'admin');
      const data = { email: 'x@example.com', customerId: 'cust-1', customerName: 'IHRDC', token: 'tok-9', status: 'pending' };
      expect(await outcome(setDoc(doc(admin.firestore, 'invites', 'other-id'), data))).toBe('permission-denied');
      expect(await outcome(setDoc(doc(admin.firestore, 'invites', 'tok-9'), data))).toBe('allowed');
    });
  });
});
