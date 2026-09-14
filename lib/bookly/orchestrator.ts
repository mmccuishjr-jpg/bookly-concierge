import { checkReturnEligibility, createReturn, findOrder, getOrder, getPolicy } from './tools.ts';
import type { ChatRequest, ChatResponse, Order, SessionState, TraceEvent } from './types.ts';

const makeId = () => crypto.randomUUID();
const trace = (
  category: TraceEvent['category'],
  title: string,
  summary: string,
  status: TraceEvent['status'] = 'complete',
  detail?: string,
): TraceEvent => ({ id: makeId(), category, title, summary, status, detail });

const answer = (
  content: string,
  state: SessionState,
  events: TraceEvent[],
  card?: ChatResponse['message']['card'],
): ChatResponse => ({
  message: { id: makeId(), role: 'assistant', content, card },
  state,
  trace: [...events, trace('response', 'Grounded response', 'Generated from verified session state and tool output')],
  engine: 'deterministic',
});

function extractIdentity(text: string) {
  const orderId = text.match(/\bB-?\d{4}\b/i)?.[0].replace(/^B(?=\d)/i, 'B-').toUpperCase();
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0].toLowerCase();
  return { orderId, email };
}

function detectReason(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes('damage') || lower.includes('broken') || lower.includes('torn')) return 'Arrived damaged';
  if (lower.includes('wrong')) return 'Wrong item received';
  if (lower.includes('change') || lower.includes('want')) return 'Changed mind';
  return undefined;
}

function selectedItem(text: string, state: SessionState) {
  const order = state.activeOrderId ? getOrder(state.activeOrderId) : undefined;
  if (!order) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes('second') || lower.includes('2nd')) return order.items[1];
  if (lower.includes('first') || lower.includes('1st')) return order.items[0];
  return order.items.find((item) => lower.includes(item.title.toLowerCase().slice(0, 12)));
}

function orderStatusCopy(order: Order) {
  if (order.status === 'delivered') return `was delivered ${order.deliveredAt ?? 'successfully'}`;
  if (order.status === 'processing') return 'is being prepared for shipment';
  return `is ${order.statusLabel.toLowerCase()}${order.eta ? ` and expected ${order.eta}` : ''}`;
}

export function runDemoAgent(request: ChatRequest): ChatResponse {
  const text = request.message.trim();
  const lower = text.toLowerCase();
  const state: SessionState = { ...request.state, returnRecords: [...(request.state.returnRecords ?? [])] };
  const events: TraceEvent[] = [];

  if (/ignore (all|your|previous)|system prompt|show .*orders|give me .*customer|reveal .*data/i.test(lower)) {
    events.push(trace('guardrail', 'Prompt-injection guardrail', 'Blocked a request to bypass instructions or expose customer data', 'blocked'));
    return answer(
      'I can’t reveal private customer data or change my security rules. I can still help with an order after verifying its order number and email address.',
      state,
      events,
    );
  }

  if (state.awaiting === 'confirmation') {
    if (/\b(yes|confirm|do it|go ahead|submit)\b/i.test(lower)) {
      const order = state.activeOrderId ? getOrder(state.activeOrderId) : undefined;
      const item = order?.items.find((candidate) => candidate.id === state.selectedItemId);
      if (!order || !item || !state.returnReason) {
        events.push(trace('guardrail', 'Write-action precondition', 'Required return context was missing', 'blocked'));
        return answer('I’m missing part of the return information, so I haven’t submitted anything. Let’s start again with the order number.', { returnRecords: state.returnRecords, attempts: 0 }, events);
      }
      events.push(trace('guardrail', 'Explicit confirmation', 'Customer approved the consequential write action'));
      const result = createReturn(order.id, item.id, state.returnReason, state.returnRecords);
      events.push(trace('tool', 'create_return', result.ok ? `Created return for ${item.id}` : result.message, result.ok ? 'complete' : 'blocked', JSON.stringify({ orderId: order.id, itemId: item.id, reason: state.returnReason })));
      if (!result.ok) {
        return answer(result.code === 'duplicate' ? 'A return already exists for that item, so I didn’t create a duplicate. I can connect you with a specialist if you need help with the existing return.' : 'I couldn’t create the return safely. I can connect you with a specialist instead.', state, events);
      }
      state.returnRecords.push(result.data);
      state.awaiting = undefined;
      return answer(
        `Your return is approved. I created return ${result.data.id} for “${item.title}.” A prepaid label is ready, and your $${item.price.toFixed(2)} refund will be issued after the carrier scans the package.`,
        state,
        events,
        { kind: 'return_confirmation', orderId: order.id, item, reason: result.data.reason, amount: item.price, returnId: result.data.id },
      );
    }
    if (/\b(no|cancel|stop|never mind)\b/i.test(lower)) {
      events.push(trace('guardrail', 'Write action cancelled', 'Customer declined the proposed return'));
      state.awaiting = undefined;
      return answer('No problem — I cancelled the request and did not create a return.', state, events);
    }
    events.push(trace('guardrail', 'Confirmation required', 'No write action executed without an explicit yes', 'waiting'));
    return answer('Before I create the return, please confirm: should I submit it now?', state, events);
  }

  if (state.awaiting === 'item' || state.awaiting === 'reason') {
    const item = selectedItem(text, state);
    const reason = detectReason(text);
    if (item) state.selectedItemId = item.id;
    if (reason) state.returnReason = reason;
    const order = state.activeOrderId ? getOrder(state.activeOrderId) : undefined;
    const chosen = order?.items.find((candidate) => candidate.id === state.selectedItemId);

    events.push(trace('intent', 'Return request', 'Continued the active multi-turn return workflow'));
    events.push(trace('memory', 'Session context updated', `${chosen ? `Item: ${chosen.title}` : 'Item still missing'} · ${state.returnReason ? `Reason: ${state.returnReason}` : 'Reason still missing'}`));

    if (!chosen) {
      state.awaiting = 'item';
      return answer('Which book would you like to return? You can say “the first one,” “the second one,” or give me the title.', state, [...events, trace('guardrail', 'Clarification required', 'The order contains multiple items', 'waiting')]);
    }
    if (!state.returnReason) {
      state.awaiting = 'reason';
      return answer(`What’s the reason for returning “${chosen.title}” — was it damaged, the wrong item, or did you change your mind?`, state, [...events, trace('guardrail', 'Clarification required', 'A return reason is required before eligibility and action', 'waiting')]);
    }

    const eligibility = checkReturnEligibility(state.activeOrderId!, chosen.id);
    events.push(trace('tool', 'check_return_eligibility', eligibility.ok ? 'Eligible under the 30-day return policy' : eligibility.message, eligibility.ok ? 'complete' : 'blocked', JSON.stringify({ orderId: state.activeOrderId, itemId: chosen.id })));
    if (!eligibility.ok) {
      state.awaiting = undefined;
      return answer('That item is outside Bookly’s return window, so I can’t automatically approve it. I can connect you with a specialist to review an exception.', state, events);
    }
    state.awaiting = 'confirmation';
    return answer(
      `“${chosen.title}” is eligible for a $${chosen.price.toFixed(2)} refund. I’ll use “${state.returnReason}” as the reason and create a prepaid label. Should I submit the return?`,
      state,
      [...events, trace('guardrail', 'Confirmation required', 'Paused before executing a consequential write action', 'waiting')],
      { kind: 'return_proposal', orderId: state.activeOrderId!, item: chosen, reason: state.returnReason, amount: chosen.price },
    );
  }

  if (state.awaiting === 'identity') {
    const { orderId, email } = extractIdentity(text);
    events.push(trace('intent', state.intent === 'return_request' ? 'Return request' : 'Order status', 'Continued the active workflow'));
    if (!orderId || !email) {
      state.attempts += 1;
      events.push(trace('guardrail', 'Identity required', `Still missing ${!orderId && !email ? 'order number and email' : !orderId ? 'order number' : 'email'}`, 'waiting'));
      return answer(`I still need ${!orderId && !email ? 'the order number and email address' : !orderId ? 'the order number' : 'the email address'} used at checkout.`, state, events);
    }

    const result = findOrder(orderId, email);
    events.push(trace('tool', 'find_order', result.ok ? `Verified ${orderId}` : result.message, result.ok ? 'complete' : 'blocked', JSON.stringify({ orderId, email: email.replace(/(^.).*(@.*$)/, '$1••••$2') })));
    if (!result.ok) {
      state.attempts += 1;
      if (result.code === 'unavailable') {
        events.push(trace('guardrail', 'Fail closed', 'Did not invent an order status when the tool failed', 'blocked'));
        return answer('Bookly’s order service is temporarily unavailable, so I won’t guess at your status. Please try again shortly, or I can connect you with a specialist.', state, events);
      }
      return answer('I couldn’t verify an order with those details. Please check both entries and try again; I won’t reveal order information until they match.', state, events);
    }

    state.verifiedEmail = email;
    state.activeOrderId = result.data.id;
    state.awaiting = undefined;
    events.push(trace('memory', 'Verified context stored', `${result.data.id} is available for this session only`));

    if (state.intent === 'return_request') {
      state.awaiting = result.data.items.length > 1 ? 'item' : 'reason';
      if (result.data.items.length === 1) state.selectedItemId = result.data.items[0].id;
      return answer(result.data.items.length > 1 ? `I found order ${result.data.id} with two books. Which one would you like to return — “${result.data.items[0].title}” or “${result.data.items[1].title}”?` : `I found “${result.data.items[0].title}.” What’s the reason for the return?`, state, [...events, trace('guardrail', 'Clarification required', result.data.items.length > 1 ? 'Multiple items require disambiguation' : 'A return reason is required', 'waiting')], { kind: 'order', order: result.data });
    }

    return answer(`I found it — order ${result.data.id} ${orderStatusCopy(result.data)}.`, state, events, { kind: 'order', order: result.data });
  }

  if (/\b(return|refund|send .*back)\b/i.test(lower)) {
    state.intent = 'return_request';
    events.push(trace('intent', 'Return request', 'Customer wants to return or refund an item'));
    const order = state.activeOrderId ? getOrder(state.activeOrderId) : undefined;
    if (!order) {
      state.awaiting = 'identity';
      events.push(trace('guardrail', 'Identity required', 'Order data stays private until order number and email match', 'waiting'));
      return answer('I can help with that. What’s the Bookly order number and the email address used at checkout?', state, events);
    }
    state.awaiting = order.items.length > 1 ? 'item' : 'reason';
    if (order.items.length === 1) state.selectedItemId = order.items[0].id;
    events.push(trace('memory', 'Reused verified order', `${order.id} remained active; no repeat verification needed`));
    return answer(order.items.length > 1 ? `I still have verified order ${order.id}. Which book would you like to return — “${order.items[0].title}” or “${order.items[1].title}”?` : `I have “${order.items[0].title}” from order ${order.id}. What’s the reason for the return?`, state, [...events, trace('guardrail', 'Clarification required', order.items.length > 1 ? 'Multiple items require disambiguation' : 'A return reason is required', 'waiting')]);
  }

  if (/\b(order|track|package|delivery|where is|where's)\b/i.test(lower)) {
    state.intent = 'order_status';
    events.push(trace('intent', 'Order status', 'Customer is asking about an order or delivery'));
    const order = state.activeOrderId ? getOrder(state.activeOrderId) : undefined;
    if (order) {
      events.push(trace('memory', 'Reused verified order', `${order.id} remained active in session memory`));
      return answer(`Order ${order.id} ${orderStatusCopy(order)}.`, state, events, { kind: 'order', order });
    }
    state.awaiting = 'identity';
    events.push(trace('guardrail', 'Identity required', 'The agent chose to clarify instead of guessing', 'waiting'));
    return answer('I can look that up. What’s the Bookly order number and the email address used at checkout?', state, events);
  }

  if (/\b(ship|shipping|how long|delivery time)\b/i.test(lower)) {
    state.intent = 'policy_question';
    events.push(trace('intent', 'Shipping policy', 'Customer asked a general policy question'));
    const policy = getPolicy('shipping');
    events.push(trace('tool', 'get_policy', 'Retrieved the approved shipping policy', 'complete', JSON.stringify({ topic: 'shipping' })));
    return answer(policy, state, events);
  }

  if (/\b(password|reset|login|sign in)\b/i.test(lower)) {
    state.intent = 'policy_question';
    events.push(trace('intent', 'Account access', 'Customer asked about password reset'));
    events.push(trace('tool', 'get_policy', 'Retrieved the approved account-security policy', 'complete', JSON.stringify({ topic: 'password' })));
    return answer(`${getPolicy('password')} I can send you to Bookly’s secure reset page, but I’ll never ask for your password or verification code here.`, state, events);
  }

  if (/\b(human|person|agent|specialist)\b/i.test(lower)) {
    state.intent = 'human_support';
    events.push(trace('intent', 'Human support', 'Customer requested escalation'));
    events.push(trace('tool', 'escalate_to_human', 'Prepared a handoff summary with verified context'));
    return answer('Absolutely. I’ve prepared a handoff with the context from this conversation so you won’t need to repeat yourself. A Bookly specialist will join shortly.', state, events);
  }

  events.push(trace('intent', 'Intent uncertain', 'No supported workflow reached the confidence threshold', 'waiting'));
  events.push(trace('guardrail', 'Clarification required', 'The agent avoided making an unsupported assumption', 'waiting'));
  return answer('I want to make sure I help with the right thing. Are you trying to track an order, return a book, ask about shipping, or reach a specialist?', state, events);
}
