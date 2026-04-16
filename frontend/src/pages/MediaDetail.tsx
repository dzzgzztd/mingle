import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getMediaById, getRecommendationsForMedia } from "../api/media";
import { getActivity, upsertActivity } from "../api/profile";
import Cover from "../components/Cover";
import RecommendationCard from "../components/RecommendationCard";
import type { MediaItem } from "../types/media";
import type { RecommendationItem } from "../types/recommendation";
import styles from "./MediaDetail.module.css";

export default function MediaDetail() {
    const { id } = useParams();

    const [item, setItem] = useState<MediaItem | null>(null);
    const [rating, setRating] = useState(0);
    const [mingleRecs, setMingleRecs] = useState<RecommendationItem[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

            try {
                const res = await getMediaById(id);
                if (cancelled) return;
                setItem(res.data);

                try {
                    const act = await getActivity();
                    if (!cancelled) {
                        const mediaId = Number(id);
                        const row = (act.data ?? []).find((a: any) => (a.media_id ?? a.mediaID) === mediaId);
                        const stars = row?.rating ? Math.round(Number(row.rating) / 2) : 0;
                        setRating(stars);
                    }
                } catch {
                    // ignore
                }

                try {
                    const rec = await getRecommendationsForMedia(id);
                    if (!cancelled) {
                        setMingleRecs(rec.data.recommendations ?? []);
                    }
                } catch {
                    // ignore
                }
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

    const saveRating = async (val: number) => {
        setRating(val);
        if (!id) return;
        await upsertActivity({ media_id: Number(id), rating: val * 2, status: "viewed" });
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
                                    >
                                        ★
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

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
