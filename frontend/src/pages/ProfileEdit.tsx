import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProfile, patchProfile } from "../api/profile";
import styles from "./ProfileEdit.module.css";

export default function ProfileEdit() {
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await getProfile();
                setName(res.data.name || "");
                setAvatarUrl(res.data.avatar_url || "");
            } catch {}
        })();
    }, []);

    const save = async () => {
        setSaving(true);
        setMsg(null);

        try {
            await patchProfile({
                name: name.trim(),
                avatar_url: avatarUrl.trim(),
            });
            window.dispatchEvent(new Event("profile-updated"));
            setMsg("Профиль сохранен");
            setTimeout(() => navigate("/profile"), 500);
        } catch (e: any) {
            setMsg(e?.response?.data?.error || "Не удалось сохранить профиль");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.wrap}>
            <div className={styles.h2}>Редактирование профиля</div>

            <div className={styles.form}>
                <label className={styles.label}>Имя</label>
                <input
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Имя пользователя"
                />

                <label className={styles.label}>Ссылка на аватар</label>
                <input
                    className={styles.input}
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://..."
                />

                <div className={styles.actions}>
                    <button className="btn" onClick={save} disabled={saving}>
                        {saving ? "Сохранение..." : "Сохранить"}
                    </button>
                    <Link to="/profile" className="btn">Назад</Link>
                </div>

                {msg && <div className={styles.msg}>{msg}</div>}
            </div>
        </div>
    );
}