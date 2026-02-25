import { Injectable, inject } from '@angular/core';
import { Auth, authState, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, User } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc, updateDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import { USER_PROFILES } from './firestore-collections.const';
import { UserProfile } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  user$: Observable<User | null> = authState(this.auth);

  async signIn(email: string, password: string): Promise<void> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    const profile = await this.getUserProfile(credential.user.uid);

    await updateDoc(doc(this.firestore, USER_PROFILES, credential.user.uid), {
      lastLogin: new Date()
    });

    if (profile?.role === 'admin') {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/portal']);
    }
  }

  async signUp(email: string, password: string, role: 'admin' | 'customer' = 'admin'): Promise<void> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);

    const profile: UserProfile = {
      uid: credential.user.uid,
      email: email,
      role: role,
      isAdmin: role === 'admin',
      createdAt: new Date(),
      lastLogin: new Date()
    };

    await setDoc(doc(this.firestore, USER_PROFILES, credential.user.uid), profile);

    if (role === 'admin') {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/portal']);
    }
  }

  async signOutUser(): Promise<void> {
    await signOut(this.auth);
    this.router.navigate(['/auth']);
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docSnap = await getDoc(doc(this.firestore, USER_PROFILES, uid));
    return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
  }

  async isCurrentUserAdmin(): Promise<boolean> {
    const user = await firstValueFrom(this.user$.pipe(filter(u => u !== undefined)));
    if (!user) return false;
    const profile = await this.getUserProfile(user.uid);
    return profile?.role === 'admin' || false;
  }

  async getCurrentUserRole(): Promise<'admin' | 'customer' | null> {
    const user = await firstValueFrom(this.user$.pipe(filter(u => u !== undefined)));
    if (!user) return null;
    const profile = await this.getUserProfile(user.uid);
    return profile?.role ?? null;
  }

  async getCurrentUserCustomerId(): Promise<string | null> {
    const user = await firstValueFrom(this.user$.pipe(filter(u => u !== undefined)));
    if (!user) return null;
    const profile = await this.getUserProfile(user.uid);
    return profile?.customerId ?? null;
  }
}
