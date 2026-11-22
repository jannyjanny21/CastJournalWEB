export interface Comment {
  id: string;
  tripId: string;
  userId: string;
  userFullName: string | null;
  userAvatarUrl: string | null;
  content: string;
  createdAt: string;
  editedAt: string | null;
  isOwnedByCurrentUser: boolean;
}
