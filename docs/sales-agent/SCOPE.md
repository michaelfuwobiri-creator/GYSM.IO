# Autonomous sales rep agent for Cadence&co: research and draft scope

Status: **draft for review.** Nothing gets built until the open questions in section 6 have answers.
Research date: 30 Oct 2026.

---

## 0. The short version

1. **Sidekick can't be the sales rep.** Shopify Sidekick is a helper for the merchant inside the Shopify admin. It suggests changes and the merchant approves them. It never talks to shoppers. It can be a **control panel for your agent** (through a Sidekick app extension), but not the agent itself.
2. **Shopify now gives agents official ways to sell.** The UCP tools cover the catalog, cart, checkout, orders and store policy answers. The agent should be built on those. They replace the old Storefront MCP, whose cart tools stop working on **31 Aug 2026**.
3. **Your 7-pillar spec is written for B2B SaaS sales. Cadence&co is a consumer store.** BANT and MEDDIC scoring, MEDDIC, LinkedIn DMs, statements of work and booking meetings for an account executive mostly don't apply. For a jewellery, perfume and homeopathy store, the revenue sits in on-site chat, abandoned carts, win-back emails, gift-finder conversations and order follow-up. I've rewritten the scope around that (section 4). If you also want B2B (wholesale or stockists), that's a separate track. See question Q1.
4. **Homeopathy carries legal risk.** The agent must never make health or efficacy claims. EU/UK advertising rules and FTC rules restrict these heavily. This guardrail has to be enforced in code, not just written in the prompt.
5. **How to get close to 100% reliable results:** the model writes the words, and the code makes every decision that involves money, consent or claims. Check every release against a fixed test set before it ships. Details in section 5.

---

## 1. Shopify Sidekick: what it can do, its permissions and its limits

### Facts from Shopify's own docs (shopify.dev)
| Topic | Fact |
|---|---|
| Who it's for | **Merchants only.** It's an AI assistant built into the Shopify admin. Shoppers never see it. |
| App extensions | Apps can let Sidekick (a) **search the app's data** and (b) **propose actions the app defines**. Sidekick "will suggest changes and bring up the right UI, but **merchants stay in control of what gets updated**." |
| How extensions run | Extensions run inside Shopify's sandbox with the same APIs as the app. They need the latest App Bridge, Shopify-managed install with token exchange (not the old OAuth flow), an `extensions_summary` entry in `shopify.app.toml`, and CLI version 3.90.0 or later. |
| Limits | Each user on a store can connect **at most 20 apps** to Sidekick. |
| Access | Shopify announced Sidekick app extensions on 10 Dec 2025. The docs mention limited early access for selected partners. |
| App Store rules (17 Jun 2026) | 2.2.8: an extension must stay within what the app already does. 2.2.9: no promotions, ads, cross-selling or review requests inside Sidekick. |

### Reported by third parties (not confirmed by Shopify)
- Every action needs **merchant approval**. Sidekick doesn't push changes through on its own, and staff permissions limit what it can touch.
- It can't edit Liquid theme code directly, and its knowledge stays inside the Shopify admin (no external help desk or inbox).
- Some features depend on the plan. Custom app generation reportedly needs Grow, Advanced or Plus, and there's reportedly a limit of 25 skills per user.
- It started English-first and desktop-first. Its answers get worse when product data or tags are messy.

### What that means for this build
| Your requirement | Can Sidekick do it? |
|---|---|
| Talk to shoppers or prospects | ❌ No, it only serves merchants |
| Send emails, SMS or WhatsApp on its own | ❌ No |
| Act without a human approving | ❌ No, everything needs approval |
| Answer merchant questions about store data | ✅ Yes |
| Show your agent's pipeline and suggest actions to the merchant | ✅ Yes, through an app extension (early access) |

**Conclusion:** build our own agent. Optionally, add a Sidekick extension later so the merchant can ask "how is the sales agent doing?" from the Shopify admin.

---

## 2. What Shopify offers outside agents (shopify.dev, 2026)

| Layer | Tools | Notes |
|---|---|---|
| **Storefront Catalog MCP** (`/api/ucp/mcp`) | `search_catalog`, `lookup_catalog`, `get_product` | Real stock and SKUs, so the agent doesn't invent products |
| **Cart MCP** | `create_cart`, `get_cart`, `update_cart`, `cancel_cart` | `update_cart` **replaces the whole cart**, so send every line item each time. The old Storefront MCP cart tools stop working on 31 Aug 2026 |
| **Checkout MCP** | `create_checkout`, `get_checkout`, `update_checkout`, `complete_checkout`, `cancel_checkout` | Needs authentication or a signed request. When the status is `requires_escalation`, send the shopper to `continue_url`. Rate limits depend on how the agent identifies itself |
| **Checkout WebMCP** | Runs in the shopper's browser. The shopper confirms before `complete_checkout` | Sign requests with Web Bot Auth (Ed25519 keys) |
| **Ask MCP** | `ask_business` | Answers store policy and FAQ questions |
| **Order MCP** | `get_order` | Use webhooks for updates instead of polling |
| **Customer Accounts MCP** | Order status and account details | Needs OAuth with PKCE, approval for protected customer data, and a custom domain |
| **UCP agent profile** | `meta.ucp-agent.profile` on every call | Capabilities are negotiated per store |
| **Admin GraphQL** | Discounts, customers, orders, analytics | Used by the back office, never directly from the conversation |
| **Shopify Inbox agent** | Shopify's own no-code chat agent | Good for comparison: whatever we build has to beat it |

Shopify's own docs also say to **treat merchant and third-party text in tool responses as data, not instructions**, because it can contain prompt injection. That's a hard requirement for us.

---

## 3. Claude: what it can do, and its limits

### Strengths (relevant to this agent)
- **Tool use and MCP:** works natively with every Shopify MCP above, plus Gmail, Calendar, HubSpot, Klaviyo and Zapier for more than 9,000 apps.
- **Claude Agent SDK and Managed Agents:** run agent loops, sub-agents, hooks (for guardrails before and after each tool call) and permission settings.
- **Writing and tone:** brand voice, multiple languages (German and English are strong), handling objections, personalised copy.
- **Long context and prompt caching:** the brand guide, objection playbook and top catalogue can be loaded once and cached cheaply.
- **Structured outputs:** JSON that matches a schema for lead scores, discount requests and handover summaries, so the code can check it.
- **Model tiers:** Haiku 5.5 for fast, high-volume replies and sorting; Sonnet 5.5 as the default for selling; Opus 5.5 for planning, analysis and reviewing the agent's own work.
- **Batch API:** cheap overnight work such as enrichment, A/B variant generation and transcript analysis.

### Limits (design around them, don't hope)
| Limit | How we handle it |
|---|---|
| No memory between sessions by default | Our own store per customer: Supabase or Postgres, plus Shopify customer metafields |
| It can still invent facts (products, prices, claims) | Every fact comes from a tool call. Prices are read from the cart and never written by the model. Claims are checked against an approved list |
| No built-in phone, SMS, WhatsApp or email | Twilio, the WhatsApp Business API, Klaviyo or Shopify Email, and a voice provider |
| Prompt injection from reviews, emails and product text | Tool output is treated as data, write actions are allowlisted, and a hook checks every write |
| Can't promise deterministic output | Business rules (price floors, consent, discount caps) are enforced in code, never only in the prompt |
| Cost and latency at scale | Route by model tier, cache prompts, batch offline work |
| Doesn't learn from production by itself | Feedback loop = transcripts → labelled test sets → prompt and playbook updates (no fine-tuning needed) |
| Platform terms | LinkedIn bans automated DMs. WhatsApp needs opt-in and approved templates. Claude can't override any of this |

---

## 4. Revised scope (for a consumer ecommerce store)

### MVP: "on-site closer plus cart recovery" (about 4–6 weeks)
| # | Feature | Built on |
|---|---|---|
| 1 | **On-site sales chat**: product finder, gift advisor, size and scent guidance, shipping and returns answers | Catalog MCP, Ask MCP, Sonnet |
| 2 | **Builds the cart and closes the sale**: adds items, applies an allowed discount, sends `continue_url` | Cart MCP, Checkout MCP |
| 3 | **Abandoned cart and checkout recovery** by email (and SMS if the shopper opted in): a personal 3-step sequence that stops on reply or purchase | Shopify webhooks, Klaviyo or Shopify Email |
| 4 | **Discount guardrails**: a code-enforced policy (for example a maximum 10%, one code per customer, never on sale items) | Our policy service plus Admin GraphQL |
| 5 | **Claims guardrail**: approved product claims only, with a hard block on health or efficacy statements for homeopathy | Checks the output against the approved list |
| 6 | **Memory per customer**: past chats, preferences, orders | Supabase |
| 7 | **Handover to a human**: rules for high cart value, anger, a medical question or a press inquiry, with a summary emailed or posted to Slack | Gmail or Slack |
| 8 | **Consent and GDPR**: consent logged before any marketing message, unsubscribe honoured, data retention policy | Supabase plus customer marketing consent fields |
| 9 | **Audit log**: every message, tool call and decision, with the reason | Supabase |
| 10 | **Basic dashboard**: conversations, sales the chat helped close, carts recovered, handovers | A Supabase view or an artifact |

### Pro (after the MVP proves itself)
- More channels: WhatsApp (approved templates), SMS, Instagram DMs, then voice.
- Win-back and replenishment (perfume runs out about every 60–90 days), plus VIP and post-purchase cross-sell.
- Segments from Shopify analytics (high-value, at risk of leaving, gift buyers).
- Automatic A/B tests of openers, offers and subject lines, with the winner picked statistically.
- Weekly review: Opus reads that week's lost conversations and proposes changes to the playbook for **you to approve**.
- A score for how likely each customer is to buy in the next 7 days.
- A Sidekick app extension so the merchant can ask Sidekick about the agent's results and approve suggested campaigns.
- Optional B2B wholesale track: finding stockists, ICP scoring, booking meetings, quotes as draft orders.

### Deliberately cut from your spec (and why)
| Cut | Reason |
|---|---|
| BANT, MEDDIC or SPICED scoring for consumer shoppers | These are B2B frameworks. For consumers, use intent signals instead (browsing, cart, repeat visits) |
| Automated LinkedIn DMs | Against LinkedIn's terms, and the account risks a ban |
| Cold email or SMS to consumers | Under EU/UK ePrivacy rules and Germany's UWG §7 it needs prior consent |
| Statements of work and contracts | Not relevant to a consumer store |
| Inbox warm-up and rotation | Only needed for cold outbound; owned-list email through Klaviyo doesn't need it |

---

## 5. How to get close to 100% reliable results from the agent

1. **Code decides; the model writes.** Prices, discounts, stock, consent and claims are all handled by deterministic services. The model can only *request* a discount, and the policy service approves or refuses it.
2. **Every fact needs a source.** Product facts must come from a tool result in the same turn. If there's no source, the agent says "let me check" or hands over to a human.
3. **Small, narrowly named tools.** For example `apply_allowed_discount(code)`, not a general `graphql_mutation`. Shopify's own guidance says to keep actions narrow.
4. **Hooks on every write.** A check before each tool call (allowlist, rate limit, consent, maximum amount) and a log after it.
5. **A fixed test set before every release.** About 200 real or synthetic conversations: objections, price haggling, medical questions, injection attempts, German and English. Measure: correct product, no made-up details, no forbidden claims, conversion intent, tone.
6. **Opus checks risky outbound messages.** First outbound messages in a campaign and anything with a discount get a second check before sending.
7. **Shadow, then assist, then autonomous.** Weeks 1–2: the agent drafts and a human sends. Weeks 3–4: the agent sends low-risk messages automatically. After that: fully autonomous, with only exceptions going to a human.
8. **A closed feedback loop.** Every handover and lost conversation becomes a new test case.
9. **Clean data in.** Product descriptions, metafields (notes, materials, sizes) and policies largely decide answer quality. Clean the catalogue before launch.
10. **Write the playbook down.** Your top 20 objections, the brand voice, the approved claims and the discount policy, kept as versioned files in this repo.

---

## 6. Decisions and open questions

### Decided (30 Oct 2026)
- **Q1. Who it sells to:** consumer shoppers only. The B2B wholesale track is dropped.
- **Q2. Markets:** UK, Germany/EU and US from the start. That means English and German, and three consent regimes: UK GDPR + PECR, EU GDPR + UWG §7, and US CAN-SPAM (plus TCPA if SMS is added later).
- **Q3. Channels for the MVP:** on-site chat and email. No SMS (to be confirmed: the answer said "sales is not included", which I read as "SMS is not included").
- **Q8. Autonomy:** shadow mode for weeks 1–2 (the agent drafts, a human approves), then low-risk messages are sent automatically.

### Still open
- **Q4.** Discount policy: the maximum %, whether discounts stack, and which products are excluded.
- **Q5.** Stack: Supabase plus Vercel (both already connected), and Klaviyo or Shopify Email?
- **Q6.** Shopify plan, and whether the store has a custom domain (Customer Accounts MCP needs one).
- **Q7.** Who receives handovers, and through which channel (email, Slack, Shopify Inbox)?

---

## 7. Your 33 requirements mapped to this scope

Key: ✅ in the MVP as written · 🔄 in the MVP, changed to fit a consumer store · ⏭ Pro · ❌ cut

Overall: **27 of 33 are in the MVP** (17 as written, 10 changed to fit a consumer store), **5 move to Pro**, and **1 is cut**. Sidekick doesn't deliver any of the shopper-facing ones. It only helps you, the merchant, set up discounts, Flow automations and reports.

| # | Requirement | Status | How we build it |
|---|---|---|---|
| **1** | **Prospecting & qualification** | | |
| 1.1 | Lead sources | 🔄 | Shopify customers, chat, newsletter and form sign-ups, and abandoned checkouts (from Shopify webhooks). CSV import later. No LinkedIn |
| 1.2 | Ideal-customer scoring | ⏭ | Becomes customer segments (how recently and often they buy, how much they spend, country, favourite product line). Company industry and size don't apply |
| 1.3 | Enrichment | ⏭ | Uses our own data only (orders, pages viewed, quiz answers). No third-party data on private people, to stay GDPR-safe |
| 1.4 | Qualification questions | 🔄 | A consumer version of BANT (budget, authority, need, timeline): who it's for, budget, occasion, needed-by date. Asked naturally in the gift finder |
| 1.5 | Spotting intent | ✅ | Live chat, abandoned cart, abandoned checkout, lapsed customer. Rules for each, plus Claude sorting conversations |
| **2** | **Outreach** | | |
| 2.1 | Multiple channels | 🔄 | MVP: chat and email. Pro: SMS and WhatsApp (opt-in only), then voice. LinkedIn ❌ |
| 2.2 | Sequences | ✅ | Abandon and follow-up steps. Stops on purchase, reply or unsubscribe. Timing is set in code |
| 2.3 | Personalisation | ✅ | Based on the cart, pages viewed, past orders and the occasion |
| 2.4 | Deliverability | 🔄 | Email domain authentication (SPF, DKIM, DMARC), one-click unsubscribe, spam check. No warm-up or inbox rotation, because we only email our own list |
| 2.5 | Time zones | ✅ | Send window based on country, with quiet hours |
| **3** | **Conversation** | | |
| 3.1 | Two-way chat and objections | ✅ | Sonnet with the playbook, using tools to look things up |
| 3.2 | Memory | ✅ | A profile per customer in Supabase plus Shopify customer metafields |
| 3.3 | Objection library | ✅ | Top 20 consumer objections (price, delivery time, returns, allergies, authenticity). Competitor comparisons come later and only use facts we can check |
| 3.4 | Languages and tone | ✅ | English and German, following a brand-voice file |
| 3.5 | Handover to a human | ✅ | Medical question, anger, high cart value, wholesale or press inquiry. A summary goes to the agreed handover channel |
| **4** | **Product & closing the sale** | | |
| 4.1 | Live product knowledge | ✅ | Live catalog lookups through Catalog MCP. The policy and brand documents are searched as a knowledge base |
| 4.2 | Tailored pitch | 🔄 | Tailored to the occasion, the recipient and their taste, not to a job role or business problem |
| 4.3 | Pricing and discounts | 🔄 | Discounts within code-enforced limits. Gift-set bundles in Pro. No quotes |
| 4.4 | Booking meetings | ❌ | Not needed for a consumer store. A virtual styling appointment is an optional Pro feature |
| 4.5 | Checkout | ✅ | Builds the cart, applies a coupon and sends a checkout link. No contracts or statements of work |
| **5** | **Systems** | | |
| 5.1 | CRM sync | 🔄 | Shopify is the CRM (tags, notes, metafields), plus email-platform profiles. No HubSpot or Salesforce |
| 5.2 | Tasks and alerts | 🔄 | Handover tasks by email or Slack. There are no deal stages for consumers |
| 5.3 | Automatic triggers | 🔄 | Cart abandoned for X hours. In Pro, a repurchase reminder (for example after 75 days). Missed meetings don't apply |
| 5.4 | Compliance | ✅ | Consent records and unsubscribe handling for UK, EU and US rules, plus a data-retention job |
| **6** | **Intelligence** | | |
| 6.1 | Conversation analytics | ✅ | Tags for why a sale was lost, objections and sentiment. Talk time only once voice exists |
| 6.2 | Dashboard | 🔄 | Chat-to-sale rate, revenue recovered, average order value, reply rate, handovers. Meeting rate doesn't apply |
| 6.3 | A/B testing | ⏭ | Openers, offers and subject lines |
| 6.4 | Self-improvement | ⏭ | A weekly review of lost chats that suggests playbook changes for you to approve |
| 6.5 | Forecasting | ⏭ | A score for how likely each customer is to buy in the next 7 days |
| **7** | **Trust & control** | | |
| 7.1 | Guardrails | ✅ | Minimum price, discount cap and stock check, all enforced in code |
| 7.2 | Permissions | ✅ | A list of allowed tools for each autonomy level, plus shadow mode |
| 7.3 | Audit trail | ✅ | Every message, tool call and the reason for each decision |
| 7.4 | Brand safety | ✅ | Approved claims only, health claims blocked, no statements about competitors in the MVP |

---

### Sources
- [Sidekick app extensions (shopify.dev)](https://shopify.dev/docs/apps/build/sidekick)
- [Introducing Sidekick app extensions, changelog](https://shopify.dev/changelog/posts/introducing-sidekick-app-extensions)
- [Sidekick app extension App Store requirements](https://shopify.dev/changelog/posts/sidekick-app-extensions-app-store-requirements)
- [Use extensions to surface app data](https://shopify.dev/docs/apps/build/sidekick/build-app-data)
- [Migrate from Storefront MCP](https://shopify.dev/docs/apps/build/storefront-mcp)
- [Storefront MCP cart tools deprecation](https://shopify.dev/changelog/posts/storefront-mcp-cart-tools-are-being-deprecated-in-favour-of-ucp-cart-mcp)
- [Carts and checkout for agents](https://shopify.dev/docs/agents/carts-and-checkout) · [Checkout MCP](https://shopify.dev/docs/agents/carts-and-checkout/checkout-mcp) · [Checkout WebMCP](https://shopify.dev/docs/agents/carts-and-checkout/checkout-webmcp)
- [Order MCP](https://shopify.dev/docs/agents/orders/order-mcp) · [Customer Accounts MCP](https://shopify.dev/docs/apps/build/customer-accounts-mcp) · [Agent profiles](https://shopify.dev/docs/agents/profiles) · [WebMCP tools](https://shopify.dev/docs/api/web-mcp)
- Third-party reviews (not confirmed by Shopify): [letstalkshop](https://www.letstalkshop.com/blog/shopify-sidekick-limitations-and-what-it-cannot-do), [No7 Software](https://no7software.co.uk/blog/shopify-sidekick-engineering-review-production), [Weaverse](https://weaverse.io/blogs/shopify-sidekick-agents-propose-merchants-approve-2026), [Ryze](https://www.get-ryze.ai/blog/shopify-sidekick-deep-dive-what-it-can-and-can-t-do)
