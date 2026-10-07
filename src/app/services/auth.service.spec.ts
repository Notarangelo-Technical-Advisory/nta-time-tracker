import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService, NO_ACCESS_MESSAGE } from './auth.service';
import {
  EmulatorApp, clearEmulators, createAccount, createEmulatorApp, provideEmulator, readDocument, rejectionOf, signInAs
} from '../../testing/emulator-testing';

describe('AuthService', () => {
  let emulator: EmulatorApp;
  let service: AuthService;
  let navigate: jasmine.Spy;

  beforeEach(async () => {
    await clearEmulators();
    emulator = createEmulatorApp();
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...provideEmulator(emulator)] });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    service = TestBed.inject(AuthService);
  });

  afterEach(() => emulator.dispose());

  it('signs an admin in, records the time, and opens the dashboard', async () => {
    const uid = await createAccount(emulator, 'jack@example.com', 'correct-horse', 'admin');

    await service.signIn('jack@example.com', 'correct-horse');

    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect((await readDocument(`userProfiles/${uid}`))!['lastLogin']).toEqual(jasmine.any(Date));
  });

  it('signs a customer in and opens the portal', async () => {
    await createAccount(emulator, 'brad@example.com', 'correct-horse', 'customer');
    await service.signIn('brad@example.com', 'correct-horse');
    expect(navigate).toHaveBeenCalledWith(['/portal']);
  });

  it('signs an account with no profile straight out again, and says why', async () => {
    await createAccount(emulator, 'stranger@example.com', 'correct-horse', null);

    const error = await rejectionOf(service.signIn('stranger@example.com', 'correct-horse'));

    expect(error.message).toBe(NO_ACCESS_MESSAGE);
    expect(emulator.auth.currentUser).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('refuses a wrong password', async () => {
    await createAccount(emulator, 'jack@example.com', 'correct-horse', 'admin');
    const error = await rejectionOf(service.signIn('jack@example.com', 'wrong'));
    expect(error.code).toBe('auth/wrong-password');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports the role and customer of whoever is signed in', async () => {
    expect(await service.getCurrentUserRole()).toBeNull();
    expect(await service.isCurrentUserAdmin()).toBeFalse();

    await signInAs(emulator, 'customer', 'cust-7');

    expect(await service.getCurrentUserRole()).toBe('customer');
    expect(await service.getCurrentUserCustomerId()).toBe('cust-7');
    expect(await service.isCurrentUserAdmin()).toBeFalse();
  });

  it('signs out and returns to the sign-in page', async () => {
    await signInAs(emulator, 'admin');
    expect(await service.isCurrentUserAdmin()).toBeTrue();

    await service.signOutUser();

    expect(emulator.auth.currentUser).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/auth']);
  });

  it('sends a password reset to an existing account', async () => {
    await createAccount(emulator, 'jack@example.com', 'correct-horse', 'admin');
    await expectAsync(service.resetPassword('jack@example.com')).toBeResolved();
  });
});
