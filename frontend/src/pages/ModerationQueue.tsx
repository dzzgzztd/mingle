import { useEffect, useState } from "react";
import {
    approveSubmission,
    listModerationSubmissions,
    rejectSubmission,
} from "../api/admin";
import type { MediaSubmission } from "../types/media";
import styles from "./ModerationQueue.module.css";

const TYPE_LABEL: Record<string, string> = {
    movie: "Фильм",
    series: "Сериал",
    book: "Книга",
    game: "Игра",
};

function Cover({ src }: { src?: string | null }) {
    return src ? <img className={styles.cover} src={src} alt="" /> : <div className={styles.ph} />;
}

export default function ModerationQueue() {
    const [status, setStatus] = useState("pending");
    const [submissions, setSubmissions] = useState<MediaSubmission[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const loadSubmissions = async () => {
        setLoading(true);
        setErr(null);

        try {
            const res = await listModerationSubmissions(status);
            setSubmissions(res.data || []);
        } catch (e: any) {
            setErr(e?.response?.data?.error || "Не удалось загрузить заявки");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSubmissions();
    }, [status]);

    const approve = async (id: number) => {
        setMsg(null);
        setErr(null);

        try {
            await approveSubmission(id);
            setMsg("Заявка одобрена и добавлена в каталог");
            await loadSubmissions();
        } catch (e: any) {
            setErr(e?.response?.data?.error || "Не удалось одобрить заявку");
        }
    };

    const reject = async (id: number) => {
        const comment = window.prompt("Причина отклонения", "");
        setMsg(null);
        setErr(null);

        try {
            await rejectSubmission(id, comment || "");
            setMsg("Заявка отклонена");
            await loadSubmissions();
        } catch (e: any) {
            setErr(e?.response?.data?.error || "Не удалось отклонить заявку");
        }
    };

    return (
        <div>
            <div className={styles.h2}>Заявки на модерацию</div>

            {msg && <div className={styles.msg}>{msg}</div>}
            {err && <div className={styles.err}>{err}</div>}

            <section className={styles.section}>
                <div className={styles.toolbar}>
                    <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="pending">Ожидают</option>
                        <option value="approved">Одобрены</option>
                        <option value="rejected">Отклонены</option>
                    </select>
                    <button className="btn" type="button" onClick={loadSubmissions}>Обновить</button>
                </div>

                {loading && <div className="small">загрузка...</div>}
                {!loading && submissions.length === 0 && <div className="small">заявок нет</div>}

                <div className={styles.list}>
                    {submissions.map((s) => (
                        <div key={s.id} className={styles.card}>
                            <Cover src={s.imageURL} />
                            <div>
                                <div className={styles.title}>{s.title}</div>
                                <div className={styles.meta}>
                                    {TYPE_LABEL[s.type] ?? s.type} • {s.year ?? "—"} • {s.creator || "—"} • user #{s.user_id}
                                </div>
                                <div className={styles.desc}>{s.description || "Без описания"}</div>
                                {s.admin_comment && <div className={styles.msg}>Комментарий: {s.admin_comment}</div>}
                            </div>
                            <div className={styles.actions}>
                                {s.status === "pending" && (
                                    <>
                                        <button className="btn" type="button" onClick={() => approve(s.id)}>Одобрить</button>
                                        <button className={styles.dangerBtn} type="button" onClick={() => reject(s.id)}>Отклонить</button>
                                    </>
                                )}
                                {s.media_id && <a className="btn" href={`/media/${s.media_id}`}>Открыть</a>}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
