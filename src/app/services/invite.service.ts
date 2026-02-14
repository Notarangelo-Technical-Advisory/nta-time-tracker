import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, addDoc, updateDoc, query, orderBy, where, getDocs } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { INVITES } from './firestore-collections.const';
import { Invite } from '../models/invite.model';

@Injectable({ providedIn: 'root' })
export class InviteService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  getInvites(): Observable<Invite[]> {
    const ref = collection(this.firestore, INVITES);
    const q = query(ref, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Invite[]>;
  }

  async createInvite(email: string, customerId: string, customerName: string): Promise<Invite> {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await this.getPendingInviteForEmail(normalizedEmail);
    if (existing) {
      throw new Error('A pending invite already exists for this email address.');
    }

    const token = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const inviteData = {
      email: normalizedEmail,
      customerId,
      customerName,
      token,
      status: 'pending' as const,
      createdBy: this.auth.currentUser?.uid || '',
      createdAt: now,
      expiresAt
    };

    const ref = collection(this.firestore, INVITES);
    const docRef = await addDoc(ref, inviteData);

    return { id: docRef.id, ...inviteData };
  }

  async getInviteByToken(token: string): Promise<Invite | null> {
    const ref = collection(this.firestore, INVITES);
    const q = query(ref, where('token', '==', token));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const docSnap = snapshot.docs[0];
    const invite = { id: docSnap.id, ...docSnap.data() } as Invite;

    if (invite.status !== 'pending') return null;

    const expiresAt = invite.expiresAt instanceof Date
      ? invite.expiresAt
      : (invite.expiresAt as any).toDate();
    if (expiresAt < new Date()) {
      await updateDoc(doc(this.firestore, INVITES, invite.id), { status: 'expired' });
      return null;
    }

    return invite;
  }

  async acceptInvite(inviteId: string): Promise<void> {
    const ref = doc(this.firestore, INVITES, inviteId);
    await updateDoc(ref, { status: 'accepted', acceptedAt: new Date() });
  }

  async revokeInvite(id: string): Promise<void> {
    const ref = doc(this.firestore, INVITES, id);
    await updateDoc(ref, { status: 'revoked' });
  }

  getInviteLink(token: string): string {
    return `${window.location.origin}/invite/${token}`;
  }

  private async getPendingInviteForEmail(email: string): Promise<Invite | null> {
    const ref = collection(this.firestore, INVITES);
    const q = query(ref, where('email', '==', email), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const docSnap = snapshot.docs[0];
    const invite = { id: docSnap.id, ...docSnap.data() } as Invite;

    const expiresAt = invite.expiresAt instanceof Date
      ? invite.expiresAt
      : (invite.expiresAt as any).toDate();
    if (expiresAt < new Date()) {
      await updateDoc(doc(this.firestore, INVITES, invite.id), { status: 'expired' });
      return null;
    }

    return invite;
  }
}
