export class NotificationResponseDto {
  id: string;
  type: string;
  actorId?: string | null;
  sourceId?: string | null;
  movieId?: number | null;
  title: string;
  body?: string | null;
  data?: any;
  is_read: boolean;
  createdAt: string;
}
