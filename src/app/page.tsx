"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, ExternalLinkIcon, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalBody,
  ResponsiveModalFooter,
  ResponsiveModalClose
} from "@/components/ResponsiveModal";

export default function Page() {
  const [url, setUrl] = useState("");
  const [tweets, setTweets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [firecrawlKey, setFirecrawlKey] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [wantsFull, setWantsFull] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasKey = firecrawlKey.length > 0;
  const isFull = wantsFull && hasKey;

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    let inferredUrl = url;
    if (!inferredUrl.startsWith("http") && !inferredUrl.startsWith("https")) {
      inferredUrl = `https://${inferredUrl}`;
    }

    if (!inferredUrl) {
      toast.error("Please enter a URL.");
      return;
    }

    try {
      new URL(inferredUrl);
    } catch {
      toast.error("Please enter a valid URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/generate-tweets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: inferredUrl, firecrawlKey, wantsFull })
      });
      const result = await res.json();

      if (result.success) {
        setTweets(result.tweets);
      } else {
        setError(result.error || "An unknown error occurred.");
        toast.error(result.error || "An unknown error occurred.");
      }
    } catch (e: any) {
      setError(e.message || "An unknown error occurred.");
      toast.error(e.message || "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  }, [url, firecrawlKey, wantsFull]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Tweet copied to clipboard!");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-100">
      <div className="w-full max-w-2xl space-y-8 bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl lg:text-5xl font-semibold font-mono tracking-tight text-center">
          Tweet Generator
        </h1>
        <h2 className="text-center text-balance lg:text-lg mt-2">
          Generate banger tweets from any website using AI.
        </h2>
        <p className="mt-2 text-sm text-gray-600 text-center">
          Powered by{" "}
          <a
            href="https://firecrawl.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Firecrawl
          </a>{" "}
          and{" "}
          <a
            href="https://kluster.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Kluster AI
          </a>.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <Input
            placeholder="Enter website URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="full-generation-switch"
                checked={isFull}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setIsModalOpen(true);
                    setWantsFull(true);
                  } else {
                    setWantsFull(false);
                  }
                }}
                disabled={loading}
              />
              <Label htmlFor="full-generation-switch">Full Generation</Label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Generate"
              )}
            </Button>
          </div>
        </form>

        {error && (
          <div className="mt-4 text-red-500">
            {error}
          </div>
        )}

        {tweets.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Generated Tweets:</h3>
            <div className="space-y-4">
              {tweets.map((tweet, index) => (
                <div key={index} className="p-4 border rounded-md flex items-start justify-between">
                  <p className="text-gray-700 break-words flex-1">{tweet}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(tweet)}
                    className="p-2 rounded-full hover:bg-gray-200 focus:outline-none"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <ResponsiveModal
          open={isModalOpen}
          onOpenChange={(val) => setIsModalOpen(val)}
        >
          <ResponsiveModalContent className="bg-white rounded-lg shadow-xl">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsModalOpen(false);
              }}
              className="flex flex-col sm:gap-4"
            >
              <ResponsiveModalHeader>
                <ResponsiveModalTitle className="text-lg font-semibold">
                  Enable Full Generation
                </ResponsiveModalTitle>
                <ResponsiveModalDescription className="text-sm text-gray-500">
                  Please enter your Firecrawl API key to enable the full generation feature.
                </ResponsiveModalDescription>
              </ResponsiveModalHeader>
              <ResponsiveModalBody>
                <div className="flex flex-col space-y-2">
                  <Input
                    disabled={loading}
                    autoFocus
                    placeholder="Paste your Firecrawl API key"
                    value={firecrawlKey}
                    onChange={(e) => setFirecrawlKey(e.target.value)}
                    className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <a
                    href="https://firecrawl.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline inline-flex items-center"
                  >
                    Don't have a key? Create Firecrawl account{" "}
                    <ExternalLinkIcon className="ml-1 h-4 w-4" />
                  </a>
                </div>
              </ResponsiveModalBody>
              <ResponsiveModalFooter>
                <ResponsiveModalClose asChild>
                  <Button
                    type="submit"
                    className="px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                  >
                    Save and Return
                  </Button>
                </ResponsiveModalClose>
              </ResponsiveModalFooter>
            </form>
          </ResponsiveModalContent>
        </ResponsiveModal>
      </div>
    </div>
  );
}
