import { api } from "./axios";
import type { User } from "../types/user";

export const getProfile = () => api.get<User>("/profile");
export const patchProfile = (data: Partial<User>) => api.patch("/profile", data);

export const getActivity = () => api.get("/activity");

export const upsertActivity = (data: { media_id: number; status?: string; rating?: number | null }) =>
    api.post("/activity", data);

export const deleteActivity = (mediaId: number) =>
    api.delete(`/activity/${mediaId}`);