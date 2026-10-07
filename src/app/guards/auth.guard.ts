import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { authState } from 'rxfire/auth';
import { map, take } from 'rxjs/operators';
import { AUTH } from '../firebase';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AUTH);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    map(user => {
      if (user) return true;
      router.navigate(['/auth']);
      return false;
    })
  );
};

export const noAuthGuard: CanActivateFn = () => {
  const auth = inject(AUTH);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    map(user => {
      if (!user) return true;
      router.navigate(['/dashboard']);
      return false;
    })
  );
};
