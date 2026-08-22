import { bot } from "./telegram";
import { incrementStat } from "./db";

let installed = false;

/**
 * Keeps the application tolerant of older helper options while sending only
 * current Telegram Bot API fields over the wire.
 */
export function installTelegramCompat() {
  if (installed) return;
  installed = true;

  const api: any = bot.api;

  const originalSendMessage = api.sendMessage.bind(api);
  api.sendMessage = async (chatId: number | string, text: string, options: any = {}) => {
    const { disable_web_page_preview, ...rest } = options || {};
    if (disable_web_page_preview !== undefined && rest.link_preview_options === undefined) {
      rest.link_preview_options = { is_disabled: Boolean(disable_web_page_preview) };
    }
    return originalSendMessage(chatId, text, rest);
  };

  const originalEditMessageCaption = api.editMessageCaption.bind(api);
  api.editMessageCaption = async (chatId: number | string, messageId: number, options: any = {}) => {
    const { link_preview_options, ...rest } = options || {};
    return originalEditMessageCaption(chatId, messageId, rest);
  };

  const originalSendSticker = api.sendSticker.bind(api);
  api.sendSticker = async (chatId: number | string, sticker: string, options: any = {}) => {
    const { reply_to_message_id, ...rest } = options || {};
    if (reply_to_message_id !== undefined && rest.reply_parameters === undefined) {
      rest.reply_parameters = { message_id: reply_to_message_id };
    }
    return originalSendSticker(chatId, sticker, rest);
  };

  const originalHandleUpdate = bot.handleUpdate.bind(bot);
  (bot as any).handleUpdate = async (update: any, webhookReply?: any) => {
    const message = update?.message;
    if (message?.entities?.some((entity: any) => entity.type === "bot_command" && entity.offset === 0)) {
      await incrementStat("commandsReceived");
    }
    return originalHandleUpdate(update, webhookReply);
  };
}
