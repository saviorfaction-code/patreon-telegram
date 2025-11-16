const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

// Debug logs
console.log("TELEGRAM_TOKEN:", process.env.TELEGRAM_TOKEN ? "LOADED" : "MISSING");
console.log("CHANNEL_ID:", process.env.CHANNEL_ID ? "LOADED" : "MISSING");
console.log("WEBHOOK_SECRET:", process.env.PATREON_WEBHOOK_SECRET ? "LOADED" : "MISSING");

// ⭐ TELEGRAM BOT (WEBHOOK MODE)
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { webHook: true });

// ⭐ Webhook URL for Telegram
const WEBHOOK_URL = "https://patreon-telegram.onrender.com/telegram-webhook";
bot.setWebHook(WEBHOOK_URL);
console.log("Webhook set to:", WEBHOOK_URL);

// ⭐ in-memory mapping Patreon ➜ Telegram
let userLinks = {};

// ⭐ Handle /start <patreon_id>
bot.onText(/\/start (.+)/, async (msg, match) => {
  const telegramId = msg.from.id;
  const patreonId = match[1];

  userLinks[patreonId] = telegramId;

  bot.sendMessage(telegramId, "Your Telegram has been linked. Adding you to channel…");

  try {
    const invite = await bot.createChatInviteLink(process.env.CHANNEL_ID, {
      member_limit: 1,
    });

    bot.sendMessage(telegramId, `Here is your invite:\n${invite.invite_link}`);
  } catch (err) {
    console.error("Invite error:", err);
    bot.sendMessage(telegramId, "Error generating invite. Contact admin.");
  }
});

// ⭐ Patreon webhook
app.post("/patreon-webhook", async (req, res) => {
  const event = req.body;
  const patreonId = event?.data?.id;
  const status = event?.data?.attributes?.patron_status;

  console.log("Patreon webhook:", patreonId, status);

  if (status !== "active_patron") {
    const telegramId = userLinks[patreonId];

    if (telegramId) {
      try {
        await bot.banChatMember(process.env.CHANNEL_ID, telegramId);
        await bot.unbanChatMember(process.env.CHANNEL_ID, telegramId);
        console.log("User removed:", telegramId);
      } catch (err) {
        console.error("Removal error:", err);
      }
    }
  }

  res.sendStatus(200);
});

// ⭐ Telegram webhook endpoint (required)
app.post("/telegram-webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Start server (Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));

