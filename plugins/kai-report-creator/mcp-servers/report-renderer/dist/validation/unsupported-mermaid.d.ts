export interface UnsupportedMermaid {
    line: number;
    message: string;
}
/** Reject diagrams the renderer would otherwise silently collapse into prose. */
export declare function findUnsupportedMermaid(source: string): UnsupportedMermaid[];
