import { api } from "./axios";
import type { MediaItem } from "../types/media";

export const searchMedia = (params: { q: string; type?: string }) =>
    api.get("/search", { params });

export const getMedia = (params?: { q?: string; type?: string }) =>
  api.get<MediaItem[]>("/media", { params });

export const getMediaById = (id: string | number) =>
  api.get<MediaItem>(`/media/${id}`);

export const createMedia = (data: Partial<MediaItem>) =>
  api.post("/media", data);

export const getRecommendationsForMedia = (id: string | number) =>
  api.get(`/media/${id}/recommendations`);
