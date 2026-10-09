import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { JSONRPCMessage } from '@modelcontextprotocol/server';
import { ReportTasks } from '../src/report-tasks.js';

describe('durable report task producer', () => {
  const roots: string[] = [], owners: ReportTasks[] = [];
  afterEach(() => { for (const owner of owners) owner.close(); for (const root of roots) rmSync(root, { recursive: true, force: true }); owners.length = 0; roots.length = 0; });
  const metadata = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': { extensions: { 'io.modelcontextprotocol/tasks': {} } } };
  function fixture(root = mkdtempSync(join(tmpdir(), 'report-task-')), onSend?: (message: any) => void) {
    if (!roots.includes(root)) roots.push(root);
    const messages: any[] = [];
    const owner = new ReportTasks(async message => { messages.push(message); onSend?.(message); }, root); owners.push(owner);
    const request = (id: number, method: string, params: Record<string, unknown>) => owner.route({ jsonrpc: '2.0', id, method, params: { ...params, _meta: metadata } } as JSONRPCMessage);
    return { root, owner, messages, request };
  }
  it('commits creation and terminal result, replays after restart and seeds a late subscription without re-rendering', async () => {
    const f = fixture(), ir = readFileSync(join(import.meta.dirname, 'fixtures/valid-mixed.report.md'), 'utf8');
    f.request(1, 'tools/call', { name: 'render_report', arguments: { ir_content: ir } });
    await vi.waitFor(() => expect(f.messages[0]?.result.resultType).toBe('task'));
    const taskId = f.messages[0].result.taskId;
    await vi.waitFor(() => { f.request(2, 'tasks/get', { taskId }); expect(f.messages.at(-1)?.result?.status).toBe('completed'); });
    const lastUpdatedAt = f.messages.at(-1).result.lastUpdatedAt;
    f.owner.close();
    const reopened = fixture(f.root);
    reopened.request(3, 'subscriptions/listen', { notifications: { taskIds: [taskId] } });
    await vi.waitFor(() => expect(reopened.messages.some(message => message.method === 'notifications/tasks')).toBe(true));
    expect(reopened.messages.find(message => message.method === 'notifications/tasks').params).toMatchObject({ status: 'completed', lastUpdatedAt });
    expect(reopened.messages[0].method).toBe('notifications/subscriptions/acknowledged');
  });
  it('does not intercept a legacy synchronous call or expose a handle without negotiated task capability', () => {
    const f = fixture();
    expect(f.owner.route({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'render_report', arguments: { ir_content: '' } } })).toBe(false);
    expect(f.messages).toEqual([]);
  });
  it('preserves validation failure as a completed execution with an error business result', async () => {
    const f = fixture();
    f.request(1, 'tools/call', { name: 'render_report', arguments: { ir_content: '---\ntitle: Failure\n---\n\n:::kpi\nitems:\n  - label: 状态\n    value: 完成\n:::\n' } });
    await vi.waitFor(() => expect(f.messages[0]?.result.taskId).toBeTruthy());
    const taskId = f.messages[0].result.taskId;
    await vi.waitFor(() => { f.request(2, 'tasks/get', { taskId }); expect(f.messages.at(-1)?.result?.status).toBe('completed'); });
    expect(f.messages.at(-1).result.result.isError).toBe(true);
  });
  it('fails closed after a real terminal SQLite write failure and never replays the report on restart', async () => {
    const root = mkdtempSync(join(tmpdir(), 'report-task-'));
    const f = fixture(root, message => {
      if (message.result?.resultType !== 'task') return;
      const fault = new DatabaseSync(join(root, 'tasks.sqlite'));
      fault.exec("CREATE TRIGGER reject_terminal BEFORE UPDATE ON tasks BEGIN SELECT RAISE(ABORT, 'injected durable write failure'); END");
      fault.close();
    });
    const output = join(root, 'result.html');
    f.request(1, 'tools/call', { name: 'render_report', arguments: {
      ir_content: readFileSync(join(import.meta.dirname, 'fixtures/valid-mixed.report.md'), 'utf8'), output_path: output,
    } });
    await vi.waitFor(() => expect(f.messages[0]?.result.taskId).toBeTruthy());
    const taskId = f.messages[0].result.taskId;
    await vi.waitFor(() => { f.request(2, 'tasks/get', { taskId }); expect(f.messages.at(-1)?.error?.message).toBe('report_task_source_unavailable'); });
    const bytes = readFileSync(output), modified = statSync(output).mtimeMs;
    expect(f.messages.some(message => message.result?.status === 'completed')).toBe(false);
    f.owner.close();
    const repair = new DatabaseSync(join(root, 'tasks.sqlite'));
    repair.exec('DROP TRIGGER reject_terminal'); repair.close();
    const reopened = fixture(root);
    reopened.request(3, 'tasks/get', { taskId });
    await vi.waitFor(() => expect(reopened.messages[0]?.result?.status).toBe('failed'));
    expect(reopened.messages[0].result.error.message).toContain('not replayed');
    expect(readFileSync(output)).toEqual(bytes);
    expect(statSync(output).mtimeMs).toBe(modified);
  });
});
