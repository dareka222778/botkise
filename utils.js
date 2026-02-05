export function formatUptime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

export function safe1900(text) {
  const t = String(text ?? "");
  return t.length > 1900 ? t.slice(0, 1900) + "…" : t;
}

export function setSafetyLogs() {
  process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
  process.on("uncaughtException", (e) => console.error("uncaughtException:", e));
}

