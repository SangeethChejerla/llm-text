// /app/api/generate-tweets/route.ts
import { generateTweetsAction } from '@/actions/action2';
import { NextResponse } from 'next/server';


export async function POST(request: Request) {
  try {
    const { url, firecrawlKey, wantsFull } = await request.json();
    const result = await generateTweetsAction(url, firecrawlKey, wantsFull);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "An unknown error occurred." });
  }
}
