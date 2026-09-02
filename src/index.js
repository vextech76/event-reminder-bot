const fs = require('fs');
const path = require('path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  Events,
  MessageFlags,
} = require('discord.js');
const { config } = require('./config');
const { ensureDataDir } = require('./services/store');
const { Scheduler } = require('./services/scheduler');
const { handleComponentInteraction } = require('./interactions/router');

ensureDataDir();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

/** @type {Collection<string, any>} */
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command?.data?.name) {
    client.commands.set(command.data.name, command);
  }
}

/** @type {Scheduler} */
let scheduler;

client.once(Events.ClientReady, (c) => {
  console.log(`[ready] Logged in as ${c.user.tag}`);
  scheduler = new Scheduler(client);
  scheduler.start();
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);
      return;
    }

    const handled = await handleComponentInteraction(interaction, client);
    if (!handled && (interaction.isRepliable?.() || interaction.isMessageComponent?.())) {
      // Unknown component — ignore quietly
    }
  } catch (err) {
    console.error('[interaction]', err);
    const payload = {
      content: 'Something went wrong with that interaction.',
      flags: MessageFlags.Ephemeral,
    };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else if (interaction.isRepliable?.()) {
        await interaction.reply(payload);
      }
    } catch {
      /* ignore */
    }
  }
});

process.on('SIGINT', () => {
  scheduler?.stop();
  client.destroy();
  process.exit(0);
});

client.login(config.token);
