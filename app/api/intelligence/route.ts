import { NextResponse } from "next/server";

import { ApiError, getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXA_SEARCH_URL = "https://api.exa.ai/search";
const INTELLIGENCE_SYSTEM_PROMPT =
  "You are a space procurement intelligence analyst. Given a search result and a seller's capability description, write one sentence explaining why this result is a relevant procurement opportunity. Be specific. Under 25 words.";
const JUDGE_INCLUDE_DOMAINS = [
  "spacenews.com",
  "nasa.gov",
  "esa.int",
  "spacex.com",
  "rocketlabusa.com"
];
const COUNSEL_INCLUDE_DOMAINS = [
  "spacenews.com",
  "space.com",
  "techcrunch.com",
  "defensenews.com"
];

export type TabId = "judge" | "counsel" | "entity";

export type IntelligenceResult = {
  id: string;
  title: string;
  url: string;
  domain: string;
  publishedDate: string | null;
  highlights: string[];
  snippet: string;
  score: number | null;
};

export type IntelligenceResponse = {
  tab: TabId;
  query: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  results: IntelligenceResult[];
};

function getExaApiKey(): string {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new ApiError("Missing search API environment variable: EXA_API_KEY.", 500);
  return key;
}

function buildQuery(tab: TabId, judgeName: string, firmName: string, entityName: string): string {
  if (tab === "judge") {
    return `"${judgeName}" satellite program procurement buyer space company`;
  }
  if (tab === "counsel") {
    return `space program announcement mission launch "${firmName}" 2025 2026`;
  }
  return `"${entityName}" space startup hiring partnership contract announcement`;
}

function buildExaRequest(tab: TabId, query: string): Record<string, unknown> {
  const highlights = { query, numSentences: 4, highlightsPerUrl: 2 };

  if (tab === "judge") {
    return {
      query,
      type: "neural",
      numResults: 8,
      includeDomains: JUDGE_INCLUDE_DOMAINS,
      systemPrompt: INTELLIGENCE_SYSTEM_PROMPT,
      contents: { highlights }
    };
  }

  if (tab === "counsel") {
    return {
      query,
      type: "neural",
      category: "news",
      numResults: 8,
      startPublishedDate: "2025-01-01",
      includeDomains: COUNSEL_INCLUDE_DOMAINS,
      systemPrompt: INTELLIGENCE_SYSTEM_PROMPT,
      contents: { highlights }
    };
  }

  // entity
  return {
    query,
    type: "neural",
    category: "news",
    numResults: 10,
    startPublishedDate: "2024-01-01",
    systemPrompt: INTELLIGENCE_SYSTEM_PROMPT,
    contents: { highlights }
  };
}

function normalizeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function truncate(text: string, max = 340): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export async function POST(req: Request) {
  let attemptedQuery: string | undefined;

  try {
    const body = (await req.json()) as {
      tab?: string;
      judgeName?: string;
      firmName?: string;
      entityName?: string;
      query?: string;
    };

    const tab = body.tab as TabId | undefined;
    if (!tab || !["judge", "counsel", "entity"].includes(tab)) {
      throw new ApiError("Invalid or missing tab parameter.", 400);
    }

    const judgeName =
      body.judgeName?.trim() || "radiation-hardened microprocessors for small satellites";
    const firmName =
      body.firmName?.trim() || "radiation-hardened microprocessors for small satellites";
    const entityName =
      body.entityName?.trim() || "radiation-hardened microprocessors for small satellites";

    const query =
      body.query?.trim() || buildQuery(tab, judgeName, firmName, entityName);
    attemptedQuery = query;

    const requestPayload = buildExaRequest(tab, query);

    const exaResponse = await fetch(EXA_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": getExaApiKey()
      },
      body: JSON.stringify(requestPayload),
      cache: "no-store"
    });

    if (!exaResponse.ok) {
      const details = await exaResponse.text();
      throw new ApiError(
        `Search request failed (${exaResponse.status}).${details ? ` ${details}` : ""}`,
        exaResponse.status
      );
    }

    const data = (await exaResponse.json()) as Record<string, unknown> & {
      results?: Record<string, unknown>[];
    };
    const rawResults = data.results ?? [];

    const results: IntelligenceResult[] = rawResults
      .filter((item) => typeof item.url === "string" && item.url)
      .map((item): IntelligenceResult => {
        const rawHighlights = Array.isArray(item.highlights)
          ? (item.highlights as string[]).filter(Boolean).map((h) => truncate(h))
          : [];

        let snippet = "";
        if (rawHighlights.length > 0) {
          snippet = rawHighlights[0];
        } else if (typeof item.summary === "string" && item.summary.trim()) {
          snippet = truncate(item.summary);
        } else if (typeof item.text === "string" && item.text.trim()) {
          snippet = truncate(item.text);
        }

        return {
          id: typeof item.id === "string" ? item.id : `result-${item.url}`,
          title:
            (typeof item.title === "string" ? item.title.trim() : "") ||
            (item.url as string) ||
            "Untitled",
          url: item.url as string,
          domain: normalizeDomain(item.url as string),
          publishedDate: typeof item.publishedDate === "string" ? item.publishedDate : null,
          highlights: rawHighlights,
          snippet,
          score: typeof item.score === "number" ? item.score : null
        };
      });

    const response: IntelligenceResponse = {
      tab,
      query,
      request: requestPayload,
      response: data,
      results
    };

    return NextResponse.json(response);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    return NextResponse.json(
      { error: getErrorMessage(error), attemptedQuery },
      { status }
    );
  }
}
