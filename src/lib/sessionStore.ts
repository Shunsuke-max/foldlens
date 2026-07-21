import { isSession } from './export';
import type { AF3Result, FoldLensSession, FoldLensViewState } from '../types/af3';

const DATABASE_NAME = 'foldlens-workspace';
const DATABASE_VERSION = 1;
const RESULT_STORE = 'results';
const RECENT_STORE = 'recent';
const LATEST_RECORD = 'latest';

type StoredResult = {
  id: string;
  result: AF3Result;
};

type StoredRecent = RecentSessionSummary & {
  id: typeof LATEST_RECORD;
  resultId: string;
  view: FoldLensViewState;
};

export type RecentSessionSummary = {
  jobName: string;
  sourceName: string;
  predictionCount: number;
  savedAt: string;
};

let writeQueue: Promise<void> = Promise.resolve();

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('FoldLens storage request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('FoldLens storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('FoldLens storage transaction was aborted.'));
  });
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable.'));
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RESULT_STORE)) database.createObjectStore(RESULT_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(RECENT_STORE)) database.createObjectStore(RECENT_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('FoldLens storage could not be opened.'));
    request.onblocked = () => reject(new Error('FoldLens storage upgrade is blocked by another tab.'));
  });
}

function enqueueWrite<T>(operation: () => Promise<T>) {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

function hashSignature(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function resultStorageKey(result: AF3Result) {
  const signature = JSON.stringify([
    result.jobName,
    result.sourceName,
    result.predictions.map((prediction) => [prediction.id, prediction.path, prediction.cif.length]),
  ]);
  return `result:${hashSignature(signature)}`;
}

export function recentSessionSummary(session: FoldLensSession): RecentSessionSummary {
  return {
    jobName: session.result.jobName,
    sourceName: session.result.sourceName,
    predictionCount: session.result.predictions.length,
    savedAt: session.savedAt,
  };
}

function isRecentRecord(value: unknown): value is StoredRecent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<StoredRecent>;
  return record.id === LATEST_RECORD
    && typeof record.resultId === 'string'
    && typeof record.jobName === 'string'
    && typeof record.sourceName === 'string'
    && typeof record.predictionCount === 'number'
    && Number.isSafeInteger(record.predictionCount)
    && record.predictionCount > 0
    && typeof record.savedAt === 'string'
    && Boolean(record.view && typeof record.view === 'object');
}

export async function loadRecentSummary(): Promise<RecentSessionSummary | null> {
  if (typeof indexedDB === 'undefined') return null;
  let database: IDBDatabase | undefined;
  try {
    database = await openDatabase();
    const transaction = database.transaction(RECENT_STORE, 'readonly');
    const completed = transactionComplete(transaction);
    const record: unknown = await requestValue(transaction.objectStore(RECENT_STORE).get(LATEST_RECORD));
    await completed;
    if (!isRecentRecord(record)) return null;
    return { jobName: record.jobName, sourceName: record.sourceName, predictionCount: record.predictionCount, savedAt: record.savedAt };
  } catch {
    return null;
  } finally {
    database?.close();
  }
}

export async function loadRecentSession(): Promise<FoldLensSession | null> {
  if (typeof indexedDB === 'undefined') return null;
  let database: IDBDatabase | undefined;
  try {
    database = await openDatabase();
    const transaction = database.transaction([RECENT_STORE, RESULT_STORE], 'readonly');
    const completed = transactionComplete(transaction);
    const recent: unknown = await requestValue(transaction.objectStore(RECENT_STORE).get(LATEST_RECORD));
    if (!isRecentRecord(recent)) {
      await completed;
      return null;
    }
    const stored: StoredResult | undefined = await requestValue(transaction.objectStore(RESULT_STORE).get(recent.resultId));
    await completed;
    const session: FoldLensSession | null = stored
      ? { format: 'foldlens-session', version: 1, savedAt: recent.savedAt, result: stored.result, view: recent.view }
      : null;
    return session && isSession(session) ? session : null;
  } catch {
    return null;
  } finally {
    database?.close();
  }
}

export function saveRecentResult(result: AF3Result) {
  return enqueueWrite(async () => {
    const database = await openDatabase();
    try {
      const transaction = database.transaction([RESULT_STORE, RECENT_STORE], 'readwrite');
      const completed = transactionComplete(transaction);
      const results = transaction.objectStore(RESULT_STORE);
      results.clear();
      results.put({ id: resultStorageKey(result), result } satisfies StoredResult);
      transaction.objectStore(RECENT_STORE).delete(LATEST_RECORD);
      await completed;
    } finally {
      database.close();
    }
  });
}

export function saveRecentView(result: AF3Result, view: FoldLensViewState) {
  return enqueueWrite(async () => {
    const database = await openDatabase();
    try {
      const savedAt = new Date().toISOString();
      const record: StoredRecent = {
        id: LATEST_RECORD,
        resultId: resultStorageKey(result),
        jobName: result.jobName,
        sourceName: result.sourceName,
        predictionCount: result.predictions.length,
        savedAt,
        view,
      };
      const transaction = database.transaction(RECENT_STORE, 'readwrite');
      const completed = transactionComplete(transaction);
      transaction.objectStore(RECENT_STORE).put(record);
      await completed;
      return { jobName: record.jobName, sourceName: record.sourceName, predictionCount: record.predictionCount, savedAt: record.savedAt } satisfies RecentSessionSummary;
    } finally {
      database.close();
    }
  });
}

export function clearRecentSession() {
  if (typeof indexedDB === 'undefined') return Promise.resolve();
  return enqueueWrite(async () => {
    const database = await openDatabase();
    try {
      const transaction = database.transaction([RESULT_STORE, RECENT_STORE], 'readwrite');
      const completed = transactionComplete(transaction);
      transaction.objectStore(RESULT_STORE).clear();
      transaction.objectStore(RECENT_STORE).clear();
      await completed;
    } finally {
      database.close();
    }
  });
}
