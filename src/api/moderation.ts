import { api } from './client';

export type ReportTargetType = 'Trip' | 'Comment';
export type ReportReason = 'Spam' | 'Offensive' | 'Harassment' | 'NotFishingRelated' | 'PrivateInformation' | 'Other';
export type ReportStatus = 'Open' | 'Dismissed' | 'ContentRemoved';

export const REPORT_REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: 'Spam', label: 'Spam or advertising', hint: 'Selling, links, repeated posts' },
  { value: 'Offensive', label: 'Offensive or inappropriate', hint: 'Graphic, hateful or adult content' },
  { value: 'Harassment', label: 'Harassment or bullying', hint: 'Targets or insults someone' },
  { value: 'NotFishingRelated', label: 'Not about fishing', hint: "Doesn't belong in a fishing community" },
  { value: 'PrivateInformation', label: "Shares someone's private information", hint: 'Phone numbers, addresses, private spots of others' },
  { value: 'Other', label: 'Something else', hint: 'Tell us what’s wrong' },
];

export const reasonLabel = (r: ReportReason) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r;

export interface ModerationItem {
  targetType: ReportTargetType;
  targetId: string;
  tripId: string;
  status: ReportStatus;
  authorId: string | null;
  authorName: string | null;
  tripTitle: string | null;
  /** Only while still public; null if the author withdrew or deleted it. */
  preview: string | null;
  coverUrl: string | null;
  isStillPublic: boolean;
  reportCount: number;
  firstReportedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  reports: { reporterName: string | null; reason: ReportReason; details: string | null; createdAt: string }[];
}

/** Content flagging (FR-44, F-18). */
export const moderationApi = {
  report: (targetType: ReportTargetType, targetId: string, reason: ReportReason, details?: string) =>
    api.post<{ message: string }>('/moderation/reports', { targetType, targetId, reason, details }),

  // Admin
  queue: (status: 'open' | 'closed') => api.get<ModerationItem[]>(`/moderation/queue?status=${status}`),
  openCount: () => api.get<number>('/moderation/open-count'),
  dismiss: (type: ReportTargetType, id: string, note?: string) =>
    api.post<{ closed: number }>(`/moderation/${type}/${id}/dismiss`, { reason: note }),
  remove: (type: ReportTargetType, id: string, reason: string) =>
    api.post<{ closed: number }>(`/moderation/${type}/${id}/remove`, { reason }),
};
