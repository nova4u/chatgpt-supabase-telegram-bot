import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  Bot,
  Context,
  webhookCallback,
} from "https://deno.land/x/grammy@v1.8.3/mod.ts";
import {
  clearUserMessageHistory,
  formatMessageHistory,
  getAiResponse,
  getUserId,
  getUserMessageHistory,
  Message,
  updateUserMessageHistory,
} from "./utils.ts";

const users: string[] = JSON.parse(Deno.env.get("USERS") || "[]");
const botToken = Deno.env.get("BOT_TOKEN") || "";

if (!botToken) {
  throw new Error(`Please specify the Telegram Bot Token.`);
}

if (!users.length) {
  throw new Error(`Please specify the users that have access to the bot.`);
}

const bot = new Bot<BotContext>(botToken);

type BotContext = Context & {
  config: {
    isOwner: boolean;
  };
};

bot.use(async (ctx, next) => {
  ctx.config = {
    isOwner: users.some((user) => ctx.from?.username === user),
  };

  if (!ctx.config.isOwner) {
    return ctx.reply(`Sorry, you are not allowed. This is personal AI Bot`);
  }

  await next();
});

bot.command("start", (ctx) =>
  ctx.reply("Welcome! I will be your personal AI Assistant.")
);

bot.command("ping", (ctx) => ctx.reply(`Pong! ${new Date()} ${Date.now()}`));

bot.command("history", async (ctx) => {
  const userId = getUserId(ctx);
  if (!userId) return ctx.reply(`No User Found`);

  const history = await getUserMessageHistory(userId);

  // Format the message and filter out the initial prompt.
  return ctx.reply(
    formatMessageHistory(history.filter((m) => m.role !== "system")) ||
      "History is empty",
    {}
  );
});

bot.errorBoundary((err) => {
  console.error(err);
});

bot.command("clear", async (ctx) => {
  const userId = getUserId(ctx);

  if (!userId) {
    return ctx.reply(`No User Found`);
  }

  await clearUserMessageHistory(userId);

  return ctx.reply(`Your dialogue has been cleared`);
});

bot.on("message", async (ctx) => {
  try {
    const userId = ctx?.from?.id;
    const receivedMessage = ctx.update.message.text;

    if (!receivedMessage) {
      ctx.reply(`No message`);
    }

    const history = await getUserMessageHistory(userId);

    const message: Message = {
      role: "user",
      content: receivedMessage || "",
    };

    const aiResponse = await getAiResponse([...history, message]);

    await updateUserMessageHistory(userId, [
      ...history,
      message,
      { role: "assistant", content: aiResponse + "\n" },
    ]);

    await ctx.reply(aiResponse).catch((e) => console.error(e));
  } catch (error) {
    console.error(error);
    ctx.reply(`Sorry an error has occured, please try again later.`);
  }
});

const handleUpdate = webhookCallback(bot, "std/http", "throw", 40_000);

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const isAllowed =
      url.searchParams.get("secret") === Deno.env.get("FUNCTION_SECRET");

    if (!isAllowed) {
      return new Response("not allowed", { status: 405 });
    }

    return await handleUpdate(req);
  } catch (err) {
    console.error(err);
  }
});
