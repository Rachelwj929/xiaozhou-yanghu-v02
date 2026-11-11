import { cleanRecord, DailyRecord, isRecordEmpty } from './domain';

const DB_NAME = 'xiaozhou-care-v02';
const STORE_NAME = 'records';
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'date' });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error);
  });
}

function complete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function getRecord(date: string): Promise<DailyRecord | undefined> {
  const database = await openDatabase();
  return new Promise<DailyRecord | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).get(date);
    request.onsuccess = () => resolve(request.result as DailyRecord | undefined);
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
}

export async function getAllRecords(): Promise<DailyRecord[]> {
  const database = await openDatabase();
  return new Promise<DailyRecord[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as DailyRecord[]);
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
}

export async function saveRecord(record: DailyRecord) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const cleaned = cleanRecord(record);
  if (isRecordEmpty(cleaned)) store.delete(record.date);
  else store.put({ ...cleaned, updatedAt: new Date().toISOString() });
  try { await complete(transaction); } finally { database.close(); }
}

export async function mergeRecords(records: DailyRecord[]) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  records.forEach((record) => {
    const cleaned = cleanRecord(record);
    if (!isRecordEmpty(cleaned)) store.put(cleaned);
  });
  try { await complete(transaction); } finally { database.close(); }
}
