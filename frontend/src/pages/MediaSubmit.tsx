import { useState } from "react";
import { Link } from "react-router-dom";
import { submitMedia } from "../api/media";
import styles from "./MediaSubmit.module.css";

const TYPES = [
    { value: "movie", label: "Фильм" },
    { value: "series", label: "Сериал" },
    { value: "book", label: "Книга" },
    { value: "game", label: "Игра" },
];

export default function MediaSubmit() {
    const [title, setTitle] = useState("");
    const [type, setType] = useState("movie");
    const [year, setYear] = useState("");
    const [creator, setCreator] = useState("");
    const [imageURL, setImageURL] = useState("");
    const [description, setDescription] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const submit = async () => {
        const cleanTitle = title.trim();
        if (!cleanTitle || saving) return;

        setSaving(true);
        setMsg(null);
        setErr(null);

        try {
            await submitMedia({
                title: cleanTitle,
                type,
                year: year.trim() ? Number(year) : null,
                creator: creator.trim(),
                imageURL: imageURL.trim(),
                description: description.trim(),
            });

            setTitle("");
            setYear("");
            setCreator("");
            setImageURL("");
            setDescription("");
            setType("movie");
            setMsg("Заявка отправлена на модерацию");
        } catch (e: any) {
            setErr(e?.response?.data?.error || "Не удалось отправить заявку");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.wrap}>
            <div className={styles.h2}>Добавить контент</div>

            <div className={styles.form}>
                <label className={styles.label}>Название *</label>
                <input
                    className={styles.input}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Например, Hades"
                />

                <div className={styles.row}>
                    <div>
                        <label className={styles.label}>Тип *</label>
                        <select className={styles.select} value={type} onChange={(e) => setType(e.target.value)}>
                            {TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={styles.label}>Год</label>
                        <input
                            className={styles.input}
                            value={year}
                            onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                            placeholder="2020"
                        />
                    </div>
                </div>

                <label className={styles.label}>Автор / режиссёр / разработчик</label>
                <input
                    className={styles.input}
                    value={creator}
                    onChange={(e) => setCreator(e.target.value)}
                    placeholder="Supergiant Games"
                />

                <label className={styles.label}>Ссылка на обложку</label>
                <input
                    className={styles.input}
                    value={imageURL}
                    onChange={(e) => setImageURL(e.target.value)}
                    placeholder="https://..."
                />

                <label className={styles.label}>Описание</label>
                <textarea
                    className={styles.textarea}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Краткое описание контента"
                />

                {msg && <div className={styles.msg}>{msg}</div>}
                {err && <div className={styles.err}>{err}</div>}

                <div className={styles.actions}>
                    <button className="btn" type="button" onClick={submit} disabled={saving || !title.trim()}>
                        {saving ? "Отправка..." : "Отправить на модерацию"}
                    </button>
                    <Link className="btn" to="/profile">Назад в профиль</Link>
                </div>
            </div>
        </div>
    );
}
