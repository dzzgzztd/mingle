import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMediaById, getRecommendationsForMedia } from "../api/media";
import { deleteActivity, getActivity, getProfile, upsertActivity } from "../api/profile";
import { addToCollection, listCollections } from "../api/collections";
import { adminDeleteMedia, adminUpdateMedia } from "../api/admin";
import Cover from "../components/Cover";
import RecommendationCard from "../components/RecommendationCard";
import type { MediaDraft, MediaItem } from "../types/media";
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
const TYPES = ["movie", "series", "book", "game"];

const TYPE_LABEL: Record<string, string> = {
    movie: "Фильм",
    series: "Сериал",
    book: "Книга",
    game: "Игра",
};

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

function toDraft(item: MediaItem): MediaDraft {
    return {
        title: item.title || "",
        type: item.type || "movie",
        year: item.year ?? null,
        creator: item.creator || "",
        imageURL: item.imageURL || "",
        description: item.description || "",
    };
}

export default function MediaDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [item, setItem] = useState<MediaItem | null>(null);
    const [rating, setRating] = useState(0);
    const [status, setStatus] = useState("");
    const [hasActivity, setHasActivity] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    const [mingleRecs, setMingleRecs] = useState<RecommendationItem[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionMsg, setActionMsg] = useState<string | null>(null);

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<MediaDraft | null>(null);

    const statusOptions = useMemo(
        () => statusOptionsForType(item?.type, hasActivity),
        [item?.type, hasActivity]
    );

    const load = async () => {
        if (!id) {
            setError("Некорректный id");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        setActionMsg(null);
        setMingleRecs([]);
        setCollections([]);
        setHasActivity(false);
        setRating(0);
        setIsAdmin(false);

        try {
            const mediaRes = await getMediaById(id);
            const media = mediaRes.data;
            const mediaId = Number(id);

            setItem(media);
            setStatus(defaultStatusForType(media.type));
            setDraft(toDraft(media));

            const [profileResult, activityResult, recResult, collectionsResult] =
                await Promise.allSettled([
                    getProfile(),
                    getActivity(),
                    getRecommendationsForMedia(id),
                    listCollections(),
                ]);

            if (profileResult.status === "fulfilled") {
                setIsAdmin(profileResult.value.data.role === "admin");
            }

            if (activityResult.status === "fulfilled") {
                const row = (activityResult.value.data ?? []).find(
                    (a: ActivityItem) => (a.media_id ?? a.mediaID) === mediaId
                );

                setHasActivity(Boolean(row));
                setRating(row?.rating ? Math.round(Number(row.rating) / 2) : 0);
                setStatus(row?.status || defaultStatusForType(media.type));
            }

            if (recResult.status === "fulfilled") {
                setMingleRecs(recResult.value.data.recommendations ?? []);
            }

            if (collectionsResult.status === "fulfilled") {
                setCollections(collectionsResult.value.data ?? []);
            }
        } catch (e: any) {
            const msg =
                e?.response?.data?.error ||
                e?.message ||
                "Не удалось загрузить контент";

            setError(String(msg));
            setItem(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!cancelled) await load();
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

    const patchDraft = (patch: Partial<MediaDraft>) => {
        setDraft((prev) => ({ ...((prev || {}) as MediaDraft), ...patch } as MediaDraft));
    };

    const startEdit = () => {
        if (!item) return;
        setDraft(toDraft(item));
        setEditing(true);
        setActionMsg(null);
    };

    const cancelEdit = () => {
        if (item) setDraft(toDraft(item));
        setEditing(false);
        setActionMsg(null);
    };

    const saveAdminEdit = async () => {
        if (!id || !draft) return;

        const cleanTitle = draft.title.trim();
        if (!cleanTitle) {
            setActionMsg("Название не может быть пустым");
            return;
        }

        setBusy(true);
        setActionMsg(null);

        try {
            const res = await adminUpdateMedia(id, {
                ...draft,
                title: cleanTitle,
                creator: draft.creator?.trim() || "",
                imageURL: draft.imageURL?.trim() || "",
                description: draft.description?.trim() || "",
                year: draft.year ?? null,
            });
            setItem(res.data);
            setDraft(toDraft(res.data));
            setEditing(false);
            setActionMsg("Контент обновлен");
        } catch (e: any) {
            setActionMsg(e?.response?.data?.error || "Не удалось обновить контент");
        } finally {
            setBusy(false);
        }
    };

    const removeMedia = async () => {
        if (!id || !window.confirm("Удалить эту единицу контента из каталога?")) return;

        setBusy(true);
        setActionMsg(null);

        try {
            await adminDeleteMedia(id);
            navigate("/media", { replace: true });
        } catch (e: any) {
            setActionMsg(e?.response?.data?.error || "Не удалось удалить контент");
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
                                <div className={styles.dot} />
                                {TYPE_LABEL[item.type] ?? item.type}
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

                            <button
                                className={styles.clearLink}
                                type="button"
                                onClick={clearRating}
                                disabled={busy}
                            >
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
                                    disabled={busy || collections.length === 0}
                                >
                                    <option value="">
                                        {collections.length === 0
                                            ? "Нет подборок"
                                            : "Выбери подборку"}
                                    </option>

                                    {collections.map((c) => (
                                        <option key={c.id} value={String(c.id)}>
                                            {c.title}
                                        </option>
                                    ))}
                                </select>

                                <button
                                    className="btn"
                                    type="button"
                                    onClick={addCurrentToCollection}
                                    disabled={busy || !selectedCollectionId}
                                >
                                    Добавить в подборку
                                </button>
                            </div>
                        </div>
                    </div>

                    {actionMsg && <div className={styles.actionMsg}>{actionMsg}</div>}

                    <div className={styles.desc}>{item.description || "Описание пока не добавлено"}</div>

                    {isAdmin && (
                        <div className={styles.adminPanel}>
                            <div className={styles.adminTitle}>Управление контентом</div>

                            {!editing ? (
                                <div className={styles.adminActions}>
                                    <button className="btn" type="button" onClick={startEdit} disabled={busy}>
                                        Редактировать контент
                                    </button>
                                    <button className={styles.dangerBtn} type="button" onClick={removeMedia} disabled={busy}>
                                        Удалить контент
                                    </button>
                                </div>
                            ) : (
                                <div className={styles.adminForm}>
                                    <div className={styles.formGrid}>
                                        <input
                                            className={styles.input}
                                            value={draft?.title || ""}
                                            onChange={(e) => patchDraft({ title: e.target.value })}
                                            placeholder="Название"
                                        />
                                        <input
                                            className={styles.input}
                                            value={draft?.year ?? ""}
                                            onChange={(e) => patchDraft({ year: e.target.value ? Number(e.target.value) : null })}
                                            placeholder="Год"
                                            type="number"
                                        />
                                        <select
                                            className={styles.select}
                                            value={draft?.type || "movie"}
                                            onChange={(e) => patchDraft({ type: e.target.value })}
                                        >
                                            {TYPES.map((t) => (
                                                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <input
                                        className={styles.input}
                                        value={draft?.creator || ""}
                                        onChange={(e) => patchDraft({ creator: e.target.value })}
                                        placeholder="Автор / режиссёр / разработчик"
                                    />

                                    <input
                                        className={styles.input}
                                        value={draft?.imageURL || ""}
                                        onChange={(e) => patchDraft({ imageURL: e.target.value })}
                                        placeholder="Ссылка на обложку"
                                    />

                                    <textarea
                                        className={styles.textarea}
                                        value={draft?.description || ""}
                                        onChange={(e) => patchDraft({ description: e.target.value })}
                                        placeholder="Описание"
                                    />

                                    <div className={styles.adminActions}>
                                        <button className="btn" type="button" onClick={saveAdminEdit} disabled={busy}>
                                            Сохранить
                                        </button>
                                        <button className="btn" type="button" onClick={cancelEdit} disabled={busy}>
                                            Отмена
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="hr" />

            <div className={styles.sectionTitle}>Рекомендации Mingle</div>

            <div className={styles.strip}>
                {mingleRecs.map((r) => (
                    <RecommendationCard key={r.id} item={r} />
                ))}
            </div>

            {mingleRecs.length === 0 && (
                <div className="small">пока нет рекомендаций для этого контента</div>
            )}
        </div>
    );
}
