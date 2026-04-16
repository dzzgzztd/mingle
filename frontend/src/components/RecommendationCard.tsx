import type { RecommendationItem } from "../types/recommendation";
import Cover from "./Cover";
import styles from "./RecommendationCard.module.css";

export default function RecommendationCard({ item }: { item: RecommendationItem }) {
  return (
    <a className={styles.wrap} href={`/media/${item.id}`}>
      <div className={styles.card}>
        <div className={styles.cover}>
          <Cover src={item.image_url || undefined} seed={String(item.id)} />
        </div>
      </div>
    </a>
  );
}
