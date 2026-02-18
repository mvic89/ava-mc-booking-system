/**
 * Mock BankID Data for Development
 *
 * This file provides fake BankID responses for development/testing
 * without needing real BankID certificates or test accounts.
 */

import type { BankIDAuthResponse, BankIDCollectResponse } from './client';

// Mock test users
const MOCK_USERS = [
  {
    personalNumber: '198906042384',
    name: 'Anna Andersson',
    givenName: 'Anna',
    surname: 'Andersson',
  },
  {
    personalNumber: '199003152385',
    name: 'Rolf Göransson',
    givenName: 'Rolf',
    surname: 'Göransson',
  },
  {
    personalNumber: '197512189876',
    name: 'Eva Eriksson',
    givenName: 'Eva',
    surname: 'Eriksson',
  },
];

// Store for simulating async BankID flow
const mockOrders = new Map<string, {
  status: 'pending' | 'complete' | 'failed';
  startTime: number;
  user: typeof MOCK_USERS[0];
}>();

/**
 * Mock auth - simulates starting a BankID authentication
 */
export function mockAuth(): BankIDAuthResponse {
  const orderRef = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const randomUser = MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)];

  // Store the order for later collection
  mockOrders.set(orderRef, {
    status: 'pending',
    startTime: Date.now(),
    user: randomUser,
  });

  return {
    orderRef,
    autoStartToken: 'mock-autostart-token',
    qrStartToken: 'mock-qr-token',
    qrStartSecret: 'mock-qr-secret',
  };
}

/**
 * Mock collect - simulates polling for BankID result
 * Auto-completes after 3 seconds to simulate user scanning QR
 */
export function mockCollect(orderRef: string): BankIDCollectResponse {
  const order = mockOrders.get(orderRef);

  if (!order) {
    return {
      orderRef,
      status: 'failed',
      hintCode: 'cancelled',
    };
  }

  // If already complete, return complete status again
  if (order.status === 'complete') {
    return {
      orderRef,
      status: 'complete',
      completionData: {
        user: {
          personalNumber: order.user.personalNumber,
          name: order.user.name,
          givenName: order.user.givenName,
          surname: order.user.surname,
        },
        device: {
          ipAddress: '127.0.0.1',
          uhi: 'mock-device-id',
        },
        bankIdIssueDate: '2024-01-15',
        signature: 'mock-signature-data',
        ocspResponse: 'mock-ocsp-response',
        risk: 'low',
      },
    };
  }

  const elapsed = Date.now() - order.startTime;

  // Simulate pending states with different messages
  if (elapsed < 2000) {
    return {
      orderRef,
      status: 'pending',
      hintCode: 'outstandingTransaction',
    };
  } else if (elapsed < 3000) {
    return {
      orderRef,
      status: 'pending',
      hintCode: 'started',
    };
  } else if (elapsed < 4000) {
    return {
      orderRef,
      status: 'pending',
      hintCode: 'userSign',
    };
  }

  // After 4 seconds, mark as complete
  order.status = 'complete';

  return {
    orderRef,
    status: 'complete',
    completionData: {
      user: {
        personalNumber: order.user.personalNumber,
        name: order.user.name,
        givenName: order.user.givenName,
        surname: order.user.surname,
      },
      device: {
        ipAddress: '127.0.0.1',
        uhi: 'mock-device-id',
      },
      bankIdIssueDate: '2024-01-15',
      signature: 'mock-signature-data',
      ocspResponse: 'mock-ocsp-response',
      risk: 'low',
    },
  };
}

/**
 * Mock cancel - simulates cancelling a BankID order
 */
export function mockCancel(orderRef: string): void {
  mockOrders.delete(orderRef);
}
