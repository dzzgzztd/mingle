import styles from "./Cover.module.css";

export default function Cover({ src, seed }: { src?: string; seed: string }) {
  if (src) {
    return <img className={styles.img} src={src} alt="" />;
  }
  return <div className={styles.ph} style={{ backgroundImage: gradient(seed) }} />;
}

function gradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  const a = (h + 20) % 360;
  const b = (h + 180) % 360;
  return `radial-gradient(140px 220px at 30% 25%, hsla(${a}, 80%, 65%, 0.95), transparent 60%),
          radial-gradient(200px 200px at 65% 70%, hsla(${b}, 85%, 55%, 0.95), transparent 60%),
          linear-gradient(135deg, hsla(${h}, 80%, 45%, 0.9), hsla(${(h+60)%360}, 85%, 60%, 0.9))`;
}
