import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, isObservable } from 'rxjs';
import { authGuard, noAuthGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { customerGuard } from './customer.guard';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { EmulatorApp, clearEmulators, createEmulatorApp, provideEmulator, signInAs } from '../../testing/emulator-testing';

// The route guards against the Auth and Firestore emulators, with real
// accounts and profiles.

describe('Route guards', () => {
  let emulator: EmulatorApp;
  let navigate: jasmine.Spy;

  beforeEach(async () => {
    await clearEmulators();
    emulator = createEmulatorApp();
    TestBed.configureTestingModule({ providers: [provideRouter([]), ...provideEmulator(emulator)] });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  afterEach(() => emulator.dispose());

  type Guard = typeof authGuard;

  async function run(guard: Guard): Promise<unknown> {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    return isObservable(result) ? firstValueFrom(result as Observable<unknown>) : result;
  }

  describe('for a visitor who is not signed in', () => {
    it('sends them to sign in from any page that needs an account', async () => {
      for (const guard of [authGuard, adminGuard, customerGuard]) {
        navigate.calls.reset();
        expect(await run(guard)).toBeFalse();
        expect(navigate).toHaveBeenCalledWith(['/auth']);
      }
    });

    it('lets them open the sign-in page', async () => {
      expect(await run(noAuthGuard)).toBeTrue();
    });
  });

  describe('for an admin', () => {
    beforeEach(() => signInAs(emulator, 'admin'));

    it('opens the admin pages', async () => {
      expect(await run(authGuard)).toBeTrue();
      expect(await run(adminGuard)).toBeTrue();
    });

    it('sends them to the dashboard from the customer portal and the sign-in page', async () => {
      expect(await run(customerGuard)).toBeFalse();
      expect(navigate).toHaveBeenCalledWith(['/dashboard']);
      navigate.calls.reset();
      expect(await run(noAuthGuard)).toBeFalse();
      expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  describe('for a signed-in account with no profile', () => {
    it('signs them out and sends them to sign in, instead of bouncing between the two areas', async () => {
      for (const guard of [adminGuard, customerGuard]) {
        await createUserWithEmailAndPassword(emulator.auth, `stranger-${guard === adminGuard ? 'a' : 'c'}@example.com`, 'password123');
        navigate.calls.reset();

        expect(await run(guard)).toBeFalse();

        expect(navigate.calls.allArgs()).toEqual([[['/auth']]]);
        expect(emulator.auth.currentUser).toBeNull();
      }
    });
  });

  describe('for a customer', () => {
    beforeEach(() => signInAs(emulator, 'customer', 'cust-1'));

    it('opens the portal', async () => {
      expect(await run(customerGuard)).toBeTrue();
    });

    it('sends them to the portal from the admin pages', async () => {
      expect(await run(adminGuard)).toBeFalse();
      expect(navigate).toHaveBeenCalledWith(['/portal']);
    });
  });
});
