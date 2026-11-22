import { api } from './client';
import type { Comment } from '../types/comment';
import type { PagedResult } from '../types/catch';

/** Comments attach to trips: one trip, one conversation. */
export const commentsApi = {
  getForTrip: (tripId: string, page = 1, pageSize = 20) =>
    api.get<PagedResult<Comment>>(`/trips/${tripId}/comments?page=${page}&pageSize=${pageSize}`),

  add: (tripId: string, content: string) =>
    api.post<Comment>(`/trips/${tripId}/comments`, { content }),

  update: (tripId: string, commentId: string, content: string) =>
    api.put<void>(`/trips/${tripId}/comments/${commentId}`, { content }),

  remove: (tripId: string, commentId: string) =>
    api.delete<void>(`/trips/${tripId}/comments/${commentId}`),
};
