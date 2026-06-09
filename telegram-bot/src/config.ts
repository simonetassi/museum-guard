import "dotenv/config";

export const CONFIG = {
  sensor: { tdUrl: process.env.SENSOR_TD_URL ?? "http://localhost:8080/museumguard-sensor" },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    chatId:   process.env.TELEGRAM_CHAT_ID   ?? "",
  },
};