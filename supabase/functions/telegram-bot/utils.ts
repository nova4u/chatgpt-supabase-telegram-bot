import { OpenAI } from "./openai.ts";
import { supabaseClient } from "./supaClient.ts";
import { BotContext } from "./index.ts";

export type Messages = Message[];
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

const openAI = new OpenAI(Deno.env.get("OPENAI_KEY") || "");
const startingMessages: Messages = Deno.env.get("STARTING_PROMPT")
  ? [{ role: "system", content: Deno.env.get("STARTING_PROMPT") || "" }]
  : [];

if (!openAI) {
  throw new Error(`Please specify the OpenAI API Key.`);
}

export const getUserId = (ctx: BotContext) => {
  return ctx.from?.id || null;
};

export const getCredits = async () => {
  const { total_available, total_used } = await openAI.getBilling();

  const formatNumber = (number: number) => {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return formatter.format(number);
  };

  return {
    total_available: formatNumber(total_available),
    total_used: formatNumber(total_used),
  };
};
export function estimateTokens(
  text: string,
  method: "max" | "min" | "chars" | "words" | "average" = "max"
) {
  // method can be "average", "words", "chars", "max", "min", defaults to "max"
  // "average" is the average of words and chars
  // "words" is the word count divided by 0.75
  // "chars" is the char count divided by 4
  // "max" is the max of word and char
  // "min" is the min of word and char
  const word_count = text.split(" ").length;
  const char_count = text.length;
  const tokens_count_word_est = word_count / 0.75;
  const tokens_count_char_est = char_count / 4.0;
  let output = 0;
  switch (method) {
    case "average":
      output = (tokens_count_word_est + tokens_count_char_est) / 2;
      break;
    case "words":
      output = tokens_count_word_est;
      break;
    case "chars":
      output = tokens_count_char_est;
      break;
    case "max":
      output = Math.max(tokens_count_word_est, tokens_count_char_est);
      break;
    case "min":
      output = Math.min(tokens_count_word_est, tokens_count_char_est);
      break;
    default:
      // return invalid method message
      return "Invalid method. Use 'average', 'words', 'chars', 'max', or 'min'.";
  }
  return Math.ceil(output);
}

export const formatMessageHistory = (messages: Messages): string => {
  let output = "";
  for (const message of messages) {
    const { role, content } = message;
    output += `${
      role.charAt(0).toUpperCase() + role.slice(1)
    }: ${content.replace(/^\n+/, "")}\n`;
  }

  return output.replaceAll("User", "You").replaceAll("assistant", "AI:");
};

export const getUserMessageHistory = async (id: number): Promise<Messages> => {
  const { data } = await supabaseClient
    .from("dialogues")
    .select("message")
    .eq("user_id", id);

  if (!data?.length) {
    const { error } = await supabaseClient
      .from("dialogues")
      .insert({
        user_id: id,
        message: startingMessages,
      })
      .eq("user_id", id);

    if (error) throw error.message;

    return startingMessages;
  }

  return data![0]["message"] || " ";
};

export const getAiResponse = async (
  messages: Messages,
  model: Settings["model"] = "gpt-3.5-turbo"
): Promise<string> => {
  const { answer } = await openAI.createChatCompletion(messages, model);
  return answer;
};
interface Settings {
  model: "gpt-3.5-turbo" | "gpt-4" | "gpt-4-1106-preview";
}

const initSettings: Settings = {
  model: "gpt-3.5-turbo",
};

export const checkUserSettings = async (id: number) => {
  const { data } = await supabaseClient
    .from("settings")
    .select("settings")
    .eq("user_id", id);
  console.log(!data?.length ? false : true);
  return !data?.length ? false : true;
};

export const changeSettings = async (id: number, settings: Settings) => {
  const { error } = await supabaseClient
    .from("settings")
    .update({
      user_id: id,
      settings,
    })
    .eq("user_id", id);
  return error ? false : true;
};

export const getUserSettings = async (id: number) => {
  const { data } = await supabaseClient
    .from("settings")
    .select("settings")
    .eq("user_id", id);

  if (!data) return null;

  return data[0].settings;
};
export const getUserChatModel = async (id: number) => {
  const userSettings = await getUserSettings(id);
  if (!userSettings) return "gpt-3.5-turbo";
  return userSettings.model;
};

export const createInitialUserSettings = async (id: number) => {
  const { error, data } = await supabaseClient
    .from("settings")
    .insert({
      user_id: id,
      settings: initSettings,
    })
    .eq("user_id", id);

  console.log({ data, error });
  if (error) throw error.message;
};

export const updateUserMessageHistory = async (
  id: number,
  message: Messages
) => {
  const { error } = await supabaseClient
    .from("dialogues")
    .update({ message: message })
    .eq("user_id", id);

  if (error) throw error.message;
};

export const clearUserMessageHistory = async (id: number) => {
  const { error } = await supabaseClient
    .from("dialogues")
    .update({ message: startingMessages })
    .eq("user_id", id);

  if (error) throw error.message;
};
