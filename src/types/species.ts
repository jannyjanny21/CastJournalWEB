export type SpeciesStatus = 'Approved' | 'Pending' | 'Rejected';

export interface Species {
  id: string;
  commonName: string;
  scientificName: string | null;
  category: string | null;
  description: string | null;
  averageSize: string | null;
  imageUrl: string | null;
  isApproved: boolean;
  /** Species requests (FR-42). */
  status: SpeciesStatus;
  requestedByUserId: string | null;
  requestedByName: string | null;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface SpeciesRequestPayload {
  commonName: string;
  scientificName?: string;
  description?: string;
}
