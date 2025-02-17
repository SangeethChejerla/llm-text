"use server";

import { config } from 'dotenv';
config();
import FirecrawlApp from '@mendable/firecrawl-js';
import { OpenAI } from "openai";
import { z } from "zod";
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL and Key must be defined in environment variables");
}
const supabase = createClient(supabaseUrl, supabaseKey);

const TweetSchema = z.array(z.string());

export const generateTweetsAction = cache(async (
  url: string,
  firecrawlApiKey: string | undefined,
  wantsFull: boolean
) => {
  try {
    let apiKey = firecrawlApiKey || process.env.FIRECRAWL_API_KEY;
    let limit = wantsFull ? 100 : 10; // Default 10 limit

    if (!apiKey) {
      return { success: false, error: 'FIRECRAWL_API_KEY is not set' };
    }

    const app = new FirecrawlApp({ apiKey });

    let urlObj;
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        urlObj = new URL(url);
      } else if (url.startsWith('http:/') || url.startsWith('https:/')) {
        urlObj = new URL(url);
      } else {
        urlObj = new URL(`http://${url}`);
      }
    } catch (error) {
      return { success: false, error: "Invalid URL provided." };
    }

    let stemUrl = `${urlObj.hostname}`;

    // GitHub URL handling
    if (stemUrl.includes('github.com')) {
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment);
      if (pathSegments.length >= 2) {
        const owner = pathSegments[0];
        const repo = pathSegments[1];
        stemUrl = `${stemUrl}/${owner}/${repo}`;
      }
    }

    // Supabase Cache Check
    const { data: cacheData, error: cacheError } = await supabase
      .from('cache')
      .select('tweets')
      .eq('url', url)
      .eq('is_full', wantsFull)
      .single();

    if (cacheError) {
      console.log('No cache hit:', cacheError);
    } else if (cacheData && cacheData.tweets) {
      console.log(`Cache hit for ${url}`);
      try {
        const parsedTweets = JSON.parse(cacheData.tweets);
        const validatedTweets = TweetSchema.safeParse(parsedTweets);
        if (validatedTweets.success) {
          return { success: true, tweets: validatedTweets.data };
        } else {
          console.error("Cached Tweet validation error:", validatedTweets.error);
        }
      } catch (parseError) {
        console.error("Error parsing cached tweets:", parseError);
      }
    }

    // Map a website
    const mapResult = await app.mapUrl(stemUrl, { limit: limit });

    if (!mapResult.success) {
      return { success: false, error: `Failed to map: ${mapResult.error}` };
    }

    // Declare with let so we can slice if needed
    let urls = mapResult.links || [];
    if (urls.length > limit) {
      urls = urls.slice(0, limit);
    }

    const batchScrapeResult = await app.batchScrapeUrls(urls, {
      formats: ['markdown'],
      onlyMainContent: true,
    });

    if (!batchScrapeResult.success) {
      return { success: false, error: `Failed to scrape: ${batchScrapeResult.error}` };
    }

    let combinedMarkdown = "";
    for (const result of batchScrapeResult.data) {
      combinedMarkdown += result.markdown + "\n\n";
    }

    const klusterApiKey = process.env.KLUSTER_API_KEY;
    if (!klusterApiKey) {
      return { success: false, error: "KLUSTER_API_KEY is not defined." };
    }
    const client = new OpenAI({ apiKey: klusterApiKey, baseURL: 'https://api.kluster.ai/v1' });

    const completion = await client.chat.completions.create({
      model: "klusterai/Meta-Llama-3.1-8B-Instruct-Turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that generates tweets based on provided text content." },
        {
          role: "user",
          content: `Generate 15 short, engaging tweets in American English, using a conversational, everyday tone, based on this content:\n\n${combinedMarkdown}`
        }
      ],
      n: 1,
      max_tokens: 1000
    });

    if (!completion.choices || completion.choices.length === 0 || !completion.choices[0].message.content) {
      return { success: false, error: "Failed to generate tweets from Kluster AI." };
    }
    const rawTweets = completion.choices[0].message.content;

    const parsedTweets = rawTweets
      .split('\n')
      .filter(tweet => tweet.trim() !== '')
      .map(tweet => tweet.replace(/^\d+\.\s*/, '').trim());
    const validatedTweets = TweetSchema.safeParse(parsedTweets);

    if (!validatedTweets.success) {
      console.error("Tweet validation error:", validatedTweets.error);
      return { success: false, error: "Failed to validate generated tweets." + validatedTweets.error.toString() };
    }

    const finalTweets = validatedTweets.data.slice(0, 15);

    // Store in Supabase Cache
    const { error: insertError } = await supabase
      .from('cache')
      .upsert([{ url: url, tweets: JSON.stringify(finalTweets), is_full: wantsFull }]);

    if (insertError) {
      console.error("Failed to insert into Supabase:", insertError);
    }

    return { success: true, tweets: finalTweets };
  } catch (error: any) {
    console.error("Error in generateTweetsAction:", error);
    return { success: false, error: error.message || "An unknown error occurred." };
  }
});
