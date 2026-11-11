import { DailyRecord, SupplementKey, supplementRules } from './domain';

export type ProgramState = 'rule-skip' | 'diet-replacement';

export interface SupplementLinkState {
  programState?: ProgramState;
  message?: string;
  warning?: boolean;
}

export function getVisibleSupplementRules(weekday: number) {
  return supplementRules.filter((rule) => rule.days.includes(weekday));
}

export function getSupplementLinkState(
  key: SupplementKey,
  today: DailyRecord,
  yesterday: DailyRecord,
): SupplementLinkState {
  if (key === 'vitaminB') {
    if (yesterday.animalLiver === 'yes') {
      return {
        programState: 'rule-skip',
        message: '昨天吃过动物肝脏，与复合 VB 冲突。今天跳过。',
      };
    }
    if (today.animalLiver === 'yes' && today.supplements?.vitaminB === 'taken') {
      return { message: '今天已记录复合 VB，同时记录了动物肝脏。', warning: true };
    }
    if (today.animalLiver === 'yes') return { message: '今天吃动物肝脏，VB 跳过 / 错开。' };
  }
  if (key === 'fishOil' && today.seafood === 'yes') {
    return { programState: 'diet-replacement', message: '今天吃了海产品，鱼油可以不吃。' };
  }
  if (key === 'inositol') {
    return { message: '昨天如有腹泻，今天可以先不吃。' };
  }
  return {};
}
