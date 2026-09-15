import { runAirtableAgent } from '@/lib/bookly/airtable-orchestrator';
import { isAirtableConfigured } from '@/lib/bookly/airtable';
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

  if (!isAirtableConfigured()) {
    return Response.json({ error: 'Airtable is not configured on the server.' }, { status: 503 });
  }

  try {
    return Response.json(await runAirtableAgent(body));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Airtable error';
    console.error('Bookly Airtable request failed:', message);
    return Response.json({ error: 'Bookly could not safely complete the Airtable request. No action was taken.' }, { status: 503 });
  }
}
