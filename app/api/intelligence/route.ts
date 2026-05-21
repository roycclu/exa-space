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
  contact: {
    name: string;
    title: string;
    url: string | null;
  } | null;
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
    return `${judgeName} space procurement buyer program lead sourcing`;
  }
  if (tab === "counsel") {
    return `space program announcement mission launch "${firmName}" 2025 2026`;
  }
  return `"${entityName}" space startup hiring partnership contract announcement`;
}

function buildExaRequest(tab: TabId, query: string): Record<string, unknown> {
  if (tab === "judge") {
    return {
      query,
      numResults: 10,
      type: "auto",
      category: "company",
      highlights: {
        numSentences: 2,
        highlightsPerUrl: 1
      }
    };
  }

  const highlights = { query, numSentences: 4, highlightsPerUrl: 2 };

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

const CONTACT_TITLE_KEYWORDS = [
  "procurement",
  "sourcing",
  "buyer",
  "supply chain",
  "program lead",
  "vp",
  "director",
  "head of"
];

type ExaPersonResult = {
  title?: string;
  url?: string;
  text?: string;
  summary?: string;
  highlights?: string[];
};

async function searchRelevantContact(companyName: string): Promise<IntelligenceResult["contact"]> {
  const query = `${companyName} procurement OR sourcing OR "program manager" OR "VP supply chain" OR "director of procurement" space`;
  const requestPayload = {
    query,
    numResults: 3,
    type: "auto",
    category: "person",
    highlights: {
      numSentences: 1,
      highlightsPerUrl: 1
    }
  };

  const response = await fetch(EXA_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getExaApiKey()
    },
    body: JSON.stringify(requestPayload),
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { results?: ExaPersonResult[] };
  const results = data.results ?? [];

  for (const result of results) {
    const parsed = parseContactResult(result);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function parseContactResult(result: ExaPersonResult): IntelligenceResult["contact"] {
  const textParts = [
    result.title ?? "",
    result.summary ?? "",
    result.text ?? "",
    ...(Array.isArray(result.highlights) ? result.highlights : [])
  ];
  const haystack = textParts.join(" ").replace(/\s+/g, " ").trim();
  const lower = haystack.toLowerCase();

  const matchedKeyword = CONTACT_TITLE_KEYWORDS.find((keyword) => lower.includes(keyword));
  if (!matchedKeyword) {
    return null;
  }

  const normalizedTitle = (result.title ?? "").replace(/\s+/g, " ").trim();
  const segments = normalizedTitle
    .split(/\s+[|\-–]\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const fallbackName = segments[0] || normalizedTitle || "Research needed";
  const titleCandidate =
    segments.find((segment, index) => index > 0 && hasContactKeyword(segment)) ||
    extractContactTitle(haystack) ||
    normalizedTitle;

  return {
    name: fallbackName,
    title: titleCandidate,
    url: typeof result.url === "string" ? result.url : null
  };
}

function hasContactKeyword(value: string): boolean {
  const lower = value.toLowerCase();
  return CONTACT_TITLE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function extractContactTitle(value: string): string | null {
  const sentences = value
    .split(/[.!?\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const sentence of sentences) {
    if (hasContactKeyword(sentence)) {
      return truncate(sentence, 120);
    }
  }

  return null;
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

    const results: IntelligenceResult[] = await Promise.all(
      rawResults
      .filter((item) => typeof item.url === "string" && item.url)
      .map(async (item): Promise<IntelligenceResult> => {
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

        const normalizedTitle =
          (typeof item.title === "string" ? item.title.trim() : "") ||
          (item.url as string) ||
          "Untitled";

        return {
          id: typeof item.id === "string" ? item.id : `result-${item.url}`,
          title: normalizedTitle,
          url: item.url as string,
          domain: normalizeDomain(item.url as string),
          publishedDate: typeof item.publishedDate === "string" ? item.publishedDate : null,
          highlights: rawHighlights,
          snippet,
          score: typeof item.score === "number" ? item.score : null,
          contact: tab === "judge" ? await searchRelevantContact(normalizedTitle) : null
        };
      })
    );

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
