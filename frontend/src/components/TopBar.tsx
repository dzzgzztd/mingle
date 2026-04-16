import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import styles from "./TopBar.module.css";

export default function TopBar() {
    const navigate = useNavigate();
    const [sp] = useSearchParams();
    const [q, setQ] = useState("");

    useEffect(() => {
        const qq = sp.get("q") ?? "";
        setQ(qq);
    }, [sp]);

    const goSearch = () => {
        const qq = q.trim();
        if (!qq) {
            navigate("/search");
            return;
        }
        navigate(`/search?q=${encodeURIComponent(qq)}`);
    };

    return (
        <div className={styles.top}>
            <Link className={styles.brand} to="/">Mingle</Link>

            <input
                className="input"
                placeholder="поиск..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") goSearch();
                }}
            />

            <div className={styles.right}>
                <Link className={styles.link} to="/collections">Подборки</Link>
                <div className={styles.sep}>|</div>
                <Link className={styles.link} to="/profile">Профиль</Link>
            </div>
        </div>
    );
}
