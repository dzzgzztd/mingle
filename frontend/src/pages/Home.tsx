import { useEffect, useState } from "react";
import { getMedia } from "../api/media";
import type { MediaItem } from "../types/media";
import Cover from "../components/Cover";
import { Link } from "react-router-dom";
import styles from "./Home.module.css";

function Section({ title, type, items }: { title: string; type: string; items: MediaItem[] }) {
    return (
        <div className={styles.section}>
            <div className={styles.sectionTitle}>
                <span>{title}</span>
                <Link className={styles.more} to={`/media?type=${type}`}>все →</Link>
            </div>
            <div className={styles.strip}>
                {items.map((m) => (
                    <Link key={m.id} to={`/media/${m.id}`} className={styles.card}>
                        <Cover src={(m.imageURL ?? undefined) as string | undefined} seed={String(m.id)} />
                        <div className={styles.cardTitle}>{m.title}</div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default function Home() {
    const [movies, setMovies] = useState<MediaItem[]>([]);
    const [series, setSeries] = useState<MediaItem[]>([]);
    const [books, setBooks] = useState<MediaItem[]>([]);
    const [games, setGames] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            const [m, s, b, g] = await Promise.all([
                getMedia({ type: "movie" }),
                getMedia({ type: "series" }),
                getMedia({ type: "book" }),
                getMedia({ type: "game" }),
            ]);
            setMovies(m.data.slice(0, 12));
            setSeries(s.data.slice(0, 12));
            setBooks(b.data.slice(0, 12));
            setGames(g.data.slice(0, 12));
            setLoading(false);
        })();
    }, []);

    if (loading) return <div className="small">загрузка...</div>;

    return (
        <div>
            <Section title="Фильмы" type="movie" items={movies} />
            <Section title="Сериалы" type="series" items={series} />
            <Section title="Книги" type="book" items={books} />
            <Section title="Игры" type="game" items={games} />
        </div>
    );
}
