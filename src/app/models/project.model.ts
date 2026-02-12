export interface Project {
  id: string;
  projectId: string;
  customerId: string;
  projectName: string;
  description?: string;
  hourlyRate?: number;
  status: 'active' | 'completed' | 'on-hold';
  createdAt: Date;
  updatedAt: Date;
}
