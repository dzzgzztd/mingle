import styles from "./RatingControl.module.css";

type RatingControlProps = {
    value: number;
    disabled?: boolean;
    onChange: (value: number) => void | Promise<void>;
    onClear?: () => void | Promise<void>;
};

export default function RatingControl({
                                          value,
                                          disabled = false,
                                          onChange,
                                          onClear,
                                      }: RatingControlProps) {
    const safeValue = Math.max(0, Math.min(5, Math.round(value || 0)));
    const canClear = safeValue > 0 && Boolean(onClear);

    return (
        <div className={styles.wrap}>
            <button
                type="button"
                className={styles.clear}
                onClick={() => onClear?.()}
                disabled={disabled || !canClear}
                aria-label="Убрать оценку"
                title="Убрать оценку"
            >
                ×
            </button>

            <div className={styles.stars}>
                {Array.from({ length: 5 }).map((_, i) => {
                    const starValue = i + 1;

                    return (
                        <button
                            key={starValue}
                            type="button"
                            className={starValue <= safeValue ? styles.on : styles.off}
                            onClick={() => onChange(starValue)}
                            disabled={disabled}
                            aria-label={`Поставить оценку ${starValue}`}
                        >
                            ★
                        </button>
                    );
                })}
            </div>
        </div>
    );
}