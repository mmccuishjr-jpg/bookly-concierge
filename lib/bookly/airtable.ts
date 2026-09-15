import { AIRTABLE_SCHEMA } from './airtable-schema.ts';

export type AirtableRecord = {
  id: string;
  createdTime?: string;
  fields: Record<string, unknown>;
};

type AirtableListResponse = { records: AirtableRecord[]; offset?: string };

export function isAirtableConfigured() {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  return Boolean(token && !token.includes('PASTE_'));
}

function configuration() {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const baseId = process.env.AIRTABLE_BASE_ID?.trim() || AIRTABLE_SCHEMA.baseId;
  if (!token || token.includes('PASTE_')) throw new Error('Airtable is not configured.');
  return { token, baseId };
}

async function airtableFetch(path: string, init?: RequestInit) {
  const { token, baseId } = configuration();
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`https://api.airtable.com/v0/${baseId}/${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Airtable request failed (${response.status}): ${body.slice(0, 280)}`);
  }
  return response;
}

export async function listRecords(tableId: string, fieldIds: readonly string[]) {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: '100', returnFieldsByFieldId: 'true' });
    for (const field of fieldIds) params.append('fields[]', field);
    if (offset) params.set('offset', offset);
    const response = await airtableFetch(`${tableId}?${params.toString()}`);
    const page = await response.json() as AirtableListResponse;
    records.push(...page.records);
    offset = page.offset;
  } while (offset);
  return records;
}

export async function getRecord(tableId: string, recordId: string) {
  const params = new URLSearchParams({ returnFieldsByFieldId: 'true' });
  const response = await airtableFetch(`${tableId}/${recordId}?${params.toString()}`);
  return response.json() as Promise<AirtableRecord>;
}

export async function createRecord(tableId: string, fields: Record<string, unknown>) {
  const response = await airtableFetch(`${tableId}?returnFieldsByFieldId=true`, {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }] }),
  });
  const payload = await response.json() as { records: AirtableRecord[] };
  if (!payload.records[0]) throw new Error('Airtable did not return the created record.');
  return payload.records[0];
}

export function text(value: unknown) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'name' in value) return String((value as { name: unknown }).name);
  return '';
}

export function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function strings(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean);
  const single = text(value);
  return single ? single.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

export function links(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.startsWith('rec')) : [];
}
