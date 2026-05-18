import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const isProfile = location.pathname.startsWith("/profile");
  const isSearch = location.pathname.startsWith("/search");

  const activeType = sp.get("type") || "";

  const makeTo = (type: string) => {
    if (isProfile) {
      return `/profile?type=${type}`;
    }

    if (isSearch) {
      const params = new URLSearchParams(sp);
      params.set("type", type);
      return `/search?${params.toString()}`;
    }

    return `/media?type=${type}`;
  };

  const handleClick = (
      e: React.MouseEvent<HTMLAnchorElement>,
      type: string
  ) => {
    if (activeType !== type) return;

    e.preventDefault();

    if (isProfile) {
      navigate("/profile");
      return;
    }

    if (isSearch) {
      const params = new URLSearchParams(sp);
      params.delete("type");
      const query = params.toString();
      navigate(query ? `/search?${query}` : "/search");
      return;
    }

    navigate("/media");
  };

  return (
      <div className={styles.tabs}>
        {tabs.map((t) => {
          const cls = activeType === t.type ? styles.active : styles.tab;

          return (
              <NavLink
                  key={t.type}
                  to={makeTo(t.type)}
                  className={cls}
                  onClick={(e) => handleClick(e, t.type)}
              >
                <span className={styles.icon}>{t.icon}</span>
                <span>{t.label}</span>
              </NavLink>
          );
        })}
      </div>
  );
}