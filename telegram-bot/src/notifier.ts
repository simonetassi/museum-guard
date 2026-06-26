import pino from "pino";
import { CONFIG } from "./config";

const log = pino({ name: "telegramNotifier" });

export async function notifyTelegram(message: string): Promise<void> {
  if (!CONFIG.telegram.botToken || !CONFIG.telegram.chatId) {
    log.warn("Telegram bot token or chat id not configured, skipping alert");
    return;
  }

  const res = await fetch(`https://api.telegram.org/bot${CONFIG.telegram.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CONFIG.telegram.chatId, text: message, parse_mode: "HTML" }),
  });

  if (!res.ok) {
    log.error({ status: res.status, body: await res.text() }, "Telegram sendMessage failed");
  }
}