import { isAirtableConfigured } from '@/lib/bookly/airtable';
import { matchesDemoCustomer } from '@/lib/bookly/demo-session';
import { getSignedInCustomer } from '@/lib/bookly/airtable-tools';

const VERIFY_ERROR = 'We couldn’t verify that demo customer. Try the demo name shown below.';

export async function POST(request: Request) {
  let identifier: unknown;

  try {
    ({ identifier } = await request.json() as { identifier?: unknown });
  } catch {
    return Response.json({ error: 'Enter a valid full name or email.' }, { status: 400 });
  }

  if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 200) {
    return Response.json({ error: 'Enter a valid full name or email.' }, { status: 400 });
  }

  if (!isAirtableConfigured()) {
    return Response.json({ error: 'Demo access is temporarily unavailable.' }, { status: 503 });
  }

  try {
    const customer = await getSignedInCustomer();
    if (!matchesDemoCustomer(identifier, customer)) {
      return Response.json({ error: VERIFY_ERROR }, { status: 401 });
    }

    return Response.json({ customer: { id: customer.id, name: customer.name } });
  } catch (error) {
    console.error('Bookly demo verification failed:', error instanceof Error ? error.message : 'Unknown error');
    return Response.json({ error: 'Demo access is temporarily unavailable.' }, { status: 503 });
  }
}
