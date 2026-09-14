# Bookly Support

Bookly Support is a conversational customer-service prototype for a fictional online bookstore. It demonstrates multi-turn support, explicit tool use, scoped memory, intent clarification, policy grounding, and confirmation-gated write actions.

## Thesis

> AI interprets the conversation. Deterministic tools establish truth and take action.

The language layer may understand intent and decide what information is missing, but it cannot invent order data, policy, return eligibility, or confirmation IDs. Those come from explicit application tools.

## Supported workflows

- Track an order after matching both order ID and checkout email.
- Start a multi-turn return, disambiguate the item, capture a reason, check eligibility, and require explicit confirmation before creating it.
- Answer shipping and account-access questions from approved policy content.
- Escalate with retained context.
- Fail closed on identity mismatch, tool failure, prompt injection, and duplicate writes.

## Run locally

Requirements: Node.js 22.13+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

The deterministic demo is the default and needs no credentials. Try:

- Order: `B-1042`
- Email: `michael@example.com`
- Failure-path order: `B-5000`

## Optional live model

The server includes a direct OpenAI Responses API tool-calling loop. Set `OPENAI_API_KEY` and `OPENAI_MODEL` from `.env.example`, then send API requests with `mode: "live"`. The UI stays in deterministic mode so the hosted evaluation path is reproducible and cannot fail because of credentials or model availability.

No secret should ever be committed or sent to the browser.

## Architecture

```text
Customer message
    -> server-side orchestrator
        -> intent / missing-information decision
        -> session-scoped verified context
        -> explicit Bookly tool
            - find_order
            - get_policy
            - check_return_eligibility
            - create_return
        -> grounded response + sanitized execution trace
```

The Agent Inspector is intentionally evaluator-facing. A production customer interface would send the same trace to observability tooling rather than expose it in the support UI.

## Quality checks

```bash
pnpm test
pnpm typecheck
pnpm build
```

The test suite covers identity matching, the complete multi-turn return flow, confirmation gating, duplicate-action protection, tool failure, and prompt-injection handling.

## Prototype tradeoffs

- Synthetic in-memory data keeps the evaluation path safe and reproducible, but production would use authenticated order and returns APIs.
- Session state is supplied by the client for demo visibility. Production would keep authoritative state server-side with signed session identity.
- The deterministic engine makes every rubric behavior demonstrable. The optional live tool-calling path shows how the same tools plug into a model-driven loop.
- The prototype uses one agent with narrow tools. Production would add evaluation, structured telemetry, rate limiting, PII retention controls, idempotency storage, and human-handoff integrations before adding more use cases.
