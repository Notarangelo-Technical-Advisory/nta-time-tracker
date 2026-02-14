import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, updateDoc, deleteDoc, query, orderBy } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { USER_PROFILES } from './firestore-collections.const';
import { UserProfile } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private firestore = inject(Firestore);

  getUsers(): Observable<UserProfile[]> {
    const ref = collection(this.firestore, USER_PROFILES);
    const q = query(ref, orderBy('email', 'asc'));
    return collectionData(q, { idField: 'uid' }) as Observable<UserProfile[]>;
  }

  async updateUserRole(uid: string, role: 'admin' | 'customer'): Promise<void> {
    const ref = doc(this.firestore, USER_PROFILES, uid);
    await updateDoc(ref, { role, isAdmin: role === 'admin' });
  }

  async linkUserToCustomer(uid: string, customerId: string | null): Promise<void> {
    const ref = doc(this.firestore, USER_PROFILES, uid);
    await updateDoc(ref, { customerId: customerId ?? '' });
  }

  async deleteUser(uid: string): Promise<void> {
    const ref = doc(this.firestore, USER_PROFILES, uid);
    await deleteDoc(ref);
  }
}
