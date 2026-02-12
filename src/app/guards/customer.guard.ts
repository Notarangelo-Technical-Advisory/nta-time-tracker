import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { switchMap, take, map } from 'rxjs/operators';
import { of, from } from 'rxjs';
import { USER_PROFILES } from '../services/firestore-collections.const';

export const customerGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const firestore = inject(Firestore);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    switchMap(user => {
      if (!user) {
        router.navigate(['/auth']);
        return of(false);
      }
      return from(getDoc(doc(firestore, USER_PROFILES, user.uid))).pipe(
        map(docSnap => {
          if (docSnap.exists() && docSnap.data()['role'] === 'customer') {
            return true;
          }
          router.navigate(['/dashboard']);
          return false;
        })
      );
    })
  );
};
