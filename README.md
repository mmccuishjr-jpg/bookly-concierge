# Bookly Concierge

Bookly is a customer-agent prototype for a fictional bookstore. It combines reliable support with proactive, evidence-backed book discovery: the same signed-in experience can check an order, capture a complaint, or recommend an in-stock book using the customer’s reading profile.

## Thesis

> The model interprets the conversation. Deterministic server tools establish truth and control every action.

That separation is the central design choice. Conversation is flexible; identity, data access, eligibility, and writes are not.

## What the demo proves

- A simulated signed-in customer, Mara Finch (`CUS-0001`), is resolved on the server rather than trusted from chat input.
- Order, policy, customer, catalog, and recommendation data are read from Airtable.
- Recommendations must be `Suggested`, display-eligible, unblocked, and currently in stock. Current preference is collected before historical taste is used.
- A complaint becomes a draft first. Only explicit confirmation calls `create_support_case`.
- Complaint creation writes a linked record to Airtable’s **Support Cases** table and returns its real Case ID.
- A stored idempotency key prevents a repeated confirmation from creating a duplicate case.
- Tool failures fail closed: the agent does not fabricate data or claim that an action succeeded.
- The evaluator-facing Agent Inspector exposes sanitized intent, memory, tool, and guardrail events.

## Architecture

```text
Customer in React UI
        |
        v
POST /api/chat (server only)
        |
        +--> resolve signed-in Mara from Customers
        +--> orchestrate the multi-turn workflow
        +--> call one narrow Airtable tool
                |-- get_customer_profile
                |-- get_recommendations
                |-- get_recent_orders
                |-- get_policy
                `-- create_support_case (confirmation required)
        |
        v
Grounded response + sanitized trace
```

The browser never talks directly to Airtable and never receives the Airtable token. Table and field IDs are centralized in `lib/bookly/airtable-schema.ts`; transport lives in `lib/bookly/airtable.ts`; business rules and allowed fields live in `lib/bookly/airtable-tools.ts`; conversation state and action gating live in `lib/bookly/airtable-orchestrator.ts`.

## Run locally

Requirements: Node.js 22.13+ and pnpm.

1. Copy `.env.example` to `.env.local`.
2. Add an Airtable Personal Access Token with `data.records:read` and `data.records:write`, restricted to the Bookly base.
3. Run:

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Never commit `.env.local` or place the token in client-side code.

## Best demo path

1. Click **Find my next book** and answer with a genre or mood.
2. Show the returned books and the inspector’s eligibility filters.
3. Reset, click **Report a problem**, and describe the issue.
4. Point out that the complaint is only a draft.
5. Click **Create support case**.
6. Open Airtable and show the new linked row in **Support Cases**.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Tests cover recommendation ranking and stock checks, customer linkage, write payloads, idempotency, confirmation gating, prompt injection, identity matching, return eligibility, and fail-closed behavior.

## Deliberate scope choices

- No cart was added. The supplied base has no cart system of record, and a fake cart would weaken the proof. Recommendations demonstrate revenue intent; the live complaint write demonstrates trusted action.
- No Streamlit layer was added. React is the customer experience; the repository already provides the code-review surface the interview requires.
- A deterministic orchestrator is used for the evaluated path. A production language model can select among the same narrow tools, but authorization and validation remain application code.
- Book covers use a neutral fallback because the supplied catalog has no authoritative cover-image field.

All Bookly data is synthetic. No real payment, refund, shipment, or customer-service action occurs.
