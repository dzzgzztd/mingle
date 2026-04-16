import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getMedia } from "../api/media";
import { externalSearch, externalImport } from "../api/external";
import type { MediaItem } from "../types/media";
import type { ExternalSearchItem } from "../types/external";
import Cover from "../components/Cover";
import styles from "./MediaList.module.css";

const TYPE_LABEL: Record<string, string> = {
  movie: "Фильмы",
  series: "Сериалы",
  book: "Книги",
  game: "Игры",
};

export default function MediaList() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const qFromUrl = params.get("q") ?? "";
  const typeFromUrl = params.get("type") ?? "movie";

  const [q, setQ] = useState(qFromUrl);
  const [type, setType] = useState(typeFromUrl);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [extItems, setExtItems] = useState<ExternalSearchItem[]>([]);
  const [extLoading, setExtLoading] = useState(false);
  const [extError, setExtError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (qFromUrl) return `Поиск: “${qFromUrl}”`;
    return TYPE_LABEL[typeFromUrl] ?? "Каталог";
  }, [qFromUrl, typeFromUrl]);

  const loadLocal = async (qq?: string, tt?: string) => {
    setLoading(true);
    try {
      const res = await getMedia({
        q: qq && qq.trim() ? qq.trim() : undefined,
        type: tt && tt.trim() ? tt.trim() : undefined,
      });
      setItems(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocal(qFromUrl, typeFromUrl);
  }, [qFromUrl, typeFromUrl]);

  const applyFiltersToUrl = () => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (type) sp.set("type", type);
    navigate({ pathname: "/media", search: sp.toString() });
  };

  const doExternalSearch = async () => {
    setExtLoading(true);
    setExtError(null);
    try {
      const res = await externalSearch({
        q: q.trim(),
        type,
      });
      setExtItems(res.data.items ?? []);
    } catch (e: any) {
      const msg =
          e?.response?.data?.error ||
          e?.message ||
          "Ошибка внешнего поиска";
      setExtError(String(msg));
      setExtItems([]);
    } finally {
      setExtLoading(false);
    }
  };

  const doImport = async (x: ExternalSearchItem) => {
    try {
      const res = await externalImport({ source: x.source, externalId: x.externalId });
      const mediaId = res.data.mediaId;

      await loadLocal(qFromUrl, typeFromUrl);

      if (mediaId) navigate(`/media/${mediaId}`);
    } catch (e: any) {
      const msg =
          e?.response?.data?.error ||
          e?.message ||
          "Не удалось импортировать";
      alert(msg);
    }
  };

  return (
      <div>
        <div className={styles.h2}>{title}</div>

        <div className={styles.toolbar}>
          <input
              className={styles.search}
              placeholder="Поиск..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFiltersToUrl();
              }}
          />

          <select
              className={styles.select}
              value={type}
              onChange={(e) => setType(e.target.value)}
          >
            <option value="movie">Фильмы</option>
            <option value="series">Сериалы</option>
            <option value="book">Книги</option>
            <option value="game">Игры</option>
          </select>

          <button className={styles.btn} onClick={applyFiltersToUrl}>
            Искать
          </button>

          <button
              className={styles.btnAlt}
              onClick={doExternalSearch}
              disabled={!q.trim() || extLoading}
              title="Поиск во внешних источниках (OMDb/Google Books/TGDB)"
          >
            {extLoading ? "Ищу..." : "Искать онлайн"}
          </button>
        </div>

        {(extLoading || extError || extItems.length > 0) && (
            <div className={styles.externalBlock}>
              <div className={styles.externalTitle}>Результаты онлайн</div>
              {extError && <div className="small">{extError}</div>}

              <div className={styles.externalGrid}>
                {extItems.map((x) => (
                    <div key={`${x.source}:${x.externalId}`} className={styles.externalRow}>
                      <div className={styles.cover}>
                        <Cover src={(x.imageUrl ?? undefined) as string | undefined} seed={`${x.source}-${x.externalId}`} />
                      </div>
                      <div className={styles.info}>
                        <div className={styles.name}>{x.title}</div>
                        <div className="small">
                          {x.year ?? "—"} • {TYPE_LABEL[x.type] ?? x.type} • {x.source}
                        </div>
                      </div>
                      <button className={styles.importBtn} onClick={() => doImport(x)}>
                        Импорт
                      </button>
                    </div>
                ))}
              </div>
            </div>
        )}

        <div className="hr" />

        {loading && <div className="small">загрузка...</div>}
        {!loading && items.length === 0 && <div className="small">ничего не найдено</div>}

        <div className={styles.grid}>
          {items.map((m) => (
              <Link key={m.id} className={styles.row} to={`/media/${m.id}`}>
                <div className={styles.cover}>
                  <Cover src={(m.imageURL ?? undefined) as string | undefined} seed={String(m.id)} />
                </div>
                <div className={styles.info}>
                  <div className={styles.name}>{m.title}</div>
                  <div className="small">{m.creator || "Автор/режиссёр/разработчик"}</div>
                  <div className={styles.desc}>{m.description}</div>
                </div>
              </Link>
          ))}
        </div>
      </div>
  );
}
