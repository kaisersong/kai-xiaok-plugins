import type { JSONRPCMessage, Transport } from '@modelcontextprotocol/server';
import { z } from 'zod';
export declare const renderInput: z.ZodObject<{
    ir_content: z.ZodString;
    output_path: z.ZodOptional<z.ZodString>;
    theme_override: z.ZodOptional<z.ZodString>;
    bundle: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
/** Single stdio endpoint owner; committed task state precedes notifications.
 * Restart preserves results and marks unfinished execution unknown/failed,
 * never re-runs the original report write. */
export declare class ReportTasks {
    private readonly send;
    private readonly root;
    private db?;
    private owner?;
    private closed;
    private commitError;
    private readonly subscriptions;
    private readonly timers;
    constructor(send: Transport['send'], root?: string);
    private database;
    private save;
    private get;
    private changed;
    /** False delegates unchanged to the SDK's normal synchronous handlers. */
    route(message: JSONRPCMessage): boolean;
    private handle;
    close(): void;
}
export declare function withReportTasks(inner: Transport): Transport;
