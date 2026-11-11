const solarTerms = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];

const termMinutes = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921,
  173149, 195551, 218072, 240693, 263343, 285989, 308563, 331033,
  353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758,
];

const lunarDayNames = [
  '', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function shiftDateKey(key: string, amount: number) {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

export function formatSolarDate(key: string) {
  const date = fromDateKey(key);
  const dateText = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
  const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(date);
  return `${dateText} · ${weekday}`;
}

export function formatWeekday(key: string) {
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(fromDateKey(key));
}

function solarTermDate(year: number, index: number) {
  const base = new Date(1900, 0, 6, 2, 5).getTime();
  return new Date(base + 31556925974.7 * (year - 1900) + termMinutes[index] * 60_000);
}

export function getSolarTerm(key: string) {
  const date = fromDateKey(key);
  let current = { name: '冬至', date: solarTermDate(date.getFullYear() - 1, 23) };
  for (let year = date.getFullYear() - 1; year <= date.getFullYear(); year += 1) {
    solarTerms.forEach((name, index) => {
      const termDate = solarTermDate(year, index);
      if (termDate <= date && termDate > current.date) current = { name, date: termDate };
    });
  }
  return current.name;
}

export function formatLunarDate(key: string) {
  const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
    month: 'long', day: 'numeric',
  }).formatToParts(fromDateKey(key));
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? 0);
  return `农历${month}${lunarDayNames[day] ?? `${day}日`} · ${getSolarTerm(key)}`;
}

export function dayOfWeek(key: string) {
  return fromDateKey(key).getDay();
}

