import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    createCollection,
    getCollection,
    getCollectionRecommendations,
    listCollections,
} from "../api/collections";
import styles from "./Collections.module.css";
import RecommendationCard from "../components/RecommendationCard";
import type { RecommendationItem } from "../types/recommendation";

type Collection = { id: number; title: string; description?: string };

type PreviewMap = Record<number, { images: (string | null)[]; loading: boolean }>;

function CoverTile({ src }: { src: string | null }) {
    return src ? (
        <img className={styles.coverImg} src={src} alt="" loading="lazy" />
    ) : (
        <div className={styles.coverPh} />
    );
}

export default function Collections() {
    const navigate = useNavigate();

    const [items, setItems] = useState<Collection[]>([]);
    const [title, setTitle] = useState("");
    const [recsById, setRecsById] = useState<Record<number, RecommendationItem[]>>({});
    const [preview, setPreview] = useState<PreviewMap>({});

    const load = async () => {
        const res = await listCollections();
        const cols: Collection[] = res.data || [];
        setItems(cols);

        const init: PreviewMap = {};
        for (const c of cols) init[c.id] = { images: [null, null, null], loading: true };
        setPreview(init);

        await Promise.all(
            cols.map(async (c) => {
                try {
                    const det = await getCollection(c.id);
                    const media = (det.data?.items || []) as Array<{ imageURL?: string | null }>;
                    const imgs = [
                        media[0]?.imageURL || null,
                        media[1]?.imageURL || null,
                        media[2]?.imageURL || null,
                    ];
                    setPreview((p) => ({ ...p, [c.id]: { images: imgs, loading: false } }));
                } catch {
                    setPreview((p) => ({ ...p, [c.id]: { images: [null, null, null], loading: false } }));
                }
            })
        );
    };

    useEffect(() => {
        load();
    }, []);

    const add = async () => {
        if (!title.trim()) return;
        await createCollection({ title: title.trim() });
        setTitle("");
        await load();
    };

    const loadRecs = async (id: number) => {
        const res = await getCollectionRecommendations(id);
        setRecsById((prev) => ({ ...prev, [id]: res.data.recommendations || [] }));
    };

    const empty = useMemo(() => items.length === 0, [items.length]);

    return (
        <div>
            <div className={styles.h2}>Мои подборки</div>

            <div className={styles.addRow}>
                <input
                    className="input"
                    placeholder="название новой подборки..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
                <button className="btn" onClick={add}>＋ Добавить</button>
            </div>

            <div className={styles.list}>
                {items.map((c) => {
                    const pr = preview[c.id];
                    const imgs = pr?.images || [null, null, null];

                    return (
                        <div key={c.id} className={styles.cardRow}>
                            <button
                                type="button"
                                className={styles.mainArea}
                                onClick={() => navigate(`/collections/${c.id}`)}
                            >
                                <div className={styles.covers}>
                                    <div className={styles.stack} aria-label="covers">
                                        <div className={styles.tile}><CoverTile src={imgs[0]} /></div>
                                        <div className={styles.tile}><CoverTile src={imgs[1]} /></div>
                                        <div className={styles.tile}><CoverTile src={imgs[2]} /></div>
                                    </div>
                                </div>

                                <div className={styles.info}>
                                    <div className={styles.title}>{c.title}</div>
                                    <div className={styles.desc}>
                                        {c.description?.trim() || "Пока нет описания подборки"}
                                    </div>
                                </div>
                            </button>

                            <div className={styles.side}>
                                <div className={styles.actions}>
                                    <button className="btn" onClick={() => navigate(`/collections/${c.id}`)}>
                                        Открыть
                                    </button>
                                    <button className="btn" onClick={() => loadRecs(c.id)}>
                                        Рекомендации 💡
                                    </button>
                                </div>

                                {recsById[c.id] && (
                                    <div className={styles.recs}>
                                        {recsById[c.id].map((r) => (
                                            <RecommendationCard key={r.id} item={r} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {empty && <div className="small">пока нет подборок</div>}
        </div>
    );
}