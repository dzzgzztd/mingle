import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { MediaItem } from "../types/media";
import type { ExternalSearchItem } from "../types/external";
import Cover from "../components/Cover";
import { searchMedia } from "../api/media";
import { externalSearch, externalImport } from "../api/external";
import styles from "./Search.module.css";

export default function Search() {
    const [sp] = useSearchParams();
    const navigate = useNavigate();

    const q = (sp.get("q") ?? "").trim();
    const type = (sp.get("type") ?? "").trim();

    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(false);

    const [onlineAll, setOnlineAll] = useState<ExternalSearchItem[]>([]);
    const [onlineLoading, setOnlineLoading] = useState(false);
    const [onlineError, setOnlineError] = useState<string | null>(null);
    const [loadedQuery, setLoadedQuery] = useState("");

    const title = useMemo(() => (q ? `Результаты: “${q}”` : "Поиск"), [q]);

    const loadLocal = async () => {
        if (!q) {
            setItems([]);
            return;
        }
        const res = await searchMedia({ q, type: type || undefined });
        setItems(res.data);
    };

    const loadOnlineMixed = async (query: string) => {
        if (!query) return;
        setOnlineLoading(true);
        setOnlineError(null);

        try {
            const res = await externalSearch({ q: query });
            setOnlineAll(res.data.items ?? []);
            setLoadedQuery(query);
        } catch (e: any) {
            const msg = e?.response?.data?.error || e?.message || "Ошибка внешнего поиска";
            setOnlineError(String(msg));
            setOnlineAll([]);
            setLoadedQuery(query);
        } finally {
            setOnlineLoading(false);
        }
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                await loadLocal();
            } finally {
                setLoading(false);
            }
        })();

        if (!q) {
            setOnlineAll([]);
            setOnlineError(null);
            setLoadedQuery("");
            return;
        }

        if (loadedQuery !== q) {
            loadOnlineMixed(q);
        }
    }, [q, type]);

    const online = useMemo(() => {
        if (!type) return onlineAll;
        return onlineAll.filter((x) => x.type === type);
    }, [onlineAll, type]);

    const doImport = async (x: ExternalSearchItem) => {
        try {
            const res = await externalImport({ source: x.source, externalId: x.externalId });
            const mediaId = res.data?.mediaId;

            await loadLocal();

            if (mediaId) {
                navigate(`/media/${mediaId}`);
            }
        } catch (e: any) {
            const msg = e?.response?.data?.error || e?.message || "Не удалось импортировать";
            alert(String(msg));
        }
    };

    return (
        <div>
            <div className={styles.h2}>{title}</div>

            {!q && <div className="small">введите запрос в строке поиска сверху</div>}
            {loading && <div className="small">ищу...</div>}

            {!loading && q && items.length === 0 && (
                <div className="small">
                    ничего не найдено локально {onlineLoading && "ищу в интернете..."}
                </div>
            )}

            {items.length > 0 && (
                <>
                    <div className="small" style={{ margin: "10px 0" }}>
                        локальные результаты: {items.length}
                    </div>

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
                </>
            )}

            {(onlineLoading || onlineError || online.length > 0) && (
                <>
                    <div className="hr" />
                    <div className="small" style={{ margin: "10px 0" }}>
                        результаты в интернете: {online.length}
                    </div>
                    {onlineError && <div className="small">{onlineError}</div>}

                    <div className={styles.grid}>
                        {online.map((x) => (
                            <div key={`${x.source}:${x.externalId}`} className={styles.row} style={{ alignItems: "center" }}>
                                <div className={styles.cover}>
                                    <Cover
                                        src={(x.imageUrl ?? undefined) as string | undefined}
                                        seed={`${x.source}-${x.externalId}`}
                                    />
                                </div>
                                <div className={styles.info}>
                                    <div className={styles.name}>{x.title}</div>
                                    <div className="small">
                                        {x.year ?? "—"} • {x.type} • {x.source}
                                    </div>
                                    {x.creator && <div className="small">{x.creator}</div>}
                                </div>
                                <button className="btn" onClick={() => doImport(x)} style={{ marginLeft: "auto" }}>
                                    Импорт
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}