export interface Customer {
  id: string;
  customerId: string;
  companyName: string;
  shortName?: string;
  address?: string;
  billablePersonName: string;
  email?: string;
  phone?: string;
  hourlyRate?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
