import { isValidRecord } from './backup';
import { getAllRecords, saveRecord } from './db';
import type { DailyRecord } from './domain';

// Only the newest pending edit for each date is journaled synchronously. A tab
// switch or immediate reload can recover it even before IndexedDB completes.
const JOURNAL_KEY = 'xiaozhou-care-v02-pending';
let saveQueue = Promise.resolve();
const pending = new Map<string, DailyRecord>();
function writeJournal() {
  if (pending.size) localStorage.setItem(JOURNAL_KEY, JSON.stringify([...pending.values()]));
  else localStorage.removeItem(JOURNAL_KEY);
}
export async function loadRecords(): Promise<DailyRecord[]> {
  const journal = localStorage.getItem(JOURNAL_KEY);
  if (journal) {
    const entries: unknown = JSON.parse(journal);
    if (!Array.isArray(entries) || !entries.every(isValidRecord)) throw new Error('Invalid V0.2 pending edits');
    for (const record of entries) await saveRecord(record);
    localStorage.removeItem(JOURNAL_KEY);
  }
  return getAllRecords();
}
export function enqueueSave(record: DailyRecord): Promise<void> {
  const snapshot = structuredClone(record);
  pending.set(record.date, snapshot);
  // IDB still gets a chance if the small recovery journal hits a quota limit.
  try { writeJournal(); } catch { /* beforeunload guards the in-memory queue */ }
  saveQueue = saveQueue.catch(() => undefined).then(async () => {
    await saveRecord(snapshot);
    if (pending.get(record.date) === snapshot) {
      pending.delete(record.date);
      writeJournal();
    }
  });
  return saveQueue;
}
export async function waitForSaves() {
  await saveQueue;
  if (pending.size) throw new Error('仍有未保存的记录，请先完成保存或导出备份');
}
