import { Context } from "https://deno.land/x/grammy@v1.8.3/mod.ts";
import { OpenAI } from "./openai.ts";
import { supabaseClient } from "./supaClient.ts";

export type Messages = Message[];
export type Message = {
  role: string;
  content: string;
};

const openAI = new OpenAI(Deno.env.get("OPENAI_KEY") || "");

if (!openAI) {
  throw new Error(`Please specify the OpenAI API Key.`);
}

export const getUserId = (ctx: Context) => {
  return ctx.from?.id || null;
};

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
        message: [],
      })
      .eq("user_id", id);

    if (error) throw error.message;

    return [];
  }

  return data![0]["message"] || " ";
};

export const getAiResponse = async (messages: Messages): Promise<string> => {
  const { answer } = await openAI.createChatCompletion(messages);
  return answer;
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
    .update({ message: [] })
    .eq("user_id", id);

  if (error) throw error.message;
};
