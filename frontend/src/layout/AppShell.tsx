import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import TopBar from "../components/TopBar";
import Tabs from "../components/Tabs";
import styles from "./AppShell.module.css";
import { getProfile } from "../api/profile";
import Cover from "../components/Cover";

export default function AppShell() {
    const [name, setName] = useState("UserNickname");
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
    const loc = useLocation();

    const loadProfile = async () => {
        try {
            const res = await getProfile();
            setName(res.data.name || "UserNickname");
            setAvatarUrl(res.data.avatar_url || undefined);
        } catch {}
    };

    useEffect(() => {
        loadProfile();
    }, []);

    useEffect(() => {
        const onUpdated = () => loadProfile();
        window.addEventListener("profile-updated", onUpdated);
        return () => window.removeEventListener("profile-updated", onUpdated);
    }, []);

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

    return (
        <div className="container">
            <TopBar />

            {showProfileHeader && (
                <div className={styles.profileHeader}>
                    <div className={styles.avatar}>
                        <Cover src={avatarUrl} seed={name} />
                    </div>

                    <div className={styles.profileMain}>
                        <div className={styles.title}>{name}</div>
                    </div>

                    <div className={styles.profileActions}>
                        <Link to="/profile/edit" className="btn">
                            Редактировать профиль
                        </Link>
                    </div>
                </div>
            )}

            {showTabs && <Tabs />}
            <div className="hr" />
            <Outlet />
        </div>
    );
}