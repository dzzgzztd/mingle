import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getProfile } from "../api/profile";
import styles from "./TopBar.module.css";

export default function TopBar() {
    const navigate = useNavigate();
    const [sp] = useSearchParams();
    const [q, setQ] = useState("");
    const [role, setRole] = useState<string>("");

    useEffect(() => {
        const qq = sp.get("q") ?? "";
        setQ(qq);
    }, [sp]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const res = await getProfile();
                if (!cancelled) setRole(res.data.role || "user");
            } catch {
                if (!cancelled) setRole("");
            }
        })();

        const onUpdated = () => {
            getProfile()
                .then((res) => setRole(res.data.role || "user"))
                .catch(() => setRole(""));
        };

        window.addEventListener("profile-updated", onUpdated);
        return () => {
            cancelled = true;
            window.removeEventListener("profile-updated", onUpdated);
        };
    }, []);

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
            <Link className={styles.brand} to="/">
                Mingle
            </Link>

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
                <Link className={styles.link} to="/media/new">
                    Добавить контент
                </Link>
                {role === "admin" && (
                    <>
                        <div className={styles.sep}>|</div>
                        <Link className={styles.link} to="/moderation">
                            Заявки
                        </Link>
                    </>
                )}
                <div className={styles.sep}>|</div>
                <Link className={styles.link} to="/collections">
                    Подборки
                </Link>
                <div className={styles.sep}>|</div>
                <Link className={styles.link} to="/profile">
                    Профиль
                </Link>
            </div>
        </div>
    );
}
