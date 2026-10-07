import { Injectable, inject } from '@angular/core';
import { collection, doc, getDoc, setDoc, updateDoc, query, orderBy, where, getDocs } from 'firebase/firestore';
import { collectionData } from 'rxfire/firestore';
import { Observable, map } from 'rxjs';
import { INVITES } from './firestore-collections.const';
import { Invite } from '../models/invite.model';
import { AUTH, FIRESTORE } from '../firebase';

@Injectable({ providedIn: 'root' })
export class InviteService {
  private firestore = inject(FIRESTORE);
  private auth = inject(AUTH);

  /** Every invite, newest first. A pending invite past its expiry shows as expired. */
  getInvites(): Observable<Invite[]> {
    const ref = collection(this.firestore, INVITES);
    const q = query(ref, orderBy('createdAt', 'desc'));
    return (collectionData(q, { idField: 'id' }) as Observable<Invite[]>).pipe(
      map(invites => invites.map(invite =>
        invite.status === 'pending' && toDate(invite.expiresAt) < new Date()
          ? { ...invite, status: 'expired' as const }
          : invite))
    );
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

    // The token is the document ID, so the invite link can open this one
    // invite without being able to list the others (see firestore.rules).
    await setDoc(doc(this.firestore, INVITES, token), inviteData);

    return { id: token, ...inviteData };
  }

  /**
   * The pending invite for a link, or null. Opened by a visitor who is not
   * signed in, so it only reads: an expired invite is reported, not marked.
   */
  async getInviteByToken(token: string): Promise<Invite | null> {
    const snap = await getDoc(doc(this.firestore, INVITES, token));
    if (!snap.exists()) return null;

    const invite = { id: snap.id, ...snap.data() } as Invite;
    if (invite.status !== 'pending') return null;
    if (toDate(invite.expiresAt) < new Date()) return null;

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

    if (toDate(invite.expiresAt) < new Date()) {
      await updateDoc(doc(this.firestore, INVITES, invite.id), { status: 'expired' });
      return null;
    }

    return invite;
  }
}

/** Firestore returns Timestamps; invites built in this session hold Dates. */
function toDate(value: Date | { toDate(): Date }): Date {
  return value instanceof Date ? value : value.toDate();
}
