## Deploy Your Personal Telegram AI Assistant with Supabase Edge Functions

![demo](./demo.gif)

1. Start by creating a new Supabase project and executing the following commands:

   - `supabase link --project-ref <PROJECT_ID>` - links your local CLI to your Supabase project.
   - `supabase db push` - it pushes your local database schema and any data to your Supabase project.

2. Contact [@BotFather](https://t.me/BotFather) on Telegram to create a bot and get its token.

3. Set up your environment variables by copying the example file:

   - `cp supabase/.env.example supabase/.env`

4. Fill out the environment variables in the `.env` file:

   - `BOT_TOKEN=your-telegram-bot-token`
   - `FUNCTION_SECRET=secret123`
   - `OPENAI_KEY=your-openai-api-secret`
   - `USERS="["user1", "user2", "user3"]"` (Note: wrap the usernames in double quotes)

5. Fill out `STARTING_PROMPT` in the `.env` file (not required):

   - `STARTING_PROMPT="You are a personal assistant. You will help the user with various tasks and requests. You should also provide information on how to complete the tasks or where to find the resources needed, if applicable. You are very helpful and provide clear and informational answers."` - Starting prompt allows up the bot to act the way you want.
     You can find more starting prompts [here](https://github.com/f/awesome-chatgpt-prompts).

6. Create the function by running the following command:

   - `supabase functions deploy --no-verify-jwt telegram-bot`

7. Set the secrets using the following command:

   - `supabase secrets set --env-file ./supabase/.env`

8. Set your bot's webhook URL by opening the following URL in your browser:
   - `https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<PROJECT_NAME>.functions.supabase.co/telegram-bot?secret=<FUNCTION_SECRET>`
   - Replace `<BOT_TOKEN>` and `<PROJECT_NAME>` with your own values.
   - Alternatively, you can run the following command in your terminal:
     - `curl https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<PROJECT_NAME>.functions.supabase.co/telegram-bot?secret=<FUNCTION_SECRET>`
