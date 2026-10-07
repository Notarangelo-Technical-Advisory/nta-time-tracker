import { Provider } from '@angular/core';
import { Observable } from 'rxjs';
import { FirebaseApp, deleteApp, initializeApp } from 'firebase/app';
import { Auth, connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { Firestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { Functions, connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { AUTH, FIRESTORE, FUNCTIONS } from '../app/firebase';

// Helpers for browser tests that need real sign-in and the real security rules.
// `npm run test:ci` runs Karma inside the Auth and Firestore emulators under
// the demo project below, so nothing touches live data.

export const EMULATOR_PROJECT = 'demo-nta-browser';
const AUTH_URL      = 'http://127.0.0.1:9099';
const FIRESTORE_URL = 'http://127.0.0.1:8080';
const DOCUMENTS_URL = `${FIRESTORE_URL}/v1/projects/${EMULATOR_PROJECT}/databases/(default)/documents`;

export interface EmulatorApp {
  auth: Auth;
  firestore: Firestore;
  functions: Functions;
  dispose: () => Promise<void>;
}

let appCount = 0;

/** A Firebase app connected to the emulators, as the real app is connected to Firebase. */
export function createEmulatorApp(): EmulatorApp {
  const app: FirebaseApp = initializeApp(
    { projectId: EMULATOR_PROJECT, apiKey: 'test-key', appId: 'test-app' },
    `emulator-app-${++appCount}`
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_URL, { disableWarnings: true });
  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  // No Functions emulator runs: tests that call a function answer it themselves.
  const functions = getFunctions(app);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  return { auth, firestore, functions, dispose: () => deleteApp(app) };
}

/** Provides the emulator's Firebase objects in place of the live ones. */
export function provideEmulator(app: EmulatorApp): Provider[] {
  return [
    { provide: AUTH, useValue: app.auth },
    { provide: FIRESTORE, useValue: app.firestore },
    { provide: FUNCTIONS, useValue: app.functions },
  ];
}

/** Creates an account with a profile, as an invite or Jack's own sign-up leaves it, and signs in. */
export async function signInAs(
  app: EmulatorApp, role: 'admin' | 'customer', customerId?: string
): Promise<string> {
  const email = `${role}-${appCount}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const { user } = await createUserWithEmailAndPassword(app.auth, email, 'password123');
  await seedDocument(`userProfiles/${user.uid}`, {
    uid: user.uid, email, role, isAdmin: role === 'admin',
    ...(customerId ? { customerId } : {}),
    createdAt: new Date(), lastLogin: new Date(),
  });
  return user.uid;
}

/** Creates an account without signing in, for tests of the sign-in page. */
export async function createAccount(
  app: EmulatorApp, email: string, password: string, role: 'admin' | 'customer' | null
): Promise<string> {
  const { user } = await createUserWithEmailAndPassword(app.auth, email, password);
  if (role) {
    await seedDocument(`userProfiles/${user.uid}`, { uid: user.uid, email, role, isAdmin: role === 'admin' });
  }
  await signOut(app.auth);
  return user.uid;
}

/** Deletes every account and document in the emulators. */
export async function clearEmulators(): Promise<void> {
  await fetch(`${FIRESTORE_URL}/emulator/v1/projects/${EMULATOR_PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`${AUTH_URL}/emulator/v1/projects/${EMULATOR_PROJECT}/accounts`, { method: 'DELETE' });
}

export type SeedValue = string | number | boolean | null | Date | SeedValue[] | { [field: string]: SeedValue };

/** A value in the Firestore REST format. */
function toRestValue(value: SeedValue): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toRestValue) } };
  switch (typeof value) {
    case 'string':  return { stringValue: value };
    case 'boolean': return { booleanValue: value };
    case 'number':  return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    default:        return { mapValue: { fields: toRestFields(value) } };
  }
}

function toRestFields(fields: { [field: string]: SeedValue }): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, toRestValue(value)]));
}

/** A plain value from the Firestore REST format. Timestamps come back as Dates. */
function fromRestValue(value: Record<string, any>): unknown {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value['stringValue'];
  if ('booleanValue' in value) return value['booleanValue'];
  if ('integerValue' in value) return Number(value['integerValue']);
  if ('doubleValue' in value) return value['doubleValue'];
  if ('timestampValue' in value) return new Date(value['timestampValue']);
  if ('arrayValue' in value) return (value['arrayValue'].values ?? []).map(fromRestValue);
  if ('mapValue' in value) return fromRestFields(value['mapValue'].fields ?? {});
  return value;
}

function fromRestFields(fields: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, fromRestValue(value)]));
}

/** Writes a document as Jack's admin account or a Cloud Function would, bypassing the security rules. */
export async function seedDocument(path: string, fields: { [field: string]: SeedValue }): Promise<void> {
  const response = await fetch(`${DOCUMENTS_URL}/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toRestFields(fields) }),
  });
  if (!response.ok) throw new Error(`Could not seed ${path}: ${response.status}`);
}

/** Reads one document, bypassing the security rules. Null when it does not exist. */
export async function readDocument(path: string): Promise<Record<string, any> | null> {
  const response = await fetch(`${DOCUMENTS_URL}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  if (response.status === 404) return null;
  const body = await response.json() as { fields?: Record<string, unknown> };
  return fromRestFields(body.fields ?? {});
}

/** Reads every document in a collection, bypassing the security rules. */
export async function listDocuments(collection: string): Promise<Array<Record<string, any>>> {
  const response = await fetch(`${DOCUMENTS_URL}/${collection}`, { headers: { Authorization: 'Bearer owner' } });
  const body = await response.json() as { documents?: Array<{ name: string; fields?: Record<string, unknown> }> };
  return (body.documents ?? []).map((d) => ({ id: d.name.split('/').pop(), ...fromRestFields(d.fields ?? {}) }));
}

/** Waits until `check` returns true, failing after `timeoutMs`. */
export async function waitFor(check: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for the page to update');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** Subscribes to a live query and keeps its latest value, as a page would. */
export function watch<T>(stream: Observable<T>): { latest: () => T | undefined; stop: () => void } {
  let latest: T | undefined;
  const subscription = stream.subscribe((value) => { latest = value; });
  return { latest: () => latest, stop: () => subscription.unsubscribe() };
}

/** Resolves to the error a promise rejects with, or fails the test if it resolves. */
export async function rejectionOf(promise: Promise<unknown>): Promise<{ code?: string; message?: string }> {
  try {
    await promise;
  } catch (error) {
    return error as { code?: string; message?: string };
  }
  throw new Error('Expected the promise to be rejected');
}
