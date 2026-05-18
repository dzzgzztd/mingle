import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getProfile, patchProfile } from "../api/profile";
import Cover from "../components/Cover";
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

    const removeAvatar = () => {
        setAvatarUrl("");
        setMsg("Аватарка будет удалена после сохранения профиля");
    };

    return (
        <div className={styles.wrap}>
            <div className={styles.h2}>Редактирование профиля</div>

            <div className={styles.form}>
                <div className={styles.avatarPreview}>
                    <Cover
                        src={avatarUrl.trim() || undefined}
                        seed={name || "profile"}
                        variant="avatar"
                    />
                </div>

                <label className={styles.label}>Имя пользователя</label>
                <input
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Имя пользователя"
                />

                <label className={styles.label}>Ссылка на аватарку</label>
                <div className={styles.avatarRow}>
                    <input
                        className={styles.input}
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        placeholder="https://..."
                    />

                    <button
                        className={styles.removeAvatarBtn}
                        type="button"
                        onClick={removeAvatar}
                        disabled={saving || !avatarUrl.trim()}
                    >
                        Удалить аватарку
                    </button>
                </div>

                <div className={styles.actions}>
                    <button className="btn" type="button" onClick={save} disabled={saving}>
                        {saving ? "Сохранение..." : "Сохранить"}
                    </button>

                    <Link className="btn" to="/profile">
                        Отмена
                    </Link>
                </div>

                {msg && <div className={styles.msg}>{msg}</div>}
            </div>
        </div>
    );
}