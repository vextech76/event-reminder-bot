const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');

function eventCreateModal() {
  return new ModalBuilder()
    .setCustomId('ev:modal:create')
    .setTitle('Create event')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Title')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(256)
          .setPlaceholder('Raid night / AMA / Game night')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('start')
          .setLabel('Start time')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(64)
          .setPlaceholder('2026-08-15 19:00 · in 2 weeks · tomorrow 19:00')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(1000)
          .setPlaceholder('Details, voice channel, links…')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('image')
          .setLabel('Image URL (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(500)
          .setPlaceholder('https://…')
      )
    );
}

function remindSetModal() {
  return new ModalBuilder()
    .setCustomId('rm:modal:set')
    .setTitle('Set reminder')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('message')
          .setLabel('Message')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(2000)
          .setPlaceholder('Drink water 💧')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('when')
          .setLabel('When')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(64)
          .setPlaceholder('every 3h · in 2h · tomorrow 9:00 · 2026-08-15 19:00')
      )
    );
}

module.exports = { eventCreateModal, remindSetModal };
