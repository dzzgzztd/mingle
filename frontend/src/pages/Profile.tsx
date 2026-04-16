import { useEffect, useMemo, useState } from "react";
import { getActivity, getProfile, upsertActivity } from "../api/profile";
import { getMediaById } from "../api/media";
import type { MediaItem } from "../types/media";
import Cover from "../components/Cover";
import { Link, useSearchParams } from "react-router-dom";
import styles from "./Profile.module.css";

type ActivityItem = { mediaID?: number; media_id: number; rating?: number | null; status?: string };

const ALLOWED = new Set([
    "viewed", "watching", "will_watch",
    "read", "reading", "will_read",
    "completed", "playing", "will_play",
]);

export default function Profile() {
    const [name, setName] = useState("UserNickname");
    const [activity, setActivity] = useState<ActivityItem[]>([]);
    const [items, setItems] = useState<Record<number, MediaItem>>({});
    const [loading, setLoading] = useState(true);

    const [sp] = useSearchParams();
    const filterType = sp.get("type"); // movie|series|book|game|null

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);

            try {
                const prof = await getProfile();
                if (!cancelled) setName(prof.data.name || "UserNickname");
            } catch {
                // ignore
            }

            try {
                const aRes = await getActivity();
                const act: ActivityItem[] = aRes.data ?? [];
                if (cancelled) return;

                const filtered = act.filter(a => a.status && ALLOWED.has(a.status));
                setActivity(filtered);

                const ids = Array.from(
                    new Set(filtered.map(a => (a.media_id ?? (a as any).mediaID)).filter(Boolean))
                ).slice(0, 80); // не грузим бесконечно

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
            .slice(0, 50);
    }, [activity, items, filterType]);

    const setRating = async (mediaId: number, stars: number, status?: string) => {
        const rating10 = stars * 2;

        setActivity((prev) =>
            prev.map((a) => {
                const id = a.media_id ?? (a as any).mediaID;
                if (id !== mediaId) return a;
                return { ...a, rating: rating10 };
            })
        );

        await upsertActivity({
            media_id: mediaId,
            rating: rating10,
            status: status || "viewed",
        });
    };

    return (
        <div>
            {loading && <div className="small">загрузка...</div>}

            {!loading && rows.map(({ a, m, id }) => {
                const currentStars = a.rating ? Math.round(Number(a.rating) / 2) : 0;

                return (
                    <div key={id} className={styles.row}>
                        <Link to={`/media/${id}`} className={styles.clickArea}>
                            <div className={styles.cover}>
                                <Cover src={m!.imageURL ?? undefined} seed={String(id)} />
                            </div>
                            <div className={styles.info}>
                                <div className={styles.title}>{m!.title}</div>
                                <div className={styles.author}>{m!.creator || "—"}</div>
                                <div className={styles.desc}>{m!.description}</div>
                            </div>
                        </Link>

                        <div className={styles.stars}>
                            <div className={styles.starPick}>
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        className={i + 1 <= currentStars ? styles.on : styles.off}
                                        onClick={() => setRating(id, i + 1, a.status)}
                                        aria-label={`rate ${i + 1}`}
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })}

            {!loading && rows.length === 0 && (
                <div className="small">пока нет активности: добавь статус/оценку любому произведению</div>
            )}
        </div>
    );
}
