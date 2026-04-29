import { useEffect, useMemo, useState } from "react";
import { deleteActivity, getActivity } from "../api/profile";
import { getMediaById } from "../api/media";
import type { MediaItem } from "../types/media";
import Cover from "../components/Cover";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import styles from "./Profile.module.css";

type ActivityItem = {
    mediaID?: number;
    media_id: number;
    rating?: number | null;
    status?: string;
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

function statusOptionsForType(type?: string | null) {
    switch (type) {
        case "movie":
        case "series":
            return [
                { value: "", label: "Все статусы" },
                { value: "viewed", label: "Посмотрел(а)" },
                { value: "will_watch", label: "Буду смотреть" },
            ];
        case "book":
            return [
                { value: "", label: "Все статусы" },
                { value: "read", label: "Прочитал(а)" },
                { value: "will_read", label: "Буду читать" },
            ];
        case "game":
            return [
                { value: "", label: "Все статусы" },
                { value: "completed", label: "Прошел(а)" },
                { value: "will_play", label: "Хочу пройти" },
            ];
        default:
            return [
                { value: "", label: "Все статусы" },
                { value: "viewed", label: "Посмотрел(а)" },
                { value: "will_watch", label: "Буду смотреть" },
                { value: "read", label: "Прочитал(а)" },
                { value: "will_read", label: "Буду читать" },
                { value: "completed", label: "Прошел(а)" },
                { value: "will_play", label: "Хочу пройти" },
            ];
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

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);

            try {
                const aRes = await getActivity();
                const act: ActivityItem[] = aRes.data ?? [];
                if (cancelled) return;

                const filtered = act.filter((a) => a.status && ALLOWED.has(a.status));
                setActivity(filtered);

                const ids = Array.from(
                    new Set(filtered.map((a) => a.media_id ?? (a as any).mediaID).filter(Boolean))
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

                if (cancelled) return;

                const map: Record<number, MediaItem> = {};
                for (const p of pairs) {
                    if (!p) continue;
                    const [id, m] = p;
                    map[id] = m;
                }
                setItems(map);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const rows = useMemo(() => {
        return activity
            .map((a) => {
                const id = a.media_id ?? (a as any).mediaID;
                const m = items[id];
                return { a, m, id };
            })
            .filter((x) => x.m)
            .filter((x) => !filterType || x.m!.type === filterType)
            .filter((x) => !filterStatus || x.a.status === filterStatus)
            .sort((x, y) => {
                const aStatus = x.a.status || "";
                const bStatus = y.a.status || "";
                if (aStatus !== bStatus) return aStatus.localeCompare(bStatus);
                return x.m!.title.localeCompare(y.m!.title);
            });
    }, [activity, items, filterType, filterStatus]);

    const changeStatusFilter = (nextStatus: string) => {
        const params = new URLSearchParams(sp);
        if (nextStatus) params.set("status", nextStatus);
        else params.delete("status");
        navigate(`/profile?${params.toString()}`);
    };

    const removeItem = async (mediaId: number) => {
        await deleteActivity(mediaId);
        setActivity((prev) => prev.filter((a) => (a.media_id ?? (a as any).mediaID) !== mediaId));
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
                rows.map(({ a, m, id }) => (
                    <div key={id} className={styles.row}>
                        <Link to={`/media/${id}`} className={styles.clickArea}>
                            <div className={styles.cover}>
                                <Cover src={m!.imageURL ?? undefined} seed={String(id)} />
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
                            <button className={styles.sideLink} onClick={() => removeItem(id)}>
                                Убрать из списка
                            </button>
                        </div>
                    </div>
                ))}

            {!loading && rows.length === 0 && (
                <div className="small">пока нет активности: добавь статус или оценку любому произведению</div>
            )}
        </div>
    );
}
