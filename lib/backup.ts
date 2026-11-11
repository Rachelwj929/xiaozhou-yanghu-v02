import { DailyRecord, optionalRules, supplementRules } from './domain';

export interface CareBackup {
  app: 'xiaozhou-care-v02';
  dataVersion: 2;
  exportedAt: string;
  records: DailyRecord[];
}

export function createBackup(records: DailyRecord[], exportedAt = new Date()): CareBackup {
  return { app: 'xiaozhou-care-v02', dataVersion: 2, exportedAt: exportedAt.toISOString(), records };
}

const recordKeys = new Set(['date', 'sunlight', 'greenWalk', 'eatWell', 'bodyNotes', 'animalLiver', 'seafood', 'supplements', 'optional', 'updatedAt']);
const supplementKeys = new Set<string>(supplementRules.map((rule) => rule.key));
const optionalKeys = new Set<string>(optionalRules.map((rule) => rule.key));
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export function isValidRecord(value: unknown): value is DailyRecord {
  if (!object(value) || !validDate(value.date) || Object.keys(value).some((key) => !recordKeys.has(key))) return false;
  for (const field of ['sunlight', 'greenWalk', 'eatWell', 'animalLiver', 'seafood']) {
    if (value[field] !== undefined && value[field] !== 'yes' && value[field] !== 'no') return false;
  }
  if (value.bodyNotes !== undefined && typeof value.bodyNotes !== 'string') return false;
  if (value.updatedAt !== undefined && (typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt)))) return false;
  if (value.supplements !== undefined && (!object(value.supplements) || Object.entries(value.supplements).some(([key, state]) => !supplementKeys.has(key) || !['taken', 'skipped'].includes(String(state))))) return false;
  if (value.optional !== undefined && (!object(value.optional) || Object.entries(value.optional).some(([key, state]) => !optionalKeys.has(key) || state !== 'used'))) return false;
  return true;
}

export function parseBackup(text: string): CareBackup {
  const backup: unknown = JSON.parse(text);
  if (!object(backup) || backup.app !== 'xiaozhou-care-v02' || backup.dataVersion !== 2 ||
      typeof backup.exportedAt !== 'string' || Number.isNaN(Date.parse(backup.exportedAt)) ||
      !Array.isArray(backup.records) || !backup.records.every(isValidRecord) ||
      new Set(backup.records.map((record) => record.date)).size !== backup.records.length) {
    throw new Error('仅支持有效的 V0.2 备份');
  }
  return backup as unknown as CareBackup;
}

export function backupFilename(date: string) {
  return `小周养护-V0.2-备份-${date}.json`;
}
