import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getMedia } from "../api/media";
import type { MediaItem } from "../types/media";
import Cover from "../components/Cover";
import styles from "./MediaList.module.css";

const TYPE_LABEL: Record<string, string> = {
  movie: "Фильмы",
  series: "Сериалы",
  book: "Книги",
  game: "Игры",
};

const TYPES = [
  { value: "movie", label: "Фильмы" },
  { value: "series", label: "Сериалы" },
  { value: "book", label: "Книги" },
  { value: "game", label: "Игры" },
];

export default function MediaList() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const typeFromUrl = sp.get("type") || "movie";

  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState(typeFromUrl);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = TYPE_LABEL[typeFromUrl] || "Каталог";

  useEffect(() => {
    setSelectedType(typeFromUrl);
  }, [typeFromUrl]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await getMedia({
          type: typeFromUrl || undefined,
        });

        if (!cancelled) {
          setItems(res.data || []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setItems([]);
          setError(e?.response?.data?.error || "Не удалось загрузить каталог");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [typeFromUrl]);

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();

    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    const params = new URLSearchParams();
    params.set("q", cleanQuery);

    if (selectedType) {
      params.set("type", selectedType);
    }

    navigate(`/search?${params.toString()}`);
  };

  const openItem = (id: number) => {
    navigate(`/media/${id}`);
  };

  return (
      <div>
        <div className={styles.h2}>{title}</div>

        <form className={styles.searchPanel} onSubmit={submitSearch}>
          <div className={styles.searchRow}>
            <input
                className={styles.searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Введите название..."
            />

            <select
                className={styles.typeSelect}
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
            >
              {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
              ))}
            </select>

            <button
                className={styles.searchBtn}
                type="submit"
                disabled={!query.trim()}
            >
              Искать
            </button>
          </div>
        </form>

        {loading && <div className="small">загрузка...</div>}
        {error && <div className={styles.error}>{error}</div>}

        {!loading && !error && items.length === 0 && (
            <div className="small">в каталоге пока нет контента этого типа</div>
        )}

        <div className={styles.list}>
          {items.map((item) => (
              <button
                  key={item.id}
                  className={styles.rowButton}
                  type="button"
                  onClick={() => openItem(item.id)}
              >
                <div className={styles.row}>
                  <div className={styles.cover}>
                    <Cover
                        src={item.imageURL || undefined}
                        seed={String(item.id)}
                        variant="thumb"
                    />
                  </div>

                  <div className={styles.info}>
                    <div className={styles.name}>{item.title}</div>

                    <div className={styles.meta}>
                      {item.creator || "—"}
                      {item.year ? ` • ${item.year}` : ""}
                    </div>

                    <div className={styles.desc}>
                      {item.description || "Описание пока не добавлено"}
                    </div>
                  </div>
                </div>
              </button>
          ))}
        </div>
      </div>
  );
}