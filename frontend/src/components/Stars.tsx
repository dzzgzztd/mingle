import styles from "./Stars.module.css";

export default function Stars({ value }: { value: number }) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className={styles.stars} aria-label={`rating ${full}/5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < full ? styles.on : styles.off}>★</span>
      ))}
    </div>
  );
}
