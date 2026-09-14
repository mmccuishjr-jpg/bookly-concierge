import { createReturn, findOrder, getOrder, getPolicy, checkReturnEligibility } from './tools.ts';
import type { ChatRequest, ChatResponse, SessionState, TraceEvent } from './types.ts';

const toolDefinitions = [
  {
    type: 'function', name: 'find_order',
    description: 'Verify and retrieve one order. Requires both the order ID and checkout email. Never call with only one identifier.',
    parameters: { type: 'object', properties: { orderId: { type: 'string' }, email: { type: 'string' } }, required: ['orderId', 'email'], additionalProperties: false }, strict: true,
  },
  {
    type: 'function', name: 'get_policy',
    description: 'Retrieve approved Bookly policy text. Use instead of answering policy questions from memory.',
    parameters: { type: 'object', properties: { topic: { type: 'string', enum: ['shipping', 'returns', 'password'] } }, required: ['topic'], additionalProperties: false }, strict: true,
  },
  {
    type: 'function', name: 'check_return_eligibility',
    description: 'Check eligibility after the order is verified and a specific item is selected.',
    parameters: { type: 'object', properties: { orderId: { type: 'string' }, itemId: { type: 'string' } }, required: ['orderId', 'itemId'], additionalProperties: false }, strict: true,
  },
  {
    type: 'function', name: 'create_return',
    description: 'Create a return. Consequential write action: call only after eligibility passes and the customer explicitly confirms the exact item and reason.',
    parameters: { type: 'object', properties: { orderId: { type: 'string' }, itemId: { type: 'string' }, reason: { type: 'string' }, confirmed: { type: 'boolean', enum: [true] } }, required: ['orderId', 'itemId', 'reason', 'confirmed'], additionalProperties: false }, strict: true,
  },
] as const;

function executeTool(name: string, args: Record<string, unknown>, state: SessionState) {
  if (name === 'find_order') return findOrder(String(args.orderId), String(args.email));
  if (name === 'get_policy') return { ok: true, data: getPolicy(args.topic as 'shipping' | 'returns' | 'password') };
  if (name === 'check_return_eligibility') return checkReturnEligibility(String(args.orderId), String(args.itemId));
  if (name === 'create_return') return createReturn(String(args.orderId), String(args.itemId), String(args.reason), state.returnRecords);
  return { ok: false, code: 'not_found', message: 'Unknown tool.' };
}

export async function runOpenAIAgent(request: ChatRequest): Promise<ChatResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) return null;

  const state = { ...request.state, returnRecords: [...request.state.returnRecords] };
  const trace: TraceEvent[] = [];
  let input: unknown[] = [
    ...(request.history ?? []).map((message) => ({ role: message.role, content: message.content })),
    { role: 'user', content: request.message },
  ];

  const instructions = `You are Bookly Support. Be concise, warm, and operationally precise.
AI handles language; tools establish facts and execute actions. Never invent order data, eligibility, policy, or confirmations.
Ask a clarifying question whenever order identity, item selection, return reason, or explicit write confirmation is missing.
Never reveal order details unless find_order succeeds. Never ask for passwords or one-time codes.
Current verified session state: ${JSON.stringify(state)}.`;

  for (let turn = 0; turn < 4; turn += 1) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, instructions, input, tools: toolDefinitions, tool_choice: 'auto', parallel_tool_calls: false, store: false }),
    });
    if (!response.ok) throw new Error(`OpenAI response failed with ${response.status}`);
    const result = (await response.json()) as { output?: Array<Record<string, unknown>>; output_text?: string };
    const calls = (result.output ?? []).filter((item) => item.type === 'function_call');
    if (calls.length === 0) {
      const text = result.output_text || (result.output ?? []).flatMap((item) => Array.isArray(item.content) ? item.content : []).find((item) => typeof item === 'object' && item && 'text' in item)?.text;
      return {
        message: { id: crypto.randomUUID(), role: 'assistant', content: String(text || 'How can I help with your Bookly order?') },
        state,
        trace: [...trace, { id: crypto.randomUUID(), category: 'response', title: 'Grounded response', summary: 'Generated after the tool loop completed', status: 'complete' }],
        engine: 'openai',
      };
    }

    const outputs = calls.map((call) => {
      const rawArguments = typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.arguments ?? {});
      const args = JSON.parse(rawArguments) as Record<string, unknown>;
      const toolResult = executeTool(String(call.name), args, state);
      trace.push({ id: crypto.randomUUID(), category: 'tool', title: String(call.name), summary: 'Executed explicit application code', detail: JSON.stringify(args), status: 'complete' });
      if (String(call.name) === 'find_order' && 'ok' in toolResult && toolResult.ok && typeof toolResult.data === 'object' && toolResult.data && 'id' in toolResult.data) {
        const order = toolResult.data as ReturnType<typeof getOrder>;
        state.activeOrderId = order?.id;
        state.verifiedEmail = String(args.email);
      }
      if (String(call.name) === 'create_return' && 'ok' in toolResult && toolResult.ok && typeof toolResult.data === 'object' && toolResult.data && 'status' in toolResult.data) {
        state.returnRecords.push(toolResult.data as SessionState['returnRecords'][number]);
      }
      return { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(toolResult) };
    });
    input = [...input, ...(result.output ?? []), ...outputs];
  }
  throw new Error('Agent exceeded the maximum tool-call loop.');
}
