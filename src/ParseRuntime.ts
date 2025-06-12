import type CSVError from "./CSVError.ts";
import type {
    Converter,
    PreFileLineCallback,
    PreRawDataCallback,
} from "./Converter.ts";
import type {  CellParser } from "./Parameters.ts";

export interface ParseRuntime {
    /**
     * If it needs to convert ignoreColumn from column name(string) to column index (number).
     * Parser needs a column index.
     */
    needProcessIgnoreColumn: boolean;
    /**
     * If it needs to convert includeColumn from column name(string) to column index (number).
     * Parser needs a column index.
     */
    needProcessIncludeColumn: boolean;
    /**
     * the indexes of columns to reserve, undefined means reserve all, [] means hide all
     */
    selectedColumns?: number[];
    ended: boolean;
    hasError: boolean;
    error?: Error;
    /**
     * Inferred delimiter
     */
    delimiter?: string;
    possibleDelimiters: string [];
    /**
     * Inferred eol
     */
    eol?: string;
    /**
     * Converter function for a column. Populated at runtime.
     */
    columnConv: (CellParser | null)[];
    headerType: unknown[];
    headerTitle: string[];
    headerFlag: unknown[];
    /**
     * Inferred headers
     */
    headers?: string[];
    csvLineBuffer?: Buffer;

    /**
     * after the first chunk of data being processed and emitted, started will become true.
     */
    started: boolean;
    preRawDataHook?: PreRawDataCallback;
    preFileLineHook?: PreFileLineCallback;
    parsedLineNumber: number;
    columnValueSetter: unknown[];
    subscribe?: {
        onNext?: (data: unknown, lineNumber: number) => void | PromiseLike<void>;
        onError?: (err: CSVError) => void;
        onCompleted?: () => void;
    };
    then?: {
        onfulfilled: (value: unknown[]) => unknown;
        onrejected: (err: Error) => unknown;
    };
}

export type ValueSetter = (value: string) => void;

export const defaultDelimiters = [",", "|", "\t", ";", ":"];

export function initParseRuntime(converter: Converter): ParseRuntime {
    const {delimiter, eol, ignoreColumns, includeColumns} = converter.parseParam;
    const possibleDelimiters: string[] = typeof delimiter === "string" ? (delimiter === "auto" ? defaultDelimiters : [delimiter]) : delimiter as string[];

    return {
        needProcessIgnoreColumn: !!ignoreColumns,
        needProcessIncludeColumn: !!includeColumns,
        selectedColumns: undefined,
        ended: false,
        hasError: false,
        error: undefined,
        delimiter: (possibleDelimiters.length === 1) ? possibleDelimiters[0] : undefined,
        possibleDelimiters,
        eol,
        columnConv: [],
        headerType: [],
        headerTitle: [],
        headerFlag: [],
        headers: undefined,
        started: false,
        parsedLineNumber: 0,
        columnValueSetter: [],
    };
}
