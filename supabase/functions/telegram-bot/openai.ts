import { Messages } from "./utils.ts";

export interface CreateCompletionRequest {
  model: string;
  prompt?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  logprobs?: number | null;
  echo?: boolean | null;
  stop?: string | string[] | null;
}

interface OpenAIError {
  message: string;
  type: string;
  param: null;
  code: null;
}

interface Completion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChoiceChat[];
  usage: Usage;
  error?: OpenAIError;
}

interface ChoiceChat {
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
  index: number;
}

interface Usage {
  total_tokens: number;
  total_credits: number;
  credits_per_token: number;
  plan: string;
}

export class OpenAI {
  constructor(private API_KEY: string) {}

  public async createChatCompletion(messages: Messages): Promise<{
    answer: Completion["choices"][0]["message"]["content"];
    tokens: Completion["usage"]["total_tokens"];
  }> {
    const options: CreateCompletionRequest & { messages: Messages } = {
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.6,
      max_tokens: 400,
    };

    const response: Completion = await fetch(
      `https://api.openai.com/v1/chat/completions`,
      {
        body: JSON.stringify(options),
        headers: {
          Authorization: `Bearer ${this.API_KEY}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }
    ).then((r) => r.json());

    if (response?.error) {
      throw response.error.message;
    }

    console.log(`Tokens used:`, response.usage.total_tokens);

    return {
      answer: response.choices[0].message["content"],
      tokens: response.usage.total_tokens,
    };
  }
}
