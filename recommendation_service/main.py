from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
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


def _description_text(item) -> str:
    description = (item.description or "").strip()
    if description:
        return description

    return (item.title or "").strip()


def _title_text(item) -> str:
    return (item.title or "").strip()


def _creator_key(item) -> str:
    return (item.creator or "").strip().lower()


def _stable_jitter(seed: int, media_id: int) -> float:
    x = (seed * 1103515245 + media_id * 12345 + 1234567) & 0x7FFFFFFF
    return (x % 1000) / 1000.0


def _stop_words() -> List[str]:
    ru_sw = [
        "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все",
        "она", "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "ее",
        "мне", "было", "вот", "от", "меня", "еще", "нет", "о", "из", "ему", "теперь", "когда",
        "даже", "ну", "вдруг", "ли", "если", "уже", "или", "ни", "быть", "был", "него", "до",
        "вас", "нибудь", "опять", "уж", "вам", "ведь", "там", "потом", "себя", "ничего", "ей",
        "может", "они", "тут", "где", "есть", "надо", "ней", "для", "это", "этот", "эта",
        "эти", "который", "которая", "которые", "свой", "своя", "свои",
    ]

    domain_sw = [
        "story", "follows", "follow", "follower", "new", "old", "young",
        "one", "two", "three", "people", "person", "man", "woman", "boy", "girl",
        "life", "lives", "world", "time", "find", "finds", "must", "become",
        "based", "set", "series", "film", "movie", "book", "game", "novel",
        "content", "media",

        "история", "новый", "новая", "новые", "старый", "молодой",
        "один", "два", "человек", "люди", "мужчина", "женщина",
        "мальчик", "девочка", "жизнь", "мир", "время", "становится",
        "должен", "должна", "основан", "основана", "фильм", "сериал",
        "книга", "игра", "роман", "контент",
    ]

    return list(set(ENGLISH_STOP_WORDS).union(ru_sw).union(domain_sw))


def _similarity_matrix(
        history_texts: List[str],
        catalog_texts: List[str],
        stop_words: List[str],
) -> np.ndarray:
    total_docs = len(history_texts) + len(catalog_texts)

    if total_docs == 0:
        return np.zeros((len(catalog_texts), len(history_texts)), dtype=float)

    all_texts = history_texts + catalog_texts

    if not any(text.strip() for text in all_texts):
        return np.zeros((len(catalog_texts), len(history_texts)), dtype=float)

    try:
        vectorizer = TfidfVectorizer(
            stop_words=stop_words,
            ngram_range=(1, 3),
            min_df=1,
            max_df=0.85 if total_docs >= 10 else 1.0,
            sublinear_tf=True,
            norm="l2",
            token_pattern=r"(?u)\b[^\W\d_][^\W_]{2,}\b",
        )

        tfidf = vectorizer.fit_transform(all_texts)
        hist_vecs = tfidf[: len(history_texts)]
        cat_vecs = tfidf[len(history_texts):]

        return cosine_similarity(cat_vecs, hist_vecs)

    except ValueError:
        return np.zeros((len(catalog_texts), len(history_texts)), dtype=float)


def _history_weights(history: List[HistoryItem]) -> np.ndarray:
    weights = np.array([_weight_from_rating(h.rating) for h in history], dtype=float)
    return weights / (weights.sum() + 1e-9)


@app.post("/recommend")
def recommend(data: RecommendationRequest):
    if not data.user_history or not data.catalog:
        return {"recommendations": []}

    exclude = set(data.exclude_ids or [])
    catalog_items = [c for c in data.catalog if c.media_id not in exclude]

    if not catalog_items:
        return {"recommendations": []}

    limit = max(0, min(int(data.limit), len(catalog_items)))
    if limit == 0:
        return {"recommendations": []}

    stop_words = _stop_words()

    history_descriptions = [_description_text(item) for item in data.user_history]
    catalog_descriptions = [_description_text(item) for item in catalog_items]

    description_sim = _similarity_matrix(
        history_descriptions,
        catalog_descriptions,
        stop_words,
    )

    weights = _history_weights(data.user_history)

    scores = (description_sim * weights.reshape(1, -1)).sum(axis=1)

    history_creators = {
        _creator_key(h)
        for h in data.user_history
        if _creator_key(h)
    }

    seed = data.user_id * 17 + sum(
        (idx + 1) * h.media_id
        for idx, h in enumerate(data.user_history)
    )

    for idx, item in enumerate(catalog_items):
        creator = _creator_key(item)

        if creator and creator in history_creators:
            scores[idx] += 0.05

        scores[idx] += _stable_jitter(seed, item.media_id) * 0.0001

    pairs = list(zip(catalog_items, scores))
    pairs.sort(key=lambda x: x[1], reverse=True)
    pairs = pairs[:limit]

    return {
        "recommendations": [
            {
                "media_id": int(item.media_id),
                "score": float(score),
            }
            for item, score in pairs
        ]
    }
