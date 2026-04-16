import { api } from "./axios";

export const listCollections = () => api.get("/collections");

export const createCollection = (data: { title: string; description?: string }) =>
    api.post("/collections", data);

export const getCollection = (id: number | string) => api.get(`/collections/${id}`);

export const updateCollection = (
    id: number | string,
    data: { title?: string; description?: string }
) => api.patch(`/collections/${id}`, data);

export const addToCollection = (id: number | string, media_id: number) =>
    api.post(`/collections/${id}/items`, { media_id });

export const getCollectionRecommendations = (id: number | string) =>
    api.get(`/collections/${id}/recommendations`);
