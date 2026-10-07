import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthComponent } from './auth.component';
import { EmulatorApp, clearEmulators, createEmulatorApp, provideEmulator } from '../../../testing/emulator-testing';

describe('AuthComponent', () => {
  let emulator: EmulatorApp;

  beforeEach(async () => {
    await clearEmulators();
    emulator = createEmulatorApp();
    await TestBed.configureTestingModule({
      imports: [AuthComponent],
      providers: [provideRouter([]), ...provideEmulator(emulator)],
    }).compileComponents();
  });

  afterEach(() => emulator.dispose());

  it('offers sign-in and password reset, but no way to create an account', () => {
    const fixture = TestBed.createComponent(AuthComponent);
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;

    expect(text).toContain('Sign In');
    expect(text).toContain('Forgot password?');
    expect(text).not.toContain('Sign Up');
    expect(text).not.toContain('Create Account');
  });
});
