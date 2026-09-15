import { createSupportCase, getPolicyAnswer, getRecentOrders, getRecommendations, getSignedInCustomer } from './airtable-tools.ts';
import type { ChatRequest, ChatResponse, CustomerProfile, Order, SessionState, TraceEvent } from './types.ts';

const makeId = () => crypto.randomUUID();
const trace = (
  category: TraceEvent['category'],
  title: string,
  summary: string,
  status: TraceEvent['status'] = 'complete',
  detail?: string,
): TraceEvent => ({ id: makeId(), category, title, summary, status, detail });

function answer(content: string, state: SessionState, events: TraceEvent[], card?: ChatResponse['message']['card']): ChatResponse {
  return {
    message: { id: makeId(), role: 'assistant', content, card },
    state,
    trace: [...events, trace('response', 'Grounded response', 'Response generated from the signed-in session and Airtable tool results')],
    engine: 'airtable',
  };
}

function hydrateState(request: ChatRequest, customer: CustomerProfile): SessionState {
  return {
    ...request.state,
    customerId: customer.id,
    customerName: customer.name,
    verifiedEmail: customer.email,
    dataSource: 'airtable',
    returnRecords: [...(request.state.returnRecords ?? [])],
  };
}

function orderStatusCopy(order: Order) {
  if (order.status === 'delivered') return `was delivered ${order.deliveredAt || 'successfully'}`;
  if (order.status === 'processing') return 'is being prepared for shipment';
  return `${order.statusLabel.toLowerCase()}${order.eta ? `, with delivery expected ${order.eta}` : ''}`;
}

function complaintTranscript(request: ChatRequest, customer: CustomerProfile, summary: string) {
  const history = (request.history ?? [])
    .filter((message) => message.content.trim())
    .map((message) => `${message.role === 'user' ? customer.name : 'Bookly'}: ${message.content.trim()}`);
  return [...history, `${customer.name}: ${summary}`].join('\n');
}

export async function runAirtableAgent(request: ChatRequest): Promise<ChatResponse> {
  const customer = await getSignedInCustomer();
  const state = hydrateState(request, customer);
  const text = request.message.trim();
  const lower = text.toLowerCase();
  const events: TraceEvent[] = [trace('memory', 'Signed-in customer resolved', `${customer.name} (${customer.id}) loaded from Airtable`,'complete', JSON.stringify({ customerId: customer.id, source: 'Airtable Customers' }))];

  if (/ignore (all|your|previous)|system prompt|show .*customers|give me .*customer|reveal .*data|airtable token|api key/i.test(lower)) {
    events.push(trace('guardrail', 'Prompt-injection guardrail', 'Blocked an attempt to expose credentials, other customers, or hidden instructions', 'blocked'));
    return answer('I can’t expose credentials, hidden instructions, or another customer’s information. I can still help with your Bookly account.', state, events);
  }

  if (state.awaiting === 'complaint_confirmation') {
    if (/\b(yes|confirm|submit|do it|go ahead|create it)\b/i.test(lower)) {
      if (!state.pendingComplaint || !state.complaintIdempotencyKey) {
        events.push(trace('guardrail', 'Write precondition failed', 'No complete complaint draft was available, so nothing was written', 'blocked'));
        state.awaiting = 'complaint_details';
        return answer('I’m missing the complaint details, so I did not submit anything. Please tell me what happened.', state, events);
      }
      events.push(trace('guardrail', 'Explicit confirmation received', 'The customer approved creation of a Support Cases record'));
      const created = await createSupportCase({
        customer,
        summary: state.pendingComplaint,
        transcript: complaintTranscript(request, customer, state.pendingComplaint),
        idempotencyKey: state.complaintIdempotencyKey,
      });
      events.push(trace('tool', 'create_support_case', created.duplicate ? 'Returned the existing case; no duplicate was created' : `Created ${created.caseId} in Airtable`, 'complete', JSON.stringify({ caseId: created.caseId, table: 'Support Cases', idempotent: true })));
      const summary = state.pendingComplaint;
      state.awaiting = undefined;
      state.pendingComplaint = undefined;
      state.complaintIdempotencyKey = undefined;
      return answer(
        `${created.duplicate ? 'Your complaint was already submitted' : 'Your complaint is submitted'}, and I did not make any refund or shipping promises. A support specialist can now review it in Airtable.`,
        state,
        events,
        { kind: 'case_confirmation', summary, caseId: created.caseId, airtableRecordId: created.recordId },
      );
    }
    if (/\b(no|cancel|stop|never mind|nevermind)\b/i.test(lower)) {
      events.push(trace('guardrail', 'Write action cancelled', 'The complaint draft was discarded without writing to Airtable'));
      state.awaiting = undefined;
      state.pendingComplaint = undefined;
      state.complaintIdempotencyKey = undefined;
      return answer('No problem — I cancelled the draft. Nothing was written to Airtable.', state, events);
    }
    events.push(trace('guardrail', 'Confirmation required', 'No record was written because the customer did not explicitly confirm', 'waiting'));
    return answer('I still have the complaint ready, but I will not submit it without a clear confirmation. Should I create the support case?', state, events, { kind: 'case_proposal', summary: state.pendingComplaint || 'Complaint details pending' });
  }

  if (state.awaiting === 'complaint_details') {
    if (text.length < 12) {
      events.push(trace('guardrail', 'Clarification required', 'The complaint needs enough detail for a useful handoff', 'waiting'));
      return answer('Could you add a little more detail about what happened and what you’d like Bookly to do?', state, events);
    }
    state.pendingComplaint = text;
    state.complaintIdempotencyKey = makeId();
    state.awaiting = 'complaint_confirmation';
    events.push(trace('intent', 'Complaint intake', 'Captured the customer’s issue as a draft support case'));
    events.push(trace('guardrail', 'Confirmation required', 'Paused before the consequential Airtable write', 'waiting'));
    return answer(
      'I’ve prepared the complaint below. Please review it. If you confirm, I’ll create a new row in Airtable’s Support Cases table; confirming will not issue a refund or change an order.',
      state,
      events,
      { kind: 'case_proposal', summary: text },
    );
  }

  if (state.awaiting === 'recommendation_preferences') {
    events.push(trace('intent', 'Book discovery', `Using the preference “${text.slice(0, 80)}”`));
    const books = await getRecommendations(customer, text);
    events.push(trace('tool', 'get_recommendations', `Retrieved ${books.length} eligible, in-stock recommendations`, books.length ? 'complete' : 'blocked', JSON.stringify({ customerId: customer.id, filters: ['Suggested', 'Display Eligible', 'In stock', 'No blocking cases'], limit: 3 })));
    state.awaiting = undefined;
    if (!books.length) {
      return answer('I couldn’t find a recommendation that passes every eligibility check right now, so I won’t invent one. Try a different genre or mood.', state, events);
    }
    return answer(`Based on your Bookly reading profile and your interest in ${text}, these are the strongest eligible matches. Each recommendation is in stock and grounded in your Airtable profile.`, state, events, { kind: 'recommendations', preference: text, recommendations: books });
  }

  if (/\b(recommend|suggest|next book|what should i read|find .*book|book.*like)\b/i.test(lower)) {
    state.intent = 'recommendation';
    state.awaiting = 'recommendation_preferences';
    events.push(trace('intent', 'Book discovery', 'Customer is asking for a personalized recommendation'));
    events.push(trace('tool', 'get_customer_profile', 'Read favorite genres and taste profile from Airtable', 'complete', JSON.stringify({ customerId: customer.id, favoriteGenres: customer.favoriteGenres })));
    events.push(trace('guardrail', 'Preference clarification', 'Asked for current intent instead of relying only on historical behavior', 'waiting'));
    const examples = customer.favoriteGenres.slice(0, 3).join(', ');
    return answer(`Absolutely. Your profile gives me useful context${examples ? ` — including ${examples}` : ''}, but I don’t want to assume. What genre or reading mood are you in today?`, state, events);
  }

  if (/\b(complaint|complain|problem|issue|unhappy|upset|damaged|wrong book|bad experience|report)\b/i.test(lower)) {
    state.intent = 'support_case';
    state.awaiting = 'complaint_details';
    events.push(trace('intent', 'Complaint intake', 'Customer wants Bookly to investigate a problem'));
    events.push(trace('guardrail', 'Clarification required', 'A useful case needs the event and desired resolution before submission', 'waiting'));
    return answer('I’m sorry something went wrong. Tell me what happened and what you’d like Bookly to do. I’ll summarize it for your review before anything is written to Airtable.', state, events);
  }

  if (/\b(order|track|package|delivery|where is|where's)\b/i.test(lower)) {
    state.intent = 'order_status';
    events.push(trace('intent', 'Order status', 'Customer is asking about an order or delivery'));
    const recent = await getRecentOrders(customer, 1);
    const order = recent[0];
    events.push(trace('tool', 'get_recent_orders', order ? `Retrieved ${order.id} from Airtable` : 'No order was found', order ? 'complete' : 'blocked', JSON.stringify({ customerId: customer.id, limit: 1 })));
    if (!order) return answer('I couldn’t find an order in your signed-in account, so I won’t guess at a status.', state, events);
    state.activeOrderId = order.id;
    return answer(`Your most recent order, ${order.id}, ${orderStatusCopy(order)}.`, state, events, { kind: 'order', order });
  }

  if (/\b(ship|shipping|return policy|refund policy|how long)\b/i.test(lower)) {
    state.intent = 'policy_question';
    events.push(trace('intent', 'Policy question', 'Customer is asking for an approved Bookly policy'));
    const policy = await getPolicyAnswer(text);
    events.push(trace('tool', 'get_policy', policy ? 'Retrieved a matching active policy from Airtable' : 'No matching approved policy found', policy ? 'complete' : 'blocked'));
    return answer(policy || 'I couldn’t find an approved policy that directly answers that question, so I won’t make one up. I can create a support case for a specialist.', state, events);
  }

  if (/\b(human|person|agent|specialist)\b/i.test(lower)) {
    state.intent = 'support_case';
    state.awaiting = 'complaint_details';
    events.push(trace('intent', 'Human support', 'Customer requested a specialist'));
    events.push(trace('guardrail', 'Handoff context required', 'Collecting a short summary before creating a case', 'waiting'));
    return answer('I can prepare that handoff. In one or two sentences, what should the specialist know? I’ll show you the case before submitting it.', state, events);
  }

  events.push(trace('intent', 'Intent uncertain', 'No supported workflow reached the confidence threshold', 'waiting'));
  return answer('I can recommend your next book, check your latest order, answer a policy question, or create a complaint for Bookly support. Which would you like?', state, events);
}
