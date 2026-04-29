import { api } from "./axios";
import type { MediaDraft, MediaItem, MediaSubmission } from "../types/media";

export const listModerationSubmissions = (status = "pending") =>
    api.get<MediaSubmission[]>("/admin/submissions/media", { params: { status } });

export const approveSubmission = (id: number | string) =>
    api.post(`/admin/submissions/media/${id}/approve`);

export const rejectSubmission = (id: number | string, comment?: string) =>
    api.post(`/admin/submissions/media/${id}/reject`, { comment });

export const adminUpdateMedia = (id: number | string, data: MediaDraft) =>
    api.patch<MediaItem>(`/admin/media/${id}`, data);

export const adminDeleteMedia = (id: number | string) =>
    api.delete(`/admin/media/${id}`);
