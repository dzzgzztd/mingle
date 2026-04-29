from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from collections import Counter
import numpy as np

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class HistoryItem(BaseModel):
    media_id: int
    title: Optional[str] = ""
    description: Optional[str] = ""
    type: Optional[str] = ""
    creator: Optional[str] = ""
    year: Optional[int] = None
    rating: Optional[int] = None


class CatalogItem(BaseModel):
    media_id: int
    title: Optional[str] = ""
    description: Optional[str] = ""
    type: Optional[str] = ""
    creator: Optional[str] = ""
    year: Optional[int] = None


class RecommendationRequest(BaseModel):
    user_id: int
    user_history: List[HistoryItem]
    catalog: List[CatalogItem]
    limit: int = 10
    exclude_ids: Optional[List[int]] = None


class RecommendationItem(BaseModel):
    media_id: int
    score: float


app = FastAPI(title="Mingle Recommendation Service")


def _weight_from_rating(r: Optional[int]) -> float:
    if r is None:
        return 1.0
    r = max(1, min(10, int(r)))
    return 0.5 + (r - 1) * (1.5 / 9.0)


def _media_text(item) -> str:
    parts = [
        item.type or "",
        item.type or "",
        item.title or "",
        item.title or "",
        item.creator or "",
        str(item.year or ""),
        item.description or "",
    ]
    return " ".join(p for p in parts if p).strip()


def _stable_jitter(seed: int, media_id: int) -> float:
    x = (seed * 1103515245 + media_id * 12345 + 1234567) & 0x7FFFFFFF
    return (x % 1000) / 1000.0


@app.post("/recommend")
def recommend(data: RecommendationRequest):
    if not data.user_history or not data.catalog:
        return {"recommendations": []}

    exclude = set(data.exclude_ids or [])
    catalog_items = [c for c in data.catalog if c.media_id not in exclude]
    if not catalog_items:
        return {"recommendations": []}

    history_texts = [_media_text(item) for item in data.user_history]
    catalog_texts = [_media_text(item) for item in catalog_items]

    ru_sw = [
        "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все",
        "она", "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "ее",
        "мне", "было", "вот", "от", "меня", "еще", "нет", "о", "из", "ему", "теперь", "когда",
        "даже", "ну", "вдруг", "ли", "если", "уже", "или", "ни", "быть", "был", "него", "до",
        "вас", "нибудь", "опять", "уж", "вам", "ведь", "там", "потом", "себя", "ничего", "ей",
        "может", "они", "тут", "где", "есть", "надо", "ней", "для",
    ]
    stop_words = list(set(ENGLISH_STOP_WORDS).union(ru_sw))

    try:
        vectorizer = TfidfVectorizer(stop_words=stop_words, ngram_range=(1, 2), min_df=1)
        tfidf = vectorizer.fit_transform(history_texts + catalog_texts)
        hist_vecs = tfidf[: len(history_texts)]
        cat_vecs = tfidf[len(history_texts) :]
        sim = cosine_similarity(cat_vecs, hist_vecs)
    except ValueError:
        sim = np.zeros((len(catalog_items), len(data.user_history)), dtype=float)

    weights = np.array([_weight_from_rating(h.rating) for h in data.user_history], dtype=float)
    weights = weights / (weights.sum() + 1e-9)
    scores = (sim * weights.reshape(1, -1)).sum(axis=1)

    history_types = [h.type for h in data.user_history if h.type]
    main_type = Counter(history_types).most_common(1)[0][0] if history_types else ""
    history_creators = {str(h.creator).strip().lower() for h in data.user_history if h.creator}
    seed = data.user_id * 17 + sum((idx + 1) * h.media_id for idx, h in enumerate(data.user_history))

    for idx, item in enumerate(catalog_items):
        if main_type and item.type == main_type:
            scores[idx] += 0.12
        if item.creator and item.creator.strip().lower() in history_creators:
            scores[idx] += 0.04
        scores[idx] += _stable_jitter(seed, item.media_id) * 0.0001

    pairs = list(zip(catalog_items, scores))
    pairs.sort(key=lambda x: x[1], reverse=True)
    pairs = pairs[: data.limit]

    return {
        "recommendations": [
            {"media_id": int(item.media_id), "score": float(score)}
            for item, score in pairs
        ]
    }
