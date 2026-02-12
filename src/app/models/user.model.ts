export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'customer';
  isAdmin: boolean;
  createdAt: Date;
  lastLogin: Date;
  displayName?: string;
  company?: string;
  customerId?: string;
}
