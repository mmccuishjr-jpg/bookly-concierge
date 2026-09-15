import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSupportCaseFields, selectRecommendations } from '../lib/bookly/airtable-tools.ts';
import { isRecommendationRequest } from '../lib/bookly/airtable-orchestrator.ts';
import { AIRTABLE_SCHEMA } from '../lib/bookly/airtable-schema.ts';
import type { CustomerProfile, Recommendation } from '../lib/bookly/types.ts';

const customer: CustomerProfile = {
  recordId: 'recCustomer1', id: 'CUS-0001', name: 'Mara Finch', email: 'mara@example.com',
  favoriteGenres: ['Literary Fiction'], readingProfile: '', summary: '', recommendationGate: 'Open', orderRecordIds: [],
};

const candidate = (overrides: Partial<Recommendation>): Recommendation => ({
  id: 'REC-1', productId: 'BOOK-1', title: 'The Quiet Map', author: 'A. Reader',
  genres: ['Literary Fiction'], moods: ['Reflective'], description: 'A reflective story', pitch: 'Quiet and moving',
  price: 18, stock: 5, reasoning: 'Matches prior highly rated books', confidence: 0.9, rank: 1, ...overrides,
});

void test('recommendations are filtered for live stock, preference, and rank', () => {
  const results = selectRecommendations([
    candidate({ id: 'REC-OUT', title: 'Mystery One', genres: ['Mystery'], stock: 0, rank: 1 }),
    candidate({ id: 'REC-LIT', rank: 3 }),
    candidate({ id: 'REC-MYS', title: 'Mystery Two', genres: ['Mystery'], rank: 2 }),
  ], 'literary');
  assert.deepEqual(results.map((book) => book.id), ['REC-LIT']);
});

void test('support case payload links the signed-in customer and carries an idempotency key', () => {
  const now = new Date('2026-09-14T12:00:00.000Z');
  const result = buildSupportCaseFields({ customer, summary: 'A damaged book arrived.', transcript: 'Mara: A damaged book arrived.', idempotencyKey: 'abcd-1234', now });
  const fields = result.fields;
  assert.equal(fields[AIRTABLE_SCHEMA.supportCases.fields.customerKey], 'CUS-0001');
  assert.deepEqual(fields[AIRTABLE_SCHEMA.supportCases.fields.customer], ['recCustomer1']);
  assert.match(String(fields[AIRTABLE_SCHEMA.supportCases.fields.conversationState]), /abcd-1234/);
  assert.match(result.caseId, /^CASE-DEMO-20260914120000-ABCD$/);
});

void test('natural book-discovery language reaches the recommendation workflow', () => {
  assert.equal(isRecommendationRequest("I'm looking for a new book — any suggestions?"), true);
  assert.equal(isRecommendationRequest('Could you suggest something to read?'), true);
  assert.equal(isRecommendationRequest('I want another great book.'), true);
  assert.equal(isRecommendationRequest('Where is my book order?'), false);
  assert.equal(isRecommendationRequest('My book arrived damaged.'), false);
});
