import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, query, orderBy, where, writeBatch } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { TIME_ENTRIES } from './firestore-collections.const';
import { TimeEntry } from '../models/time-entry.model';

@Injectable({ providedIn: 'root' })
export class TimeEntryService {
  private firestore = inject(Firestore);

  getTimeEntries(): Observable<TimeEntry[]> {
    const ref = collection(this.firestore, TIME_ENTRIES);
    const q = query(ref, orderBy('date', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<TimeEntry[]>;
  }

  getTimeEntriesByCustomer(customerId: string): Observable<TimeEntry[]> {
    const ref = collection(this.firestore, TIME_ENTRIES);
    const q = query(ref, where('customerId', '==', customerId), orderBy('date', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<TimeEntry[]>;
  }

  getUnbilledByCustomer(customerId: string): Observable<TimeEntry[]> {
    const ref = collection(this.firestore, TIME_ENTRIES);
    const q = query(ref, where('customerId', '==', customerId), where('status', '==', 'unbilled'), orderBy('date', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<TimeEntry[]>;
  }

  getTimeEntry(id: string): Observable<TimeEntry> {
    const ref = doc(this.firestore, TIME_ENTRIES, id);
    return docData(ref, { idField: 'id' }) as Observable<TimeEntry>;
  }

  async createTimeEntry(data: Partial<TimeEntry>): Promise<string> {
    const now = new Date();
    const ref = collection(this.firestore, TIME_ENTRIES);
    const docRef = await addDoc(ref, {
      ...data,
      status: 'unbilled',
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  }

  async updateTimeEntry(id: string, data: Partial<TimeEntry>): Promise<void> {
    const ref = doc(this.firestore, TIME_ENTRIES, id);
    await updateDoc(ref, {
      ...data,
      updatedAt: new Date()
    });
  }

  async deleteTimeEntry(id: string): Promise<void> {
    const ref = doc(this.firestore, TIME_ENTRIES, id);
    await deleteDoc(ref);
  }

  async markAsBilled(entryIds: string[], invoiceId: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    const now = new Date();
    for (const id of entryIds) {
      const ref = doc(this.firestore, TIME_ENTRIES, id);
      batch.update(ref, { status: 'billed', invoiceId, updatedAt: now });
    }
    await batch.commit();
  }

  async markAsPaid(entryIds: string[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    const now = new Date();
    for (const id of entryIds) {
      const ref = doc(this.firestore, TIME_ENTRIES, id);
      batch.update(ref, { status: 'paid', updatedAt: now });
    }
    await batch.commit();
  }

  static generateTimeSlots(): { value: string; label: string }[] {
    const slots: { value: string; label: string }[] = [];
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        const hour24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const period = h < 12 ? 'AM' : 'PM';
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const label = `${hour12}:${String(m).padStart(2, '0')} ${period}`;
        slots.push({ value: hour24, label });
      }
    }
    return slots;
  }

  static calculateDuration(startTime: string, endTime: string): number {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const diff = endMinutes - startMinutes;
    if (diff <= 0) return 0;
    return Math.round((diff / 60) * 100) / 100;
  }
}
