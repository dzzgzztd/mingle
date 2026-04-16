export interface ExternalSearchItem {
    source: string;
    externalId: string;
    type: string;
    title: string;
    year?: number;
    creator?: string;
    imageUrl?: string;
    description?: string;
}