import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import styles from "./Tabs.module.css";

type Tab = {
  type: "movie" | "series" | "book" | "game";
  label: string;
  icon: string;
};

const tabs: Tab[] = [
  { type: "movie", label: "Фильмы", icon: "🎞️" },
  { type: "series", label: "Сериалы", icon: "📺" },
  { type: "book", label: "Книги", icon: "📘" },
  { type: "game", label: "Игры", icon: "🎮" },
];

export default function Tabs() {
  const location = useLocation();
  const [sp] = useSearchParams();

  const isProfile = location.pathname.startsWith("/profile");
  const isSearch = location.pathname.startsWith("/search");

  const activeType = sp.get("type") || ""; // <-- ключевой фикс

  return (
      <div className={styles.tabs}>
        {tabs.map((t) => {
          const to = isProfile
              ? `/profile?type=${t.type}`
              : isSearch
                  ? `/search?type=${t.type}${sp.get("q") ? `&q=${encodeURIComponent(sp.get("q") as string)}` : ""}`
                  : `/media?type=${t.type}`;

          const cls = activeType === t.type ? styles.active : styles.tab;

          return (
              <NavLink key={t.type} to={to} className={cls}>
                <span className={styles.icon}>{t.icon}</span>
                <span>{t.label}</span>
              </NavLink>
          );
        })}
      </div>
  );
}
