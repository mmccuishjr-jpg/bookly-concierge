import type { CustomerProfile } from './types';

function normalizeIdentifier(value: string) {
  return value.trim().toLocaleLowerCase('en-US');
}

export function matchesDemoCustomer(identifier: string, customer: Pick<CustomerProfile, 'name' | 'email'>) {
  const candidate = normalizeIdentifier(identifier);
  if (!candidate) return false;

  return candidate === normalizeIdentifier(customer.name)
    || candidate === normalizeIdentifier(customer.email);
}
