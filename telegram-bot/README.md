# telegram-bot

WoT consumer that subscribes to the sensor Thing's impact/theft events and
forwards them as Telegram alerts.

## Run

```bash
cd telegram-bot
npm install
cp .env.example .env          # then set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
npm start
```
