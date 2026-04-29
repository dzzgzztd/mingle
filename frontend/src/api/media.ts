import { api } from "./axios";
import type { MediaDraft, MediaItem, MediaSubmission } from "../types/media";

export const searchMedia = (params: { q: string; type?: string }) =>
    api.get("/search", { params });

export const getMedia = (params?: { q?: string; type?: string }) =>
    api.get<MediaItem[]>("/media", { params });

export const getMediaById = (id: string | number) =>
    api.get<MediaItem>(`/media/${id}`);

export const createMedia = (data: MediaDraft) =>
    api.post<MediaSubmission>("/media/submissions", data);

export const submitMedia = (data: MediaDraft) =>
    api.post<MediaSubmission>("/media/submissions", data);

export const getMyMediaSubmissions = () =>
    api.get<MediaSubmission[]>("/submissions/media/my");

export const getRecommendationsForMedia = (id: string | number) =>
    api.get(`/media/${id}/recommendations`);
