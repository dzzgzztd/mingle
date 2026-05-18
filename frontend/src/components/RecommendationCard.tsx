import { Link } from "react-router-dom";
import type { RecommendationItem } from "../types/recommendation";
import Cover from "./Cover";
import styles from "./RecommendationCard.module.css";

export default function RecommendationCard({ item }: { item: RecommendationItem }) {
    return (
        <Link className={styles.wrap} to={`/media/${item.id}`} title={item.title}>
            <div className={styles.card}>
                <div className={styles.coverBox}>
                    <Cover
                        src={item.image_url || undefined}
                        seed={String(item.id)}
                        variant="thumb"
                    />
                </div>

                <div className={styles.title}>{item.title}</div>
            </div>
        </Link>
    );
}