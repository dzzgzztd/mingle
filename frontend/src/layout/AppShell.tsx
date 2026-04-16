import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TopBar from "../components/TopBar";
import Tabs from "../components/Tabs";
import styles from "./AppShell.module.css";
import { getProfile } from "../api/profile";
import Cover from "../components/Cover";

export default function AppShell() {
  const [name, setName] = useState("UserNickname");
  const loc = useLocation();

  useEffect(() => {
    (async () => {
      try {
        const res = await getProfile();
        setName(res.data.name || "UserNickname");
      } catch {}
    })();
  }, []);

  const showTabs = useMemo(() => {
    return loc.pathname === "/" ||
        loc.pathname.startsWith("/media") ||
        loc.pathname.startsWith("/profile") ||
        loc.pathname.startsWith("/search");
  }, [loc.pathname]);

  const showProfileHeader = useMemo(() => loc.pathname.startsWith("/profile"), [loc.pathname]);

  return (
      <div className="container">
        <TopBar />

        {showProfileHeader && (
            <div className={styles.profileHeader}>
              <div className={styles.avatar}><Cover seed={name} /></div>
              <div className={styles.title}>{name}</div>
            </div>
        )}

        {showTabs && <Tabs />}
        <div className="hr" />
        <Outlet />
      </div>
  );
}
