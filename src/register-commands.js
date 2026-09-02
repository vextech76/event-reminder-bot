const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { config } = require('./config');

async function loadCommandData() {
  const dir = path.join(__dirname, 'commands');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
  return files.map((file) => {
    const cmd = require(path.join(dir, file));
    return cmd.data.toJSON();
  });
}

async function registerCommands() {
  const body = await loadCommandData();
  const rest = new REST({ version: '10' }).setToken(config.token);

  if (config.guildId) {
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body }
    );
    console.log(
      `[commands] Registered ${body.length} guild command(s) for ${config.guildId}`
    );
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body });
    console.log(`[commands] Registered ${body.length} global command(s)`);
  }
}

if (require.main === module) {
  registerCommands()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[commands] Registration failed:', err);
      process.exit(1);
    });
}

module.exports = { registerCommands, loadCommandData };
