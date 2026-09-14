import { orders, policies } from './data.ts';
import type { Order, ReturnRecord } from './types.ts';

export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'identity_mismatch' | 'ineligible' | 'duplicate' | 'unavailable'; message: string };

export function findOrder(orderId: string, email: string): ToolResult<Order> {
  if (orderId.toUpperCase() === 'B-5000') {
    return { ok: false, code: 'unavailable', message: 'The order service did not respond.' };
  }

  const order = orders.find((candidate) => candidate.id === orderId.toUpperCase());
  if (!order) return { ok: false, code: 'not_found', message: 'No matching order was found.' };
  if (order.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, code: 'identity_mismatch', message: 'The order and email did not match.' };
  }
  return { ok: true, data: order };
}

export function getOrder(orderId: string): Order | undefined {
  return orders.find((order) => order.id === orderId);
}

export function getPolicy(topic: keyof typeof policies): string {
  return policies[topic];
}

export function checkReturnEligibility(orderId: string, itemId: string): ToolResult<{ eligible: true; itemId: string }> {
  const order = getOrder(orderId);
  const item = order?.items.find((candidate) => candidate.id === itemId);
  if (!order || !item) return { ok: false, code: 'not_found', message: 'The item could not be found.' };
  if (order.status !== 'delivered') {
    return { ok: false, code: 'ineligible', message: 'Returns can only be started after delivery.' };
  }
  if (!item.returnable) return { ok: false, code: 'ineligible', message: 'This item is outside the return window.' };
  return { ok: true, data: { eligible: true, itemId } };
}

export function createReturn(
  orderId: string,
  itemId: string,
  reason: string,
  existing: ReturnRecord[],
): ToolResult<ReturnRecord> {
  if (existing.some((record) => record.orderId === orderId && record.itemId === itemId)) {
    return { ok: false, code: 'duplicate', message: 'A return already exists for this item.' };
  }

  const eligibility = checkReturnEligibility(orderId, itemId);
  if (!eligibility.ok) return eligibility;
  const item = getOrder(orderId)?.items.find((candidate) => candidate.id === itemId);
  if (!item) return { ok: false, code: 'not_found', message: 'The item could not be found.' };

  return {
    ok: true,
    data: {
      id: `RTN-${orderId.replace('B-', '')}-${itemId.replace('BK-', '')}`,
      orderId,
      itemId,
      reason,
      amount: item.price,
      status: 'approved',
    },
  };
}
