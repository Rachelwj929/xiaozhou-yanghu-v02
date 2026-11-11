'use client';

import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  CloudSun,
  Download,
  Droplets,
  FileUp,
  HeartPulse,
  Leaf,
  NotebookText,
  Salad,
  Sparkles,
  SunMedium,
  Utensils,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { backupFilename, createBackup, parseBackup } from '@/lib/backup';
import { getAllRecords, mergeRecords } from '@/lib/db';
import { enqueueSave, loadRecords, waitForSaves } from '@/lib/persistence';
import {
  cleanRecord,
  DailyRecord,
  isRecordEmpty,
  OptionalKey,
  optionalRules,
  SupplementKey,
  supplementRules,
  SupplementState,
  TriState,
} from '@/lib/domain';
import {
  dayOfWeek,
  formatLunarDate,
  formatSolarDate,
  formatWeekday,
  shiftDateKey,
  toDateKey,
} from '@/lib/date';
import { getSupplementLinkState, getVisibleSupplementRules } from '@/lib/rules';

type Tab = 'today' | 'records' | 'plan';

const naturalFields = [
  { key: 'sunlight' as const, label: '阳光', question: '昨天晒太阳了吗？', icon: SunMedium },
  { key: 'greenWalk' as const, label: '绿色 + 溜达', question: '昨天有接触绿色、出去溜达吗？', icon: Leaf },
  { key: 'eatWell' as const, label: '吃好', question: '昨天吃好了吗？', icon: Utensils },
];

const positiveFeedback: Partial<Record<keyof DailyRecord, string>> = {
  sunlight: '真棒，昨天晒到太阳了。',
  greenWalk: '真棒，昨天看了绿色，也出去溜达了。',
  eatWell: '真棒，天然食物吃好了，补剂漏吃也没关系。',
};

const supplementShort: Record<SupplementKey, string> = {
  vitaminB: 'VB',
  vitaminD: 'VD',
  fishOil: '鱼油',
  vitaminC: 'VC',
  nac: 'NAC',
  veinSupport: '静脉曲张补剂',
  inositol: '肌醇',
  magnesium: '镁',
};

function ChoiceButtons({
  value,
  onChange,
  yesLabel = '有',
  noLabel = '没有',
}: {
  value?: TriState;
  onChange: (value?: TriState) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <div className="choice-row">
      <Button
        size="lg"
        variant={value === 'yes' ? 'default' : 'outline'}
        aria-pressed={value === 'yes'}
        onClick={() => onChange(value === 'yes' ? undefined : 'yes')}
      >
        {value === 'yes' && <Check />} {yesLabel}
      </Button>
      <Button
        size="lg"
        variant={value === 'no' ? 'secondary' : 'outline'}
        className={value === 'no' ? 'choice-no-selected' : undefined}
        aria-pressed={value === 'no'}
        onClick={() => onChange(value === 'no' ? undefined : 'no')}
      >
        {noLabel}
      </Button>
    </div>
  );
}

function StateButtons({
  value,
  onChange,
  takenLabel,
  skippedLabel,
}: {
  value?: SupplementState;
  onChange: (value?: SupplementState) => void;
  takenLabel: string;
  skippedLabel: string;
}) {
  return (
    <div className="choice-row">
      <Button
        size="lg"
        variant={value === 'taken' ? 'default' : 'outline'}
        aria-pressed={value === 'taken'}
        onClick={() => onChange(value === 'taken' ? undefined : 'taken')}
      >
        {value === 'taken' && <Check />} {takenLabel}
      </Button>
      <Button
        size="lg"
        variant={value === 'skipped' ? 'secondary' : 'outline'}
        className={value === 'skipped' ? 'choice-no-selected' : undefined}
        aria-pressed={value === 'skipped'}
        onClick={() => onChange(value === 'skipped' ? undefined : 'skipped')}
      >
        {skippedLabel}
      </Button>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <div className="section-heading"><h2>{title}</h2></div>;
}

function BodyNotesEditor({ record, onChange }: { record: DailyRecord; onChange: (value: string) => void }) {
  return <Textarea className="symptom-input" rows={4} value={record.bodyNotes ?? ''}
    placeholder="有不舒服或其他身体变化，可以记在这里；没有就留空。"
    aria-label="身体记录" onChange={(event) => onChange(event.target.value)} />;
}

export function CareApp() {
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const yesterdayKey = useMemo(() => shiftDateKey(todayKey, -1), [todayKey]);
  const [tab, setTab] = useState<Tab>('today');
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [ready, setReady] = useState(false);
  const recordsRef = useRef<DailyRecord[]>([]);
  const [storageError, setStorageError] = useState<string>();
  const [saving, setSaving] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const pendingWrites = useRef(0);
  const failedDates = useRef(new Set<string>());
  const [selectedDate, setSelectedDate] = useState<string>();
  const [pendingRestore, setPendingRestore] = useState<DailyRecord[]>();
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [notice, setNotice] = useState<string>();

  const replaceRecords = useCallback((next: DailyRecord[]) => {
    const sorted = [...next].sort((a, b) => b.date.localeCompare(a.date));
    recordsRef.current = sorted;
    setRecords(sorted);
  }, []);

  useEffect(() => {
    loadRecords()
      .then(replaceRecords)
      .then(() => setReady(true))
      .catch(() => setStorageError('读取记录失败，请刷新重试；为保护记录，暂时不能编辑。'));

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/xiaozhou-yanghu-v02';
      navigator.serviceWorker
        .register(`${basePath}/sw.js`, { scope: `${basePath}/` })
        .catch(() => undefined);
    }
  }, [replaceRecords]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(undefined), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pendingWrites.current || failedDates.current.size) { event.preventDefault(); }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const handleCommit = useCallback(async (date: string, mutate: (draft: DailyRecord) => void) => {
    if (!ready || restoring) return;
    const current = recordsRef.current.find((record) => record.date === date) ?? { date };
    const draft = structuredClone(current);
    mutate(draft);
    const others = recordsRef.current.filter((record) => record.date !== date);
    // Keep the exact input (including whitespace) in React; clean only at the storage boundary.
    replaceRecords(isRecordEmpty(draft) && !draft.bodyNotes ? others : [draft, ...others]);
    pendingWrites.current += 1;
    setSaving(pendingWrites.current);
    try {
      await enqueueSave(draft);
      failedDates.current.delete(date);
      if (!failedDates.current.size) setStorageError(undefined);
    } catch {
      failedDates.current.add(date);
      setStorageError('保存失败，最近编辑尚未存入设备。请保留此页面，继续编辑可自动重试，也可先到记录页导出备份。');
    } finally {
      pendingWrites.current -= 1;
      setSaving(pendingWrites.current);
    }
  }, [ready, restoring, replaceRecords]);

  const today = records.find((record) => record.date === todayKey) ?? { date: todayKey };
  const yesterday = records.find((record) => record.date === yesterdayKey) ?? { date: yesterdayKey };

  const handleTriState = (date: string, key: 'sunlight' | 'greenWalk' | 'eatWell' | 'animalLiver' | 'seafood', value?: TriState) => {
    void handleCommit(date, (draft) => {
      if (value) draft[key] = value;
      else delete draft[key];
    });
  };

  const handleBodyNotes = (date: string, value: string) => {
    void handleCommit(date, (draft) => { draft.bodyNotes = value; });
  };

  const handleSupplement = (date: string, key: SupplementKey, value?: SupplementState) => {
    void handleCommit(date, (draft) => {
      draft.supplements = { ...draft.supplements };
      if (value) draft.supplements[key] = value;
      else delete draft.supplements[key];
    });
  };

  const handleOptional = (date: string, key: OptionalKey) => {
    void handleCommit(date, (draft) => {
      draft.optional = { ...draft.optional };
      if (draft.optional[key]) delete draft.optional[key];
      else draft.optional[key] = 'used';
    });
  };

  const switchTab = (next: Tab) => {
    setSelectedDate(undefined);
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExport = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    const backup = createBackup(recordsRef.current.map(cleanRecord).filter((record) => !isRecordEmpty(record)));
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    event.currentTarget.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const chooseBackup = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseBackup(await file.text());
      setPendingRestore(parsed.records);
      setRestoreOpen(true);
    } catch {
      setNotice('仅支持小周养护 V0.2 的有效备份，不能恢复 V0.1 备份。');
    }
  };

  const restoreBackup = async () => {
    if (!pendingRestore) return;
    setRestoring(true);
    try {
      await waitForSaves();
      await mergeRecords(pendingRestore);
      replaceRecords(await getAllRecords());
      setNotice('恢复完成。');
    } catch {
      setNotice('恢复失败，请重试。');
    } finally {
      setPendingRestore(undefined);
      setRestoring(false);
    }
  };

  const weekday = dayOfWeek(todayKey);
  const shownSupplements = getVisibleSupplementRules(weekday);
  const yesterdayHasData = !isRecordEmpty(yesterday);
  const todayContent = (
      <>
        <header className="hero-card">
          <h1>小周养护 <small className="version-label">V0.2</small></h1>
          <p className="date-line">{formatSolarDate(todayKey)}</p>
          <p className="lunar-line">{formatLunarDate(todayKey)}</p>
          <div className="principle-strip"><span>天然食物、阳光和活动优先</span><span>补剂只是补充</span></div>
        </header>

        <section className="section-block">
          <SectionTitle title="昨天怎么样？" />
          {!yesterdayHasData && <p className="empty-note">昨天还没有记录</p>}
          <div className="review-grid">
            {naturalFields.map(({ key, question, icon: Icon }) => (
              <article className="review-card" key={key}>
                <Icon />
                <div>
                  <h3>{question}</h3>
                  <ChoiceButtons value={yesterday[key]} onChange={(value) => handleTriState(yesterdayKey, key, value)} />
                  {yesterday[key] === 'yes' && <p className="positive-note">{positiveFeedback[key]}</p>}
                </div>
              </article>
            ))}
          </div>

          <article className="wide-card symptoms-card">
            <HeartPulse />
            <div>
              <h3>昨天身体怎么样？</h3>
              <p>有不舒服再记，没有可以跳过。</p>
              <BodyNotesEditor record={yesterday} onChange={(value) => handleBodyNotes(yesterdayKey, value)} />
            </div>
          </article>

          <article className="wide-card">
            <Salad />
            <div>
              <h3>昨天吃过动物肝脏吗？</h3>
              <ChoiceButtons value={yesterday.animalLiver} yesLabel="吃过" noLabel="没吃" onChange={(value) => handleTriState(yesterdayKey, 'animalLiver', value)} />
            </div>
          </article>
        </section>

        <section className="section-block">
          <SectionTitle title="今天的补充" />
          <div className="supplement-list">
            {(['早餐', '午餐', '晚餐', '其他补充'] as const).map((group) => (
            <section className="supplement-group" key={group}><h3 className="meal-heading">{group}</h3>
            {shownSupplements.filter((rule) => rule.group === group).map((rule) => {
              const state = today.supplements?.[rule.key];
              const linkState = getSupplementLinkState(rule.key, today, yesterday);
              return (
                <article className={`supplement-card ${rule.optional ? 'optional-emphasis' : ''}`} key={rule.key}>
                  <div className="card-topline">
                    <div><span className="soft-badge">{rule.schedule}</span><h3>{rule.name}</h3></div>
                    {linkState.programState === 'rule-skip' && <span className="rule-badge">规则跳过</span>}
                    {linkState.programState === 'diet-replacement' && <span className="food-badge">饮食替代</span>}
                    {rule.optional && !linkState.programState && <span className="quiet-badge">可选</span>}
                  </div>
                  {rule.details.map((detail) => <p key={detail}>{detail}</p>)}
                  {linkState.message && <div className={`linked-note ${linkState.warning ? 'warning' : ''}`}>{linkState.message}</div>}
                  <StateButtons value={state} takenLabel={rule.takenLabel} skippedLabel={rule.skippedLabel} onChange={(value) => handleSupplement(todayKey, rule.key, value)} />
                </article>
              );
            })}</section>))}
          </div>
        </section>

        <section className="section-block quiet-section">
          <SectionTitle title="可选补充" />
          <div className="optional-grid">
            {optionalRules.map((item) => {
              const active = Boolean(today.optional?.[item.key]);
              return (
                <article className="optional-card" key={item.key}>
                  <div><h3>{item.name}</h3><p>{item.schedule}</p>{item.notes.map((note) => <small className={item.key === 'appleCiderVinegar' ? 'must-note' : ''} key={note}>{note}</small>)}</div>
                  <Button variant={active ? 'default' : 'outline'} aria-pressed={active} onClick={() => handleOptional(todayKey, item.key)}>{active && <Check />}{item.action}</Button>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="life-reminder"><h3>一次生病经历的提醒</h3><p>连续外食、身体尚未恢复时，注意放慢节奏。天气变化、呼吸道病毒流行期间，留意休息与防护。</p></aside>

        <section className="section-block mini-record">
          <SectionTitle title="今天 · 小记录" />
          <div className="tag-row">
            {naturalFields.map(({ key, label }) => <button key={key} className={`tag-button ${today[key] === 'yes' ? 'selected' : ''}`} onClick={() => handleTriState(todayKey, key, today[key] === 'yes' ? undefined : 'yes')}>{label}</button>)}
            <button className={`tag-button ${today.animalLiver === 'yes' ? 'selected' : ''}`} onClick={() => handleTriState(todayKey, 'animalLiver', today.animalLiver === 'yes' ? undefined : 'yes')}>动物肝脏</button>
            <button className={`tag-button ${today.seafood === 'yes' ? 'selected' : ''}`} onClick={() => handleTriState(todayKey, 'seafood', today.seafood === 'yes' ? undefined : 'yes')}>海产品</button>
          </div>
        </section>
      </>
    );

  const getSummary = (record: DailyRecord) => {
    const natural = [
      record.sunlight && `阳光 ${record.sunlight === 'yes' ? '✓' : '—'}`,
      record.greenWalk && `绿色+溜达 ${record.greenWalk === 'yes' ? '✓' : '—'}`,
      record.eatWell && `吃好 ${record.eatWell === 'yes' ? '✓' : '—'}`,
    ].filter(Boolean) as string[];
    const symptoms = record.bodyNotes?.trim() ? [record.bodyNotes] : [];
    const taken = Object.entries(record.supplements ?? {}).filter(([, state]) => state === 'taken').map(([key]) => key as SupplementKey);
    const skipped = Object.entries(record.supplements ?? {}).filter(([, state]) => state === 'skipped').map(([key]) => key as SupplementKey);
    const supplement: string[] = [];
    taken.forEach((key) => supplement.push(`${supplementShort[key]} ✓`));
    skipped.forEach((key) => supplement.push(`${supplementShort[key]} 跳过`));
    const diet = [
      record.animalLiver && `肝脏 ${record.animalLiver === 'yes' ? '✓' : '—'}`,
      record.seafood && `海产品 ${record.seafood === 'yes' ? '✓' : '—'}`,
    ].filter(Boolean) as string[];
    const optional = optionalRules.filter((item) => record.optional?.[item.key]).map((item) => item.name);
    return { natural, diet, symptoms, supplement, optional };
  };

  const renderRecords = () => {
    const historyRecords = records.filter((record) => !isRecordEmpty(record));
    if (selectedDate) return renderDetail(selectedDate);
    return (
      <>
        <header className="page-header">
          <div className="page-icon"><NotebookText /></div>
          <div><h1>记录</h1></div>
        </header>

        <section className="backup-panel">
          <div className="backup-actions">
            <a className="export-button" href="data:application/json,%7B%7D" download={backupFilename(todayKey)} onClick={handleExport}><Download />导出全部记录</a>
            <label className="file-button"><FileUp />恢复记录<input type="file" accept="application/json,.json" onChange={(event) => { void chooseBackup(event.target.files?.[0]); event.target.value = ''; }} /></label>
          </div>
        </section>

        {!ready ? <p className="empty-state">正在读取记录…</p> : historyRecords.length === 0 ? (
          <div className="empty-state"><CalendarDays /><p>还没有记录</p></div>
        ) : (
          <div className="history-list">
            {historyRecords.map((record) => {
              const summary = getSummary(record);
              return (
                <button className="history-card" key={record.date} onClick={() => { setSelectedDate(record.date); window.scrollTo(0, 0); }}>
                  <div className="history-date"><div><strong>{record.date}</strong><span>{formatWeekday(record.date)}</span></div><ChevronRight /></div>
                  <p>{[
                    ...summary.natural,
                    ...summary.diet,
                    ...summary.supplement,
                    ...summary.optional,
                    ...(summary.symptoms.length > 0 ? [`身体：${summary.symptoms.join('、')}`] : []),
                  ].join(' · ')}</p>
                </button>
              );
            })}
          </div>
        )}
      </>
    );
  };

  const renderDetail = (date: string) => {
    const record = records.find((item) => item.date === date) ?? { date };
    return (
      <>
        <button type="button" className="back-button" aria-label="返回记录列表" onClick={() => setSelectedDate(undefined)}><ArrowLeft />返回</button>
        <header className="detail-header">
          <h1>{formatSolarDate(date)}</h1>
          <p>{formatLunarDate(date)}</p>
        </header>

        <DetailSection title="自然养护">
          {naturalFields.map(({ key, label }) => <div className="detail-row" key={key}><span>{label}</span><ChoiceButtons value={record[key]} onChange={(value) => handleTriState(date, key, value)} /></div>)}
        </DetailSection>
        <DetailSection title="身体感觉">
          <BodyNotesEditor record={record} onChange={(value) => handleBodyNotes(date, value)} />
        </DetailSection>
        <DetailSection title="饮食">
          <div className="detail-row"><span>动物肝脏</span><ChoiceButtons value={record.animalLiver} yesLabel="吃过" noLabel="没吃" onChange={(value) => handleTriState(date, 'animalLiver', value)} /></div>
          <div className="detail-row"><span>海产品</span><ChoiceButtons value={record.seafood} yesLabel="吃过" noLabel="没吃" onChange={(value) => handleTriState(date, 'seafood', value)} /></div>
        </DetailSection>
        <DetailSection title="当天补充">
          {getVisibleSupplementRules(dayOfWeek(date)).map((rule) => <div className="detail-row" key={rule.key}><span>{rule.name}</span><StateButtons value={record.supplements?.[rule.key]} takenLabel={rule.takenLabel} skippedLabel={rule.skippedLabel} onChange={(value) => handleSupplement(date, rule.key, value)} /></div>)}
        </DetailSection>
        <DetailSection title="可选项">
          {optionalRules.map((item) => <div className="detail-row" key={item.key}><span>{item.name}</span><Button variant={record.optional?.[item.key] ? 'default' : 'outline'} onClick={() => handleOptional(date, item.key)}>{record.optional?.[item.key] && <Check />}{item.action}</Button></div>)}
        </DetailSection>
        <p className="edit-caption">编辑这一天</p>
      </>
    );
  };

  const renderPlan = () => (
    <>
        <header className="page-header plan-header">
          <div className="page-icon"><Sparkles /></div>
          <div><h1>方案</h1></div>
      </header>

      <section className="principle-card">
        <CloudSun />
        <div><h2>自然养护原则</h2><p>天然食物、阳光、绿色和活动优先。补剂只是补充，漏吃不补双份。</p></div>
      </section>

      <section className="plan-section">
        <SectionTitle title="当前补剂规则" />
        <div className="plan-list">
          {supplementRules.map((rule) => (
            <article key={rule.key}><div><h3>{rule.name}</h3><span>{rule.schedule}</span></div><ul>{rule.details.map((detail) => <li key={detail}>{detail}</li>)}</ul></article>
          ))}
        </div>
      </section>

      <section className="plan-section">
        <SectionTitle title="联动规则" />
        <div className="link-rule-grid">
          <div><Salad /><strong>动物肝脏 ↔ VB</strong><p>昨天吃动物肝脏 → 今天 VB 规则跳过。今天吃动物肝脏 → VB 跳过 / 错开。</p></div>
          <div><Droplets /><strong>海产品 ↔ 鱼油</strong><p>今天吃海产品 → 鱼油可以不吃。</p></div>
          <div><HeartPulse /><strong>腹泻 ↔ 肌醇</strong><p>昨天如有腹泻，今天肌醇可以先不吃；请根据自己的身体记录判断。</p></div>
        </div>
      </section>

      <section className="plan-section quiet-section">
        <SectionTitle title="可选补充" />
        <div className="optional-grid">
          {optionalRules.map((item) => <article className="optional-card plan-optional" key={item.key}><div><h3>{item.name}</h3><p>{item.schedule}</p>{item.notes.map((note) => <small className={item.key === 'appleCiderVinegar' ? 'must-note' : ''} key={note}>{note}</small>)}</div></article>)}
        </div>
      </section>
      <p className="plan-version">方案更新：2026年11月 · V0.2</p>
    </>
  );

  return (
    <main className="app-shell">
      {storageError && <div className="storage-error" role="alert">{storageError}</div>}
      <output className="save-status">{restoring ? '正在恢复…' : saving ? '正在保存…' : ready && !storageError ? '已保存到本机' : ''}</output>
      {!ready ? <p className="empty-state">正在读取记录…</p> : restoring ? <p className="empty-state">正在恢复记录，请稍候…</p> : <>
      {tab === 'today' && todayContent}
      {tab === 'records' && renderRecords()}
      {tab === 'plan' && renderPlan()}
      </>}

      {notice && <output className="toast-note">{notice}</output>}

      {!selectedDate && (
        <nav className="bottom-nav" aria-label="主导航">
          <button className={tab === 'today' ? 'active' : ''} onClick={() => switchTab('today')}><SunMedium />今天</button>
          <button className={tab === 'records' ? 'active' : ''} onClick={() => switchTab('records')}><NotebookText />记录</button>
          <button className={tab === 'plan' ? 'active' : ''} onClick={() => switchTab('plan')}><Leaf />方案</button>
        </nav>
      )}

      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>恢复记录？</AlertDialogTitle>
            <AlertDialogDescription>恢复后，同日期记录将以备份内容为准，其他日期会保留。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingRestore(undefined)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setRestoreOpen(false); void restoreBackup(); }}>恢复</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="detail-section"><h2>{title}</h2><div>{children}</div></section>;
}
