import { api } from "./axios";

export const externalSearch = (params: { q: string; type?: string; source?: string }) =>
    api.get("/external/search", { params });

export const externalImport = (data: { source: string; externalId: string }) =>
    api.post("/external/import", data);
