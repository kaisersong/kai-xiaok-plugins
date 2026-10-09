import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { CreateTaskResultV2Schema, DetailedTaskV2Schema, GetTaskRequestV2Schema, CancelTaskRequestV2Schema, TaskStatusNotificationV2Schema, TaskSubscriptionNotificationsV2Schema, hasTaskClientCapabilityV2 } from '@modelcontextprotocol/ext-tasks/core/v2';
import { handleRenderReport } from './tools/render-report.js';
export const renderInput = z.object({ ir_content: z.string().max(4 * 1024 * 1024), output_path: z.string().optional(),
    theme_override: z.string().optional(), bundle: z.boolean().optional() }).strict();
/** Single stdio endpoint owner; committed task state precedes notifications.
 * Restart preserves results and marks unfinished execution unknown/failed,
 * never re-runs the original report write. */
export class ReportTasks {
    send;
    root;
    db;
    owner;
    closed = false;
    commitError = false;
    subscriptions = new Map();
    timers = new Set();
    constructor(send, root = process.env.XIAOK_REPORT_TASKS_ROOT
        ?? join(homedir(), '.xiaok', 'report-renderer-tasks', createHash('sha256').update(process.cwd()).digest('hex').slice(0, 24))) {
        this.send = send;
        this.root = root;
    }
    database() {
        if (this.db)
            return this.db;
        if (this.closed)
            throw new Error('report_task_owner_closed');
        mkdirSync(this.root, { recursive: true });
        const owner = new DatabaseSync(join(this.root, 'owner.sqlite'));
        try {
            owner.exec('PRAGMA busy_timeout=0; PRAGMA journal_mode=DELETE; BEGIN EXCLUSIVE');
        }
        catch (error) {
            owner.close();
            throw error;
        }
        const db = new DatabaseSync(join(this.root, 'tasks.sqlite'));
        try {
            const version = db.prepare('PRAGMA user_version').get().user_version;
            if (version > 1)
                throw new Error('unsupported_report_tasks_schema');
            db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA max_page_count=16384; CREATE TABLE IF NOT EXISTS tasks(task_id TEXT PRIMARY KEY,data_json TEXT NOT NULL,expires_at INTEGER NOT NULL); PRAGMA user_version=1');
            const rows = db.prepare('SELECT data_json FROM tasks').all();
            for (const row of rows) {
                const task = DetailedTaskV2Schema.parse(JSON.parse(row.data_json));
                if (task.status === 'working' || task.status === 'input_required') {
                    const recovered = DetailedTaskV2Schema.parse({ ...task, status: 'failed', lastUpdatedAt: new Date().toISOString(), error: { code: -32001, message: 'Execution outcome unknown after endpoint restart; report was not replayed.' } });
                    db.prepare('UPDATE tasks SET data_json=? WHERE task_id=?').run(JSON.stringify(recovered), task.taskId);
                }
            }
            this.owner = owner;
            this.db = db;
            return db;
        }
        catch (error) {
            db.close();
            owner.close();
            throw error;
        }
    }
    save(task) {
        const json = JSON.stringify(DetailedTaskV2Schema.parse(task));
        if (Buffer.byteLength(json) > 128 * 1024)
            throw new Error('report_task_result_capacity');
        this.database().prepare('INSERT INTO tasks VALUES(?,?,?) ON CONFLICT(task_id) DO UPDATE SET data_json=excluded.data_json')
            .run(task.taskId, json, Date.parse(task.createdAt) + (task.ttlMs ?? 86400_000));
    }
    get(id) {
        if (this.commitError)
            throw new Error('report_task_source_unavailable');
        const row = this.database().prepare('SELECT data_json FROM tasks WHERE task_id=? AND expires_at>?').get(id, Date.now());
        if (!row)
            throw new Error('report_task_missing_or_expired');
        return DetailedTaskV2Schema.parse(JSON.parse(row.data_json));
    }
    async changed(task) {
        for (const [subscriptionId, ids] of this.subscriptions)
            if (ids.includes(task.taskId)) {
                const notification = TaskStatusNotificationV2Schema.parse({ jsonrpc: '2.0', method: 'notifications/tasks', params: { ...task,
                        _meta: { 'io.modelcontextprotocol/subscriptionId': subscriptionId } } });
                await this.send(notification).catch(() => { });
            }
    }
    /** False delegates unchanged to the SDK's normal synchronous handlers. */
    route(message) {
        if (!('method' in message))
            return false;
        if (message.method === 'notifications/cancelled') {
            const id = message.params?.requestId;
            if (typeof id === 'string' || typeof id === 'number')
                this.subscriptions.delete(id);
            return false;
        }
        if (!('id' in message))
            return false;
        const params = message.params;
        const reportCall = message.method === 'tools/call' && params?.name === 'render_report' && hasTaskClientCapabilityV2(params);
        const listen = message.method === 'subscriptions/listen' && params?.notifications && typeof params.notifications === 'object' && 'taskIds' in params.notifications;
        if (!reportCall && !listen && !message.method.startsWith('tasks/'))
            return false;
        void this.handle(message, Boolean(reportCall), Boolean(listen)).catch(async (error) => {
            await this.send({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: error instanceof Error ? error.message : 'report_task_failed' } }).catch(() => { });
        });
        return true;
    }
    async handle(message, reportCall, listen) {
        const respond = (result) => this.send({ jsonrpc: '2.0', id: message.id, result });
        if (listen) {
            const filter = TaskSubscriptionNotificationsV2Schema.parse(message.params?.notifications);
            const ids = filter.taskIds ?? [];
            if (!ids.length || ids.length > 256 || this.subscriptions.size >= 256)
                throw new Error('report_task_subscription_capacity');
            for (const id of ids)
                this.get(id);
            this.subscriptions.set(message.id, [...new Set(ids)]);
            await this.send({ jsonrpc: '2.0', method: 'notifications/subscriptions/acknowledged', params: { notifications: { taskIds: ids }, _meta: { 'io.modelcontextprotocol/subscriptionId': message.id } } });
            for (const id of ids)
                await this.changed(this.get(id));
            return;
        }
        if (!hasTaskClientCapabilityV2(message.params))
            throw new Error('report_tasks_capability_required');
        if (reportCall) {
            if (this.commitError)
                throw new Error('report_task_source_unavailable');
            const input = renderInput.parse(message.params?.arguments);
            const db = this.database();
            db.prepare('DELETE FROM tasks WHERE expires_at<=?').run(Date.now());
            if (db.prepare('SELECT COUNT(*) count FROM tasks').get().count >= 256)
                throw new Error('report_task_capacity');
            const now = new Date().toISOString();
            const task = DetailedTaskV2Schema.parse({ taskId: randomUUID(), status: 'working', createdAt: now, lastUpdatedAt: now, ttlMs: 86400_000, pollIntervalMs: 1000 });
            this.save(task);
            await respond(CreateTaskResultV2Schema.parse({ ...task, resultType: 'task' }));
            const timer = setImmediate(() => {
                this.timers.delete(timer);
                if (this.closed || this.get(task.taskId).status !== 'working')
                    return;
                // The render call is synchronous. We cannot claim it physically stopped
                // while it is executing; queued cancellation is confirmed before entry.
                let final;
                try {
                    const report = handleRenderReport(input);
                    final = DetailedTaskV2Schema.parse({ ...task, status: 'completed', lastUpdatedAt: new Date().toISOString(),
                        result: { resultType: 'complete', content: [{ type: 'text', text: JSON.stringify(report) }], isError: !report.success } });
                }
                catch (error) {
                    final = DetailedTaskV2Schema.parse({ ...task, status: 'failed', lastUpdatedAt: new Date().toISOString(), error: { code: -32000, message: error instanceof Error ? error.message : 'render_failed' } });
                }
                try {
                    this.save(final);
                    void this.changed(final);
                }
                catch (error) {
                    if (error instanceof Error && error.message === 'report_task_result_capacity') {
                        const failed = DetailedTaskV2Schema.parse({ ...task, status: 'failed', lastUpdatedAt: new Date().toISOString(), error: { code: -32001, message: 'Result exceeded the durable limit. Output may exist; the report was not replayed.' } });
                        try {
                            this.save(failed);
                            void this.changed(failed);
                        }
                        catch {
                            this.commitError = true;
                        }
                    }
                    else
                        this.commitError = true; // No uncommitted terminal or fresh working claim.
                }
            });
            this.timers.add(timer);
            return;
        }
        if (message.method === 'tasks/get') {
            const request = GetTaskRequestV2Schema.parse(message);
            await respond({ ...this.get(request.params.taskId), resultType: 'complete' });
            return;
        }
        if (message.method === 'tasks/cancel') {
            const request = CancelTaskRequestV2Schema.parse(message), task = this.get(request.params.taskId);
            if (task.status === 'working') {
                const cancelled = DetailedTaskV2Schema.parse({ ...task, status: 'cancelled', lastUpdatedAt: new Date().toISOString() });
                this.save(cancelled);
                await this.changed(cancelled);
            }
            await respond({ resultType: 'complete' });
            return;
        }
        throw new Error('report_task_method_unsupported');
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        for (const timer of this.timers)
            clearImmediate(timer);
        this.timers.clear();
        this.subscriptions.clear();
        this.db?.close();
        this.owner?.close();
    }
}
export function withReportTasks(inner) {
    const tasks = new ReportTasks(inner.send.bind(inner));
    const transport = { start: () => inner.start(), send: (message, options) => inner.send(message, options), close: async () => { tasks.close(); await inner.close(); } };
    inner.onmessage = (message, extra) => { if (!tasks.route(message))
        transport.onmessage?.(message, extra); };
    inner.onclose = () => { tasks.close(); transport.onclose?.(); };
    inner.onerror = error => transport.onerror?.(error);
    return transport;
}
//# sourceMappingURL=report-tasks.js.map