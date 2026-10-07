import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { signOut } from 'firebase/auth';
import { authState } from 'rxfire/auth';
import { doc, getDoc } from 'firebase/firestore';
import { switchMap, take } from 'rxjs/operators';
import { of, from } from 'rxjs';
import { USER_PROFILES } from '../services/firestore-collections.const';
import { AUTH, FIRESTORE } from '../firebase';

export const customerGuard: CanActivateFn = () => {
  const auth = inject(AUTH);
  const firestore = inject(FIRESTORE);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    switchMap(user => {
      if (!user) {
        router.navigate(['/auth']);
        return of(false);
      }
      return from(getDoc(doc(firestore, USER_PROFILES, user.uid))).pipe(
        switchMap(async docSnap => {
          if (docSnap.exists() && docSnap.data()['role'] === 'customer') {
            return true;
          }
          if (!docSnap.exists()) {
            // No profile, so no access anywhere. Sending them to the other
            // area would bounce straight back here, so sign them out instead.
            await signOut(auth);
            router.navigate(['/auth']);
            return false;
          }
          router.navigate(['/dashboard']);
          return false;
        })
      );
    })
  );
};
