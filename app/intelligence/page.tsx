"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import styles from "./page.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type TabId = "judge" | "counsel" | "entity";

type IntelligenceResult = {
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

type TabState = {
  results: IntelligenceResult[] | null;
  note: string | null;
  pending: boolean;
  error: string | null;
  executedQuery: string | null;
  executedRequest: Record<string, unknown> | null;
  executedResponse: Record<string, unknown> | null;
};

const INTELLIGENCE_SYSTEM_PROMPT =
  "You are a space procurement intelligence analyst. Given a search result and a seller's capability description, write one sentence explaining why this result is a relevant procurement opportunity. Be specific. Under 25 words.";
const JUDGE_INCLUDE_DOMAINS = [
  "open web"
];
const COUNSEL_INCLUDE_DOMAINS = [
  "spacenews.com",
  "space.com",
  "techcrunch.com",
  "defensenews.com"
];

// ─── Tab configuration ───────────────────────────────────────────────────────

const TAB_CONFIG = {
  judge: {
    label: "Buyers",
    description: "Potential buying organizations",
    buildQuery: (judgeName: string) =>
      `${judgeName} space procurement buyer program lead sourcing`,
    previewParams: {
      type: "auto",
      category: "company",
      numResults: 10,
      highlights: true,
      systemPrompt: INTELLIGENCE_SYSTEM_PROMPT
    },
    westlawNote:
      "Legacy research systems do not index live buyer intent across the commercial and government space ecosystem.",
    rationale:
      "Buyer discovery. Live web search surfaces companies publishing procurement, subsystem, and integration signals tied to this capability."
  },
  counsel: {
    label: "Programs",
    description: "Mission and launch demand signals",
    buildQuery: (firmName: string) =>
      `space program announcement mission launch "${firmName}" 2025 2026`,
    previewParams: {
      type: "neural",
      category: "news",
      numResults: 8,
      startPublishedDate: "2025-01-01",
      highlights: true,
      includeDomains: COUNSEL_INCLUDE_DOMAINS,
      systemPrompt: INTELLIGENCE_SYSTEM_PROMPT
    },
    westlawNote:
      "Legacy research systems do not surface fresh launch and mission announcements as structured procurement signals.",
    rationale:
      "Program tracking. Fresh announcements expose launch timelines, hardware builds, and contract activity relevant to supplier outreach."
  },
  entity: {
    label: "Signals",
    description: "Hiring, partnership, and contract activity",
    buildQuery: (entityName: string) =>
      `"${entityName}" space startup hiring partnership contract announcement`,
    previewParams: {
      type: "neural",
      category: "news",
      numResults: 10,
      startPublishedDate: "2024-01-01",
      highlights: true,
      systemPrompt: INTELLIGENCE_SYSTEM_PROMPT
    },
    westlawNote:
      "Legacy research systems do not monitor hiring, funding, partnership, and startup momentum across the live space market.",
    rationale:
      "Signals monitoring. Emerging announcements often reveal buyer intent before a formal procurement notice appears."
  }
} as const;

const TABS: TabId[] = ["judge", "counsel", "entity"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: string | null): string {
  if (!date) return "Date unavailable";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
}

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function renderHighlightedText(text: string, term: string) {
  if (!text || !term.trim()) {
    return text;
  }

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(${escaped})`, "ig");
  const parts = text.split(pattern);

  return parts.map((part, index) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <mark className={styles.keywordHighlight} key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function buildPreviewPayload(
  tab: TabId,
  query: string
): Record<string, unknown> {
  const { highlights: _h, ...restParams } = TAB_CONFIG[tab].previewParams as Record<string, unknown>;
  return {
    query,
    ...restParams,
    contents: { highlights: { query, numSentences: 4, highlightsPerUrl: 2 } }
  };
}

function makeTabState(): TabState {
  return {
    note: null,
    results: null,
    pending: false,
    error: null,
    executedQuery: null,
    executedRequest: null,
    executedResponse: null
  };
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function IntelligencePage() {
  const [activeTab, setActiveTab] = useState<TabId>("judge");
  const [judgeName, setJudgeName] = useState("radiation-hardened microprocessors for small satellites");
  const [firmName, setFirmName] = useState("radiation-hardened microprocessors for small satellites");
  const [entityName, setEntityName] = useState("radiation-hardened microprocessors for small satellites");
  const [tabQueries, setTabQueries] = useState<Record<TabId, string>>({
    judge: TAB_CONFIG.judge.buildQuery("radiation-hardened microprocessors for small satellites"),
    counsel: TAB_CONFIG.counsel.buildQuery("radiation-hardened microprocessors for small satellites"),
    entity: TAB_CONFIG.entity.buildQuery("radiation-hardened microprocessors for small satellites")
  });
  const [showRawResponse, setShowRawResponse] = useState(false);

  const [westlawMode, setWestlawMode] = useState<Record<TabId, boolean>>({
    judge: false,
    counsel: false,
    entity: false
  });

  const [tabStates, setTabStates] = useState<Record<TabId, TabState>>({
    judge: makeTabState(),
    counsel: makeTabState(),
    entity: makeTabState()
  });

  const cfg = TAB_CONFIG[activeTab];
  const ts = tabStates[activeTab];
  const isWestlaw = westlawMode[activeTab];
  const liveQuery = tabQueries[activeTab];

  const previewPayload = useMemo(
    () => buildPreviewPayload(activeTab, liveQuery),
    [activeTab, liveQuery]
  );

  // After a run, show the actual request returned from the API; otherwise show preview
  const inspectorPayload = ts.executedRequest ?? previewPayload;

  async function runSearch() {
    setTabStates((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], pending: true, error: null, note: null }
    }));

    try {
      const clientRequest = {
        url: "/api/intelligence",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { tab: activeTab, judgeName, firmName, entityName, query: liveQuery }
      };
      console.groupCollapsed(`[Intelligence] ${activeTab} request`);
      console.log("Request", clientRequest);
      console.log("Search request preview", previewPayload);
      console.groupEnd();

      const res = await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientRequest.body)
      });

      const data = (await res.json()) as {
        results?: IntelligenceResult[];
        query?: string;
        request?: Record<string, unknown>;
        response?: Record<string, unknown>;
        error?: string;
        attemptedQuery?: string;
      };

      console.groupCollapsed(`[Intelligence] ${activeTab} response`);
      console.log("Status", res.status);
      console.log("Response JSON", data);
      console.groupEnd();

      if (!res.ok) {
        throw Object.assign(new Error(data.error || "Search failed."), {
          attemptedQuery: data.attemptedQuery
        });
      }

      let nextResults = data.results ?? [];
      let note: string | null = null;

      if (activeTab === "judge" && nextResults.length > 3) {
        nextResults = nextResults.slice(0, 3);
        note = "Showing the most relevant buyer signals first.";
      }

      setTabStates((prev) => ({
        ...prev,
        [activeTab]: {
          pending: false,
          error: null,
          note,
          results: nextResults,
          executedQuery: data.query ?? null,
          executedRequest: data.request ?? null,
          executedResponse: data.response ?? data
        }
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Search failed.";
      console.groupCollapsed(`[Intelligence] ${activeTab} error`);
      console.error(err);
      console.groupEnd();
      setTabStates((prev) => ({
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          note: null,
          pending: false,
          error: msg,
          executedResponse: null
        }
      }));
    }
  }

  function toggleWestlaw() {
    setWestlawMode((prev) => ({ ...prev, [activeTab]: !prev[activeTab] }));
  }

  function switchTab(tabId: TabId) {
    setActiveTab(tabId);
    // Reset Westlaw mode when switching tabs so live search results are front and center
    setWestlawMode((prev) => ({ ...prev, [tabId]: false }));
  }

  function updateQueryForActiveTab(query: string) {
    setTabQueries((prev) => ({ ...prev, [activeTab]: query }));
  }

  function syncQuery(tabId: TabId, value: string) {
    setTabQueries((prev) => ({
      ...prev,
      [tabId]: TAB_CONFIG[tabId].buildQuery(value)
    }));
  }

  return (
    <div className={styles.page}>
      {/* ── Site header ── */}
      <header className={styles.siteHeader}>
        <div className={styles.headerInner}>
          <div className={styles.brandRow}>
            <span className={styles.brandName}>SpaceMatch</span>
            <span className={styles.brandSep}>|</span>
            <span className={styles.brandProduct}>Space Procurement Intelligence</span>
          </div>
          <div className={styles.headerRight}>
            <Link href="/" className={styles.navLink}>
              Capability Search →
            </Link>
            <span className={styles.poweredBy}>Find buyers and programs for your space hardware</span>
          </div>
        </div>
        <div className={styles.goldRule} />
      </header>

      {/* ── Active capability banner ── */}
      <div className={styles.matterBanner}>
        <div className={styles.matterInner}>
          <div className={styles.matterLeft}>
            <div className={styles.matterLabel}>Active Capability</div>
            <div className={styles.matterTitle}>SpaceMatch — Space Procurement Intelligence</div>
          </div>
          <div className={styles.matterFields}>
            <label className={styles.matterField}>
              <span className={styles.matterFieldLabel}>What do you sell?</span>
              <input
                className={styles.matterInput}
                value={judgeName}
                onChange={(e) => {
                  setJudgeName(e.target.value);
                  syncQuery("judge", e.target.value);
                }}
                placeholder="e.g. radiation-hardened microprocessors for small satellites"
              />
            </label>
            <label className={styles.matterField}>
              <span className={styles.matterFieldLabel}>Capability Mirror</span>
              <input
                className={styles.matterInput}
                value={firmName}
                onChange={(e) => {
                  setFirmName(e.target.value);
                  syncQuery("counsel", e.target.value);
                }}
                placeholder="Capability description"
              />
            </label>
            <label className={styles.matterField}>
              <span className={styles.matterFieldLabel}>Capability Mirror</span>
              <input
                className={styles.matterInput}
                value={entityName}
                onChange={(e) => {
                  setEntityName(e.target.value);
                  syncQuery("entity", e.target.value);
                }}
                placeholder="Capability description"
              />
            </label>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className={styles.tabBar}>
        {TABS.map((tabId) => {
          const tabTs = tabStates[tabId];
          return (
            <button
              key={tabId}
              className={`${styles.tab} ${activeTab === tabId ? styles.tabActive : ""}`}
              onClick={() => switchTab(tabId)}
              type="button"
            >
              <span className={styles.tabLabel}>{TAB_CONFIG[tabId].label}</span>
              <span className={styles.tabMeta}>{TAB_CONFIG[tabId].description}</span>
              {tabTs.results !== null && !tabTs.pending && (
                <span className={styles.tabBadge}>{tabTs.results.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main workspace ── */}
      <div className={styles.workspace}>
        {/* Left: API Inspector */}
        <div className={styles.inspector}>
          <div className={styles.inspectorSection}>
            <div className={styles.sectionLabel}>API Call Inspector</div>
            <div className={styles.endpoint}>
              <span className={styles.endpointMethod}>POST</span>
              <span className={styles.endpointUrl}>External search API</span>
            </div>
          </div>

          <div className={styles.inspectorSection}>
            <div className={styles.sectionLabel}>Query editor</div>
            <textarea
              className={styles.queryEditor}
              value={liveQuery}
              onChange={(e) => updateQueryForActiveTab(e.target.value)}
            />
          </div>

          <div className={styles.inspectorSection}>
            <div className={styles.sectionLabel}>Parameters to be sent</div>
            <pre className={styles.jsonBlock}>{prettyJson(previewPayload)}</pre>
          </div>

          <div className={styles.inspectorSection}>
            <div className={styles.sectionLabel}>Why these parameters?</div>
            <p className={styles.rationaleText}>{cfg.rationale}</p>
          </div>

          <div className={styles.inspectorAction}>
            <button
              className={styles.runButton}
              onClick={runSearch}
              disabled={ts.pending}
              type="button"
            >
              {ts.pending ? "Searching..." : ts.results !== null ? "Re-run search" : "Run search"}
            </button>
          </div>
        </div>

        {/* Right: Results panel */}
        <div className={styles.resultsPanel}>
          <div className={styles.resultsPanelHeader}>
            <div className={styles.resultsPanelTitle}>
              {isWestlaw ? "Legacy Coverage" : "Live Search Results"}
              {ts.results !== null && !isWestlaw && !ts.pending && (
                <span className={styles.resultCount}>{ts.results.length} results</span>
              )}
            </div>
            <button
              className={`${styles.westlawToggle} ${isWestlaw ? styles.westlawActive : ""}`}
              onClick={toggleWestlaw}
              type="button"
            >
              {isWestlaw ? "← Back to Search" : "vs Legacy"}
            </button>
          </div>

          <div className={styles.resultsPanelBody}>
            {/* ── Legacy comparison pane ── */}
            {isWestlaw && (
              <div className={styles.westlawPane}>
                <div className={styles.westlawGlyph}>◌</div>
                <div className={styles.westlawCoverageLabel}>Coverage Analysis</div>
                <h2 className={styles.westlawHeading}>Coverage Gap</h2>
                <div className={styles.westlawDivider} />
                <p className={styles.westlawMessage}>{cfg.westlawNote}</p>
                <p className={styles.westlawSub}>
                  Static supplier databases and generic procurement tools miss the live web
                  announcements, hiring trends, and partnership activity retrieved in real time
                  for this class of signal.
                </p>
                <div className={styles.westlawExaNote}>
                  This intelligence is retrieved live from the open web
                </div>
              </div>
            )}

            {/* ── Loading skeleton ── */}
            {!isWestlaw && ts.pending && (
              <div className={styles.loadingPane}>
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
              </div>
            )}

            {/* ── Error state (shows attempted query for conversational demo) ── */}
            {!isWestlaw && !ts.pending && ts.error && (
              <div className={styles.errorPane}>
                <div className={styles.errorAttempted}>Search attempted with query</div>
                <div className={styles.errorQuery}>
                  &ldquo;{ts.executedQuery ?? String(previewPayload.query ?? "")}&rdquo;
                </div>
                <div className={styles.errorMessage}>{ts.error}</div>
                <div className={styles.errorContinue}>
                  The query above was sent to the search system. You can continue the demo conversation
                  using this query as context — the search intent and parameters are fully
                  visible in the inspector.
                </div>
              </div>
            )}

            {/* ── Empty state ── */}
            {!isWestlaw && !ts.pending && !ts.error && ts.results === null && (
              <div className={styles.emptyPane}>
                <div className={styles.emptyGlyph}>◈</div>
                <p className={styles.emptyText}>
                  Run the search to retrieve live intelligence from the web.
                  The query and parameters are visible in the inspector.
                </p>
              </div>
            )}

            {/* ── Results ── */}
            {!isWestlaw && !ts.pending && ts.results !== null && (
              <div className={styles.resultsStack}>
                {ts.note && <div className={styles.resultsNote}>{ts.note}</div>}
                <div className={styles.resultsList}>
                  {ts.results.length === 0 ? (
                    <div className={styles.emptyPane}>
                      <p className={styles.emptyText}>
                        No results returned for this query. Try adjusting the capability context
                        and re-running.
                      </p>
                    </div>
                  ) : (
                    ts.results.map((result) => (
                      <article key={result.id} className={styles.resultCard}>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.resultTitleLink}
                        >
                          <h3 className={styles.resultTitle}>{result.title}</h3>
                        </a>
                        <div className={styles.resultCitation}>
                          <span>{result.domain}</span>
                          <span className={styles.citationDot}>&middot;</span>
                          <span>{formatDate(result.publishedDate)}</span>
                        </div>
                        {result.highlights.length > 0 ? (
                          <div className={styles.highlights}>
                            {result.highlights.slice(0, 2).map((hl, i) => (
                              <div key={i} className={styles.highlight}>
                                <span className={styles.highlightLabel}>Highlight</span>
                                {activeTab === "counsel"
                                  ? renderHighlightedText(hl, firmName)
                                  : hl}
                              </div>
                            ))}
                          </div>
                        ) : result.snippet ? (
                          <p className={styles.snippet}>
                            {activeTab === "counsel"
                              ? renderHighlightedText(result.snippet, firmName)
                              : result.snippet}
                          </p>
                        ) : null}
                        {activeTab === "judge" && (
                          <div className={styles.contactBlock}>
                            <span className={styles.contactLabel}>Contact</span>
                            {result.contact ? (
                              <div className={styles.contactDetails}>
                                <strong>{result.contact.name}</strong>
                                <span>{result.contact.title}</span>
                                {result.contact.url ? (
                                  <a
                                    href={result.contact.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.contactLink}
                                  >
                                    {result.contact.url.includes("linkedin.com")
                                      ? "LinkedIn"
                                      : "Profile"}
                                  </a>
                                ) : null}
                              </div>
                            ) : (
                              <div className={styles.contactNeeded}>Research needed</div>
                            )}
                          </div>
                        )}
                      </article>
                    ))
                  )}
                </div>

                <div className={styles.rawResponseSection}>
                  <button
                    className={styles.rawResponseToggle}
                    onClick={() => setShowRawResponse((current) => !current)}
                    type="button"
                  >
                    {showRawResponse ? "Hide raw API response" : "Show raw API response"}
                  </button>
                  {showRawResponse && (
                    <pre className={styles.rawResponseBlock}>
                      {prettyJson(ts.executedResponse ?? {})}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
