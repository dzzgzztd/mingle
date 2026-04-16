import {useState} from "react";
import {login, register} from "../api/auth";
import styles from "./Login.module.css";

export default function Login() {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        setError(null);
        try {
            if (mode === "register") {
                await register(email, password, name);
            }
            await login(email, password);
            window.location.href = "/profile";
        } catch (e: any) {
            setError(e?.response?.data?.error ?? "Сервер недоступен или запрос заблокирован (CORS)");
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.box}>
                <div className={styles.title}>Mingle</div>
                <div className={styles.sub}>веб-система рекомендаций</div>

                {mode === "register" && (
                    <input
                        className={styles.field}
                        placeholder="никнейм"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                )}

                <input
                    className={styles.field}
                    placeholder="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <input
                    className={styles.field}
                    placeholder="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                {error && <div className={styles.err}>{error}</div>}

                <button className={styles.primary} onClick={submit}>
                    {mode === "login" ? "Войти" : "Зарегистрироваться"}
                </button>

                <button className={styles.link} onClick={() => setMode(mode === "login" ? "register" : "login")}>
                    {mode === "login" ? "Нет аккаунта? Регистрация" : "Уже есть аккаунт? Вход"}
                </button>
            </div>
        </div>
    );
}
