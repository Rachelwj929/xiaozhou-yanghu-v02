export type TriState = 'yes' | 'no';
export type SupplementState = 'taken' | 'skipped';

export type SupplementKey =
  | 'vitaminB'
  | 'vitaminD'
  | 'fishOil'
  | 'vitaminC'
  | 'nac'
  | 'veinSupport'
  | 'inositol'
  | 'magnesium';

export type OptionalKey = 'oliveOil' | 'coconutOil' | 'appleCiderVinegar';

export interface DailyRecord {
  date: string;
  sunlight?: TriState;
  greenWalk?: TriState;
  eatWell?: TriState;
  bodyNotes?: string;
  animalLiver?: TriState;
  seafood?: TriState;
  supplements?: Partial<Record<SupplementKey, SupplementState>>;
  optional?: Partial<Record<OptionalKey, 'used'>>;
  updatedAt?: string;
}


export interface SupplementRule {
  key: SupplementKey;
  name: string;
  group: '早餐' | '午餐' | '晚餐' | '睡前' | '其他补充';
  days: number[];
  schedule: string;
  details: string[];
  takenLabel: string;
  skippedLabel: string;
  optional?: boolean;
}

export const supplementRules: SupplementRule[] = [
  {"key": "vitaminD", "name": "维生素 D（VD）", "group": "早餐", "days": [0, 1, 2, 3, 4, 5, 6], "schedule": "早餐随餐（随蛋黄）", "details": ["每天", "秋冬5000IU每天，不舒服可以加量。"], "takenLabel": "已吃", "skippedLabel": "跳过"},
  {"key": "vitaminC", "name": "维生素 C（VC）", "group": "早餐", "days": [0, 1, 2, 3, 4, 5, 6], "schedule": "早餐后1颗", "details": ["每天", "新版 VC 剂型", "不舒服可以加量。"], "takenLabel": "已吃", "skippedLabel": "跳过"},
  {"key": "vitaminB", "name": "复合维生素 B（VB）", "group": "午餐", "days": [1, 3, 5], "schedule": "午餐随餐", "details": ["周一 / 周三 / 周五"], "takenLabel": "已吃", "skippedLabel": "跳过"},
  {"key": "nac", "name": "NAC（呼吸道）", "group": "午餐", "days": [0, 1, 2, 3, 4, 5, 6], "schedule": "午餐后1颗", "details": ["每天", "建议秋冬、冬春换季时服用。"], "takenLabel": "已吃", "skippedLabel": "跳过"},
  {"key": "veinSupport", "name": "静脉曲张补剂", "group": "晚餐", "days": [0, 1, 2, 3, 4, 5, 6], "schedule": "晚餐后1颗", "details": ["每天"], "takenLabel": "已吃", "skippedLabel": "跳过"},
  {
    key: 'fishOil',
    group: '其他补充',
    name: '鱼油',
    days: [2, 4, 6],
    schedule: '餐后 1 粒',
    details: ['周二 / 周四 / 周六', '当天吃海产品时可以不吃'],
    takenLabel: '已吃',
    skippedLabel: '跳过',
  },
  {
    key: 'inositol',
    group: '其他补充',
    name: '肌醇',
    days: [0, 1, 2, 3, 4, 5, 6],
    schedule: '每天 · 可选',
    details: ['昨天有腹泻时，今天可以先不吃'],
    takenLabel: '吃了',
    skippedLabel: '今天不吃',
    optional: true,
  },
  {
    key: 'magnesium',
    group: '睡前',
    name: '镁',
    days: [0, 1, 2, 3, 4, 5, 6],
    schedule: '洗澡前 · 4-5颗',
    details: ['每天', '镁平衡促进其他营养吸收（如vd,vc，钙磷钾钠），平衡血压，吃够量可助眠。'],
    takenLabel: '已吃',
    skippedLabel: '跳过',
  },
];

export const optionalRules = [
  {
    key: 'oliveOil' as OptionalKey,
    name: '橄榄油',
    schedule: '随正餐 / 拌菜，或睡前 1 勺',
    notes: ['可作为助眠习惯尝试', '若腹胀，可暂停'],
    action: '用了',
  },
  {
    key: 'coconutOil' as OptionalKey,
    name: '椰子油',
    schedule: '随餐少量 · 可选',
    notes: [],
    action: '吃了',
  },
  {
    key: 'appleCiderVinegar' as OptionalKey,
    name: '苹果醋',
    schedule: '餐前空腹',
    notes: ['务必兑水；建议用吸管，减少牙齿酸蚀。'],
    action: '喝了',
  },
];

export function isRecordEmpty(record: DailyRecord) {
  return ![
    record.sunlight,
    record.greenWalk,
    record.eatWell,
    record.bodyNotes?.trim(),
    record.animalLiver,
    record.seafood,
    record.supplements && Object.keys(record.supplements).length,
    record.optional && Object.keys(record.optional).length,
  ].some(Boolean);
}

export function cleanRecord(record: DailyRecord): DailyRecord {
  const next = structuredClone(record);
  if (!next.bodyNotes?.trim()) delete next.bodyNotes;
  if (next.supplements && !Object.keys(next.supplements).length) delete next.supplements;
  if (next.optional && !Object.keys(next.optional).length) delete next.optional;
  return next;
}
