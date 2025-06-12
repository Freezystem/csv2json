export default class CSVError extends Error {
    override readonly name = "CSV Parse Error";
    readonly err: string
    readonly line: number
    readonly extra?: string

    constructor(
        err: string,
        line: number,
        extra?: string,
    ) {
        super(
            `Error: ${err}. JSON Line number: ${line}${extra ? ` near: ${extra}` : ""}`,
        );

        this.err = err;
        this.line = line;
        this.extra = extra;
    }

    toJSON() {
        return {
            err: this.err,
            line: this.line,
            extra: this.extra,
        };
    }

    static column_mismatched(index: number, extra?: string) {
        return new CSVError("column_mismatched", index, extra);
    }

    static unclosed_quote(index: number, extra?: string) {
        return new CSVError("unclosed_quote", index, extra);
    }

    static fromJSON(obj: CSVError) {
        return new CSVError(obj.err, obj.line, obj.extra);
    }
}
