import {useCallback, useEffect, useMemo, useState} from "react";
import {deleteActivity, getActivity, upsertActivity} from "../api/profile";
import RatingControl from "../components/RatingControl";
import {getMediaById} from "../api/media";
import type {MediaItem} from "../types/media";
import Cover from "../components/Cover";
import {Link, useNavigate, useSearchParams} from "react-router-dom";
import styles from "./Profile.module.css";

type ActivityItem = {
    id?: number;
    media_id: number;
    mediaID?: number;
    MediaID?: number;
    rating?: number | null;
    status?: string;
    updated_at?: string;
    UpdatedAt?: string;
    created_at?: string;
    CreatedAt?: string;
};

const ALLOWED = new Set([
    "viewed", "will_watch",
    "read", "will_read",
    "completed", "will_play",
]);

const STATUS_LABEL: Record<string, string> = {
    viewed: "Посмотрел(а)",
    will_watch: "Буду смотреть",
    read: "Прочитал(а)",
    will_read: "Буду читать",
    completed: "Прошел(а)",
    will_play: "Хочу пройти",
};

function getActivityMediaId(a: ActivityItem) {
    return a.media_id ?? a.mediaID ?? a.MediaID;
}

function getActivityTime(a: ActivityItem) {
    const raw = a.updated_at || a.UpdatedAt || a.created_at || a.CreatedAt || "";
    const time = new Date(raw).getTime();
    return Number.isNaN(time) ? 0 : time;
}

function statusOptionsForType(type?: string | null) {
    switch (type) {
        case "movie":
        case "series":
            return [
                {value: "", label: "Все статусы"},
                {value: "viewed", label: "Посмотрел(а)"},
                {value: "will_watch", label: "Буду смотреть"},
            ];
        case "book":
            return [
                {value: "", label: "Все статусы"},
                {value: "read", label: "Прочитал(а)"},
                {value: "will_read", label: "Буду читать"},
            ];
        case "game":
            return [
                {value: "", label: "Все статусы"},
                {value: "completed", label: "Прошел(а)"},
                {value: "will_play", label: "Хочу пройти"},
            ];
        default:
            return [
                {value: "", label: "Все статусы"},
                {value: "viewed", label: "Посмотрел(а)"},
                {value: "will_watch", label: "Буду смотреть"},
                {value: "read", label: "Прочитал(а)"},
                {value: "will_read", label: "Буду читать"},
                {value: "completed", label: "Прошел(а)"},
                {value: "will_play", label: "Хочу пройти"},
            ];
    }
}

function defaultStatusForType(type?: string | null) {
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

export default function Profile() {
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [items, setItems] = useState<Record<number, MediaItem>>({});
    const [loading, setLoading] = useState(true);

    const [sp] = useSearchParams();
    const navigate = useNavigate();

    const filterType = sp.get("type");
    const filterStatus = sp.get("status") ?? "";

    const [savingRatingId, setSavingRatingId] = useState<number | null>(null);

    const loadActivity = useCallback(async () => {
        setLoading(true);

        try {
            const aRes = await getActivity();
            const act: ActivityItem[] = aRes.data ?? [];

            const filtered = act.filter((a) => a.status && ALLOWED.has(a.status));
            setActivity(filtered);

            const ids = Array.from(
                new Set(
                    filtered
                        .map(getActivityMediaId)
                        .filter((id): id is number => typeof id === "number" && id > 0)
                )
            ).slice(0, 120);

            const pairs = await Promise.all(
                ids.map(async (id) => {
                    try {
                        const res = await getMediaById(String(id));
                        return [id, res.data] as const;
                    } catch {
                        return null;
                    }
                })
            );

            const map: Record<number, MediaItem> = {};
            for (const p of pairs) {
                if (!p) continue;
                const [id, m] = p;
                map[id] = m;
            }

            setItems(map);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadActivity();
    }, [loadActivity]);

    const rows = useMemo(() => {
        return activity
            .map((a) => {
                const id = getActivityMediaId(a);
                const m = id ? items[id] : undefined;
                return {a, m, id};
            })
            .filter((x) => x.id && x.m)
            .filter((x) => !filterType || x.m!.type === filterType)
            .filter((x) => !filterStatus || x.a.status === filterStatus)
            .sort((x, y) => {
                const byTime = getActivityTime(y.a) - getActivityTime(x.a);
                if (byTime !== 0) return byTime;
                return Number(y.id) - Number(x.id);
            });
    }, [activity, items, filterType, filterStatus]);

    const changeStatusFilter = (nextStatus: string) => {
        const params = new URLSearchParams(sp);

        if (nextStatus) params.set("status", nextStatus);
        else params.delete("status");

        const query = params.toString();
        navigate(query ? `/profile?${query}` : "/profile");
    };

    const removeItem = async (mediaId: number) => {
        await deleteActivity(mediaId);
        await loadActivity();
        window.dispatchEvent(new Event("profile-activity-updated"));
    };

    const saveProfileRating = async (
        mediaId: number,
        stars: number,
        currentStatus?: string
    ) => {
        const media = items[mediaId];
        const nextStatus = currentStatus || defaultStatusForType(media?.type);

        if (!nextStatus) return;

        setSavingRatingId(mediaId);

        try {
            await upsertActivity({
                media_id: mediaId,
                status: nextStatus,
                rating: stars * 2,
            });

            await loadActivity();
            window.dispatchEvent(new Event("profile-activity-updated"));
        } finally {
            setSavingRatingId(null);
        }
    };

    const clearProfileRating = async (
        mediaId: number,
        currentStatus?: string
    ) => {
        const media = items[mediaId];
        const nextStatus = currentStatus || defaultStatusForType(media?.type);

        if (!nextStatus) return;

        setSavingRatingId(mediaId);

        try {
            await upsertActivity({
                media_id: mediaId,
                status: nextStatus,
                rating: null,
            });

            await loadActivity();
            window.dispatchEvent(new Event("profile-activity-updated"));
        } finally {
            setSavingRatingId(null);
        }
    };

    return (
        <div>
            <div className={styles.topRow}>
                <div className={styles.toolbar}>
                    <div className={styles.filterLabel}>Статус:</div>

                    <select
                        className={styles.select}
                        value={filterStatus}
                        onChange={(e) => changeStatusFilter(e.target.value)}
                    >
                        {statusOptionsForType(filterType).map((opt) => (
                            <option key={opt.value || "all"} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && <div className="small">загрузка...</div>}

            {!loading &&
                rows.map(({a, m, id}) => {
                    const ratingValue = a.rating ?? 0;

                    return (
                        <div key={id} className={styles.row}>
                            <Link to={`/media/${id}`} className={styles.clickArea}>
                                <div className={styles.cover}>
                                    <Cover src={m!.imageURL ?? undefined} seed={String(id)}/>
                                </div>

                                <div className={styles.info}>
                                    <div className={styles.title}>{m!.title}</div>
                                    <div className={styles.author}>{m!.creator || "—"}</div>

                                    <div className={styles.statusBadge}>
                                        {STATUS_LABEL[a.status || ""] || a.status}
                                    </div>

                                    <div className={styles.desc}>{m!.description}</div>
                                </div>
                            </Link>

                            <div className={styles.side}>
                                <div className={styles.ratingBox}>
                                    <RatingControl
                                        value={Math.round(Number(a.rating || 0) / 2)}
                                        disabled={savingRatingId === Number(id)}
                                        onChange={(next) => saveProfileRating(Number(id), next, a.status)}
                                        onClear={() => clearProfileRating(Number(id), a.status)}
                                    />
                                </div>

                                <button
                                    className={styles.sideLink}
                                    type="button"
                                    onClick={() => removeItem(Number(id))}
                                >
                                    Убрать из списка
                                </button>
                            </div>
                        </div>
                    );
                })}

            {!loading && rows.length === 0 && (
                <div className="small">
                    пока нет активности: добавь статус или оценку любому произведению
                </div>
            )}
        </div>
    );
}