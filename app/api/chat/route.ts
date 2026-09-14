import { runDemoAgent } from '@/lib/bookly/orchestrator';
import { runOpenAIAgent } from '@/lib/bookly/openai-agent';
import type { ChatRequest } from '@/lib/bookly/types';

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = await request.json() as ChatRequest;
  } catch {
    return Response.json({ error: 'Invalid JSON request.' }, { status: 400 });
  }

  if (!body.message?.trim() || !body.state || !Array.isArray(body.state.returnRecords)) {
    return Response.json({ error: 'A message and valid session state are required.' }, { status: 400 });
  }

  if (body.message.length > 2_000) {
    return Response.json({ error: 'Message exceeds the 2,000 character limit.' }, { status: 413 });
  }

  if (body.mode === 'live') {
    try {
      const live = await runOpenAIAgent(body);
      if (live) return Response.json(live);
    } catch {
      return Response.json({ error: 'The live model is unavailable. Demo mode remains available.' }, { status: 503 });
    }
  }

  return Response.json(runDemoAgent(body));
}
