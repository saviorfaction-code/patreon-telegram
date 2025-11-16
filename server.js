const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const bodyParser = require("body-parser");
require("dotenv").config();

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

const app = express();
app.use(bodyParser.json());

// In-memory storage of PatreonID -> TelegramID
let userLinks = {};

// ⭐ When a user clicks your bot's start link: /start <patreon_id>
bot.onText(/\/start (.+)/, (msg, match) => {
    const telegramId = msg.from.id;
    const patreonId = match[1];

    // Save the mapping
    userLinks[patreonId] = telegramId;

    bot.sendMessage(
        telegramId,
        "Your Telegram has been linked to your Patreon account.\n\nYou now have access."
    );

    bot.sendMessage(telegramId, "Adding you to the Telegram channel...");

    try {
        // Add user to your channel/group
// Create a one-time invite link and send to the patron
bot.createChatInviteLink(process.env.CHANNEL_ID, {
    member_limit: 1
})
.then(link => {
    bot.sendMessage(telegramId, `You now have access!\n\nClick to join:\n${link.invite_link}`);
})
.catch(err => {
    console.error("Error creating invite link:", err);
    bot.sendMessage(telegramId, "Sorry, I could not generate your invite link. Contact the admin.");
});

    } catch (err) {
        console.error("Error adding user:", err);
    }
});

// ⭐ Patreon webhook — handle cancellations, failed payments, etc.
app.post("/patreon-webhook", async (req, res) => {
    const event = req.body;

    // Patreon member ID
    const patreonId = event.data.id;
    // Patreon membership status
    const status = event.data.attributes.patron_status;

    console.log("Patreon webhook event:", patreonId, status);

    // If user is NOT active, remove from Telegram
    if (status !== "active_patron") {
        const telegramId = userLinks[patreonId];

        if (telegramId) {
            try {
                await bot.banChatMember(process.env.CHANNEL_ID, telegramId);
                await bot.unbanChatMember(process.env.CHANNEL_ID, telegramId); // allows rejoin if they resub
                console.log("Removed from Telegram:", telegramId);
            } catch (err) {
                console.error("Error removing user:", err);
            }
        }
    }

    res.sendStatus(200);
});

// Start the local server
app.listen(3000, () => {
    console.log("Server running on port 3000");
});

