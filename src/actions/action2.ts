"use server";

import { config } from 'dotenv';
config();
import FirecrawlApp from '@mendable/firecrawl-js';
import { OpenAI } from "openai";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

// Define database types
type Database = {
  public: {
    Tables: {
      cache: {
        Row: {
          id: number;
          url: string;
          tweets: string;
          is_full: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cache']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['cache']['Insert']>;
      };
    };
  };
};

// Environment validation schema
const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string().min(1),
  FIRECRAWL_API_KEY: z.string().min(1),
  KLUSTER_API_KEY: z.string().min(1)
});

// Validate environment variables
const env = EnvSchema.safeParse({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  KLUSTER_API_KEY: process.env.KLUSTER_API_KEY
});

if (!env.success) {
  throw new Error(`Environment validation failed: ${env.error.message}`);
}

// Initialize Supabase client with types
const supabase = createClient<Database>(
  env.data.SUPABASE_URL,
  env.data.SUPABASE_KEY
);

// Tweet validation schema
const TweetSchema = z.array(z.string());

// Utility function to split text into chunks
function splitIntoChunks(text: string, maxChunkLength: number = 4000): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // Handle long sentences
      if (sentence.length > maxChunkLength) {
        const words = sentence.split(' ');
        let tempChunk = '';
        for (const word of words) {
          if ((tempChunk + ' ' + word).length > maxChunkLength) {
            chunks.push(tempChunk.trim());
            tempChunk = word;
          } else {
            tempChunk += (tempChunk ? ' ' : '') + word;
          }
        }
        if (tempChunk) {
          currentChunk = tempChunk;
        }
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Process individual content chunks
async function processContentChunk(
  client: OpenAI,
  chunk: string,
  chunkIndex: number,
  totalChunks: number
): Promise<string[]> {
  try {
    const completion = await client.chat.completions.create({
      model: "klusterai/Meta-Llama-3.1-8B-Instruct-Turbo",
      messages: [
        { 
          role: "system", 
          content: "Respond to the following situation/question/statement in the style of Shogo Makishima from Psycho-Pass.  Maintain a calm, analytical, and eloquent tone in american daily spoken english.  Incorporate at least 2 precise and accurate literary, philosophical, or historical allusions that are thematically relevant to the situation give the lines from it and explain about it.  Challenge conventional morality or assumptions related to the topic.  Focus on the underlying human motivations and the concept of free will.  Use complex sentence structures and avoid colloquialisms. Conclude with a thought provoking question phrase everything "
        },
        { 
          role: "user", 
          content: `Generate 3 engaging tweets from the following content (chunk ${chunkIndex + 1}/${totalChunks}). 
                   Format each tweet as a separate line starting with "Tweet: ". 
                   Keep tweets concise and engaging. Here's the content:\n\n${chunk}`
        }
      ],
      n: 1,
      max_tokens: 500
    });

    const generatedContent = completion.choices?.[0]?.message?.content;
    if (!generatedContent) {
      return [];
    }

    return generatedContent
      .split('\n')
      .filter(line => line.trim().startsWith('Tweet:'))
      .map(line => line.replace(/^Tweet:\s*/, '').trim())
      .filter(Boolean);
  } catch (error) {
    console.error(`Error processing chunk ${chunkIndex + 1}:`, error);
    return [];
  }
}

// Main function to generate tweets
export async function generateTweetsAction(
  url: string,
  firecrawlApiKey?: string,
  wantsFull: boolean = false
) {
  try {
    const apiKey = firecrawlApiKey || process.env.FIRECRAWL_API_KEY;
    const limit = wantsFull ? 100 : 10;

    // Validate URL
    let urlObj: URL;
    try {
      urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
    } catch (error) {
      return { success: false, error: "Invalid URL provided." };
    }

    // Process URL for GitHub repositories
    let stemUrl = urlObj.hostname;
    if (stemUrl.includes('github.com')) {
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      if (pathSegments.length >= 2) {
        stemUrl = `${stemUrl}/${pathSegments[0]}/${pathSegments[1]}`;
      }
    }

    // Check cache
    const { data: cacheData, error: cacheError } = await supabase
      .from('cache')
      .select('tweets')
      .eq('url', url)
      .eq('is_full', wantsFull)
      .single();

    if (!cacheError && cacheData?.tweets) {
      const validatedTweets = TweetSchema.safeParse(JSON.parse(cacheData.tweets));
      if (validatedTweets.success) {
        return { success: true, tweets: validatedTweets.data };
      }
    }

    // Initialize Firecrawl
    const app = new FirecrawlApp({ apiKey });

    // Map URL
    const mapResult = await app.mapUrl(stemUrl, { limit });
    if (!mapResult.success) {
      return { success: false, error: `Failed to map URL: ${mapResult.error}` };
    }

    const urls = mapResult.links?.slice(0, limit) || [];
    
    // Scrape URLs
    const batchScrapeResult = await app.batchScrapeUrls(urls, {
      formats: ['markdown'],
      onlyMainContent: true,
    });

    if (!batchScrapeResult.success) {
      return { success: false, error: `Failed to scrape URLs: ${batchScrapeResult.error}` };
    }

    const combinedMarkdown = batchScrapeResult.data
      .map(result => result.markdown)
      .join("\n\n");

    // Split content into chunks
    const chunks = splitIntoChunks(combinedMarkdown);
    
    // Initialize OpenAI client
    const client = new OpenAI({ 
      apiKey: process.env.KLUSTER_API_KEY,
      baseURL: 'https://api.kluster.ai/v1'
    });

    // Process chunks with rate limiting
    const allTweets: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const chunkTweets = await processContentChunk(client, chunks[i], i, chunks.length);
      allTweets.push(...chunkTweets);

      // Break if we have enough tweets
      if (allTweets.length >= 15) break;
    }

    // Select and validate final tweets
    const finalTweets = allTweets.slice(0, 15);
    const validatedTweets = TweetSchema.safeParse(finalTweets);
    
    if (!validatedTweets.success) {
      return { 
        success: false, 
        error: "Failed to validate generated tweets: " + validatedTweets.error.message
      };
    }

    // Update cache
    const { error: upsertError } = await supabase
      .from('cache')
      .upsert({ 
        url, 
        tweets: JSON.stringify(finalTweets), 
        is_full: wantsFull 
      });

    if (upsertError) {
      console.error("Cache update failed:", upsertError);
    }

    return { success: true, tweets: finalTweets };
  } catch (error) {
    console.error("Error in generateTweetsAction:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "An unknown error occurred." 
    };
  }
}