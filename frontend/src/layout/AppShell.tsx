import {useCallback, useEffect, useMemo, useState} from "react";
import {Link, Outlet, useLocation, useNavigate} from "react-router-dom";
import TopBar from "../components/TopBar";
import Tabs from "../components/Tabs";
import styles from "./AppShell.module.css";
import {getProfile} from "../api/profile";
import {logout} from "../api/auth";
import Cover from "../components/Cover";
import {getRecommendations} from "../api/recommendations";
import RecommendationCard from "../components/RecommendationCard";
import type {RecommendationItem} from "../types/recommendation";

export default function AppShell() {
    const [name, setName] = useState("UserNickname");
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

    const [recsVisible, setRecsVisible] = useState(false);
    const [recs, setRecs] = useState<RecommendationItem[]>([]);
    const [recsLoading, setRecsLoading] = useState(false);
    const [recsError, setRecsError] = useState<string | null>(null);

    const loc = useLocation();
    const navigate = useNavigate();

    const showTabs = useMemo(() => {
        return (
            loc.pathname === "/" ||
            loc.pathname.startsWith("/media") ||
            loc.pathname.startsWith("/profile") ||
            loc.pathname.startsWith("/search")
        );
    }, [loc.pathname]);

    const showProfileHeader = useMemo(
        () => loc.pathname === "/profile",
        [loc.pathname]
    );

    const loadProfile = useCallback(async () => {
        try {
            const res = await getProfile();
            setName(res.data.name || "UserNickname");
            setAvatarUrl(res.data.avatar_url || undefined);
        } catch {
            setName("UserNickname");
            setAvatarUrl(undefined);
        }
    }, []);

    const loadRecommendations = useCallback(async () => {
        setRecsVisible(true);
        setRecsLoading(true);
        setRecsError(null);

        try {
            const res = await getRecommendations();
            setRecs(res.data.recommendations || []);
        } catch (e: any) {
            setRecs([]);
            setRecsError(e?.response?.data?.error || "Не удалось загрузить рекомендации");
        } finally {
            setRecsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    useEffect(() => {
        const onUpdated = () => loadProfile();

        window.addEventListener("profile-updated", onUpdated);
        return () => window.removeEventListener("profile-updated", onUpdated);
    }, [loadProfile]);

    useEffect(() => {
        const onActivityUpdated = () => {
            if (recsVisible) {
                loadRecommendations();
            }
        };

        window.addEventListener("profile-activity-updated", onActivityUpdated);
        return () => window.removeEventListener("profile-activity-updated", onActivityUpdated);
    }, [recsVisible, loadRecommendations]);

    const handleLogout = () => {
        logout();
        navigate("/login", {replace: true});
    };

    return (
        <div className="container">
            <TopBar/>

            {showProfileHeader && (
                <div className={styles.profileHeader}>
                    <div className={styles.avatar}>
                        <Cover src={avatarUrl} seed={name} variant="avatar"/>
                    </div>

                    <div className={styles.profileMain}>
                        <div className={styles.title}>{name}</div>
                    </div>

                    <div className={styles.profileActions}>
                        <div className={styles.actionsTop}>
                            <Link to="/profile/edit" className="btn">
                                Редактировать профиль
                            </Link>

                            <button
                                className={styles.logoutBtn}
                                type="button"
                                onClick={handleLogout}
                            >
                                Выйти
                            </button>
                        </div>

                        <button
                            className={styles.recommendBtn}
                            type="button"
                            onClick={loadRecommendations}
                            disabled={recsLoading}
                        >
                            {recsLoading ? "Загрузка..." : "Получить рекомендации"}
                        </button>
                    </div>
                </div>
            )}

            {showProfileHeader && recsVisible && (
                <section className={styles.profileRecs}>
                    <div className={styles.recsTitle}>Рекомендации по профилю</div>

                    {recsError && <div className="small">{recsError}</div>}

                    {!recsLoading && !recsError && recs.length === 0 && (
                        <div className="small">
                            пока нет рекомендаций: добавь статус или оценку нескольким произведениям
                        </div>
                    )}

                    {recs.length > 0 && (
                        <div className={styles.recsStrip}>
                            {recs.map((r) => (
                                <RecommendationCard key={r.id} item={r}/>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {showTabs && <Tabs/>}
            <div className="hr"/>
            <Outlet/>
        </div>
    );
}