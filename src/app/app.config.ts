import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';

import { routes } from './app.routes';
import { provideFirebase } from './firebase';

export const appConfig: ApplicationConfig = {
  providers: [
    // Angular 21+ defaults to zoneless; this app still relies on zone.js.
    provideZoneChangeDetection(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withXhr()),
    importProvidersFrom(ReactiveFormsModule),
    provideFirebase(),
  ]
};
