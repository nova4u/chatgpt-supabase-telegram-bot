import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  Bot,
  Context,
  GrammyError,
  HttpError,
  webhookCallback,
} from "https://deno.land/x/grammy@v1.8.3/mod.ts";

import { Menu } from "https://deno.land/x/grammy_menu@v1.1.3/mod.ts";

import {
  changeSettings,
  checkUserSettings,
  clearUserMessageHistory,
  createInitialUserSettings,
  estimateTokens,
  formatMessageHistory,
  getAiResponse,
  getUserChatModel,
  getUserId,
  getUserMessageHistory,
  Message,
  updateUserMessageHistory,
} from "./utils.ts";

const botToken = Deno.env.get("BOT_TOKEN") || "";
if (!botToken) {
  throw new Error(`Please specify the Telegram Bot Token.`);
}

const users: string[] = JSON.parse(Deno.env.get("USERS") || "[]");
if (!users.length) {
  throw new Error(`Please specify the users that have access to the bot.`);
}

const menu = new Menu("model")
  .text("GPT-3.5 turbo", async (ctx) => {
    await changeSettings(ctx.from?.id, {
      model: "gpt-3.5-turbo",
    });
    return ctx.reply("The model has been changed to gpt-3.5-turbo");
  })
  .row()
  .text("GPT-4", async (ctx) => {
    await changeSettings(ctx.from?.id, {
      model: "gpt-4",
    });
    return ctx.reply("The model has been changed to gpt-4");
  })
  .row()
  .text("GPT-4-Turbo", async (ctx) => {
    await changeSettings(ctx.from?.id, {
      model: "gpt-4-1106-preview",
    });
    return ctx.reply("The model has been changed to gpt-4-1106-preview");
  });

const bot = new Bot<BotContext>(botToken);

export type BotContext = Context & {
  config: {
    isOwner: boolean;
  };
};

// deno-lint-ignore no-explicit-any
bot.use(menu as any);

bot.use(async (ctx, next) => {
  if (!ctx.from?.username) throw new Error("No user information found");

  ctx.config = { isOwner: users.includes(ctx.from.username) };
  if (!ctx.config.isOwner)
    return ctx.reply(`Sorry, you are not allowed. This is personal AI Bot`);

  const userId = getUserId(ctx);
  if (!userId) throw new Error("User ID could not be retrieved");

  const userHasSettings = await checkUserSettings(userId);
  if (!userHasSettings) await createInitialUserSettings(userId);

  await next();
});

bot.command("start", (ctx) =>
  ctx.reply("Welcome! I will be your personal AI Assistant.")
);

bot.command("model", async (ctx) => {
  const userId = getUserId(ctx);
  const model = await getUserChatModel(userId!);
  return ctx.reply(`You are currently using ${model} model`);
});

bot.command("changemodel", async (ctx) => {
  await ctx.reply("Please select the model you want to use", {
    reply_markup: menu,
  });
});

bot.command("history", async (ctx) => {
  const userId = getUserId(ctx);
  if (!userId) return ctx.reply(`No User Found`);

  const history = await getUserMessageHistory(userId);
  const aprxTokens = estimateTokens(
    formatMessageHistory(history).replaceAll("\n", "")
  );
  console.log(formatMessageHistory(history).replaceAll("\n", ""));

  const reply = formatMessageHistory(history.filter((m) => m.role !== "system"))
    ? formatMessageHistory(history.filter((m) => m.role !== "system")) +
      `Approximate token usage for your query: ${aprxTokens}`
    : "History is empty";

  return ctx.reply(reply, {});
});

bot.command("clear", async (ctx) => {
  const userId = getUserId(ctx);
  console.log(ctx.chat.id);

  if (!userId) {
    return ctx.reply(`No User Found`);
  }

  await clearUserMessageHistory(userId);

  return ctx.reply(`Your dialogue has been cleared`);
});

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

bot.on("message", async (ctx) => {
  try {
    const userId = ctx?.from?.id;
    const receivedMessage = ctx.update.message.text;

    if (!receivedMessage) {
      ctx.reply(`No message`);
    }

    const history = await getUserMessageHistory(userId);

    const lastRequest = history.findLast(
      (message) => message.role === "user"
    )?.content;

    if (lastRequest === receivedMessage) {
      return ctx.reply("Repeated requested!");
    }

    const aprxTokens = +estimateTokens(formatMessageHistory(history));

    if (aprxTokens > 2000) {
      await ctx.reply(
        `Just a heads up, you've used around *${Math.floor(
          +aprxTokens
        )}* tokens for this query. To help you manage your token usage, we recommend running the */clear* command every so oftens usage.`,
        {
          parse_mode: "Markdown",
        }
      );
    }

    const message: Message = {
      role: "user",
      content: receivedMessage || "",
    };
    const model = await getUserChatModel(userId);

    // console.log(`${model} used for the request`);
    // const sleep = (returnValue: string) => {
    //   return new Promise<string>((res) =>
    //     setTimeout(() => {
    //       return res(returnValue);
    //     }, 5000)
    //   );
    // };

    const aiResponse = await getAiResponse([...history, message], model);
    // const aiResponse = await sleep(`Some response`);
    await ctx.reply(aiResponse).catch((e) => console.error(e));
    await updateUserMessageHistory(userId, [
      ...history,
      message,
      { role: "assistant", content: aiResponse + "\n" },
    ]);
  } catch (error) {
    await ctx.reply(`Sorry an error has occured, please try again later.`);
    throw new Error(error.message);
  }
});

await bot.api.setMyCommands([
  {
    command: "/start",
    description: "Start the bot",
  },
  {
    command: "/clear",
    description: "Clear the dialogue history.",
  },
  {
    command: "/history",
    description: "Show the dialogue history.",
  },
  {
    command: "/model",
    description: "Outputs a GPT model you are currently using.",
  },
  {
    command: "/changemodel",
    description: "Change the model you are using.",
  },
  {
    command: "/credits",
    description: "Show the amount of credits used.",
  },
]);

const handleUpdate = webhookCallback(bot, "std/http", "throw", 120_000);

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
