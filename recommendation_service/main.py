from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import numpy as np

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class HistoryItem(BaseModel):
    media_id: int
    description: str
    rating: Optional[int] = None

class CatalogItem(BaseModel):
    media_id: int
    description: str

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
    # rating is 1..10; if none -> 1.0
    if r is None:
        return 1.0
    r = max(1, min(10, int(r)))
    # map to 0.5..2.0
    return 0.5 + (r - 1) * (1.5 / 9.0)

@app.post("/recommend")
def recommend(data: RecommendationRequest):
    if not data.user_history or not data.catalog:
        return {"recommendations": []}

    exclude = set(data.exclude_ids or [])
    # build filtered catalog indices
    catalog_items = [c for c in data.catalog if c.media_id not in exclude]
    if not catalog_items:
        return {"recommendations": []}

    history_texts = [item.description or "" for item in data.user_history]
    catalog_texts = [item.description or "" for item in catalog_items]

    # bilingual stopwords: keep simple; english stopwords + some russian particles
    ru_sw = ["и","в","во","не","что","он","на","я","с","со","как","а","то","все","она","так","его","но","да","ты",
             "к","у","же","вы","за","бы","по","ее","мне","было","вот","от","меня","еще","нет","о","из","ему","теперь",
             "когда","даже","ну","вдруг","ли","если","уже","или","ни","быть","был","него","до","вас","нибудь","опять",
             "уж","вам","ведь","там","потом","себя","ничего","ей","может","они","тут","где","есть","надо","ней","для"]
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1,2), min_df=1)
    tfidf = vectorizer.fit_transform(history_texts + catalog_texts)

    hist_vecs = tfidf[:len(history_texts)]
    cat_vecs = tfidf[len(history_texts):]

    sim = cosine_similarity(cat_vecs, hist_vecs)

    weights = np.array([_weight_from_rating(h.rating) for h in data.user_history], dtype=float)
    weights = weights / (weights.sum() + 1e-9)

    scores = (sim * weights.reshape(1, -1)).sum(axis=1)

    pairs = list(zip(catalog_items, scores))
    pairs.sort(key=lambda x: x[1], reverse=True)
    pairs = pairs[: data.limit]

    return {"recommendations": [{"media_id": int(item.media_id), "score": float(score)} for item, score in pairs]}
