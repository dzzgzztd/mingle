export interface MediaItem {
  id: number;
  title: string;
  description: string;
  type: string;
  year?: number | null;
  creator?: string | null;
  imageURL?: string | null;
  source?: string | null;
  externalID?: string | null;
}

export interface MediaDraft {
  title: string;
  description?: string;
  type: string;
  year?: number | null;
  creator?: string;
  imageURL?: string;
}

export interface MediaSubmission extends MediaDraft {
  id: number;
  user_id: number;
  status: "pending" | "approved" | "rejected";
  admin_comment?: string;
  reviewed_by?: number | null;
  media_id?: number | null;
  created_at: string;
  updated_at: string;
}
