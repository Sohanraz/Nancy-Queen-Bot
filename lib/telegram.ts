import { Bot, Context, InlineKeyboard, Keyboard, Update } from "grammy";
import {
  clearSession,
  getChannel,
  getDashboardStats,
  getSession,
  getUserChannels,
  incrementStat,
  removeChannel,
  removeUserChannel,
  setSession,
  updateChannel,
  upsertChannel,
  ensureUser,
  addUserChannel,
} from "./db";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is not configured");

export const bot = new Bot(token);

const BRAND = "@Purohit_bots";
const SUPPORT_URL = "https://t.me/Purohit_bots";
const UPDATES_URL = "https://t.me/Purohit_bots";
const SESSION_TTL_MS = 5 * 60 * 1000;

const homeButtons = () => new InlineKeyboard().text("🏠 ʀᴇᴛᴜʀɴ ʜᴏᴍᴇ 🏠", "home");

function mainInlineKeyboard() {
  return new InlineKeyboard()
    .url("✨ sᴜᴘᴘᴏʀᴛ ✨", SUPPORT_URL)
    .row()
    .text("ʜᴇʟᴘ❔", "help")
    .text("🎪 ᴀʙᴏᴜᴛ 🎪", "about")
    .row()
    .url("🤖 ᴜᴘᴅᴀᴛᴇs", UPDATES_URL);
}

function mainReplyKeyboard() {
  return new Keyboard()
    .text("+ Add Channels +")
    .row()
    .text("Manage Channels")
    .row()
    .text("Report a Problem")
    .resized()
    .oneTime();
}

function htmlEscape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function sliceUtf16(text: string, start: number, length: number) {
  const bytes = Buffer.from(text, "utf16le");
  return bytes.subarray(start * 2, (start + length) * 2).toString("utf16le");
}

function entityTag(entity: any, open: boolean) {
  if (!open) {
    switch (entity.type) {
      case "bold": return "</b>";
      case "italic": return "</i>";
      case "underline": return "</u>";
      case "strikethrough": return "</s>";
      case "code": return "</code>";
      case "pre": return "</pre>";
      case "text_link":
      case "text_mention": return "</a>";
      default: return "";
    }
  }
  switch (entity.type) {
    case "bold": return "<b>";
    case "italic": return "<i>";
    case "underline": return "<u>";
    case "strikethrough": return "<s>";
    case "code": return "<code>";
    case "pre": return "<pre>";
    case "text_link": return `<a href="${htmlEscape(entity.url || "")}">`;
    case "text_mention": return entity.user?.id ? `<a href="tg://user?id=${entity.user.id}">` : "";
    case "url": return `<a href="${htmlEscape(entity.url || "")}">`;
    case "email": return `<a href="mailto:${htmlEscape(entity.email || "")}">`;
    default: return "";
  }
}

function messageTextToHtml(message: any): string {
  const text = message.text ?? message.caption ?? "";
  const entities = message.entities ?? message.caption_entities ?? [];
  if (!text || entities.length === 0) return htmlEscape(text);

  type Boundary = { offset: number; kind: "open" | "close"; entity: any };
  const boundaries: Boundary[] = [];
  for (const entity of entities) {
    if (entity.offset == null || entity.length == null) continue;
    boundaries.push({ offset: entity.offset, kind: "open", entity });
    boundaries.push({ offset: entity.offset + entity.length, kind: "close", entity });
  }

  boundaries.sort((a, b) => {
    if (a.offset !== b.offset) return a.offset - b.offset;
    if (a.kind !== b.kind) return a.kind === "close" ? -1 : 1;
    return a.kind === "open" ? (b.entity.length ?? 0) - (a.entity.length ?? 0) : (a.entity.length ?? 0) - (b.entity.length ?? 0);
  });

  let result = "";
  let cursor = 0;
  for (const boundary of boundaries) {
    if (boundary.offset > cursor) {
      result += htmlEscape(sliceUtf16(text, cursor, boundary.offset - cursor));
      cursor = boundary.offset;
    }
    const tag = entityTag(boundary.entity, boundary.kind === "open");
    if (tag) result += tag;
  }
  if (cursor < Array.from(Buffer.from(text, "utf16le")).length / 2) {
    result += htmlEscape(sliceUtf16(text, cursor, text.length - cursor));
  }
  return result;
}

function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (/^(https?|tg):\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("www.")) return `https://${trimmed}`;
  return `https://${trimmed}`;
}

function parseButtons(value?: string | null) {
  if (!value) return undefined;
  const rows = value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split("|").map((entry) => {
      const separator = entry.indexOf("-");
      if (separator <= 0) throw new Error("Invalid button format");
      const text = entry.slice(0, separator).trim();
      const url = normalizeUrl(entry.slice(separator + 1).trim());
      return { text, url };
    }));

  return { inline_keyboard: rows };
}

async function replyUser(ctx: Context, html: string, extra: any = {}) {
  return ctx.reply(html, { parse_mode: "HTML", ...extra });
}

async function startFlow(ctx: Context) {
  if (!ctx.from || !ctx.chat) return;
  await ensureUser(ctx.from.id, {
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name,
    username: ctx.from.username,
  });
  await incrementStat("messagesReceived");
  await replyUser(ctx, `Hey ${htmlEscape(ctx.from.first_name || "there")}\n\nWelcome to <b>Nancy Queen</b>\n\nYou can use me to manage channels with tons of features. Use the buttons below to learn more!\n\nBy ${BRAND}`, {
    reply_markup: mainInlineKeyboard(),
  });
  await replyUser(ctx, "Use below buttons to interact with me", { reply_markup: mainReplyKeyboard() });
}

async function helpFlow(ctx: Context) {
  await replyUser(ctx, `<b>Here's How to use me</b>\n\nEverything is self explanatory after you add a channel.\nTo add a channel use the <b>Add Channels</b> button or /add.\n\n<b>Available Commands</b>\n/about - About the Bot\n/help - This Message\n/start - Start the Bot\n\n<b>Alternative Commands</b>\n/channels - List added Channels\n/add - Add a channel\n/report - Report a Problem`, { reply_markup: homeButtons() });
}

async function aboutFlow(ctx: Context) {
  await replyUser(ctx, `<b>About This Bot</b>\n\nA Telegram channel automation bot by ${BRAND}\n\nFramework: Telegram Bot API + grammY\nLanguage: TypeScript\nDatabase: MongoDB\nDeveloper: ${BRAND}`, { reply_markup: homeButtons() });
}

async function reportFlow(ctx: Context) {
  await replyUser(ctx, `<b>Report a Problem</b>\n\nIf something <b>unexpected</b> happens, you can report it to us. You can also suggest features.\n\n<b>Steps</b>\n1) Try whatever you did again. If it shows the same unexpected thing, move to step 2.\n2) Visit ${BRAND} and define your problem completely: what you expected and what happened instead.\n\nSupport: ${BRAND}`, {
    reply_markup: new InlineKeyboard().url("Support", SUPPORT_URL),
  });
}

async function manageChannelsFlow(ctx: Context) {
  if (!ctx.from) return;
  const channels = await getUserChannels(ctx.from.id);
  if (!channels.length) {
    await replyUser(ctx, "No Channels Found. Add a channel using the button below.", { reply_markup: new Keyboard().text("+ Add Channels +").resized() });
    return;
  }

  const keyboard = new InlineKeyboard();
  let visible = 0;
  for (const channelId of channels) {
    try {
      const chat = await ctx.api.getChat(channelId);
      keyboard.text(chat.title || String(channelId), `settings+${channelId}`).row();
      visible++;
    } catch {
      await removeUserChannel(ctx.from.id, channelId);
      await removeChannel(channelId);
    }
  }

  if (!visible) {
    await replyUser(ctx, "No Channels Found. Add a channel using the button below.", { reply_markup: new Keyboard().text("+ Add Channels +").resized() });
    return;
  }
  await replyUser(ctx, "Below are your channels.", { reply_markup: keyboard });
}

async function settingsData(channelId: number, ctx: Context) {
  const channel = await getChannel(channelId);
  if (!channel) return null;
  let title = channel.title || String(channelId);
  try {
    const chat = await ctx.api.getChat(channelId);
    title = chat.title || title;
  } catch {
    // Keep cached title.
  }

  const position = channel.position || "below";
  const editMode = channel.editMode || "media";
  const preview = channel.webpagePreview ? "True" : "False";
  const text = `<b>${htmlEscape(title)}</b> (<code>${channelId}</code>)\n\n` +
    `<b>Caption</b>: ${channel.caption ? "Set" : "Not Set"}\n\n` +
    `<b>Caption Position</b>: ${position[0].toUpperCase() + position.slice(1)} the previous caption\n\n` +
    `<b>Buttons</b>: ${channel.buttons ? "Set" : "Not Set"}\n\n` +
    `<b>Edit Mode</b>: ${editMode[0].toUpperCase() + editMode.slice(1)} Messages\n\n` +
    `<b>Sticker</b>: ${channel.stickerId ? "Set (Sent Above)" : "Not Set"}\n\n` +
    `<b>Webpage Preview</b>: ${preview}\n`;

  const keyboard = new InlineKeyboard()
    .text("📝 Caption", `change+caption+${channelId}`)
    .text("🔗 Buttons", `change+buttons+${channelId}`).row()
    .text(`🍃 Caption Mode : ${position[0].toUpperCase() + position.slice(1)}`, `change+position+${channelId}+${position}`).row()
    .text("🌅 Sticker", `change+sticker+${channelId}`).row()
    .text(`✏️ Edit Mode : ${editMode[0].toUpperCase() + editMode.slice(1)}`, `change+edit_mode+${channelId}+${editMode}`).row()
    .text(`📖 Webpage Preview : ${preview}`, `change+webpage_preview+${channelId}+${preview}`).row()
    .text("🗑 Remove Channel", `remove+${channelId}`).row()
    .text("<-- Back", "home+channels");

  return { text, keyboard, stickerId: channel.stickerId ?? null };
}

async function showSettings(ctx: Context, channelId: number) {
  const data = await settingsData(channelId, ctx);
  if (!data) return false;
  await replyUser(ctx, data.text, { reply_markup: data.keyboard });
  if (data.stickerId && ctx.chat) await ctx.api.sendSticker(ctx.chat.id, data.stickerId);
  return true;
}

async function beginSession(ctx: Context, action: "add-channel" | "caption" | "buttons" | "sticker", channelId?: number) {
  if (!ctx.from) return;
  await setSession({
    userId: ctx.from.id,
    action,
    channelId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
}

async function addChannelFlow(ctx: Context) {
  if (!ctx.from || !ctx.chat) return;
  await beginSession(ctx, "add-channel");
  await replyUser(ctx, `Please add me as <b>admin</b> with at least <b>Post Messages</b> and <b>Edit message of others</b> rights to the desired channel.\n\nAfter that, forward a message from the channel.\n\nCancel using /cancel. If there is no reply in 5 minutes, this action is automatically cancelled.`);
}

function getForwardedChannel(message: any) {
  const origin = message.forward_origin;
  if (origin?.type === "channel" && origin.chat) return origin.chat;
  if (message.forward_from_chat?.type === "channel") return message.forward_from_chat;
  return null;
}

async function processAddChannel(ctx: Context) {
  if (!ctx.from || !ctx.message) return true;
  const message: any = ctx.message;
  const channel = getForwardedChannel(message);
  if (!channel) {
    await replyUser(ctx, "Please forward a channel message or /cancel the process.");
    return true;
  }

  const me = await ctx.api.getMe();
  try {
    const botMember: any = await ctx.api.getChatMember(channel.id, me.id);
    const userMember: any = await ctx.api.getChatMember(channel.id, ctx.from.id);

    const botCanPost = botMember.status === "administrator" && botMember.can_post_messages;
    const botCanEdit = botMember.status === "administrator" && botMember.can_edit_messages;
    const userIsAdmin = userMember.status === "administrator" || userMember.status === "creator";

    if (!botCanPost || !botCanEdit) {
      await replyUser(ctx, "I'm admin but I don't have both necessary rights: <b>Post Messages</b> and <b>Edit message of others</b>. Please fix the permissions and forward the message again.");
      return true;
    }
    if (!userIsAdmin) {
      await replyUser(ctx, "I'm admin but you are not an admin there. I can't allow this.");
      await clearSession(ctx.from.id);
      return true;
    }

    const existing = await getChannel(channel.id);
    if (existing) {
      try {
        const previousAdmin: any = await ctx.api.getChatMember(channel.id, existing.adminId);
        if (previousAdmin.status === "administrator" || previousAdmin.status === "creator") {
          const admin = await ctx.api.getChatMember(channel.id, existing.adminId).catch(() => null);
          await replyUser(ctx, `This channel is already added${admin?.user?.first_name ? ` by <b>${htmlEscape(admin.user.first_name)}</b>` : ""}.`);
          await clearSession(ctx.from.id);
          return true;
        }
      } catch {
        // Previous admin is gone; reclaim the channel for this admin.
      }
    }

    await ensureUser(ctx.from.id, { firstName: ctx.from.first_name, lastName: ctx.from.last_name, username: ctx.from.username });
    await addUserChannel(ctx.from.id, channel.id);
    await upsertChannel({
      channelId: channel.id,
      adminId: ctx.from.id,
      title: channel.title,
      caption: null,
      buttons: null,
      position: "below",
      stickerId: null,
      editMode: "media",
      webpagePreview: false,
    });
    await clearSession(ctx.from.id);
    await incrementStat("channelsAdded");
    await replyUser(ctx, "Thanks for choosing me. Now start managing this channel by customizing the settings below.");
    await showSettings(ctx, channel.id);
  } catch (error) {
    await incrementStat("errors");
    await replyUser(ctx, "I'm still not able to access that channel. Please confirm that I'm an administrator and try forwarding a channel post again.");
  }
  return true;
}

async function handleSession(ctx: Context) {
  if (!ctx.from || !ctx.message) return false;
  if (ctx.chat?.type !== "private") return false;
  const session = await getSession(ctx.from.id);
  if (!session) return false;

  const message: any = ctx.message;
  if (message.text === "/cancel") {
    await clearSession(ctx.from.id);
    await replyUser(ctx, "Cancelled.");
    return true;
  }

  if (session.action === "add-channel") return processAddChannel(ctx);

  if (!session.channelId) {
    await clearSession(ctx.from.id);
    return false;
  }

  if (session.action === "caption") {
    if (!message.text) {
      await replyUser(ctx, "Please send the caption as a text message or /cancel.");
      return true;
    }
    const caption = messageTextToHtml(message);
    await updateChannel(session.channelId, { caption });
    await clearSession(ctx.from.id);
    await incrementStat("captionsApplied");
    await replyUser(ctx, "Caption set successfully!");
    await showSettings(ctx, session.channelId);
    return true;
  }

  if (session.action === "buttons") {
    if (!message.text) {
      await replyUser(ctx, "Please send the buttons text or /cancel.");
      return true;
    }
    try {
      parseButtons(message.text);
      await updateChannel(session.channelId, { buttons: message.text });
      await clearSession(ctx.from.id);
      await incrementStat("buttonsApplied");
      await replyUser(ctx, "Buttons set successfully!");
      await showSettings(ctx, session.channelId);
    } catch {
      await replyUser(ctx, "Wrong format for buttons. Use:\n<code>Google - google.com | Telegram - telegram.org</code>\n\nFor multiple rows, put each row on a new line. Try again or /cancel.");
    }
    return true;
  }

  if (session.action === "sticker") {
    if (!message.sticker?.file_id) {
      await replyUser(ctx, "Please send a sticker or /cancel.");
      return true;
    }
    await updateChannel(session.channelId, { stickerId: message.sticker.file_id });
    await clearSession(ctx.from.id);
    await replyUser(ctx, "Sticker set successfully!");
    await showSettings(ctx, session.channelId);
    return true;
  }

  return false;
}

async function applyChannelPost(ctx: Context) {
  const message: any = ctx.channelPost;
  if (!message) return;
  await incrementStat("postsProcessed");

  const channel = await getChannel(message.chat.id);
  if (!channel) return;
  if (channel.editMode === "media" && !(
    message.photo || message.video || message.document || message.audio || message.animation || message.sticker
  )) return;

  const hasText = Boolean(message.text || message.caption);
  let content: string | null = null;
  if (channel.caption) {
    const original = hasText ? messageTextToHtml(message) : "";
    if (channel.position === "above") content = original ? `${channel.caption}<br><br>${original}` : channel.caption;
    else if (channel.position === "replace") content = channel.caption;
    else content = original ? `${original}<br><br>${channel.caption}` : channel.caption;
  }

  const replyMarkup = channel.buttons ? parseButtons(channel.buttons) : undefined;
  const linkPreviewOptions = { is_disabled: !channel.webpagePreview };

  try {
    if (content && (message.text || message.caption)) {
      if (message.caption !== undefined) {
        await ctx.api.editMessageCaption(message.chat.id, message.message_id, {
          caption: content,
          parse_mode: "HTML",
          reply_markup: replyMarkup,
          link_preview_options: linkPreviewOptions,
        });
      } else {
        await ctx.api.editMessageText(message.chat.id, message.message_id, {
          text: content,
          parse_mode: "HTML",
          reply_markup: replyMarkup,
          link_preview_options: linkPreviewOptions,
        });
      }
    } else if (content && (message.photo || message.video || message.document || message.audio || message.animation)) {
      await ctx.api.editMessageCaption(message.chat.id, message.message_id, {
        caption: content,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
    } else if (replyMarkup && (message.text || message.caption)) {
      if (message.caption !== undefined) {
        await ctx.api.editMessageCaption(message.chat.id, message.message_id, { reply_markup: replyMarkup });
      } else {
        await ctx.api.editMessageText(message.chat.id, message.message_id, { reply_markup: replyMarkup });
      }
    }

    if (channel.stickerId) {
      await ctx.api.sendSticker(message.chat.id, channel.stickerId, { reply_to_message_id: message.message_id });
      await incrementStat("stickersSent");
    }
    if (content) await incrementStat("postsModified");
  } catch {
    await incrementStat("errors");
  }
}

// Commands
bot.command("start", async (ctx) => startFlow(ctx));
bot.command("help", async (ctx) => helpFlow(ctx));
bot.command("about", async (ctx) => aboutFlow(ctx));
bot.command("report", async (ctx) => reportFlow(ctx));
bot.command("add", async (ctx) => addChannelFlow(ctx));
bot.command("channels", async (ctx) => manageChannelsFlow(ctx));
bot.command("cancel", async (ctx) => {
  if (ctx.from) await clearSession(ctx.from.id);
  await replyUser(ctx, "Cancelled.");
});
bot.command("stats", async (ctx) => {
  if (!ctx.from) return;
  const adminId = Number(process.env.ADMIN_USER_ID || 0);
  if (!adminId || ctx.from.id !== adminId) return;
  const stats = await getDashboardStats();
  await replyUser(ctx, `<b>Nancy Queen Stats</b>\n\nUsers: <b>${stats.users}</b>\nChannels: <b>${stats.channels}</b>\nPosts processed: <b>${stats.postsProcessed}</b>\nPosts modified: <b>${stats.postsModified}</b>\nStickers sent: <b>${stats.stickersSent}</b>`);
});

// Main private-menu shortcuts.
bot.hears("+ Add Channels +", async (ctx) => addChannelFlow(ctx));
bot.hears("Manage Channels", async (ctx) => manageChannelsFlow(ctx));
bot.hears("Report a Problem", async (ctx) => reportFlow(ctx));

bot.on("callback_query:data", async (ctx) => {
  const query = ctx.callbackQuery.data.toLowerCase();
  await ctx.answerCallbackQuery();

  if (query === "home") {
    await ctx.editMessageText(`Welcome to <b>Nancy Queen</b>\n\nYou can use me to manage channels with tons of features. Use the buttons below to learn more!\n\nBy ${BRAND}`, { parse_mode: "HTML", reply_markup: mainInlineKeyboard() });
    return;
  }
  if (query === "help") return helpFlow(ctx);
  if (query === "about") return aboutFlow(ctx);
  if (query === "home+channels") return manageChannelsFlow(ctx);

  const parts = query.split("+");
  const action = parts[0];
  if (action === "settings" && parts[1]) {
    const channelId = Number(parts[1]);
    const data = await settingsData(channelId, ctx);
    if (!data) {
      await ctx.reply("Channel Not Found. Please add it again!");
      return;
    }
    await ctx.editMessageText(data.text, { parse_mode: "HTML", reply_markup: data.keyboard });
    return;
  }

  if (action === "change" && parts[1] && parts[2]) {
    const change = parts[1];
    const channelId = Number(parts[2]);
    const channel = await getChannel(channelId);
    if (!channel) {
      await ctx.reply("Channel Not Found. Please add it again!");
      return;
    }

    if (change === "caption") {
      const kb = new InlineKeyboard();
      if (channel.caption) kb.text("Change Caption", `add+caption+${channelId}`).row().text("Remove Caption", `remove+caption+${channelId}`).row();
      else kb.text("Add Caption", `add+caption+${channelId}`).row();
      kb.text("<-- Back to Channel Settings", `settings+${channelId}`);
      await ctx.editMessageText(channel.caption ? `Current caption is:\n\n${channel.caption}\n\nUse the buttons below to change or remove it.` : "No caption set. Use the button below to add it.", { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    if (change === "buttons") {
      const kb = new InlineKeyboard();
      if (channel.buttons) kb.text("Change URL Buttons", `add+buttons+${channelId}`).row().text("Remove URL Buttons", `remove+buttons+${channelId}`).row();
      else kb.text("Add Buttons", `add+buttons+${channelId}`).row();
      kb.text("<-- Back to Channel Settings", `settings+${channelId}`);
      await ctx.editMessageText(channel.buttons ? `Current buttons are:\n\n<code>${htmlEscape(channel.buttons)}</code>` : "No buttons set. Use the button below to add them.", { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    if (change === "sticker") {
      const kb = new InlineKeyboard();
      if (channel.stickerId) kb.text("Show Current Sticker", `show+${channelId}`).row().text("Change Sticker", `add+sticker+${channelId}`).row().text("Remove Sticker", `remove+sticker+${channelId}`).row();
      else kb.text("Add Sticker", `add+sticker+${channelId}`).row();
      kb.text("<-- Back to Channel Settings", `settings+${channelId}`);
      await ctx.editMessageText(channel.stickerId ? "A sticker is already set. See it with <b>Show Current Sticker</b>." : "No sticker set. Use the button below to add it.", { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    if (change === "position") {
      const current = parts[3] || channel.position;
      const next = current === "below" ? "above" : current === "above" ? "replace" : "below";
      await updateChannel(channelId, { position: next as any });
      const data = await settingsData(channelId, ctx);
      if (data) await ctx.editMessageText(data.text, { parse_mode: "HTML", reply_markup: data.keyboard });
      return;
    }

    if (change === "edit_mode") {
      const current = parts[3] || channel.editMode;
      const next = current === "all" ? "media" : "all";
      await updateChannel(channelId, { editMode: next as any });
      const data = await settingsData(channelId, ctx);
      if (data) await ctx.editMessageText(data.text, { parse_mode: "HTML", reply_markup: data.keyboard });
      return;
    }

    if (change === "webpage_preview") {
      const current = (parts[3] || String(channel.webpagePreview)).toLowerCase() === "true";
      await updateChannel(channelId, { webpagePreview: !current });
      const data = await settingsData(channelId, ctx);
      if (data) await ctx.editMessageText(data.text, { parse_mode: "HTML", reply_markup: data.keyboard });
      return;
    }
  }

  if (action === "add" && parts[1] && parts[2]) {
    const change = parts[1] as "caption" | "buttons" | "sticker";
    const channelId = Number(parts[2]);
    await beginSession(ctx, change, channelId);
    if (change === "caption") await replyUser(ctx, "Please send the new caption or /cancel. Anything you send now will be set as the caption.");
    else if (change === "buttons") await replyUser(ctx, "<b>Buttons Format</b>\n<code>Google - google.com | Telegram - telegram.org</code>\n\nFor multiple rows, write each row on a new line. Send the buttons or /cancel.");
    else await replyUser(ctx, "Please send a sticker or /cancel.");
    return;
  }

  if (action === "remove") {
    const type = parts[1];
    if (!type) return;
    if (!parts[2]) {
      const channelId = Number(type);
      await removeChannel(channelId);
      if (ctx.from) await removeUserChannel(ctx.from.id, channelId);
      await incrementStat("channelsRemoved");
      await replyUser(ctx, "Removed Channel Successfully.");
      await manageChannelsFlow(ctx);
      return;
    }
    const channelId = Number(parts[2]);
    if (type === "caption") await updateChannel(channelId, { caption: null });
    if (type === "buttons") await updateChannel(channelId, { buttons: null });
    if (type === "sticker") await updateChannel(channelId, { stickerId: null });
    const data = await settingsData(channelId, ctx);
    if (data) await ctx.editMessageText(data.text, { parse_mode: "HTML", reply_markup: data.keyboard });
    return;
  }

  if (action === "show" && parts[1]) {
    const channel = await getChannel(Number(parts[1]));
    if (channel?.stickerId && ctx.chat) {
      await ctx.api.sendSticker(ctx.chat.id, channel.stickerId);
      await replyUser(ctx, "This is the current sticker.");
    }
    return;
  }
});

bot.on("message", async (ctx) => {
  if (ctx.from) {
    await ensureUser(ctx.from.id, { firstName: ctx.from.first_name, lastName: ctx.from.last_name, username: ctx.from.username });
  }
  await incrementStat("messagesReceived");
  if (await handleSession(ctx)) return;
});

bot.on("channel_post", async (ctx) => {
  await applyChannelPost(ctx);
});

export async function processUpdate(update: Update) {
  await bot.handleUpdate(update);
}

export async function configureBot(baseUrl: string) {
  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  await bot.api.setWebhook(webhookUrl, {
    secret_token: secret,
    allowed_updates: ["message", "callback_query", "channel_post", "edited_channel_post"],
  });
  await bot.api.setMyCommands([
    { command: "start", description: "Start the bot" },
    { command: "channels", description: "Manage your channels" },
    { command: "add", description: "Add a channel" },
    { command: "help", description: "Show help" },
    { command: "about", description: "About the bot" },
    { command: "report", description: "Report a problem" },
    { command: "cancel", description: "Cancel the current action" },
  ]);
  return webhookUrl;
}
