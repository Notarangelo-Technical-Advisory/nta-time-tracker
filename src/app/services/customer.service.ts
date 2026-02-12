import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, query, orderBy, where, getDocs } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { CUSTOMERS } from './firestore-collections.const';
import { Customer } from '../models/customer.model';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private firestore = inject(Firestore);

  getCustomers(): Observable<Customer[]> {
    const ref = collection(this.firestore, CUSTOMERS);
    const q = query(ref, orderBy('companyName', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Customer[]>;
  }

  getActiveCustomers(): Observable<Customer[]> {
    const ref = collection(this.firestore, CUSTOMERS);
    const q = query(ref, where('isActive', '==', true), orderBy('companyName', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Customer[]>;
  }

  getCustomer(id: string): Observable<Customer> {
    const ref = doc(this.firestore, CUSTOMERS, id);
    return docData(ref, { idField: 'id' }) as Observable<Customer>;
  }

  async createCustomer(data: Partial<Customer>): Promise<string> {
    const customerId = await this.generateCustomerId();
    const now = new Date();
    const ref = collection(this.firestore, CUSTOMERS);
    const docRef = await addDoc(ref, {
      ...data,
      customerId,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  }

  async updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
    const ref = doc(this.firestore, CUSTOMERS, id);
    await updateDoc(ref, {
      ...data,
      updatedAt: new Date()
    });
  }

  async deleteCustomer(id: string): Promise<void> {
    const ref = doc(this.firestore, CUSTOMERS, id);
    await deleteDoc(ref);
  }

  private async generateCustomerId(): Promise<string> {
    const ref = collection(this.firestore, CUSTOMERS);
    const snapshot = await getDocs(ref);
    const nextNum = snapshot.size + 1;
    return `CUST-${String(nextNum).padStart(3, '0')}`;
  }
}
