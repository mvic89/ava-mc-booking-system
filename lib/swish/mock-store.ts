/**
 * In-memory store for mock Swish payments (dev / SWISH_MOCK_MODE=true only).
 * Module-level state is shared across API route handlers in the same Node.js process.
 */

export interface MockSwishPayment {
  status:     'CREATED' | 'PAID' | 'DECLINED' | 'ERROR';
  payerAlias: string;
  amount:     string;
  orderId:    string;
  createdAt:  number;
}

const store = new Map<string, MockSwishPayment>();

export const mockSwishStore = {
  set(id: string, p: MockSwishPayment) { store.set(id, p); },
  get(id: string)                      { return store.get(id); },
  paid(id: string) {
    const p = store.get(id);
    if (p) store.set(id, { ...p, status: 'PAID' });
  },
};
