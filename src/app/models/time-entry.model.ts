export interface TimeEntry {
  id: string;
  userId: string;
  customerId: string;
  projectId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  description?: string;
  invoiceId?: string;
  status: 'unbilled' | 'billed' | 'paid';
  createdAt: Date;
  updatedAt: Date;
}
