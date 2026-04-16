import json
import os
import random
import requests
import time

from requests.exceptions import HTTPError, RequestException

OMDB = "https://www.omdbapi.com/"
GBOOKS = "https://www.googleapis.com/books/v1/volumes"

OMDB_KEY = os.environ.get("OMDB_API_KEY", "")
GBOOKS_KEY = os.environ.get("GOOGLE_BOOKS_API_KEY", "")
OUT = os.environ.get("CATALOG_OUT", "/app/seed/catalog.jsonl")

TARGET_MEDIA = int(os.environ.get("TARGET_MEDIA", "3000"))
TARGET_BOOKS = int(os.environ.get("TARGET_BOOKS", "6000"))


def omdb_search(term: str, page: int = 1):
    r = requests.get(OMDB, params={"apikey": OMDB_KEY, "s": term, "page": page}, timeout=20)
    r.raise_for_status()
    d = r.json()
    if d.get("Response") != "True":
        return []
    return d.get("Search", [])


def omdb_details(imdb_id: str):
    r = requests.get(OMDB, params={"apikey": OMDB_KEY, "i": imdb_id, "plot": "short"}, timeout=20)
    r.raise_for_status()
    d = r.json()
    if d.get("Response") != "True":
        return None
    return d


def omdb_to_row(d):
    title = d.get("Title") or ""
    typ = d.get("Type") or ""
    y = d.get("Year") or ""
    year = int(y[:4]) if len(y) >= 4 and y[:4].isdigit() else None
    creator = d.get("Director") or d.get("Writer") or ""
    desc = d.get("Plot") or ""
    img = d.get("Poster") or ""
    if img == "N/A": img = ""
    return {
        "type": typ,
        "title": title,
        "year": year,
        "creator": creator,
        "description": desc[:800],
        "imageURL": img,
        "source": "omdb",
        "externalId": d.get("imdbID") or "",
    }


def gbooks_search(query: str, start_index: int, max_results: int = 40):
    params = {"q": query, "startIndex": start_index, "maxResults": max_results}
    if GBOOKS_KEY:
        params["key"] = GBOOKS_KEY

    try:
        r = requests.get(GBOOKS, params=params, timeout=25)
        if r.status_code == 400:
            return "__STOP__", []
        if r.status_code in (429, 500, 502, 503, 504):
            return "__RETRY__", []
        r.raise_for_status()
        d = r.json()
        if "error" in d:
            msg = d["error"].get("message", "gbooks error")
            return "__STOP__", [] if "invalid" in msg.lower() else "__RETRY__", []
        return "__OK__", d.get("items", [])
    except (HTTPError, RequestException):
        return "__RETRY__", []


def gbooks_to_row(item):
    vid = item.get("id") or ""
    v = item.get("volumeInfo", {}) or {}
    title = v.get("title") or ""
    authors = ", ".join((v.get("authors") or [])[:3])
    desc = v.get("description") or ""
    pd = v.get("publishedDate") or ""
    year = int(pd[:4]) if len(pd) >= 4 and pd[:4].isdigit() else None
    img = ((v.get("imageLinks") or {}).get("thumbnail") or "")
    if img.startswith("http://"):
        img = "https://" + img[len("http://"):]
    return {
        "type": "book",
        "title": title,
        "year": year,
        "creator": authors,
        "description": desc[:800],
        "imageURL": img,
        "source": "gbooks",
        "externalId": vid,
    }


def write_row(f, row):
    row = {k: v for k, v in row.items() if v not in ("", None, [])}
    f.write(json.dumps(row, ensure_ascii=False) + "\n")


def main():
    if not OMDB_KEY:
        raise SystemExit("OMDB_API_KEY is missing")

    seen = set()
    count_media = 0
    count_books = 0

    with open(OUT, "w", encoding="utf-8") as f:
        # ---- Movies/Series ----
        terms = [
            "love", "war", "space", "star", "dark", "night", "man", "girl", "world", "life",
            "future", "city", "dream", "king", "secret", "red", "blue", "black", "detective",
            "crime", "alien", "robot", "time", "lost", "fire", "ice", "gold", "shadow"
        ]
        random.shuffle(terms)

        for term in terms:
            for page in range(1, 11):
                if count_media >= TARGET_MEDIA:
                    break
                hits = omdb_search(term, page)
                time.sleep(0.2)
                for h in hits:
                    imdb = h.get("imdbID")
                    if not imdb or imdb in seen:
                        continue
                    d = omdb_details(imdb)
                    time.sleep(0.2)
                    if not d:
                        continue
                    row = omdb_to_row(d)
                    if row.get("type") not in ("movie", "series"):
                        continue
                    write_row(f, row)
                    seen.add(imdb)
                    count_media += 1
                    if count_media >= TARGET_MEDIA:
                        break
            if count_media >= TARGET_MEDIA:
                break

        # ---- Books ----
        book_queries = [
            "subject:fiction", "subject:fantasy", "subject:science", "subject:history",
            "subject:philosophy", "subject:psychology", "subject:computers",
            "subject:mathematics", "subject:art", "subject:music"
        ]

        for q in book_queries:
            for start in range(0, 1200, 40):
                if count_books >= TARGET_BOOKS:
                    break

                status, items = gbooks_search(q, start, 40)

                if status == "__STOP__":
                    break

                if status == "__RETRY__":
                    time.sleep(1.0)
                    status2, items2 = gbooks_search(q, start, 40)
                    if status2 == "__STOP__":
                        break
                    items = items2

                time.sleep(0.15)

                for it in items:
                    vid = it.get("id")
                    key = "gbooks:" + str(vid)
                    if not vid or key in seen:
                        continue
                    row = gbooks_to_row(it)
                    if not row.get("title"):
                        continue
                    write_row(f, row)
                    seen.add(key)
                    count_books += 1
                    if count_books % 200 == 0:
                        print("books:", count_books, flush=True)
                    if count_books >= TARGET_BOOKS:
                        break

            if count_books >= TARGET_BOOKS:
                break

    print("done:", OUT, "media:", count_media, "books:", count_books)


if __name__ == "__main__":
    main()
