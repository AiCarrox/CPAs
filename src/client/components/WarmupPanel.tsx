import { useEffect, useState } from 'react';
import type { WarmupConfig, WarmupEntry, WarmupApiConfig, WarmupSchedule, WarmupTestResponse } from '../../shared/types';
import { fmtDateTime } from '../lib/format';

const SPREAD_OPTIONS = [0, 5, 10, 15, 30, 60];

/* ──── Entry Editor (inline in Modal) ──── */

function EntryEditor(props: {
  entry: WarmupEntry;
  onUpdateApi: (patch: Partial<WarmupApiConfig>) => void;
  onUpdateSchedule: (patch: Partial<WarmupSchedule>) => void;
  onUpdateEntry: (patch: Partial<WarmupEntry>) => void;
  onRemove: () => void;
  onTest: () => void;
  testing: boolean;
  testResult: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { entry } = props;

  return (
    <div style={{ border: '1px solid var(--line)', padding: '6px 8px', marginTop: 6 }}>
      {/* Summary row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}
          onClick={() => setExpanded(v => !v)}
        >
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{expanded ? '▼' : '▶'}</span>
          <strong>{entry.api.remark || '(未命名)'}</strong>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {String(entry.schedule.hour).padStart(2, '0')}:{String(entry.schedule.minute).padStart(2, '0')}
            {entry.schedule.random_spread_minutes > 0 && ` ±${entry.schedule.random_spread_minutes}分`}
          </span>
          <span style={{ fontSize: 12, color: entry.enabled ? 'var(--success)' : 'var(--muted)' }}>
            {entry.enabled ? '启用' : '关闭'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="ghost" onClick={props.onTest} disabled={props.testing} style={{ fontSize: 12 }}>
            {props.testing ? '测试中...' : '测试'}
          </button>
          <button className="ghost ghost--danger" onClick={props.onRemove} style={{ fontSize: 12 }}>删除</button>
        </div>
      </div>

      {/* Test result */}
      {props.testResult && (
        <div style={{ fontSize: 12, marginTop: 4, padding: '2px 6px', background: 'var(--line)', color: props.testResult.startsWith('✓') ? 'var(--success)' : 'var(--warning)' }}>
          {props.testResult}
        </div>
      )}

      {/* Expanded editor */}
      {expanded && (
        <div className="form-grid" style={{ marginTop: 8 }}>
          <label>
            备注
            <input value={entry.api.remark} onChange={e => props.onUpdateApi({ remark: e.target.value })} placeholder="如：Claude 主站" />
          </label>
          <label>
            启用
            <select value={entry.enabled ? 'on' : 'off'} onChange={e => props.onUpdateEntry({ enabled: e.target.value === 'on' })}>
              <option value="on">启用</option>
              <option value="off">关闭</option>
            </select>
          </label>
          <label className="span-2">
            API URL
            <input value={entry.api.apiurl} onChange={e => props.onUpdateApi({ apiurl: e.target.value })} placeholder="https://api.example.com/v1" />
          </label>
          <label className="span-2">
            API Key
            <input type="password" value={entry.api.apikey} onChange={e => props.onUpdateApi({ apikey: e.target.value })} placeholder={entry.api.apikey.includes('***') ? '留空保留原 key' : ''} />
          </label>
          <label>
            Model
            <input value={entry.api.model} onChange={e => props.onUpdateApi({ model: e.target.value })} placeholder="claude-sonnet-4-20250514" />
          </label>
          <label>
            预热次数
            <input type="number" min={1} max={10} value={entry.count} onChange={e => props.onUpdateEntry({ count: Math.max(1, Number(e.target.value)) })} />
          </label>
          <label>
            小时（北京时间）
            <select value={entry.schedule.hour} onChange={e => props.onUpdateSchedule({ hour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
              ))}
            </select>
          </label>
          <label>
            分钟
            <select value={entry.schedule.minute} onChange={e => props.onUpdateSchedule({ minute: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
          </label>
          <label className="span-2">
            随机跨度
            <select value={entry.schedule.random_spread_minutes} onChange={e => props.onUpdateSchedule({ random_spread_minutes: Number(e.target.value) })}>
              {SPREAD_OPTIONS.map(v => (
                <option key={v} value={v}>{v === 0 ? '无随机' : `±${v} 分钟`}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

/* ──── Main WarmupPanel ──── */

export function WarmupPanel(props: {
  config: WarmupConfig;
  onSave: (entries: WarmupEntry[]) => Promise<void>;
  onTest: (entry: WarmupEntry) => Promise<WarmupTestResponse>;
}) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [entries, setEntries] = useState<WarmupEntry[]>(props.config.entries);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  useEffect(() => {
    setEntries(props.config.entries);
  }, [props.config]);

  const addEntry = () => {
    setEntries(cur => [...cur, {
      api: { id: crypto.randomUUID(), remark: '', apikey: '', apiurl: '', model: '', enabled: true },
      schedule: { hour: 8, minute: 0, random_spread_minutes: 0 },
      count: 1,
      enabled: true,
    }]);
  };

  const updateApi = (id: string, patch: Partial<WarmupApiConfig>) => {
    setEntries(cur => cur.map(e => e.api.id === id ? { ...e, api: { ...e.api, ...patch } } : e));
  };

  const updateSchedule = (id: string, patch: Partial<WarmupSchedule>) => {
    setEntries(cur => cur.map(e => e.api.id === id ? { ...e, schedule: { ...e.schedule, ...patch } } : e));
  };

  const updateEntry = (id: string, patch: Partial<WarmupEntry>) => {
    setEntries(cur => cur.map(e => e.api.id === id ? { ...e, ...patch, api: e.api } : e));
  };

  const removeEntry = (id: string) => {
    setEntries(cur => cur.filter(e => e.api.id !== id));
  };

  const submit = async () => {
    setSaving(true);
    setMessage('');
    try {
      await props.onSave(entries);
      setMessage('✓ 已保存');
      setTimeout(() => setMessage(''), 2000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const testEntry = async (entry: WarmupEntry) => {
    setTestingId(entry.api.id);
    setTestResults(cur => ({ ...cur, [entry.api.id]: '' }));
    try {
      const res = await props.onTest(entry);
      setTestResults(cur => ({
        ...cur,
        [entry.api.id]: res.ok ? '✓ 测试成功' : `✗ ${res.error || '测试失败'}`,
      }));
    } catch (e) {
      setTestResults(cur => ({
        ...cur,
        [entry.api.id]: `✗ ${e instanceof Error ? e.message : '测试失败'}`,
      }));
    } finally {
      setTestingId(null);
    }
  };

  const enabledCount = props.config.entries.filter(e => e.enabled).length;

  return (
    <section style={{ border: '1px solid var(--line)', padding: '6px 8px', marginTop: 16 }}>
      {/* Collapsible header */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{open ? '▼' : '▶'}</span>
          <strong>API 预热</strong>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {props.config.entries.length} 条配置 / {enabledCount} 启用
          </span>
        </div>
        <button onClick={e => { e.stopPropagation(); setModalOpen(true); setMessage(''); setTestResults({}); }} style={{ fontSize: 12 }}>编辑</button>
      </div>

      {/* Expanded summary */}
      {open && (
        <div style={{ marginTop: 8 }}>
          {props.config.entries.map(entry => {
            const state = props.config.states?.[entry.api.id];
            return (
              <div key={entry.api.id} style={{ fontSize: 13, padding: '3px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: entry.enabled ? 'var(--success)' : 'var(--muted)' }}>{entry.enabled ? '●' : '○'}</span>
                <strong>{entry.api.remark || '(未命名)'}</strong>
                <span style={{ color: 'var(--muted)' }}>
                  {String(entry.schedule.hour).padStart(2, '0')}:{String(entry.schedule.minute).padStart(2, '0')} 北京时间
                  {entry.schedule.random_spread_minutes > 0 && ` (±${entry.schedule.random_spread_minutes}分)`}
                </span>
                <span style={{ color: 'var(--muted)' }}>×{entry.count}</span>
                {state?.last_run_at && (
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                    上次: {fmtDateTime(state.last_run_at)}
                    {state.last_status === 'success' ? ' ✓' : state.last_error ? ` ✗ ${state.last_error.slice(0, 30)}` : ''}
                  </span>
                )}
              </div>
            );
          })}
          {props.config.entries.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>尚未配置任何 API 预热</div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="modal-panel" style={{ width: '60%', minWidth: 400 }}>
            <div className="modal-header">
              <strong style={{ fontSize: 14 }}>API 预热配置</strong>
              <button className="ghost" onClick={() => setModalOpen(false)} style={{ fontSize: 12 }}>关闭</button>
            </div>

            <div style={{ marginTop: 10 }}>
              {entries.map(entry => (
                <EntryEditor
                  key={entry.api.id}
                  entry={entry}
                  onUpdateApi={patch => updateApi(entry.api.id, patch)}
                  onUpdateSchedule={patch => updateSchedule(entry.api.id, patch)}
                  onUpdateEntry={patch => updateEntry(entry.api.id, patch)}
                  onRemove={() => removeEntry(entry.api.id)}
                  onTest={() => testEntry(entry)}
                  testing={testingId === entry.api.id}
                  testResult={testResults[entry.api.id] ?? ''}
                />
              ))}

              <button className="ghost" onClick={addEntry} style={{ fontSize: 12, marginTop: 8 }}>+ 添加 API</button>

              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, padding: '4px 8px', background: 'rgba(30,24,17,0.06)', borderRadius: 4 }}>
                提示：配置多次预热时，应将 CPA 路由策略设为"轮询"，以保证各账号均触发预热。
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => void submit()} disabled={saving}>{saving ? '保存中...' : '保存配置'}</button>
              </div>
            </div>

            {message && <div style={{ fontSize: 13, marginTop: 6, padding: '4px 8px', background: 'var(--line)' }}>{message}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
