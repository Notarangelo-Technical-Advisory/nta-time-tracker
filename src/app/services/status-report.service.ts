import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  getDocs,
  where
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable } from 'rxjs';
import { STATUS_REPORTS, OUTCOMES } from './firestore-collections.const';
import { StatusReport, StatusReportSection } from '../models/status-report.model';
import { OutcomeRecord } from '../models/outcome-record.model';
import { TimeEntry } from '../models/time-entry.model';
import { Project } from '../models/project.model';

interface GenerateStatusReportRequest {
  customerName: string;
  entries: Array<{
    date: string;
    description?: string;
    durationHours: number;
    projectName: string;
    status: string;
    invoiceId?: string;
  }>;
  priorOutcomes: Array<{ projectName: string; outcomes: string[] }>;
}

interface GenerateStatusReportResponse {
  sections: StatusReportSection[];
}

@Injectable({ providedIn: 'root' })
export class StatusReportService {
  private firestore = inject(Firestore);
  private functions = inject(Functions);

  getStatusReports(): Observable<StatusReport[]> {
    const ref = collection(this.firestore, STATUS_REPORTS);
    const q = query(ref, orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<StatusReport[]>;
  }

  getStatusReport(id: string): Observable<StatusReport> {
    const ref = doc(this.firestore, STATUS_REPORTS, id);
    return docData(ref, { idField: 'id' }) as Observable<StatusReport>;
  }

  async generateWithAI(
    customerName: string,
    entries: TimeEntry[],
    projectMap: Map<string, Project>,
    priorOutcomes: OutcomeRecord[]
  ): Promise<StatusReportSection[]> {
    const callable = httpsCallable<GenerateStatusReportRequest, GenerateStatusReportResponse>(
      this.functions,
      'generateStatusReport'
    );

    const entriesInput = entries.map(e => ({
      date: e.date,
      description: e.description,
      durationHours: e.durationHours,
      projectName: projectMap.get(e.projectId)?.projectName ?? e.projectId,
      status: e.status,
      invoiceId: e.invoiceId
    }));

    const priorOutcomesInput = priorOutcomes.map(r => ({
      projectName: r.projectName,
      outcomes: r.outcomes
    }));

    const result = await callable({ customerName, entries: entriesInput, priorOutcomes: priorOutcomesInput });
    return result.data.sections;
  }

  async getOutcomesByCustomer(customerId: string): Promise<OutcomeRecord[]> {
    const ref = collection(this.firestore, OUTCOMES);
    const q = query(ref, where('customerId', '==', customerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as OutcomeRecord));
  }

  async upsertOutcomes(customerId: string, sections: StatusReportSection[]): Promise<void> {
    const existing = await this.getOutcomesByCustomer(customerId);
    const now = new Date();

    for (const section of sections) {
      const record = existing.find(r => r.projectName === section.projectName);
      if (record?.id) {
        const ref = doc(this.firestore, OUTCOMES, record.id);
        await updateDoc(ref, { outcomes: section.outcomes, updatedAt: now });
      } else {
        const ref = collection(this.firestore, OUTCOMES);
        await addDoc(ref, {
          customerId,
          projectName: section.projectName,
          outcomes: section.outcomes,
          updatedAt: now
        });
      }
    }
  }

  async saveReport(
    customerId: string,
    customerName: string,
    entries: TimeEntry[],
    sections: StatusReportSection[]
  ): Promise<string> {
    const reportNumber = await this.generateReportNumber();

    const dates = entries.map(e => e.date).sort();
    const periodStart = dates[0];
    const periodEnd = dates[dates.length - 1];

    const now = new Date();
    const ref = collection(this.firestore, STATUS_REPORTS);
    const docRef = await addDoc(ref, {
      reportNumber,
      customerId,
      customerName,
      periodStart,
      periodEnd,
      timeEntryIds: entries.map(e => e.id),
      sections,
      status: 'draft',
      createdAt: now,
      updatedAt: now
    });

    return docRef.id;
  }

  async deleteReport(id: string): Promise<void> {
    const ref = doc(this.firestore, STATUS_REPORTS, id);
    await deleteDoc(ref);
  }

  async updateStatus(id: string, status: StatusReport['status']): Promise<void> {
    const ref = doc(this.firestore, STATUS_REPORTS, id);
    await updateDoc(ref, { status, updatedAt: new Date() });
  }

  async updateSections(id: string, sections: StatusReportSection[]): Promise<void> {
    const ref = doc(this.firestore, STATUS_REPORTS, id);
    await updateDoc(ref, { sections, updatedAt: new Date() });
  }

  private async generateReportNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const ref = collection(this.firestore, STATUS_REPORTS);
    const snapshot = await getDocs(ref);
    const thisYearReports = snapshot.docs.filter(d => {
      const num = d.data()['reportNumber'] as string;
      return num && num.startsWith(`RPT-${year}`);
    });
    const nextNum = thisYearReports.length + 1;
    return `RPT-${year}-${String(nextNum).padStart(3, '0')}`;
  }
}
