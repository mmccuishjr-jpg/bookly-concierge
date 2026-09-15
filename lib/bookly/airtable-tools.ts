import { createRecord, getRecord, links, listRecords, number, strings, text, type AirtableRecord } from './airtable.ts';
import { AIRTABLE_SCHEMA } from './airtable-schema.ts';
import type { CustomerProfile, Order, OrderItem, Recommendation } from './types.ts';

const { customers, catalog, orders, lineItems, recommendations, supportCases, policies } = AIRTABLE_SCHEMA;

const customerFields = Object.values(customers.fields);
const recommendationFields = Object.values(recommendations.fields);

function checked(value: unknown) {
  return value === true || value === 1 || text(value).toLowerCase() === 'true';
}

function value(record: AirtableRecord, fieldId: string) {
  return record.fields[fieldId];
}

function isoDate(value: unknown) {
  const raw = text(value);
  const date = raw ? new Date(raw) : undefined;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : '';
}

export async function getSignedInCustomer(customerId = process.env.AIRTABLE_DEMO_CUSTOMER_ID?.trim() || 'CUS-0001'): Promise<CustomerProfile> {
  const records = await listRecords(customers.table, customerFields);
  const record = records.find((candidate) => text(value(candidate, customers.fields.customerId)).toUpperCase() === customerId.toUpperCase());
  if (!record) throw new Error(`Configured demo customer ${customerId} was not found.`);
  return {
    recordId: record.id,
    id: text(value(record, customers.fields.customerId)),
    name: text(value(record, customers.fields.fullName)),
    email: text(value(record, customers.fields.email)),
    favoriteGenres: strings(value(record, customers.fields.favoriteGenres)),
    readingProfile: text(value(record, customers.fields.readingProfile)),
    summary: text(value(record, customers.fields.customerSummary)),
    recommendationGate: text(value(record, customers.fields.recommendationGate)),
    orderRecordIds: links(value(record, customers.fields.orders)),
  };
}

function matchesPreference(book: Recommendation, preference: string) {
  const tokens = preference.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  if (!tokens.length) return true;
  const haystack = [book.title, book.author, book.description, book.pitch, ...book.genres, ...book.moods].join(' ').toLowerCase();
  return tokens.some((token) => haystack.includes(token));
}

export function selectRecommendations(candidates: Recommendation[], preference: string, limit = 3) {
  const inStock = candidates.filter((book) => book.stock > 0).sort((a, b) => a.rank - b.rank || b.confidence - a.confidence);
  const matched = inStock.filter((book) => matchesPreference(book, preference));
  return (matched.length ? matched : inStock).slice(0, limit);
}

export async function getRecommendations(customer: CustomerProfile, preference: string) {
  const rows = await listRecords(recommendations.table, recommendationFields);
  const eligible = rows.filter((row) => {
    const customerLinks = links(value(row, recommendations.fields.customer));
    const status = text(value(row, recommendations.fields.status)).toLowerCase();
    return customerLinks.includes(customer.recordId)
      && status === 'suggested'
      && checked(value(row, recommendations.fields.displayEligible))
      && links(value(row, recommendations.fields.blockingCases)).length === 0;
  });

  const mapped = await Promise.all(eligible.map(async (row): Promise<Recommendation | undefined> => {
    const bookRecordId = links(value(row, recommendations.fields.book))[0];
    if (!bookRecordId) return undefined;
    const book = await getRecord(catalog.table, bookRecordId);
    const stockStatus = text(value(book, catalog.fields.stockStatus)).toLowerCase();
    const stock = number(value(book, catalog.fields.stock));
    if (stock <= 0 || stockStatus.includes('out')) return undefined;
    return {
      id: text(value(row, recommendations.fields.recId)) || row.id,
      productId: text(value(book, catalog.fields.productId)),
      title: text(value(book, catalog.fields.title)),
      author: text(value(book, catalog.fields.author)),
      genres: strings(value(book, catalog.fields.genres)),
      moods: strings(value(book, catalog.fields.moodTags)),
      description: text(value(book, catalog.fields.description)),
      pitch: text(value(book, catalog.fields.pitch)),
      price: number(value(book, catalog.fields.purchasePrice)),
      stock,
      reasoning: text(value(row, recommendations.fields.reasoning)),
      confidence: number(value(row, recommendations.fields.confidence)),
      rank: number(value(row, recommendations.fields.rank)) || 999,
    };
  }));

  return selectRecommendations(mapped.filter((item): item is Recommendation => Boolean(item)), preference);
}

function orderStatus(raw: string): Order['status'] {
  const status = raw.toLowerCase();
  if (status.includes('deliver')) return 'delivered';
  if (status.includes('transit') || status.includes('ship')) return 'in_transit';
  return 'processing';
}

async function mapLineItem(recordId: string): Promise<OrderItem | undefined> {
  const line = await getRecord(lineItems.table, recordId);
  const productRecordId = links(value(line, lineItems.fields.product))[0];
  if (!productRecordId) return undefined;
  const book = await getRecord(catalog.table, productRecordId);
  return {
    id: text(value(line, lineItems.fields.lineId)) || line.id,
    title: text(value(book, catalog.fields.title)),
    author: text(value(book, catalog.fields.author)),
    price: number(value(line, lineItems.fields.unitPrice)),
    returnable: checked(value(line, lineItems.fields.returnEligible)),
  };
}

export async function getRecentOrders(customer: CustomerProfile, limit = 3): Promise<Order[]> {
  const rows = await Promise.all(customer.orderRecordIds.map((recordId) => getRecord(orders.table, recordId)));
  rows.sort((a, b) => isoDate(value(b, orders.fields.orderDate)).localeCompare(isoDate(value(a, orders.fields.orderDate))));
  return Promise.all(rows.slice(0, limit).map(async (row) => {
    const rawStatus = text(value(row, orders.fields.status));
    const items = (await Promise.all(links(value(row, orders.fields.lineItems)).map(mapLineItem)))
      .filter((item): item is OrderItem => Boolean(item));
    return {
      id: text(value(row, orders.fields.orderId)) || row.id,
      email: customer.email,
      status: orderStatus(rawStatus),
      statusLabel: text(value(row, orders.fields.statusSummary)) || rawStatus || 'Processing',
      placedAt: isoDate(value(row, orders.fields.orderDate)),
      eta: text(value(row, orders.fields.estimatedDelivery)) || undefined,
      deliveredAt: text(value(row, orders.fields.deliveredOn)) || undefined,
      carrier: text(value(row, orders.fields.carrier)) || undefined,
      items,
    };
  }));
}

export async function getPolicyAnswer(query: string) {
  const rows = await listRecords(policies.table, Object.values(policies.fields));
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3);
  const active = rows.filter((row) => !text(value(row, policies.fields.status)) || text(value(row, policies.fields.status)).toLowerCase() === 'active');
  const match = active.find((row) => {
    const haystack = [
      text(value(row, policies.fields.name)),
      text(value(row, policies.fields.category)),
      text(value(row, policies.fields.keywords)),
    ].join(' ').toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  });
  return match ? text(value(match, policies.fields.shortAnswer)) || text(value(match, policies.fields.fullText)) : '';
}

type CaseInput = {
  customer: CustomerProfile;
  summary: string;
  transcript: string;
  idempotencyKey: string;
  now?: Date;
};

export function buildSupportCaseFields({ customer, summary, transcript, idempotencyKey, now = new Date() }: CaseInput) {
  const caseId = `CASE-DEMO-${now.toISOString().replace(/\D/g, '').slice(0, 14)}-${idempotencyKey.slice(0, 4).toUpperCase()}`;
  return {
    caseId,
    fields: {
      [supportCases.fields.caseId]: caseId,
      [supportCases.fields.customerKey]: [customer.recordId],
      [supportCases.fields.contactEmail]: customer.email,
      [supportCases.fields.openedAt]: now.toISOString(),
      [supportCases.fields.status]: 'Needs Human',
      [supportCases.fields.primaryIntent]: 'Complaint or Feedback',
      [supportCases.fields.clarificationNeeded]: false,
      [supportCases.fields.fullTranscript]: transcript,
      [supportCases.fields.conversationState]: JSON.stringify({ idempotencyKey, source: 'bookly-support-agent', version: 1 }),
      [supportCases.fields.verificationStatus]: 'Verified',
      [supportCases.fields.caseSummary]: summary,
      [supportCases.fields.nextBestAction]: 'Review and respond to customer complaint',
      [supportCases.fields.language]: 'en',
      [supportCases.fields.notes]: 'Created by the Bookly customer-agent take-home demo.',
      [supportCases.fields.customer]: [customer.recordId],
    },
  };
}

export async function createSupportCase(input: CaseInput) {
  const existing = await listRecords(supportCases.table, [
    supportCases.fields.caseId,
    supportCases.fields.conversationState,
    supportCases.fields.caseSummary,
  ]);
  const duplicate = existing.find((row) => text(value(row, supportCases.fields.conversationState)).includes(input.idempotencyKey));
  if (duplicate) {
    return {
      recordId: duplicate.id,
      caseId: text(value(duplicate, supportCases.fields.caseId)),
      duplicate: true,
    };
  }
  const payload = buildSupportCaseFields(input);
  const created = await createRecord(supportCases.table, payload.fields);
  return { recordId: created.id, caseId: payload.caseId, duplicate: false };
}
