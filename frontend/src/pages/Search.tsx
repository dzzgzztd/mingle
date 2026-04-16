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

    const [online, setOnline] = useState<ExternalSearchItem[]>([]);
    const [onlineLoading, setOnlineLoading] = useState(false);
    const [onlineError, setOnlineError] = useState<string | null>(null);

    const title = useMemo(() => (q ? `Результаты: “${q}”` : "Поиск"), [q]);

    const loadLocal = async () => {
        if (!q) {
            setItems([]);
            return;
        }
        const res = await searchMedia({ q, type: type || undefined });
        setItems(res.data);
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

        setOnline([]);
        setOnlineError(null);
    }, [q, type]);

    const doOnlineSearch = async () => {
        if (!q) return;

        setOnlineLoading(true);
        setOnlineError(null);

        try {
            const res = await externalSearch({
                q,
                type: type || undefined,
            });
            setOnline(res.data.items ?? []);
        } catch (e: any) {
            const msg = e?.response?.data?.error || e?.message || "Ошибка внешнего поиска";
            setOnlineError(String(msg));
            setOnline([]);
        } finally {
            setOnlineLoading(false);
        }
    };

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
                    ничего не найдено локально{" "}
                    <button
                        onClick={doOnlineSearch}
                        disabled={onlineLoading}
                        style={{ marginLeft: 8 }}
                    >
                        {onlineLoading ? "ищу в интернете..." : "искать в интернете"}
                    </button>
                </div>
            )}

            {items.length > 0 && (
                <>
                    <div className="small" style={{ margin: "10px 0" }}>
                        локальные результаты: {items.length}
                        <button
                            onClick={doOnlineSearch}
                            disabled={!q || onlineLoading}
                            style={{ marginLeft: 10 }}
                        >
                            {onlineLoading ? "ищу в интернете..." : "искать в интернете"}
                        </button>
                    </div>

                    <div className={styles.grid}>
                        {items.map((m) => (
                            <Link key={m.id} className={styles.row} to={`/media/${m.id}`}>
                                <div className={styles.cover}>
                                    <Cover
                                        src={(m.imageURL ?? undefined) as string | undefined}
                                        seed={String(m.id)}
                                    />
                                </div>

                                <div className={styles.info}>
                                    <div className={styles.name}>{m.title}</div>
                                    <div className={styles.meta}>
                                        {m.creator || "Автор/режиссёр/разработчик"}
                                    </div>
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
                            <div key={`${x.source}:${x.externalId}`} className={styles.row}>
                                <div className={styles.cover}>
                                    <Cover
                                        src={(x.imageUrl ?? undefined) as string | undefined}
                                        seed={`${x.source}-${x.externalId}`}
                                    />
                                </div>

                                <div className={styles.info}>
                                    <div className={styles.name}>{x.title}</div>
                                    <div className={styles.meta}>
                                        {x.year ?? "—"} • {x.type} • {x.source}
                                        {x.creator ? ` • ${x.creator}` : ""}
                                    </div>
                                    {x.description && (
                                        <div className={styles.desc}>{x.description}</div>
                                    )}
                                </div>

                                <button
                                    className={styles.importBtn}
                                    onClick={() => doImport(x)}
                                >
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