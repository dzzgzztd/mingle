import { useEffect, useState } from "react";
import {
    approveSubmission,
    listModerationSubmissions,
    rejectSubmission,
    updateSubmission,
} from "../api/admin";
import type { MediaDraft, MediaSubmission } from "../types/media";
import Cover from "../components/Cover";
import styles from "./ModerationQueue.module.css";

const TYPE_LABEL: Record<string, string> = {
    movie: "Фильм",
    series: "Сериал",
    book: "Книга",
    game: "Игра",
};

const TYPE_OPTIONS = [
    { value: "movie", label: "Фильм" },
    { value: "series", label: "Сериал" },
    { value: "book", label: "Книга" },
    { value: "game", label: "Игра" },
];

function draftFromSubmission(s: MediaSubmission): MediaDraft {
    return {
        title: s.title || "",
        description: s.description || "",
        type: s.type || "movie",
        year: s.year ?? null,
        creator: s.creator || "",
        imageURL: s.imageURL || "",
    };
}

export default function ModerationQueue() {
    const [status, setStatus] = useState("pending");
    const [submissions, setSubmissions] = useState<MediaSubmission[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const [editId, setEditId] = useState<number | null>(null);
    const [draft, setDraft] = useState<MediaDraft | null>(null);
    const [savingId, setSavingId] = useState<number | null>(null);

    const loadSubmissions = async () => {
        setLoading(true);
        setErr(null);

        try {
            const res = await listModerationSubmissions(status);
            setSubmissions(res.data || []);
        } catch (e: any) {
            setErr(e?.response?.data?.error || "Не удалось загрузить заявки");
            setSubmissions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSubmissions();
    }, [status]);

    const approve = async (id: number) => {
        setSavingId(id);
        setErr(null);

        try {
            await approveSubmission(id);
            await loadSubmissions();
        } catch (e: any) {
            setErr(e?.response?.data?.error || "Не удалось одобрить заявку");
        } finally {
            setSavingId(null);
        }
    };

    const reject = async (id: number) => {
        const comment = window.prompt("Комментарий к отклонению", "Не соответствует требованиям") || "";

        setSavingId(id);
        setErr(null);

        try {
            await rejectSubmission(id, comment);
            await loadSubmissions();
        } catch (e: any) {
            setErr(e?.response?.data?.error || "Не удалось отклонить заявку");
        } finally {
            setSavingId(null);
        }
    };

    const startEdit = (s: MediaSubmission) => {
        setEditId(s.id);
        setDraft(draftFromSubmission(s));
        setErr(null);
    };

    const cancelEdit = () => {
        setEditId(null);
        setDraft(null);
    };

    const saveEdit = async (id: number) => {
        if (!draft) return;

        const clean: MediaDraft = {
            title: draft.title.trim(),
            description: draft.description?.trim() || "",
            type: draft.type,
            year: draft.year ?? null,
            creator: draft.creator?.trim() || "",
            imageURL: draft.imageURL?.trim() || "",
        };

        if (!clean.title) {
            setErr("Название не может быть пустым");
            return;
        }

        setSavingId(id);
        setErr(null);

        try {
            await updateSubmission(id, clean);
            setEditId(null);
            setDraft(null);
            await loadSubmissions();
        } catch (e: any) {
            setErr(e?.response?.data?.error || "Не удалось сохранить изменения");
        } finally {
            setSavingId(null);
        }
    };

    const updateDraft = <K extends keyof MediaDraft>(key: K, value: MediaDraft[K]) => {
        setDraft((prev) => {
            if (!prev) return prev;
            return { ...prev, [key]: value };
        });
    };

    return (
        <div>
            <div className={styles.h2}>Заявки на модерацию</div>

            {err && <div className={styles.err}>{err}</div>}

            <section className={styles.section}>
                <div className={styles.toolbar}>
                    <select
                        className={styles.select}
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="pending">Ожидают</option>
                        <option value="approved">Одобрены</option>
                        <option value="rejected">Отклонены</option>
                    </select>

                    <button className="btn" type="button" onClick={loadSubmissions}>
                        Обновить
                    </button>
                </div>

                {loading && <div className="small">загрузка...</div>}
                {!loading && submissions.length === 0 && <div className="small">заявок нет</div>}

                <div className={styles.list}>
                    {submissions.map((s) => {
                        const editing = editId === s.id && draft;

                        return (
                            <div key={s.id} className={styles.card}>
                                <div className={styles.cover}>
                                    <Cover
                                        src={(editing ? draft.imageURL : s.imageURL) || undefined}
                                        seed={String(s.id)}
                                        variant="thumb"
                                    />
                                </div>

                                <div className={styles.main}>
                                    {!editing ? (
                                        <>
                                            <div className={styles.title}>{s.title}</div>

                                            <div className={styles.meta}>
                                                {TYPE_LABEL[s.type] ?? s.type} • {s.year ?? "—"} •{" "}
                                                {s.creator || "—"} • user #{s.user_id}
                                            </div>

                                            <div className={styles.desc}>{s.description || "Без описания"}</div>

                                            {s.admin_comment && (
                                                <div className={styles.msg}>
                                                    Комментарий: {s.admin_comment}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className={styles.editForm}>
                                            <div className={styles.grid2}>
                                                <label className={styles.field}>
                                                    <span>Название</span>
                                                    <input
                                                        className={styles.input}
                                                        value={draft.title}
                                                        onChange={(e) => updateDraft("title", e.target.value)}
                                                    />
                                                </label>

                                                <label className={styles.field}>
                                                    <span>Тип</span>
                                                    <select
                                                        className={styles.input}
                                                        value={draft.type}
                                                        onChange={(e) => updateDraft("type", e.target.value)}
                                                    >
                                                        {TYPE_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className={styles.field}>
                                                    <span>Год</span>
                                                    <input
                                                        className={styles.input}
                                                        type="number"
                                                        value={draft.year ?? ""}
                                                        onChange={(e) =>
                                                            updateDraft(
                                                                "year",
                                                                e.target.value ? Number(e.target.value) : null
                                                            )
                                                        }
                                                    />
                                                </label>

                                                <label className={styles.field}>
                                                    <span>Автор / разработчик</span>
                                                    <input
                                                        className={styles.input}
                                                        value={draft.creator || ""}
                                                        onChange={(e) => updateDraft("creator", e.target.value)}
                                                    />
                                                </label>
                                            </div>

                                            <label className={styles.field}>
                                                <span>Ссылка на изображение</span>
                                                <input
                                                    className={styles.input}
                                                    value={draft.imageURL || ""}
                                                    onChange={(e) => updateDraft("imageURL", e.target.value)}
                                                />
                                            </label>

                                            <label className={styles.field}>
                                                <span>Описание</span>
                                                <textarea
                                                    className={styles.textarea}
                                                    value={draft.description || ""}
                                                    onChange={(e) => updateDraft("description", e.target.value)}
                                                />
                                            </label>
                                        </div>
                                    )}
                                </div>

                                <div className={styles.actions}>
                                    {!editing ? (
                                        <>
                                            <button
                                                className={styles.secondaryBtn}
                                                type="button"
                                                onClick={() => startEdit(s)}
                                                disabled={savingId === s.id}
                                            >
                                                Изменить
                                            </button>

                                            {s.status === "pending" && (
                                                <>
                                                    <button
                                                        className={styles.actionBtn}
                                                        type="button"
                                                        onClick={() => approve(s.id)}
                                                        disabled={savingId === s.id}
                                                    >
                                                        Одобрить
                                                    </button>

                                                    <button
                                                        className={styles.dangerBtn}
                                                        type="button"
                                                        onClick={() => reject(s.id)}
                                                        disabled={savingId === s.id}
                                                    >
                                                        Отклонить
                                                    </button>
                                                </>
                                            )}

                                            {s.media_id && (
                                                <a className={styles.actionBtn} href={`/media/${s.media_id}`}>
                                                    Открыть
                                                </a>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                className={styles.actionBtn}
                                                type="button"
                                                onClick={() => saveEdit(s.id)}
                                                disabled={savingId === s.id}
                                            >
                                                {savingId === s.id ? "Сохранение..." : "Сохранить"}
                                            </button>

                                            <button
                                                className={styles.secondaryBtn}
                                                type="button"
                                                onClick={cancelEdit}
                                                disabled={savingId === s.id}
                                            >
                                                Отмена
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}