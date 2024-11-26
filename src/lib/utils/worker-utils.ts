export const isProduction = process.env.NODE_ENV === "production";

export const checkEnvironmentVariables = () => {
  const requiredEnvVars = [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REDIRECT_URI",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "OPENAI_API_KEY",
    "UPSTASH_REDIS_URL",
    "UPSTASH_REDIS_TOKEN",
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
};
