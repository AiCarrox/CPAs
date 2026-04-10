import { useEffect, useState } from 'react';
import type { AlertConfig, AlertChannel, AlertRule, AlertTarget, AlertTestResponse } from '../../shared/types';
import { refreshIntervalOptions, alertTargetOptions } from '../lib/constants';

export function AlertPanel(props: {
  config: AlertConfig;
  onSave: (patch: Partial<AlertConfig>) => Promise<void>;
  onTest: () => Promise<AlertTestResponse>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [enabled, setEnabled] = useState(props.config.enabled);
  const [channel, setChannel] = useState<AlertChannel>(props.config.channel);
  const [customUrl, setCustomUrl] = useState(props.config.custom_url);
  const [feishuToken, setFeishuToken] = useState(props.config.feishu_token);
  const [telegramBotToken, setTelegramBotToken] = useState(props.config.telegram_bot_token);
  const [telegramChatId, setTelegramChatId] = useState(props.config.telegram_chat_id);
  const [qmsgKey, setQmsgKey] = useState(props.config.qmsg_key);
  const [rules, setRules] = useState<AlertRule[]>(props.config.rules);
  const [interval, setInterval2] = useState(props.config.refresh_interval_seconds);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setEnabled(props.config.enabled);
    setChannel(props.config.channel);
    setCustomUrl(props.config.custom_url);
    setFeishuToken(props.config.feishu_token);
    setTelegramBotToken(props.config.telegram_bot_token);
    setTelegramChatId(props.config.telegram_chat_id);
    setQmsgKey(props.config.qmsg_key);
    setRules(props.config.rules);
    setInterval2(props.config.refresh_interval_seconds);
  }, [props.config]);

  const openModal = () => { setMessage(''); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const updateRule = (id: string, patch: Partial<AlertRule>) =>
    setRules((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const addRule = () =>
    setRules((cur) => [...cur, { id: crypto.randomUUID(), enabled: true, threshold: 50, target: 'quota_5h' as AlertTarget }]);

  const removeRule = (id: string) => setRules((cur) => cur.filter((r) => r.id !== id));

  const submit = async () => {
    setSaving(true);
    setMessage('');
    try {
      await props.onSave({
        enabled,
        channel,
        custom_url: customUrl,
        feishu_token: feishuToken,
        telegram_bot_token: telegramBotToken,
        telegram_chat_id: telegramChatId,
        qmsg_key: qmsgKey,
        rules: rules.filter((r) => Number.isFinite(r.threshold) && r.threshold > 0 && r.threshold <= 100),
        refresh_interval_seconds: interval,
      });
      closeModal();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setMessage('');
    try {
      const res = await props.onTest();
      setMessage(res.ok ? '测试消息已发送' : res.error || '发送失败');
    } finally {
      setTesting(false);
    }
  };

  return (
    <section style={{ border: '1px solid var(--line)', padding: '6px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>配额告警</strong>
        <button onClick={openModal} style={{ fontSize: 12 }}>编辑</button>
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
        <span>{props.config.enabled ? '已启用' : '未启用'}</span>
        <span>渠道 {props.config.channel}</span>
        <span>{props.config.rules.length} 条规则</span>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-panel">
            <div className="modal-header">
              <strong style={{ fontSize: 14 }}>配额告警配置</strong>
              <button className="ghost" onClick={closeModal} style={{ fontSize: 12 }}>关闭</button>
            </div>
            <div className="form-grid" style={{ marginTop: 10 }}>
              <label>
                启用告警
                <select value={enabled ? 'on' : 'off'} onChange={(e) => setEnabled(e.target.value === 'on')}>
                  <option value="on">启用</option>
                  <option value="off">关闭</option>
                </select>
              </label>
              <label>
                通知渠道
                <select value={channel} onChange={(e) => setChannel(e.target.value as AlertChannel)}>
                  <option value="custom">Custom Webhook</option>
                  <option value="feishu">飞书</option>
                  <option value="telegram">Telegram</option>
                  <option value="qmsg">Qmsg</option>
                </select>
              </label>
              <label>
                刷新间隔
                <select value={interval} onChange={(e) => setInterval2(Number(e.target.value))}>
                  {refreshIntervalOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>

              <div className="span-2">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: 13 }}>预警规则</strong>
                  <button className="ghost" onClick={addRule} type="button" style={{ fontSize: 12 }}>+ 添加</button>
                </div>
                {rules.map((rule) => (
                  <div key={rule.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px auto', gap: 6, marginBottom: 4, alignItems: 'end' }}>
                    <label>
                      状态
                      <select value={rule.enabled ? 'on' : 'off'} onChange={(e) => updateRule(rule.id, { enabled: e.target.value === 'on' })}>
                        <option value="on">启用</option>
                        <option value="off">关闭</option>
                      </select>
                    </label>
                    <label>
                      对象
                      <select value={rule.target} onChange={(e) => updateRule(rule.id, { target: e.target.value as AlertTarget })}>
                        {alertTargetOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      阈值%
                      <input type="number" min="1" max="100" value={rule.threshold} onChange={(e) => updateRule(rule.id, { threshold: Number(e.target.value) })} />
                    </label>
                    <button className="ghost ghost--danger" onClick={() => removeRule(rule.id)} type="button" disabled={rules.length <= 1} style={{ alignSelf: 'end' }}>
                      删除
                    </button>
                  </div>
                ))}
              </div>

              {channel === 'custom' && (
                <label className="span-2">Webhook URL<input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://..." /></label>
              )}
              {channel === 'feishu' && (
                <label className="span-2">飞书 Token<input value={feishuToken} onChange={(e) => setFeishuToken(e.target.value)} /></label>
              )}
              {channel === 'telegram' && (
                <>
                  <label>Bot Token<input value={telegramBotToken} onChange={(e) => setTelegramBotToken(e.target.value)} /></label>
                  <label>Chat ID<input value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} /></label>
                </>
              )}
              {channel === 'qmsg' && (
                <label className="span-2">Qmsg Key<input value={qmsgKey} onChange={(e) => setQmsgKey(e.target.value)} /></label>
              )}

              <div className="span-2" style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => void submit()} disabled={saving}>{saving ? '保存中...' : '保存配置'}</button>
                <button className="ghost" onClick={() => void test()} disabled={testing}>{testing ? '发送中...' : '测试'}</button>
              </div>
            </div>
            {message && <div style={{ fontSize: 13, marginTop: 6, padding: '4px 8px', background: 'var(--line)' }}>{message}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
