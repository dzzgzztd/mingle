import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getMediaById, getRecommendationsForMedia } from "../api/media";
import { deleteActivity, getActivity, upsertActivity } from "../api/profile";
import { addToCollection, listCollections } from "../api/collections";
import Cover from "../components/Cover";
import RecommendationCard from "../components/RecommendationCard";
import type { MediaItem } from "../types/media";
import type { RecommendationItem } from "../types/recommendation";
import styles from "./MediaDetail.module.css";

type ActivityItem = {
    mediaID?: number;
    media_id: number;
    rating?: number | null;
    status?: string;
};

type Collection = { id: number; title: string };

const REMOVE_STATUS = "__remove__";

function statusOptionsForType(type?: string, hasActivity?: boolean) {
    const base =
        type === "movie" || type === "series"
            ? [
                { value: "viewed", label: "Посмотрел(а)" },
                { value: "will_watch", label: "Буду смотреть" },
            ]
            : type === "book"
                ? [
                    { value: "read", label: "Прочитал(а)" },
                    { value: "will_read", label: "Буду читать" },
                ]
                : type === "game"
                    ? [
                        { value: "completed", label: "Прошел(а)" },
                        { value: "will_play", label: "Хочу пройти" },
                    ]
                    : [];

    if (hasActivity) {
        return [...base, { value: REMOVE_STATUS, label: "Убрать из моего списка" }];
    }

    return base;
}

function defaultStatusForType(type?: string) {
    switch (type) {
        case "movie":
        case "series":
            return "viewed";
        case "book":
            return "read";
        case "game":
            return "completed";
        default:
            return "";
    }
}

export default function MediaDetail() {
    const { id } = useParams();

    const [item, setItem] = useState<MediaItem | null>(null);
    const [rating, setRating] = useState(0);
    const [status, setStatus] = useState("");
    const [hasActivity, setHasActivity] = useState(false);

    const [mingleRecs, setMingleRecs] = useState<RecommendationItem[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionMsg, setActionMsg] = useState<string | null>(null);

    const statusOptions = useMemo(
        () => statusOptionsForType(item?.type, hasActivity),
        [item?.type, hasActivity]
    );

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!id) {
                setError("Некорректный id");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            setActionMsg(null);

            try {
                const [mediaRes, activityRes, recRes, collectionsRes] = await Promise.all([
                    getMediaById(id),
                    getActivity(),
                    getRecommendationsForMedia(id).catch(() => ({ data: { recommendations: [] } })),
                    listCollections().catch(() => ({ data: [] })),
                ]);

                if (cancelled) return;

                const media = mediaRes.data;
                setItem(media);
                setCollections(collectionsRes.data ?? []);

                const mediaId = Number(id);
                const row = (activityRes.data ?? []).find((a: ActivityItem) => (a.media_id ?? a.mediaID) === mediaId);

                setHasActivity(Boolean(row));
                setRating(row?.rating ? Math.round(Number(row.rating) / 2) : 0);
                setStatus(row?.status || defaultStatusForType(media.type));
                setMingleRecs(recRes.data.recommendations ?? []);
            } catch (e: any) {
                const msg =
                    e?.response?.data?.error ||
                    e?.message ||
                    "Не удалось загрузить контент";

                if (!cancelled) {
                    setError(String(msg));
                    setItem(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [id]);

    const saveStatus = async (nextStatus: string) => {
        if (!id || !item) return;

        if (nextStatus === REMOVE_STATUS) {
            setBusy(true);
            setActionMsg(null);
            try {
                await deleteActivity(Number(id));
                setHasActivity(false);
                setRating(0);
                setStatus(defaultStatusForType(item.type));
                setActionMsg("Контент убран из моего списка");
            } catch (e: any) {
                setActionMsg(e?.response?.data?.error || "Не удалось удалить запись");
            } finally {
                setBusy(false);
            }
            return;
        }

        setBusy(true);
        setActionMsg(null);
        try {
            await upsertActivity({
                media_id: Number(id),
                status: nextStatus,
                rating: rating > 0 ? rating * 2 : null,
            });
            setStatus(nextStatus);
            setHasActivity(true);
            setActionMsg("Статус сохранен");
        } catch (e: any) {
            setActionMsg(e?.response?.data?.error || "Не удалось сохранить статус");
        } finally {
            setBusy(false);
        }
    };

    const saveRating = async (val: number) => {
        if (!id || !item) return;

        const nextStatus = status || defaultStatusForType(item.type);

        setBusy(true);
        setActionMsg(null);
        try {
            await upsertActivity({
                media_id: Number(id),
                rating: val * 2,
                status: nextStatus,
            });
            setRating(val);
            setStatus(nextStatus);
            setHasActivity(true);
            setActionMsg("Оценка сохранена");
        } catch (e: any) {
            setActionMsg(e?.response?.data?.error || "Не удалось сохранить оценку");
        } finally {
            setBusy(false);
        }
    };

    const clearRating = async () => {
        if (!id || !item) return;

        const nextStatus = status || defaultStatusForType(item.type);

        setBusy(true);
        setActionMsg(null);
        try {
            await upsertActivity({
                media_id: Number(id),
                rating: null,
                status: nextStatus,
            });
            setRating(0);
            setHasActivity(true);
            setActionMsg("Оценка удалена");
        } catch (e: any) {
            setActionMsg(e?.response?.data?.error || "Не удалось убрать оценку");
        } finally {
            setBusy(false);
        }
    };

    const addCurrentToCollection = async () => {
        if (!id || !selectedCollectionId) return;

        setBusy(true);
        setActionMsg(null);

        try {
            const collectionId = Number(selectedCollectionId);
            if (!collectionId || Number.isNaN(collectionId)) {
                setActionMsg("Выбери подборку");
                return;
            }

            await addToCollection(collectionId, Number(id));
            setActionMsg("Добавлено в подборку");
        } catch (e: any) {
            const msg =
                e?.response?.data?.error ||
                e?.message ||
                "Не удалось добавить в подборку";
            setActionMsg(String(msg));
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <div className="small">загрузка...</div>;
    if (error) return <div className="small">ошибка: {error}</div>;
    if (!item) return <div className="small">не найдено</div>;

    return (
        <div>
            <div className={styles.top}>
                <div className={styles.cover}>
                    <Cover src={item.imageURL ?? undefined} seed={String(item.id)} />
                </div>

                <div className={styles.info}>
                    <div className={styles.titleRow}>
                        <div>
                            <div className={styles.title}>{item.title}</div>
                            <div className={styles.meta}>
                                {item.year ?? "—"}
                                <div className={styles.dot} />
                                {item.creator || "Автор/режиссёр/разработчик"}
                            </div>
                        </div>

                        <div className={styles.starBlock}>
                            <div className={styles.starPick}>
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        className={i + 1 <= rating ? styles.on : styles.off}
                                        onClick={() => saveRating(i + 1)}
                                        aria-label={`rate ${i + 1}`}
                                        disabled={busy}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>
                            <button className={styles.clearLink} onClick={clearRating} disabled={busy}>
                                Убрать оценку
                            </button>
                        </div>
                    </div>

                    <div className={styles.controls}>
                        <div className={styles.controlBlock}>
                            <div className={styles.controlLabel}>Статус</div>
                            <select
                                className={styles.select}
                                value={status}
                                onChange={(e) => saveStatus(e.target.value)}
                                disabled={busy}
                            >
                                {statusOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.controlBlock}>
                            <div className={styles.controlLabel}>Подборка</div>
                            <div className={styles.collectionRow}>
                                <select
                                    className={styles.select}
                                    value={selectedCollectionId}
                                    onChange={(e) => setSelectedCollectionId(e.target.value)}
                                    disabled={busy}
                                >
                                    <option value="">Выбери подборку</option>
                                    {collections.map((c) => (
                                        <option key={c.id} value={String(c.id)}>
                                            {c.title}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    className="btn"
                                    onClick={addCurrentToCollection}
                                    disabled={busy || !selectedCollectionId}
                                >
                                    Добавить в подборку
                                </button>
                            </div>
                        </div>
                    </div>

                    {actionMsg && <div className={styles.actionMsg}>{actionMsg}</div>}

                    <div className={styles.desc}>{item.description}</div>
                </div>
            </div>

            <div className="hr" />

            <div className={styles.sectionTitle}>Рекомендации Mingle</div>
            <div className={styles.strip}>
                {mingleRecs.map((r) => (
                    <RecommendationCard key={r.id} item={r} />
                ))}
            </div>
        </div>
    );
}