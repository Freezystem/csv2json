import { EOL } from "node:os";
import type CSVError from "./CSVError.ts";
import type { Converter } from "./Converter.ts";
import type { ProcessLineResult } from "./Processor.ts";

export class Result {
    #_?: boolean;
    get #needPushDownstream(): boolean {
        if (this.#_ === undefined) {
            this.#_ =
                this.#converter.listeners("data").length > 0 ||
                this.#converter.listeners("readable").length > 0;
        }

        return this.#_;
    }
    get #needEmitLine(): boolean {
        return (
            (!!this.#converter.parseRuntime.subscribe &&
                !!this.#converter.parseRuntime.subscribe.onNext) ||
            this.#needPushDownstream
        );
    }
    get #needEmitAll(): boolean {
        return (
            !!this.#converter.parseRuntime.then &&
            this.#converter.parseParam.needEmitAll
        );
    }
    #finalResult: unknown[] = [];
    readonly #converter: Converter

    get finalResult() {
        return this.#finalResult;
    }

    constructor(converter: Converter) {
        this.#converter = converter;
    }

    processResult(resultLines: ProcessLineResult[]): Promise<unknown> {
        const startPos = this.#converter.parseRuntime.parsedLineNumber;

        if (
            this.#needPushDownstream &&
            this.#converter.parseParam.downstreamFormat === "array"
        ) {
            if (startPos === 0) {
                pushDownstream(this.#converter, `[${EOL}`);
            }
        }

        return new Promise<void>((resolve, reject) => {
            if (this.#needEmitLine) {
                processLineByLine(
                    resultLines,
                    this.#converter,
                    0,
                    this.#needPushDownstream,
                    (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            this.appendFinalResult(resultLines);
                            resolve();
                        }
                    },
                );
                // resolve();
            } else {
                this.appendFinalResult(resultLines);
                resolve();
            }
        });
    }

    appendFinalResult(lines: unknown[]) {
        if (this.#needEmitAll) {
            this.#finalResult = this.finalResult.concat(lines);
        }
        this.#converter.parseRuntime.parsedLineNumber += lines.length;
    }

    processError(err: CSVError) {
        if (
            this.#converter.parseRuntime.subscribe?.onError
        ) {
            this.#converter.parseRuntime.subscribe.onError(err);
        }

        if (
            this.#converter.parseRuntime.then?.onrejected
        ) {
            this.#converter.parseRuntime.then.onrejected(err);
        }
    }

    endProcess() {
        if (
            this.#converter.parseRuntime.then?.onfulfilled
        ) {
            if (this.#needEmitAll) {
                this.#converter.parseRuntime.then.onfulfilled(this.finalResult);
            } else {
                this.#converter.parseRuntime.then.onfulfilled([]);
            }
        }

        if (
            this.#converter.parseRuntime.subscribe?.onCompleted
        ) {
            this.#converter.parseRuntime.subscribe.onCompleted();
        }

        if (
            this.#needPushDownstream &&
            this.#converter.parseParam.downstreamFormat === "array"
        ) {
            pushDownstream(this.#converter, `]${EOL}`);
        }
    }
}

function processLineByLine(
    lines: ProcessLineResult[],
    conv: Converter,
    offset: number,
    needPushDownstream: boolean,
    cb: (err?: Error) => void,
) {
    if (offset >= lines.length) {
        cb();
    } else {
        let o = offset;
        if (conv.parseRuntime.subscribe?.onNext) {
            const hook = conv.parseRuntime.subscribe.onNext;
            const nextLine = lines[offset];
            const res = hook(
                nextLine,
                conv.parseRuntime.parsedLineNumber + offset,
            );

            o++;

            if (res?.then) {
                res.then(() => {
                    processRecursive(
                        lines,
                        hook,
                        conv,
                        offset,
                        needPushDownstream,
                        cb,
                        nextLine,
                    );
                }, cb);
            } else {
                if (needPushDownstream) {
                    pushDownstream(conv, nextLine);
                }
                while (offset < lines.length) {
                    const line = lines[offset];
                    hook(line, conv.parseRuntime.parsedLineNumber + offset);
                    o++;
                    if (needPushDownstream) {
                        pushDownstream(conv, line);
                    }
                }
                cb();
            }
        } else {
            if (needPushDownstream) {
                while (offset < lines.length) {
                    const line = lines[o++];
                    pushDownstream(conv, line);
                }
            }
            cb();
        }
    }
}

function processRecursive(
    lines: ProcessLineResult[],
    _hook: (data: unknown, lineNumber: number) => void | PromiseLike<void>,
    conv: Converter,
    offset: number,
    needPushDownstream: boolean,
    cb: (err?: Error) => void,
    res: ProcessLineResult,
) {
    if (needPushDownstream) {
        pushDownstream(conv, res);
    }
    processLineByLine(lines, conv, offset, needPushDownstream, cb);
}

function pushDownstream(conv: Converter, res: ProcessLineResult) {
    if (typeof res === "object" && !conv.options.objectMode) {
        const data = JSON.stringify(res);
        conv.push(
            data +
                (conv.parseParam.downstreamFormat === "array"
                    ? `,${EOL}`
                    : EOL),
            "utf8",
        );
    } else {
        conv.push(res);
    }
}
