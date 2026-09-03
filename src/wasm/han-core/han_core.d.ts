/* tslint:disable */
/* eslint-disable */

export function wasm_find_backlinks(content: string, source_note_id: string, target_note_id: string): any;

export function wasm_inject_yaml_frontmatter(metadata_json: string, body: string): string;

export function wasm_parse_decisions_from_content(content: string, note_id: string): any;

export function wasm_parse_reasoning(raw: string): any;

export function wasm_parse_tasks_from_content(content: string, note_id: string): any;

export function wasm_parse_yaml_frontmatter(content: string): any;

export function wasm_process_pdf_page_layout(items_json: string, page_width: number, _page_height: number, body_font_size: number): string;

export function wasm_strip_reasoning(raw: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly wasm_find_backlinks: (a: number, b: number, c: number, d: number, e: number, f: number) => any;
    readonly wasm_inject_yaml_frontmatter: (a: number, b: number, c: number, d: number) => [number, number];
    readonly wasm_parse_decisions_from_content: (a: number, b: number, c: number, d: number) => any;
    readonly wasm_parse_reasoning: (a: number, b: number) => any;
    readonly wasm_parse_tasks_from_content: (a: number, b: number, c: number, d: number) => any;
    readonly wasm_parse_yaml_frontmatter: (a: number, b: number) => any;
    readonly wasm_process_pdf_page_layout: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly wasm_strip_reasoning: (a: number, b: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
