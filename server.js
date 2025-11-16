const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

console.log("TELEGRAM_TOKEN:", process.env.TELEGRAM_TOKEN ? "LOADED" : "MISSING");
console.log("CHANNEL_ID:", process.env.CHANNEL_ID ? "LOADED" : "MISSING");
console.log("WEBHOOK_SECRET:", process.env.PATREON_WEBHOOK_SECRET ? "LOADED" : "MISSING");

// ⭐ Use webhook mode instead of polling
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
  webHook: {
    port: process.env.PORT || 3000,
  },
});

// ⭐ Tell Telegram where to send updates
const WEBHOOK_URL = `https://patreon-telegram.onrender.com/telegram-webhook`;
bot.setWebHook(WEBHOOK_URL);

console.log("Telegram webhook set:", WEBHOOK_URL);

// In-memory mapping of Patreon ID → Telegram ID
let userLinks = {};


// ⭐ When a user clicks /start <patreon_id> in Telegram
bot.onText(/\/start (.+)/, async (msg, match) => {
  const telegramId = msg.from.id;
  const patreonId = match[1];

  // Save link
  userLinks[patreonId] = telegramId;

  bot.sendMessage(
    telegramId,
    "Your Telegram has been linked to your Patreon account.\n\nYou now have access."
  );

  bot.sendMessage(telegramId, "Adding you to the Telegram channel...");

  try {
    // Create a 1-use invite link
    const link = await bot.createChatInviteLink(process.env.CHANNEL_ID, {
      member_limit: 1,
    });

    bot.sendMessage(
      telegramId,
      `You now have access!\n\nClick to join:\n${link.invite_link}`
    );
  } catch (err) {
    console.error("Error creating invite link:", err);
    bot.sendMessage(
      telegramId,
      "Sorry, I couldn't generate your invite link. Contact the admin."
    );
  }
});


// ⭐ Patreon webhook endpoint
app.post("/patreon-webhook", async (req, res) => {
  const event = req.body;

  // Patreon ID and membership status
  const patreonId = event.data.id;
  const status = event.data.attributes.patron_status;

  console.log("Patreon webhook event:", patreonId, status);

  // If user is no longer active
  if (status !== "active_patron") {
    const telegramId = userLinks[patreonId];

    if (telegramId) {
      try {
        await bot.banChatMember(process.env.CHANNEL_ID, telegramId);
        await bot.unbanChatMember(process.env.CHANNEL_ID, telegramId); // allows rejoin later
        console.log("Removed from Telegram:", telegramId);
      } catch (err) {
        console.error("Error removing user:", err);
      }
    }
  }

  res.sendStatus(200);
});


// ⭐ Telegram webhook entrypoint
app.post("/telegram-webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});
