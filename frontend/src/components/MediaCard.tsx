import { useNavigate } from "react-router-dom";
import styles from "./MediaCard.module.css";
import type { MediaItem } from "../types/media";

export default function MediaCard({ item }: { item: MediaItem }) {
    const nav = useNavigate();

    const go = () => nav(`/media/${item.id}`);

    return (
        <button className={styles.card} onClick={go} type="button">
            <div className={styles.coverWrap}>
                {item.imageURL ? (
                    <img className={styles.cover} src={item.imageURL} alt={item.title} loading="lazy" />
                ) : (
                    <div className={styles.coverPh} />
                )}
            </div>
            <div className={styles.title} title={item.title}>
                {item.title}
            </div>
        </button>
    );
}
