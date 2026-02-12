import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, docData, addDoc, updateDoc, deleteDoc, query, orderBy, where, getDocs } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { PROJECTS } from './firestore-collections.const';
import { Project } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private firestore = inject(Firestore);

  getProjects(): Observable<Project[]> {
    const ref = collection(this.firestore, PROJECTS);
    const q = query(ref, orderBy('projectName', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Project[]>;
  }

  getProjectsByCustomer(customerId: string): Observable<Project[]> {
    const ref = collection(this.firestore, PROJECTS);
    const q = query(ref, where('customerId', '==', customerId), orderBy('projectName', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Project[]>;
  }

  getActiveProjectsByCustomer(customerId: string): Observable<Project[]> {
    const ref = collection(this.firestore, PROJECTS);
    const q = query(ref, where('customerId', '==', customerId), where('status', '==', 'active'), orderBy('projectName', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Project[]>;
  }

  getProject(id: string): Observable<Project> {
    const ref = doc(this.firestore, PROJECTS, id);
    return docData(ref, { idField: 'id' }) as Observable<Project>;
  }

  async createProject(data: Partial<Project>): Promise<string> {
    const projectId = await this.generateProjectId();
    const now = new Date();
    const ref = collection(this.firestore, PROJECTS);
    const docRef = await addDoc(ref, {
      ...data,
      projectId,
      status: data.status || 'active',
      createdAt: now,
      updatedAt: now
    });
    return docRef.id;
  }

  async updateProject(id: string, data: Partial<Project>): Promise<void> {
    const ref = doc(this.firestore, PROJECTS, id);
    await updateDoc(ref, {
      ...data,
      updatedAt: new Date()
    });
  }

  async deleteProject(id: string): Promise<void> {
    const ref = doc(this.firestore, PROJECTS, id);
    await deleteDoc(ref);
  }

  private async generateProjectId(): Promise<string> {
    const ref = collection(this.firestore, PROJECTS);
    const snapshot = await getDocs(ref);
    const nextNum = snapshot.size + 1;
    return `PROJ-${String(nextNum).padStart(3, '0')}`;
  }
}
