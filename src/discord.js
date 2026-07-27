const { Client, GatewayIntentBits, Partials } = require('discord.js');

const OWNER_ID = process.env.OWNER_DISCORD_USER_ID;
const CHECK_EMOJI = '✅';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions,
  ],
  // Partials let messageCreate/reaction events fire reliably for DMs and for
  // messages sent before the bot's cache had them (e.g. after a restart).
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

// onMessage(text): called when you send the bot a plain text message.
// onReaction(messageId): called when you react with the checkmark emoji on
// any message the bot sent (a ping or a filed-ticket confirmation).
function start(onMessage, onReaction) {
  client.once('ready', () => {
    console.log(`Discord bot logged in as ${client.user.tag}`);
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.author.id !== OWNER_ID) return; // only you can file/close tickets
    await onMessage(message.content, message);
  });

  if (onReaction) {
    client.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return;
      if (user.id !== OWNER_ID) return;
      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (err) {
          return; // message/reaction no longer available, ignore
        }
      }
      if (reaction.emoji.name !== CHECK_EMOJI) return;
      await onReaction(reaction.message.id);
    });
  }

  client.login(process.env.DISCORD_BOT_TOKEN);
}

// Sends a DM and returns the sent Message object (or null on failure) so the
// caller can react to it / remember its ID for later reaction-based closing.
async function sendDM(text) {
  try {
    const user = await client.users.fetch(OWNER_ID);
    return await user.send(text);
  } catch (err) {
    console.error('Failed to send Discord DM:', err.message);
    return null;
  }
}

// Adds the checkmark reaction to a message so you can just tap it to close
// the ticket it's about, instead of typing anything.
async function addCheckReaction(message) {
  if (!message) return;
  try {
    await message.react(CHECK_EMOJI);
  } catch (err) {
    console.error('Failed to add reaction:', err.message);
  }
}

module.exports = { start, sendDM, addCheckReaction, CHECK_EMOJI };
