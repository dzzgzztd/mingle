import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { MediaItem } from "../types/media";
import type { ExternalSearchItem } from "../types/external";
import Cover from "../components/Cover";
import { searchMedia } from "../api/media";
import { externalSearch, externalImport } from "../api/external";
import styles from "./Search.module.css";

type UnifiedResult =
    | {
    kind: "local";
    key: string;
    id: number;
    type: string;
    title: string;
    creator?: string | null;
    description?: string | null;
    year?: number | null;
    imageUrl?: string | null;
    sourceLabel: string;
    score: number;
    local: MediaItem;
}
    | {
    kind: "external";
    key: string;
    externalId: string;
    source: string;
    type: string;
    title: string;
    creator?: string;
    description?: string;
    year?: number;
    imageUrl?: string;
    sourceLabel: string;
    score: number;
    external: ExternalSearchItem;
};

function normalize(s: string) {
    return (s || "")
        .toLowerCase()
        .replace(/[—–\-_:()[\]{}.,!?/\\'"`]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenScore(query: string, text: string) {
    const qTokens = normalize(query).split(" ").filter(Boolean);
    const t = normalize(text);
    let score = 0;

    for (const token of qTokens) {
        if (t === token) score += 25;
        else if (t.startsWith(token)) score += 14;
        else if (t.includes(token)) score += 8;
    }

    return score;
}

function relevanceScore(params: {
    query: string;
    title: string;
    creator?: string | null;
    year?: number | null;
    hasImage?: boolean;
    isLocal?: boolean;
}) {
    const q = normalize(params.query);
    const title = normalize(params.title);
    const creator = normalize(params.creator || "");
    let score = 0;

    if (!q || !title) return 0;

    if (title === q) score += 1200;
    else if (title.startsWith(q)) score += 700;
    else if (title.includes(q)) score += 350;

    score += tokenScore(q, title);
    if (creator) score += Math.floor(tokenScore(q, creator) * 0.5);

    if (params.hasImage) score += 35;
    if (params.isLocal) score += 20;

    if (params.year && params.year >= 1950) score += 5;

    const badHints = ["summary", "guide", "study guide", "workbook", "collection", "box set"];
    const titleLc = title.toLowerCase();
    if (badHints.some((x) => titleLc.includes(x))) score -= 120;

    return score;
}

function localToUnified(query: string, item: MediaItem): UnifiedResult {
    return {
        kind: "local",
        key: `local:${item.id}`,
        id: item.id,
        type: item.type,
        title: item.title,
        creator: item.creator,
        description: item.description,
        year: item.year ?? undefined,
        imageUrl: item.imageURL ?? undefined,
        sourceLabel: "в Mingle",
        score: relevanceScore({
            query,
            title: item.title,
            creator: item.creator,
            year: item.year,
            hasImage: Boolean(item.imageURL),
            isLocal: true,
        }),
        local: item,
    };
}

function externalToUnified(query: string, item: ExternalSearchItem): UnifiedResult {
    return {
        kind: "external",
        key: `external:${item.source}:${item.externalId}`,
        externalId: item.externalId,
        source: item.source,
        type: item.type,
        title: item.title,
        creator: item.creator,
        description: item.description,
        year: item.year,
        imageUrl: item.imageUrl,
        sourceLabel: item.source,
        score: relevanceScore({
            query,
            title: item.title,
            creator: item.creator,
            year: item.year,
            hasImage: Boolean(item.imageUrl),
            isLocal: false,
        }),
        external: item,
    };
}

function dedupeResults(items: UnifiedResult[]) {
    const best = new Map<string, UnifiedResult>();

    for (const item of items) {
        const key = `${item.type}:${normalize(item.title)}`;
        const prev = best.get(key);

        if (!prev) {
            best.set(key, item);
            continue;
        }

        if (item.kind === "local" && prev.kind !== "local") {
            best.set(key, item);
            continue;
        }

        if (item.score > prev.score) {
            best.set(key, item);
        }
    }

    return Array.from(best.values());
}

export default function Search() {
    const [sp] = useSearchParams();
    const navigate = useNavigate();

    const q = (sp.get("q") ?? "").trim();
    const type = (sp.get("type") ?? "").trim();

    const [localItems, setLocalItems] = useState<MediaItem[]>([]);
    const [externalItems, setExternalItems] = useState<ExternalSearchItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [onlineError, setOnlineError] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);

    const title = useMemo(() => (q ? `Результаты: “${q}”` : "Поиск"), [q]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!q) {
                setLocalItems([]);
                setExternalItems([]);
                setOnlineError(null);
                return;
            }

            setLoading(true);
            setOnlineError(null);

            try {
                const [localRes, extRes] = await Promise.all([
                    searchMedia({ q }),
                    externalSearch({ q }),
                ]);

                if (cancelled) return;

                setLocalItems(localRes.data ?? []);
                setExternalItems(extRes.data.items ?? []);
            } catch (e: any) {
                if (cancelled) return;
                setOnlineError(e?.response?.data?.error || e?.message || "Ошибка поиска");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [q]);

    const results = useMemo(() => {
        const localUnified = localItems.map((x) => localToUnified(q, x));
        const externalUnified = externalItems.map((x) => externalToUnified(q, x));

        let merged = dedupeResults([...localUnified, ...externalUnified]);

        if (type) {
            merged = merged.filter((x) => x.type === type);
        }

        merged.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.kind !== b.kind) return a.kind === "local" ? -1 : 1;
            return a.title.localeCompare(b.title);
        });

        return merged;
    }, [q, type, localItems, externalItems]);

    const openResult = async (item: UnifiedResult) => {
        if (item.kind === "local") {
            navigate(`/media/${item.id}`);
            return;
        }

        setBusyKey(item.key);
        try {
            const res = await externalImport({
                source: item.source,
                externalId: item.externalId,
            });

            const mediaId = res.data?.mediaId;
            if (mediaId) {
                navigate(`/media/${mediaId}`);
            }
        } catch (e: any) {
            alert(e?.response?.data?.error || e?.message || "Не удалось открыть контент");
        } finally {
            setBusyKey(null);
        }
    };

    return (
        <div>
            <div className={styles.h2}>{title}</div>

            {!q && <div className="small">введите запрос в строке поиска сверху</div>}
            {loading && <div className="small">ищу...</div>}
            {onlineError && <div className="small">{onlineError}</div>}

            {!loading && q && results.length > 0 && (
                <div className="small" style={{ margin: "10px 0" }}>
                    найдено результатов: {results.length}
                </div>
            )}

            {!loading && q && results.length === 0 && !onlineError && (
                <div className="small">ничего не найдено</div>
            )}

            <div className={styles.grid}>
                {results.map((x) => (
                    <button
                        key={x.key}
                        type="button"
                        className={styles.rowButton}
                        onClick={() => openResult(x)}
                        disabled={busyKey === x.key}
                    >
                        <div className={styles.row}>
                            <div className={styles.cover}>
                                <Cover
                                    src={(x.imageUrl ?? undefined) as string | undefined}
                                    seed={x.kind === "local" ? String(x.id) : `${x.source}-${x.externalId}`}
                                />
                            </div>

                            <div className={styles.info}>
                                <div className={styles.name}>{x.title}</div>
                                <div className="small">
                                    {x.year ?? "—"} • {x.type} • {x.sourceLabel}
                                </div>
                                {x.creator && <div className="small">{x.creator}</div>}
                                {x.description && <div className={styles.desc}>{x.description}</div>}
                            </div>

                            <div className={styles.sideNote}>
                                {busyKey === x.key
                                    ? "открываю..."
                                    : x.kind === "local"
                                        ? "открыть"
                                        : "открыть"}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}