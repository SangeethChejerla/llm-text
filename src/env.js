// env.js
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    KLUSTER_API_KEY: z.string().min(1),
    SUPABASE_KEY: z.string().min(1),
    SUPABASE_URL: z.string().url(),
    FIRECRAWL_API_KEY: z.string().min(1),
  },
  client: {
    //  Client-side environment variables go here (if any).
    //  For example:
    //  NEXT_PUBLIC_SOME_CLIENT_VAR: z.string().min(1),
  },

  // For Next.js, ALL environment variables are shared by default.
  // If you want to make sure an environment variable is ONLY available on the server:
  runtimeEnv: {
    KLUSTER_API_KEY: process.env.KLUSTER_API_KEY,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
    // NEXT_PUBLIC_SOME_CLIENT_VAR: process.env.NEXT_PUBLIC_SOME_CLIENT_VAR, // Example client var
  },
});