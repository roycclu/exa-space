import Link from "next/link";

import styles from "./page.module.css";

const ICP_ROWS = [
  {
    icp: "Scientific Researcher",
    opportunity: "Neural search finds conceptually related papers across disciplines",
    rejectionReason:
      "Status quo moat: lead researchers rely on established networks and journal subscriptions. Switching cost is low but habit is strong.",
    status: "❌ Deprioritized",
    statusTone: "negative"
  },
  {
    icp: "Pharma Clinical Trial Coordinator",
    opportunity: "Find trial-eligible patients and research sites via open web signals",
    rejectionReason:
      "Patient privacy constraints are fundamental. Open web indexing cannot access the clinical data that matters most. Hard to demonstrate value before hitting the wall.",
    status: "❌ Deprioritized",
    statusTone: "negative"
  },
  {
    icp: "Space Industry — Seller & Procurement",
    opportunity:
      "New buyers and sellers lack legacy procurement relationships. Fast-growing, fragmented market where information asymmetry is the core problem.",
    rejectionReason:
      "No fatal objection — competition exists but is not well-differentiated.",
    status: "✅ Selected",
    statusTone: "positive"
  }
] as const;

const MARKET_CARDS = [
  {
    title: "Market Attractiveness",
    items: [
      "$626B global space economy, 80% commercial",
      "Growing at 7-9% CAGR toward $2T by 2040",
      "490+ funded startups, new entrants weekly",
      "New buyers and sellers entering without legacy procurement relationships",
      "Space Force awarding 20 new commercial contracts in 2026 alone"
    ]
  },
  {
    title: "Competitive Landscape",
    items: [
      "SpaceNexus: directory and marketplace, not intelligence",
      "SAM.gov: government prime contracts only, keyword search",
      "GovWin/GovDash: government-focused, expensive, no commercial layer",
      "Gap: nobody tracks commercial signals — program announcements, funding rounds, job postings, technical blogs — as procurement intelligence"
    ]
  },
  {
    title: "Feasibility for Exa",
    items: [
      "GTM enrichment is a core Exa use case",
      "Neural search infers buyer intent from capability descriptions, not just keywords",
      "Websets enable ongoing monitoring of new program announcements",
      "Contents API extracts structured intelligence from unstructured web pages",
      "No specialized data access required — all signals are on the open web"
    ]
  }
] as const;

const SELLER_JOURNEY = [
  "Identify target programs and primes",
  "Track program announcements and funding signals",
  "Qualify opportunity (budget, timeline, fit)",
  "Prioritize outreach",
  "Engage procurement team"
] as const;

const BUYER_JOURNEY = [
  "Define technical requirements",
  "Search for qualified suppliers",
  "Evaluate capabilities and track record",
  "Request for information / proposal",
  "Award contract"
] as const;

const BUYER_SIGNALS = [
  "Technical blog posts describing new component capabilities",
  "GitHub repos showing working prototypes",
  "Conference presentation abstracts",
  "Funding announcements (Series A/B signals scaling production)",
  "Job postings (hiring propulsion engineers = building something)",
  "Patent filings",
  "Partnership announcements with primes"
] as const;

const SELLER_SIGNALS = [
  "Program launch date announcements",
  "New satellite constellation plans",
  "Mission architecture documents",
  "RFI (Request for Information) notices — pre-RFP signals",
  "Budget allocation announcements from agencies",
  "New program office establishment",
  "Technology demonstration contracts awarded"
] as const;

function WorkflowColumn({
  title,
  steps,
  highlightAfter
}: {
  title: string;
  steps: readonly string[];
  highlightAfter: number;
}) {
  return (
    <article className={styles.panel}>
      <div className={styles.cardBody}>
        <h3>{title}</h3>
        <div className={styles.workflowStack}>
          {steps.map((step, index) => (
            <div key={step}>
              <div className={styles.workflowBox}>
                <span className={styles.workflowIndex}>Box {index + 1}</span>
                <span>{step}</span>
              </div>
              {index === highlightAfter ? (
                <div className={styles.workflowArrow}>
                  <span className={styles.workflowArrowIcon}>↓</span>
                  <span className={styles.workflowArrowLabel}>Exa targets here</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function IcpPage() {
  return (
    <div className={styles.page}>
      <header className={styles.siteHeader}>
        <div className={styles.headerInner}>
          <div className={styles.brandRow}>
            <span className={styles.brandName}>Exa Space</span>
            <span className={styles.brandSep}>|</span>
            <span className={styles.brandProduct}>ICP Debrief</span>
          </div>
          <div className={styles.headerActions}>
            <Link href="/" className={styles.headerLink}>
              Demo Home
            </Link>
          </div>
        </div>
        <div className={styles.goldRule} />
      </header>

      <main className={styles.content}>
        <div className={styles.shell}>
          <section className={styles.hero}>
            <p className={styles.eyebrow}>ICP Debrief</p>
            <h1>ICP Selection: Why Exa Can Win Space Procurement GTM</h1>
            <p className={styles.subtitle}>Three verticals evaluated. One clear winner.</p>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionLabel}>Section 1</span>
              <h2>ICP Evaluation Table</h2>
            </div>
            <div className={styles.panel}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ICP</th>
                      <th>Opportunity</th>
                      <th>Rejection Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ICP_ROWS.map((row) => (
                      <tr key={row.icp}>
                        <td>{row.icp}</td>
                        <td>{row.opportunity}</td>
                        <td>{row.rejectionReason}</td>
                        <td>
                          <span className={`${styles.statusPill} ${styles[row.statusTone]}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionLabel}>Section 2</span>
              <h2>Market Assessment</h2>
            </div>
            <div className={styles.cardGrid}>
              {MARKET_CARDS.map((card) => (
                <article key={card.title} className={styles.panel}>
                  <div className={styles.cardBody}>
                    <h3>{card.title}</h3>
                    <ul className={styles.bulletList}>
                      {card.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionLabel}>Section 3</span>
              <h2>Workflow Diagrams</h2>
            </div>
            <div className={styles.workflowGrid}>
              <WorkflowColumn title="Seller Journey" steps={SELLER_JOURNEY} highlightAfter={0} />
              <WorkflowColumn title="Buyer Journey" steps={BUYER_JOURNEY} highlightAfter={1} />
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionLabel}>Section 4</span>
              <h2>What signals matter beyond formal RFPs?</h2>
            </div>
            <div className={styles.signalGrid}>
              <article className={styles.panel}>
                <div className={styles.cardBody}>
                  <h3>Signals that help Buyers find the right Seller</h3>
                  <ul className={styles.bulletList}>
                    {BUYER_SIGNALS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className={styles.panel}>
                <div className={styles.cardBody}>
                  <h3>Signals that help Sellers find the right Buyer</h3>
                  <ul className={styles.bulletList}>
                    {SELLER_SIGNALS.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </div>

            <div className={styles.callout}>
              Exa&apos;s neural search finds these signals by meaning, not keyword — a seller
              describing &quot;radiation-hardened microprocessors&quot; finds buyers talking
              about &quot;LEO satellite hardened electronics&quot; even when exact terms
              don&apos;t match.
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
