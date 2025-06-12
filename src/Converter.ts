import fs from "node:fs";
import { Readable, Transform, type TransformOptions } from "node:stream";
import type CSVError from "./CSVError";
import { type CSVParseParam, mergeParams } from "./Parameters.ts";
import { type ParseRuntime, initParseRuntime } from "./ParseRuntime.ts";
import type { Processor } from "./Processor.ts";
import { ProcessorLocal } from "./ProcessorLocal.ts";
import { Result } from "./Result.ts";

export class Converter extends Transform implements PromiseLike<unknown[]> {
    readonly #params: CSVParseParam;
    readonly #runtime: ParseRuntime;
    #processor: Processor;
    #result: Result;
    options: TransformOptions;

    constructor(
        param?: Partial<CSVParseParam>,
        options: TransformOptions = {},
    ) {
        super(options);
        this.options = options;
        this.#params = mergeParams(param);
        this.#runtime = initParseRuntime(this);
        this.#result = new Result(this);
        this.#processor = new ProcessorLocal(this);

        this.once("error", (err: CSVError) => {
            setImmediate(() => {
                this.#result.processError(err);
                this.emit("done", err);
            });
        });

        this.once("done", () => {
            this.#processor.destroy();
        });
    }

    preRawData(onRawData: PreRawDataCallback): Converter {
        this.#runtime.preRawDataHook = onRawData;
        return this;
    }

    preFileLine(onFileLine: PreFileLineCallback): Converter {
        this.#runtime.preFileLineHook = onFileLine;
        return this;
    }

    subscribe(
        onNext?: (data: unknown, lineNumber: number) => void | PromiseLike<void>,
        onError?: (err: CSVError) => void,
        onCompleted?: () => void,
    ): Converter {
        this.parseRuntime.subscribe = {
            onNext,
            onError,
            onCompleted,
        };
        return this;
    }

    fromFile(
        filePath: string,
        options?: BufferEncoding
    ): Converter {
        try {
            fs.accessSync(filePath)
            const rs = fs.createReadStream(filePath, options);
            rs.pipe(this);
        } catch (err) {
            this.emit(
                "error",
                new Error(
                    `File does not exist at ${filePath}. Check to make sure the file path to your csv is correct.`,
                ),
            );
        }

        return this;
    }

    fromStream(readStream: Readable): Converter {
        readStream.pipe(this);
        return this;
    }

    fromString(csvString: string): Converter {
        const read = new Readable();
        let idx = 0;
        read._read = function (size) {
            if (idx >= csvString.length) {
                this.push(null);
            } else {
                const str = csvString.substring(idx, idx + size);
                this.push(str);
                idx += size;
            }
        };
        return this.fromStream(read);
    }

    // biome-ignore lint/suspicious/noThenProperty: need time to change this
    then<TResult1 = unknown[], TResult2 = never>(
            onfulfilled?: (value: unknown[]) => TResult1 | PromiseLike<TResult1>,
            onrejected?: (reason: unknown) => TResult2 | PromiseLike<TResult2>,
        ): PromiseLike<TResult1 | TResult2> {
            return new Promise((resolve, reject) => {
                this.once('done', (err?: Error) => {
                    if (err) {
                        if (onrejected) {
                            resolve(onrejected(err));
                        } else {
                            reject(err);
                        }
                    } else {
                        const value = this.#result.finalResult as unknown[];

                        if (onfulfilled) {
                            resolve(onfulfilled(value));
                        } else {
                            resolve(value as TResult1);
                        }
                    }
                });
            });
        }

    get parseParam(): CSVParseParam {
        return this.#params;
    }

    get parseRuntime(): ParseRuntime {
        return this.#runtime;
    }

    override _transform(chunk: Buffer, _encoding: string, cb: ()=>unknown) {
        this.#processor
            .process(chunk)
            .then((result) => {
                if (result.length > 0) {
                    this.#runtime.started = true;

                    return this.#result.processResult(result);
                }

                return null;
            })
            .then(
                () => {
                    this.emit("drained");
                    cb();
                },
                (error) => {
                    this.#runtime.hasError = true;
                    this.#runtime.error = error;
                    this.emit("error", error);
                    cb();
                },
            );
    }

    override _flush(cb: () => unknown) {
        this.#processor
            .flush()
            .then((data) => {
                if (data.length > 0) {
                    return this.#result.processResult(data);
                }

                return null;
            })
            .then(
                () => {
                    this.processEnd(cb);
                },
                (err) => {
                    this.emit("error", err);
                    cb();
                },
            );
    }

    private processEnd(cb: () => unknown) {
        this.#result.endProcess();
        this.emit("done");
        cb();
    }

    get parsedLineNumber(): number {
        return this.#runtime.parsedLineNumber;
    }
}

export interface CreateReadStreamOption {
    flags?: string;
    encoding?: string;
    fd?: number;
    mode?: number;
    autoClose?: boolean;
    start?: number;
    end?: number;
    highWaterMark?: number;
}

export type CallBack = (err: Error, data: Array<unknown>) => void;

export type PreFileLineCallback = (
    line: string,
    lineNumber: number,
) => string | PromiseLike<string>;

export type PreRawDataCallback = (
    csvString: string,
) => string | PromiseLike<string>;
