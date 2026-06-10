# ExposureGraph — Product Requirements Document

**Version:** 1.0 · **Date:** June 2026 · **Status:** Draft for review
**Scope:** UX prototype (fake data, no real integrations) at `app/exposure/`

---

## 1. Executive summary

ExposureGraph is an interactive UX prototype for **continuous threat exposure management (CTEM)**: it renders an organization's assets, identities, and alerts as an explorable graph, from a clustered bird's-eye view down to individual entities and attack paths.

The prototype already proves the *exploration* story (semantic zoom, entity detail, scripted attack paths). Market research shows that exploration alone is table stakes — every serious competitor has a graph. What differentiates winning products is that **the graph answers questions and ends in an action**: *what do I fix first, what does fixing it buy me, and is my posture improving?*

This PRD defines the features that turn ExposureGraph from "a beautiful graph" into "the most valuable security graph UX," and a phased implementation plan mapped to the existing codebase.

**What the prototype must prove:** that each of three personas (analyst, engineer, CISO) can complete their core job in under 3 clicks from page load, with the graph as the explanation — never as a hairball.

---

## 2. Market research

### 2.1 Competitor landscape

| Product | Signature graph-UX idea | What we take from it |
|---|---|---|
| **Wiz Security Graph** | *Toxic combinations* — correlates misconfigs, vulnerabilities, network paths, and identity access so individually low-risk issues that chain into a critical path surface as one finding. "Fewer alerts, clearer impact." | The graph must explain *why* a combination is dangerous, in plain language, at the point of discovery. |
| **XM Cyber** | *Choke points* — graph analysis finds nodes where many attack paths converge, so one remediation eliminates the most paths. | Rank fixes by paths-severed, not by CVSS score. |
| **BloodHound Enterprise (SpecterOps)** | *Impact × Exposure scoring + blast radius* (v7); cutting a single choke point severs an average of **17,000 attack paths**. v8 added Privilege Zones and OpenGraph for custom entity types. | Click any node → see everything an attacker could reach from it, quantified. |
| **Microsoft Security Exposure Management** | Unified exposure view across tools; attack-path analysis tied to critical-asset classification. | Critical assets are the gravity wells of the UI — every path is judged by what it reaches. |
| **Pentera** | *Validation* — actually executes attacks rather than modeling them; proves exploitability. | Even with fake data, the prototype should *demonstrate* consequence (simulate a fix, watch paths disappear) rather than assert it. |

### 2.2 Practitioner insights

1. **"Discovery is easy; fixing is the bottleneck."** Security leaders consistently report that tools showing *what's wrong* are commodity; the value is "show me what to prioritize right now with the limited resources I have, and show my team how to fix it." Remediation queues integrated into workflow beat dashboards.
2. **Choke points are the highest-leverage graph-native concept.** Only a graph can compute them, and they convert thousands of findings into a handful of actions.
3. **Blast radius makes risk tangible.** "What can an attacker reach from here?" is the question analysts ask first when triaging an alert.
4. **Toxic combinations justify the graph's existence.** A list can show a vulnerability; only a graph can show *vulnerability + internet-facing + admin path to the customer database*.
5. **The hairball is the #1 failure mode of graph UIs.** Node-link diagrams become unreadable above ~3 edges per node; users want "the most important entities and connections, not everything everywhere all at once." Progressive disclosure, filtering, and working backwards from the user's job are the established cures. (Our semantic zoom is already aligned with this.)
6. **Executives need exactly three outputs:** a risk-posture score, a prioritized remediation queue, and a trend line showing whether exposure is increasing or decreasing.
7. **One graph, three altitudes.** Analysts investigate, engineers remediate, CISOs report — the same underlying graph must serve all three without forcing any of them through the others' view.

### 2.3 Sources

- [Wiz — What is Attack Path Analysis?](https://www.wiz.io/academy/detection-and-response/attack-path-analysis) · [Wiz Security Graph](https://www.wiz.io/lp/wiz-security-graph)
- [XM Cyber — Continuous Threat Exposure Management](https://xmcyber.com/ctem/)
- [SpecterOps — BloodHound v7.0 UX & Attack Path Optimizations](https://specterops.io/blog/2025/02/11/enhancements-for-bloodhound-v7-0-provide-fresh-user-experience-and-attack-path-risk-optimizations/) · [BloodHound v8: Usability, Extensibility, and OpenGraph](https://specterops.io/blog/2025/07/29/bloodhound-v8-usability-extensibility-and-opengraph/)
- [Software Analyst — Market Guide 2025: Modern Risk & Exposure Management Platforms](https://softwareanalyst.substack.com/p/market-guide-2025-evolution-of-modern)
- [Recorded Future — The CISO's Guide to CTEM](https://www.recordedfuture.com/blog/ciso-guide-continuous-threat-exposure-management)
- [Rapid7 — CTEM Explained](https://www.rapid7.com/fundamentals/what-is-continuous-threat-exposure-management-ctem/)
- [Cambridge Intelligence — Graph visualization: fixing data hairballs](https://cambridge-intelligence.com/how-to-fix-hairballs/) · [Graph visualization UX](https://cambridge-intelligence.com/graph-visualization-ux-how-to-avoid-wrecking-your-graph-visualization/)
- [Reclaim Security — Top CTEM Vendors Guide](https://reclaim.security/blog/ctem-vendors-guide/) · [Terra Security — Top 10 CTEM Vendors](https://www.terra.security/blog/top-ctem-vendors)

---

## 3. Personas & jobs-to-be-done

### Maya — Security Analyst (SOC, triage)
> *"An alert fired on a contractor laptop. Is this real, and how bad could it get?"*

- Finds the entity behind an alert in seconds (search or click-through from alert node).
- Sees **blast radius** instantly: what the attacker could reach from the compromised node, and whether any critical asset is in range.
- Walks the attack path hop by hop to understand the kill chain before escalating.

### Daniel — Security Engineer (remediation)
> *"I have one sprint. Which fix removes the most risk?"*

- Opens the **remediation queue** and sees fixes ranked by impact ("severs 2 attack paths, −12 org risk").
- Clicks a fix → graph highlights the choke point and every path through it.
- Hits **Simulate fix** → watches the severed paths vanish and the org score drop. Screenshot goes in the sprint ticket.

### Priya — CISO (posture & reporting)
> *"Board meeting Thursday. Are we better off than last quarter, and what's the plan?"*

- One keystroke to **Exec mode**: risk score, 90-day trend, top-5 remediation queue — board-ready.
- Never sees a hairball; the graph is a backdrop that makes the numbers credible.

---

## 4. Design principles

1. **Answer questions, don't draw pictures.** Every view exists to answer one of: *How bad? What first? Is it working?* If a visual element doesn't serve one of those, cut it.
2. **Progressive disclosure beats completeness.** The full graph is never shown at full fidelity. Altitude (zoom), lenses (modes), and filters each reveal only what the current question needs. This is the anti-hairball contract.
3. **Every view ends in an action.** Blast radius ends in "escalate / contain." Choke point ends in "fix this." Trend ends in "report." Dead-end views are bugs.
4. **The graph is the explanation; the queue is the workflow.** Users live in the ranked list of fixes; they drop into the graph when they need to understand or convince. Both must always be one click apart.

---

## 5. Feature requirements

Priorities: **P0** = makes the prototype's core argument · **P1** = deepens the story · **P2** = breadth/polish.

### P0-1 · Choke-point lens
> *As Daniel, I want to see which nodes the most attack paths flow through, so one fix buys maximum risk reduction.*

- Toolbar toggle **"Choke points"** (peer of the existing Attack-paths toggle).
- When active: node size/glow scales with the number of attack paths traversing the node; non-participating nodes dim (reuse attack-mode dimming).
- Clicking a choke point shows a callout: **"Fixing this severs N of M attack paths."**
- Side panel gains a "Choke point" section: paths through this node, listed by name, each clickable to focus.

### P0-2 · Blast-radius mode
> *As Maya, I want to select any node and see everything an attacker could reach from it, so I can judge severity in seconds.*

- New **"Blast radius"** action button in the side panel for the selected node.
- Animated flood-fill: reachability wave expands hop by hop along directed edges (~300 ms per hop, reusing the rAF animation pattern), tinting reached nodes red-orange and unreached ones dim.
- Side panel summary: **"Reaches 23 entities, including 2 critical assets"** with the critical assets named and clickable.
- Esc or background-click exits the mode cleanly.

### P0-3 · Remediation queue + fix simulation *(the wow-moment)*
> *As Daniel, I want a ranked list of fixes with quantified impact, and I want to preview a fix on the graph before I commit a sprint to it.*

- New collapsible **Remediation Queue** panel (bottom-left, above zoom controls): top 5 fixes ranked by impact, each as "**Patch CVE-XXXX on vpn-1** — severs 2 attack paths · org risk −12."
- Click a fix → camera flies to the affected subgraph; relevant paths highlight.
- **"Simulate fix"** button: severed edges fade out, dependent attack-path segments dissolve, header org-risk score animates down, queue re-ranks. **"Undo simulation"** restores. Purely client-side state; no persistence.
- Header gains an **org risk score** (0–100) computed from live entity data so the simulation visibly moves it.

### P1-1 · Attack-path playback
> *As Maya, I want to replay an attack hop by hop with narration, so I can brief others on the kill chain.*

- In attack-path focus view: **play / step-forward / step-back** controls.
- Each step: camera eases to the current hop, the node pulses, a caption explains the technique ("Phished credential used to authenticate to VPN gateway").
- Hop captions are hand-authored per scripted path in `data.ts`.

### P1-2 · Toxic-combination callouts
> *As Maya, I want the graph to tell me when individually minor issues combine into a critical exposure.*

- 3–4 hand-authored toxic combos in the data (e.g., *internet-facing + critical CVE + admin edge to database*).
- Affected nodes get a stacked **"⚠ toxic combo"** badge; hovering shows a plain-language one-liner: "Low-severity items that chain: public exposure → unpatched service → admin access to Customer DB."
- Clicking the badge selects the combo: its nodes/edges highlight as a mini-path, side panel explains each ingredient.

### P1-3 · Posture trend in header
> *As Priya, I want to see at a glance whether exposure is improving.*

- Header stat cards gain a **90-day sparkline** of org risk (seeded fake series, ending at the live score) and a delta chip ("▼ 8 pts vs last week").

### P2-1 · Exec mode
- Keyboard shortcut / header button toggles a board-ready overlay: org risk score (large), trend chart, top-5 remediation queue, critical-asset status row. Graph stays visible but dimmed as backdrop. One key to exit back to analyst view.

### P2-2 · Incident time scrubber
- A timeline scrubber for one scripted incident: dragging replays the graph state at each timestamp (alert appears → lateral movement edge appears → containment). Demonstrates the "what happened when" forensic story.

---

## 6. Out of scope

- Real data sources, scanners, or integrations (Jira/ServiceNow ticketing is *referenced* in copy, not implemented).
- Authentication, multi-user, persistence beyond client state.
- Mobile layout (desktop-first demo; minimum 1280 px).
- Real security analysis of any kind — all data remains seeded fiction.

---

## 7. Success criteria

1. **Three personas, three clicks:** alert → blast radius (Maya); load → top fix simulated (Daniel); load → exec view (Priya) — each in ≤ 3 clicks from page load.
2. **No hairball, ever:** no view renders all entities at full opacity with labels; every mode dims or hides what it doesn't need.
3. **The fix-simulation demo lands:** simulate → paths dissolve → score drops, in one unbroken animation under 3 seconds.
4. **Deterministic:** every load renders identically (seeded data, stable layout) so demos are reproducible.
5. `npm run build` stays green; no new dependencies.

---

## 8. Implementation plan

All work extends the existing hand-rolled SVG architecture — no graph libraries. Files referenced are under `app/exposure/`.

### Phase 1 — P0: the value argument (~1 session)

1. **Data & derived analytics** (`lib/types.ts`, `lib/data.ts`, new `lib/analytics.ts`):
   - Add `Fix` type (id, title, targetEntityId, severedEdgeIds, pathsSevered, riskDelta).
   - `lib/analytics.ts`: pure functions over the existing graph — `chokePointCounts(paths)` (paths per node), `blastRadius(entityId, edges)` (BFS reachability with hop depth), `orgRiskScore(entities)`, `rankFixes(...)`. All deterministic, computed in `useMemo`.
2. **Choke-point lens** (`components/GraphCanvas.tsx`, `components/Toolbar.tsx`): new `viewMode: 'normal' | 'chokepoints' | 'blast'` state in `GraphExplorer.tsx`; reuse the attack-mode dimming/highlight pipeline; node radius scaled by path count.
3. **Blast-radius mode** (`GraphCanvas.tsx`, `components/SidePanel.tsx`): hop-staged tinting driven by a `blastStep` state advanced on a rAF timer (same easing helpers as camera animation); summary block in side panel.
4. **Remediation queue + simulation** (new `components/RemediationQueue.tsx`, `GraphExplorer.tsx` state `simulatedFixIds: Set<string>`): simulated fixes filter edges/paths in the existing `useMemo` pipeline so dissolution falls out of current rendering; animate the header score with the existing easing utility.

### Phase 2 — P1: the storytelling layer (~1 session)

1. **Path playback**: `playbackStep` state + per-hop captions added to the scripted paths in `data.ts`; camera fly-to reuses `animateTransform` in `GraphExplorer.tsx`; small transport-controls strip in the path focus panel.
2. **Toxic combos**: authored in `data.ts` as mini-paths with `explanation` strings; badge rendering in `GraphCanvas.tsx`; selection treats a combo like a focused path (reuse path-focus code).
3. **Trend sparkline**: seeded 90-day series in `data.ts`; tiny inline SVG sparkline component in the header (no chart lib).

### Phase 3 — P2: breadth & polish (~1 session)

1. **Exec mode**: overlay component with large stats + queue; `execMode` boolean in `GraphExplorer.tsx`; keyboard handler.
2. **Time scrubber**: one scripted incident as an ordered list of graph-state deltas in `data.ts`; scrubber maps position → applied deltas (edges/alerts shown or hidden through the existing filter pipeline).

### Verification (every phase)

- `npm run dev` → walk each persona journey end-to-end at `/exposure`.
- `npm run build` green; existing flashcard route unaffected.
- Headless-Chrome screenshots (Puppeteer, already proven in this environment) of each new mode for the PR/demo record.
