import test from 'node:test';
import assert from 'node:assert/strict';

import { matchesDemoCustomer } from '../lib/bookly/demo-session.ts';

const customer = { name: 'Mara Finch', email: 'mara.finch@bookly.example' };

void test('demo verification accepts the exact full name with harmless case and whitespace differences', () => {
  assert.equal(matchesDemoCustomer('  mara FINCH ', customer), true);
});

void test('demo verification accepts the exact email with harmless case and whitespace differences', () => {
  assert.equal(matchesDemoCustomer(' MARA.FINCH@BOOKLY.EXAMPLE ', customer), true);
});

void test('demo verification rejects partial names, partial emails, and arbitrary customers', () => {
  assert.equal(matchesDemoCustomer('Mara', customer), false);
  assert.equal(matchesDemoCustomer('mara.finch', customer), false);
  assert.equal(matchesDemoCustomer('Someone Else', customer), false);
});
