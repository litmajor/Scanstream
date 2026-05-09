// Common types used across execution compartments
export type UUID = string & { readonly __brand: 'UUID' };

export function createUUID(): UUID {
  return (Math.random().toString(36).substring(2) + Date.now().toString(36)) as UUID;
}
