import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  addToCollection,
  getCollection,
  getCollectionRecommendations,
  updateCollection,
} from "../api/collections";
import { getMedia } from "../api/media";
import type { MediaItem } from "../types/media";
import RecommendationCard from "../components/RecommendationCard";
import MediaCard from "../components/MediaCard";
import type { RecommendationItem } from "../types/recommendation";
import styles from "./CollectionDetail.module.css";

export default function CollectionDetail() {
  const { id } = useParams();
  const colId = Number(id);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [catalog, setCatalog] = useState<MediaItem[]>([]);
  const [recs, setRecs] = useState<RecommendationItem[]>([]);

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<MediaItem | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const res = await getCollection(colId);
    const col = res.data.collection;

    setEditTitle(col.title || "");
    setEditDesc(col.description || "");
    setItems(res.data.items || []);

    const cat = await getMedia();
    setCatalog(cat.data || []);
  };

  useEffect(() => {
    if (!Number.isNaN(colId) && colId > 0) load();
  }, [colId]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.slice(0, 30);
    return catalog
        .filter((m) => (m.title || "").toLowerCase().includes(q))
        .slice(0, 30);
  }, [catalog, query]);

  const add = async () => {
    if (!picked) return;
    await addToCollection(colId, picked.id);
    setPicked(null);
    setQuery("");
    setOpen(false);
    await load();
  };

  const loadRecs = async () => {
    const res = await getCollectionRecommendations(colId);
    setRecs(res.data.recommendations || []);
  };

  const save = async () => {
    const t = editTitle.trim();
    if (!t) return;

    setSaving(true);
    try {
      await updateCollection(colId, { title: t, description: editDesc });
      await load();
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = async () => {
    await load();
    setIsEditing(false);
  };

  return (
      <div>
        {!isEditing ? (
            <>
              <div className={styles.headerRow}>
                <div>
                  <div className={styles.h2}>{editTitle || "Без названия"}</div>
                  <div className={styles.descView}>
                    {editDesc?.trim() || "Пока нет описания подборки"}
                  </div>
                </div>

                <div className={styles.topActions}>
                  <button className="btn" onClick={() => setIsEditing(true)}>
                    Редактировать
                  </button>
                  <button className="btn" onClick={loadRecs}>
                    Рекомендации 💡
                  </button>
                </div>
              </div>
            </>
        ) : (
            <>
              <div className={styles.headerRow}>
                <div className={styles.headerMain}>
                  <input
                      className={styles.titleInput}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Название подборки..."
                  />

                  <textarea
                      className={styles.descInput}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Добавьте описание..."
                  />
                </div>

                <div className={styles.topActions}>
                  <button className="btn" onClick={save} disabled={saving || !editTitle.trim()}>
                    {saving ? "Сохранение..." : "Сохранить"}
                  </button>
                  <button className="btn" onClick={cancelEditing}>
                    Отмена
                  </button>
                </div>
              </div>
            </>
        )}

        <div className={styles.row}>
          <div className={styles.addBox} ref={boxRef}>
            <div className={styles.searchWrap}>
              <input
                  className={styles.searchInput}
                  value={query}
                  placeholder="Поиск контента для добавления..."
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
              />

              {picked && (
                  <div className={styles.picked}>
                    {picked.imageURL ? (
                        <img className={styles.pickedImg} src={picked.imageURL} alt="" />
                    ) : (
                        <div className={styles.pickedPh} />
                    )}
                    <div className={styles.pickedTitle}>{picked.title}</div>
                    <button
                        className={styles.clearBtn}
                        type="button"
                        onClick={() => setPicked(null)}
                        aria-label="clear"
                    >
                      ×
                    </button>
                  </div>
              )}
            </div>

            {open && (
                <div className={styles.dropdown}>
                  {filtered.length === 0 && <div className={styles.empty}>ничего не найдено</div>}

                  {filtered.map((m) => (
                      <button
                          type="button"
                          key={m.id}
                          className={styles.opt}
                          onClick={() => {
                            setPicked(m);
                            setQuery(m.title);
                            setOpen(false);
                          }}
                      >
                        {m.imageURL ? (
                            <img className={styles.optImg} src={m.imageURL} alt="" loading="lazy" />
                        ) : (
                            <div className={styles.optPh} />
                        )}
                        <div className={styles.optText}>
                          <div className={styles.optTitle}>{m.title}</div>
                        </div>
                      </button>
                  ))}
                </div>
            )}
          </div>

          <div className={styles.actions}>
            <button className="btn" onClick={add} disabled={!picked}>
              Добавить в подборку ＋
            </button>
            <button className="btn" onClick={loadRecs}>
              Получить рекомендации 💡
            </button>
          </div>
        </div>

        <div className={styles.sectionTitle}>Контент в подборке</div>
        <div className={styles.grid}>
          {items.map((m) => (
              <MediaCard key={m.id} item={m} />
          ))}
        </div>

        {recs.length > 0 && (
            <>
              <div className={styles.h3}>Рекомендации Mingle</div>
              <div className={styles.recs}>
                {recs.map((r) => (
                    <RecommendationCard key={r.id} item={r} />
                ))}
              </div>
            </>
        )}
      </div>
  );
}