import type { Converter } from "./Converter";
import type { CSVParseParam } from "./Parameters";
import type { ParseRuntime } from "./ParseRuntime";
import type { JSONResult } from "./lineToJson";

export abstract class Processor {
    protected params: CSVParseParam;
    protected runtime: ParseRuntime;
    constructor(protected converter: Converter) {
        this.params = converter.parseParam;
        this.runtime = converter.parseRuntime;
    }
    abstract process(
        chunk: Buffer,
        finalChunk?: boolean,
    ): Promise<ProcessLineResult[]>;
    abstract destroy(): Promise<void>;
    abstract flush(): Promise<ProcessLineResult[]>;
}
export type ProcessLineResult = string | string[] | JSONResult;
