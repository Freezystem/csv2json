import CSVError from "./CSVError.ts";
import type { ParseRuntime } from "./ParseRuntime.ts";
import { type ProcessLineResult, Processor } from "./Processor.ts";
import { prepareData } from "./dataClean.ts";
import { stringToLines } from "./fileline.ts";
import getEol from "./getEol.ts";
import lineToJson from "./lineToJson.ts";
import { RowSplit } from "./rowSplit.ts";
import { bufFromString, filterArray } from "./util.ts";

export class ProcessorLocal extends Processor {
    #rowSplit: RowSplit = new RowSplit(this.converter);
    private eolEmitted = false;
    private _needEmitEol?: boolean = undefined;
    private get needEmitEol() {
        if (this._needEmitEol === undefined) {
            this._needEmitEol = this.converter.listeners("eol").length > 0;
        }
        return this._needEmitEol;
    }
    private headEmitted = false;
    private _needEmitHead?: boolean = undefined;
    private get needEmitHead() {
        if (this._needEmitHead === undefined) {
            this._needEmitHead = this.converter.listeners("header").length > 0;
        }
        return this._needEmitHead;
    }

    flush(): Promise<ProcessLineResult[]> {
        if (
            this.runtime.csvLineBuffer &&
            this.runtime.csvLineBuffer.length > 0
        ) {
            const buf = this.runtime.csvLineBuffer;
            this.runtime.csvLineBuffer = undefined;
            return this.process(buf, true).then((res) => {
                if (
                    this.runtime.csvLineBuffer &&
                    this.runtime.csvLineBuffer.length > 0
                ) {
                    return Promise.reject(
                        CSVError.unclosed_quote(
                            this.runtime.parsedLineNumber,
                            this.runtime.csvLineBuffer.toString(),
                        ),
                    );
                }

                return Promise.resolve(res);
            });
        }

        return Promise.resolve([]);
    }

    destroy(): Promise<void> {
        return Promise.resolve();
    }

    process(chunk: Buffer, finalChunk = false): Promise<ProcessLineResult[]> {
        let csvString: string;
        if (finalChunk) {
            csvString = chunk.toString();
        } else {
            csvString = prepareData(chunk, this.converter.parseRuntime);
        }
        return Promise.resolve()
            .then(() => {
                if (this.runtime.preRawDataHook) {
                    return this.runtime.preRawDataHook(csvString);
                }

                return csvString;
            })
            .then((csv) => {
                if (csv && csv.length > 0) {
                    return this.processCSV(csv, finalChunk);
                }

                return Promise.resolve([]);
            });
    }

    private processCSV(
        csv: string,
        finalChunk: boolean,
    ): Promise<ProcessLineResult[]> {
        const params = this.params;
        const runtime = this.runtime;

        if (!runtime.eol) {
            runtime.eol = getEol(csv);
        }

        if (this.needEmitEol && !this.eolEmitted && runtime.eol) {
            this.converter.emit("eol", runtime.eol);
            this.eolEmitted = true;
        }

        // trim csv file has initial blank lines.
        const _csv = (params.ignoreEmpty && !runtime.started) ? csv.trimStart() : csv;
        const stringToLineResult = stringToLines(_csv);

        if (!finalChunk) {
            this.prependLeftBuf(bufFromString(stringToLineResult.partial));
        } else {
            stringToLineResult.lines.push(stringToLineResult.partial);
            stringToLineResult.partial = "";
        }

        if (stringToLineResult.lines.length > 0) {
            let prom: Promise<string[]>;
            if (runtime.preFileLineHook) {
                prom = this.runPreLineHook(stringToLineResult.lines);
            } else {
                prom = Promise.resolve(stringToLineResult.lines);
            }
            return prom.then((lines) => {
                if (!runtime.started && !this.runtime.headers) {
                    return this.processDataWithHead(lines);
                }

                return this.processCSVBody(lines);
            });
        }

        return Promise.resolve([]);
    }

    private processDataWithHead(lines: string[]): ProcessLineResult[] {
        if (this.params.noheader) {
            if (this.params.headers) {
                this.runtime.headers = this.params.headers;
            } else {
                this.runtime.headers = [];
            }
        } else {
            let left = "";
            let headerRow: string[] = [];
            while (lines.length) {
                const line = left + lines.shift();
                const row = this.#rowSplit.parse(line);
                if (row.closed) {
                    headerRow = row.cells;
                    left = "";
                    break;
                }

                left = `${line}${this.runtime || getEol(line)}`;
            }
            this.prependLeftBuf(bufFromString(left));

            if (headerRow.length === 0) {
                return [];
            }
            if (this.params.headers) {
                this.runtime.headers = this.params.headers;
            } else {
                this.runtime.headers = headerRow;
            }
        }
        if (
            this.runtime.needProcessIgnoreColumn ||
            this.runtime.needProcessIncludeColumn
        ) {
            this.filterHeader();
        }
        if (this.needEmitHead && !this.headEmitted) {
            this.converter.emit("header", this.runtime.headers);
            this.headEmitted = true;
        }
        return this.processCSVBody(lines);
    }

    private filterHeader() {
        this.runtime.selectedColumns = [];
        if (this.runtime.headers) {
            const headers = this.runtime.headers;
            for (let i = 0; i < headers.length; i++) {
                if (this.params.ignoreColumns) {
                    if (this.params.ignoreColumns.test(headers[i])) {
                        if (
                            this.params.includeColumns?.test(headers[i])
                        ) {
                            this.runtime.selectedColumns.push(i);
                        } else {
                            // biome-ignore lint/correctness/noUnnecessaryContinue: to check later
                            continue;
                        }
                    } else {
                        this.runtime.selectedColumns.push(i);
                    }
                } else if (this.params.includeColumns) {
                    if (this.params.includeColumns.test(headers[i])) {
                        this.runtime.selectedColumns.push(i);
                    }
                } else {
                    this.runtime.selectedColumns.push(i);
                }
            }
            this.runtime.headers = filterArray(
                this.runtime.headers,
                this.runtime.selectedColumns,
            );
        }
    }

    private processCSVBody(lines: string[]): ProcessLineResult[] {
        if (this.params.output === "line") {
            return lines;
        }

        const result = this.#rowSplit.parseMultiLines(lines);
        this.prependLeftBuf(bufFromString(result.partial));

        if (this.params.output === "csv") {
            return result.rowsCells;
        }

        return lineToJson(result.rowsCells, this.converter);
    }

    private prependLeftBuf(buf: Buffer) {
        if (buf) {
            if (this.runtime.csvLineBuffer) {
                this.runtime.csvLineBuffer = Buffer.concat([
                    buf,
                    this.runtime.csvLineBuffer,
                ]);
            } else {
                this.runtime.csvLineBuffer = buf;
            }
        }
    }

    private runPreLineHook(lines: string[]): Promise<string[]> {
        return new Promise((resolve, reject) => {
            processLineHook(lines, this.runtime, 0, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(lines);
                }
            });
        });
    }
}

function processLineHook(
    lines: string[],
    runtime: ParseRuntime,
    offset: number,
    cb: (err?: Error) => void,
) {
    if (offset >= lines.length) {
        cb();
    } else {
        if (runtime.preFileLineHook) {

            let o = offset
            const line = lines[offset];
            const res = runtime.preFileLineHook(
                line,
                runtime.parsedLineNumber + offset,
            );
            o++;

            if (res && (res as PromiseLike<string>).then) {
                (res as PromiseLike<string>).then((value) => {
                    lines[offset - 1] = value;
                    processLineHook(lines, runtime, offset, cb);
                });
            } else {
                lines[offset - 1] = res as string;
                while (offset < lines.length) {
                    lines[offset] = runtime.preFileLineHook(
                        lines[offset],
                        runtime.parsedLineNumber + offset,
                    ) as string;
                    o++;
                }
                cb();
            }
        } else {
            cb();
        }
    }
}
