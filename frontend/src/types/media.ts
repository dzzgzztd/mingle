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
