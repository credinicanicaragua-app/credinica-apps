
'use client';

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { RegisteredPayment } from '@/lib/types';

const DB_NAME = 'CrediNicaDB';
const DB_VERSION = 1;
const PENDING_PAYMENTS_STORE = 'pending_payments';

interface CrediNicaDBSchema extends DBSchema {
  [PENDING_PAYMENTS_STORE]: {
    key: string;
    value: {
      creditId: string;
      paymentData: Omit<RegisteredPayment, 'id'>;
      actorId: string;
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };
}

let dbPromise: Promise<IDBPDatabase<CrediNicaDBSchema>> | null = null;

const getDb = (): Promise<IDBPDatabase<CrediNicaDBSchema>> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB can only be used in the browser.'));
  }
  if (!dbPromise) {
    dbPromise = openDB<CrediNicaDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PENDING_PAYMENTS_STORE)) {
          const store = db.createObjectStore(PENDING_PAYMENTS_STORE, {
            keyPath: 'timestamp',
          });
          store.createIndex('by-timestamp', 'timestamp');
        }
      },
    });
  }
  return dbPromise;
};

export async function savePendingPayment(
  creditId: string,
  paymentData: Omit<RegisteredPayment, 'id'>,
  actorId: string
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(PENDING_PAYMENTS_STORE, 'readwrite');
  await tx.store.add({
    creditId,
    paymentData,
    actorId,
    timestamp: Date.now(),
  });
  await tx.done;
}

export async function getPendingPayments(): Promise<{
  creditId: string;
  paymentData: Omit<RegisteredPayment, 'id'>;
  actorId: string;
  timestamp: number;
}[]> {
  const db = await getDb();
  return db.getAll(PENDING_PAYMENTS_STORE);
}

export async function deletePendingPayment(timestamp: number): Promise<void> {
  const db = await getDb();
  await db.delete(PENDING_PAYMENTS_STORE, timestamp);
}
