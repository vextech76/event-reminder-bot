# Event Reminder Bot

Discord bot for:

1. **Events** — create with a slash command; auto-post reminders **1 month, 1 week, 1 day, 1 hour** before start, plus **starting now**.
2. **Channel reminders** — one-off or recurring (`every 3h`) posts in a channel.

Stack matches FlashBot: Node 20, discord.js v14, JSON persistence, optional Docker.

## Commands (modal + ephemeral dropdowns)

### `/event create`
1. Opens a **modal**: title, start time, description, image URL  
2. Then an **ephemeral panel** with:
   - **Channel** dropdown (defaults to current channel)
   - **Role** dropdown (optional ping)
   - **Reminders** multi-select (1 month · 1 week · 1 day · 1 hour · at start)
   - **Create event** / **Cancel** buttons  

Past offsets at create time are skipped. Selected times are shown on the public event embed.

### `/event config`
Server-wide **default** reminder offsets for new events (ephemeral multi-select). Per-event create can still override.

Also: `/event list` (ephemeral), `/event cancel` (ephemeral **dropdown** of events).

### `/remind set`
1. Opens a **modal**: message + when (`every 3h`, `in 2h`, `tomorrow 9:00`, …)  
2. Then an **ephemeral panel** with channel dropdown, optional ping role, confirm/cancel.

Also: `/remind list` (ephemeral), `/remind cancel` (ephemeral **dropdown**).

Draft panels expire after **15 minutes**. Only the user who started a flow can use its controls.

## Setup

1. Create a Discord application + bot at [Discord Developer Portal](https://discord.com/developers/applications).
2. Invite the bot with scopes **`bot`** + **`applications.commands`**, and permissions:
   - View Channels
   - Send Messages
   - Embed Links
   - Mention Everyone *(only if you use role pings; or grant the bot permission to ping specific roles)*
3. Copy `.env.example` → `.env` and fill in:

```env
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...          # optional: instant guild command register while testing
DEFAULT_TIMEZONE=America/New_York
```

4. Install and register commands:

```bash
cd event-reminder-bot
npm install
npm run register
npm start
```

### Docker (home server)

Target: `vincent@192.168.0.252` → `~/event-reminder-bot`

From your workstation (with local `.env` filled in — **does not run the bot locally**):

```bash
python deploy_remote.py
```

That uploads code + `.env`, runs `docker compose up -d --build` on the server, and registers slash commands inside the container.

Manual ops on the server:

```bash
ssh vincent@192.168.0.252
cd ~/event-reminder-bot
docker compose ps
docker compose logs -f --tail=100
docker compose restart
```

Data lives in `./data` on the server (`events.json`, `reminders.json`, `jobs.json`).

## How scheduling works

- Jobs are stored as UTC epoch ms in `data/jobs.json`.
- A poll loop (default every 30s) posts anything with `fireAt <= now`.
- Safe across restarts; recurring reminders enqueue the next job after each fire.
- Event offsets already in the past when you create the event are skipped (e.g. create an event 8 days out → you get 1 week, 1 day, 1 hour, and at-start — not 1 month).

## Permissions

- `/event *` defaults to **Manage Server**.
- `/remind *` defaults to **Manage Messages**.

## Out of scope (MVP)

Native Discord Scheduled Events sync, RSVP buttons, Google Calendar, web dashboard, multi-occurrence recurring events.
