import type { Converter } from "./Converter.ts";
import type { FileLine } from "./fileline.ts";
import getEol from "./getEol.ts";
import { filterArray } from "./util.ts";

export class RowSplit {
    readonly #quote: string;
    readonly #trim: boolean;
    readonly #escape: string;
    #conv: Converter
    #cachedRegExp: { [key: string]: RegExp } = {};
    #delimiterEmitted = false;

    get #shouldEmitDelimiter() {
        return this.#conv.listeners("delimiter").length > 0;
    }

    constructor(conv: Converter) {
        this.#conv = conv;
        this.#quote = conv.parseParam.quote;
        this.#trim = conv.parseParam.trim;
        this.#escape = conv.parseParam.escape;
    }

    parse(fileLine: FileLine): RowSplitResult {
        if (
            fileLine.length === 0 ||
            (this.#conv.parseParam.ignoreEmpty && fileLine.trim().length === 0)
        ) {
            return { cells: [], closed: true };
        }

        const delimiter = this.#getDelimiter(fileLine);
        
        if (this.#shouldEmitDelimiter && !this.#delimiterEmitted) {
            this.#conv.emit("delimiter", delimiter);
            this.#delimiterEmitted = true;
        }

        const rowArr = fileLine.split(delimiter);

        if (this.#quote === "off") {
            if (this.#trim) {
                for (let i = 0; i < rowArr.length; i++) {
                    rowArr[i] = rowArr[i].trim();
                }
            }
            return { cells: rowArr, closed: true };
        }

        return this.#toCSVRow(rowArr, this.#trim, this.#quote, delimiter);
    }

    #toCSVRow(
        rowArr: string[],
        trim: boolean,
        quote: string,
        delimiter: string,
    ): RowSplitResult {
        const row: string[] = [];
        let inQuotes = false;
        let quoteBuff = "";

        for (let i = 0, rowLen = rowArr.length; i < rowLen; i++) {
            let e = rowArr[i];
            
            if (!inQuotes && trim) e = e.trimStart();
            
            const len = e.length;

            if (!inQuotes) {
                if (len === 2 && e === this.#quote + this.#quote) {
                    row.push("");
                } else if (this.isQuoteOpen(e)) {
                    e = e.slice(1);

                    if (this.isQuoteClose(e)) {
                        e = e.slice(0, e.lastIndexOf(quote));
                        e = this.escapeQuote(e);

                        row.push(e);
                    } else if (e.indexOf(quote) !== -1) {
                        let count = 0;
                        let prev = "";

                        for (const c of e) {
                            if (c === quote && prev !== this.#escape) {
                                count++;
                                prev = "";
                            } else {
                                prev = c;
                            }
                        }

                        if (count % 2 === 1) {
                            row.push(`${quote}${trim ? e.trimEnd() : e}`);
                        } else {
                            inQuotes = true;
                            quoteBuff += e;
                        }
                    } else {
                        inQuotes = true;
                        quoteBuff += e;
                    }
                } else {
                    row.push(trim ? e.trimEnd() : e);
                }
            } else {
                if (this.isQuoteClose(e)) {
                    inQuotes = false;
                    e = e.slice(0, len - 1);

                    quoteBuff += delimiter + e;
                    quoteBuff = this.escapeQuote(quoteBuff);

                    row.push(trim ? quoteBuff.trimEnd() : quoteBuff);

                    quoteBuff = "";
                } else {
                    quoteBuff += delimiter + e;
                }
            }
        }

        return { cells: row, closed: !inQuotes };
    }

    #getDelimiter(fileLine: FileLine): string {
        if (this.#conv.parseRuntime.delimiter) return this.#conv.parseRuntime.delimiter;

        const possibleDelimiters: string[] = this.#conv.parseRuntime.possibleDelimiters;

        let count = 0;
        let delimiter = possibleDelimiters[0];

        for (const delim of possibleDelimiters) {
            const delimCount = fileLine.split(delim).length;

            if (delimCount > count) {
                delimiter = delim;
                count = delimCount;
            }
        }

        this.#conv.parseRuntime.delimiter = delimiter;

        return delimiter;
    }

    private isQuoteOpen(str: string): boolean {
        return (
            str[0] === this.#quote &&
            (str[1] !== this.#quote ||
                (str[1] === this.#escape && (str[2] === this.#quote || str.length === 2)))
        );
    }

    private isQuoteClose(str: string): boolean {
        const _str = this.#conv.parseParam.trim ? str.trimEnd() : str;
        let count = 0;
        let idx = str.length - 1;

        while (_str[idx] === this.#quote || _str[idx] === this.#escape) {
            idx--;
            count++;
        }

        return count % 2 !== 0;
    }

    private escapeQuote(segment: string): string {
        const key = `es|${this.#quote}|${this.#escape}`;

        if (this.#cachedRegExp[key] === undefined) {
            this.#cachedRegExp[key] = new RegExp(
                // biome-ignore lint/style/useTemplate: double backslash is buggy in string templates
                "\\" + this.#escape + "\\" + this.#quote,
                "g",
            );
        }

        const regExp = this.#cachedRegExp[key];

        return segment.replace(regExp, this.#quote);
    }

    parseMultiLines(lines: FileLine[]): MultipleRowResult {
        const csvLines: string[][] = [];
        let left = "";

        while (lines.length) {
            const line = left + lines.shift();
            const row = this.parse(line);

            if (row.cells.length === 0 && this.#conv.parseParam.ignoreEmpty) {
                continue;
            }

            if (row.closed || this.#conv.parseParam.alwaysSplitAtEOL) {
                if (this.#conv.parseRuntime.selectedColumns) {
                    csvLines.push(
                        filterArray(
                            row.cells,
                            this.#conv.parseRuntime.selectedColumns,
                        ),
                    );
                } else {
                    csvLines.push(row.cells);
                }

                left = "";
            } else {
                left = `${line}${this.#conv.parseRuntime || getEol(line)}`
            }
        }

        return { rowsCells: csvLines, partial: left };
    }
}

export interface MultipleRowResult {
    rowsCells: string[][];
    partial: string;
}

export interface RowSplitResult {
    /**
     * csv row array. ["a","b","c"]
     */
    cells: string[];
    /**
     * if the passed FileLine is a complete row
     */
    closed: boolean;
}
