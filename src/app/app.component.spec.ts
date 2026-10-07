import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { EmulatorApp, clearEmulators, createEmulatorApp, provideEmulator, signInAs, waitFor } from '../testing/emulator-testing';

// The app shell against the emulators: the sidebar shows what each kind of
// account may open.

describe('AppComponent', () => {
  let emulator: EmulatorApp;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    await clearEmulators();
    emulator = createEmulatorApp();
  });

  afterEach(() => emulator.dispose());

  async function start(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), ...provideEmulator(emulator)],
    }).compileComponents();
    fixture = TestBed.createComponent(AppComponent);
    // Run change detection after every async callback, as the running app does.
    fixture.autoDetectChanges();
  }

  const links = (): string[] =>
    Array.from(fixture.nativeElement.querySelectorAll('.nav-links a') as NodeListOf<HTMLElement>).map((a) => a.textContent!.trim());

  it('shows no sidebar to a visitor who is not signed in', async () => {
    await start();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(fixture.nativeElement.querySelector('.sidebar')).toBeNull();
  });

  it('shows an admin every admin page', async () => {
    await signInAs(emulator, 'admin');
    await start();
    await waitFor(() => links().length > 0);
    expect(links()).toEqual(['Dashboard', 'Time Entries', 'Customers', 'Projects', 'Invoices', 'Status Reports', 'Hours Report', 'Users']);
  });

  it('shows a customer only their portal', async () => {
    await signInAs(emulator, 'customer', 'cust-1');
    await start();
    await waitFor(() => links().length > 0);
    expect(links()).toEqual(['My Dashboard']);
  });
});
