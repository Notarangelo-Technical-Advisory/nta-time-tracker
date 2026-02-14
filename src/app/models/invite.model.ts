export interface Invite {
  id: string;
  email: string;
  customerId: string;
  customerName: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
}
