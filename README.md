# Nancy Queen Bot

Nancy Queen is a Telegram channel automation bot rebuilt for **Vercel + MongoDB**. The original channel-management features are preserved while the long-running Pyrogram process and PostgreSQL/SQLAlchemy database have been replaced with webhook-based Telegram Bot API handlers and MongoDB persistence.

## Features

- Add and manage Telegram channels from private chat
- Automatically add captions to channel posts
- Caption placement: below, above, or replace
- Automatically add URL buttons
- Automatically send a sticker after a post
- Edit mode: media only or all posts
- Webpage preview toggle
- Optional mandatory-join channel gate
- `/start`, `/help`, `/about`, `/channels`, `/add`, `/report`, `/cancel`, and admin-only `/stats`
- MongoDB-backed user, channel, conversation, and usage statistics
- Protected web dashboard with live sidebar statistics

## Vercel deployment

1. Import this repository into Vercel.
2. Add the environment variables below to the **Production** environment.
3. Deploy the project.
4. Send a `POST` request to `https://YOUR-DOMAIN/api/telegram/setup` once after deployment with the `x-bot-setup-secret: YOUR_BOT_SETUP_SECRET` header. This sets the Telegram webhook and bot commands.
5. Open `https://YOUR-DOMAIN/` to use the dashboard.

The setup endpoint uses your production `NEXT_PUBLIC_APP_URL`. Keep `BOT_SETUP_SECRET` private and send it only in the request header.

## Environment variables

```env
BOT_TOKEN=
MONGODB_URI=
MONGODB_DB=nancy_queen

# Optional mandatory-join channel/group. Example: @Purohit_bots
MUST_JOIN=

# Telegram user ID allowed to use /stats
ADMIN_USER_ID=

# Telegram webhook verification
TELEGRAM_WEBHOOK_SECRET=

# Secret required by /api/telegram/setup
BOT_SETUP_SECRET=
NEXT_PUBLIC_APP_URL=https://your-production-domain.vercel.app

# Dashboard login
DASHBOARD_PASSWORD=
DASHBOARD_SESSION_SECRET=
```

## MongoDB

Use a MongoDB Atlas cluster or another MongoDB-compatible deployment. The application creates indexes for users, channels, sessions, and the statistics document automatically on first request.

## Dashboard

The root page (`/`) provides a protected dashboard with live statistics for users, managed channels, posts processed, posts modified, captions applied, buttons applied, stickers sent, commands, channel changes, errors, and MongoDB connection status.

## Branding

All old `@Developerr_Bots` references have been removed from the rebuilt application and replaced with **@Purohit_bots**.
