import _ from "lodash";
import CSVError from "./CSVError.ts";
import type { Converter } from "./Converter.ts";
import type { CellParser, ColumnParam } from "./Parameters.ts";

const numReg = /^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$/;
export type JSONPrimitives = string | number | boolean | null;
export type JSON = JSONPrimitives[] | Record<string, JSONPrimitives>;

export default function (csvRows: string[][], conv: Converter): JSONResult[] {
    const res: JSONResult[] = [];
    for (let i = 0, len = csvRows.length; i < len; i++) {
        const r = processRow(csvRows[i], conv, i);
        if (r) {
            res.push(r);
        }
    }

    return res;
}

export type JSONResult = {
    [key: string]: any;
};

function processRow(row: string[], conv: Converter, index): JSONResult | null {
    if (
        conv.parseParam.checkColumn &&
        conv.parseRuntime.headers &&
        row.length !== conv.parseRuntime.headers.length
    ) {
        throw CSVError.column_mismatched(
            conv.parseRuntime.parsedLineNumber + index,
        );
    }

    const headRow = conv.parseRuntime.headers || [];
    const resultRow = convertRowToJson(row, headRow, conv);

    if (resultRow) return resultRow;

    return null;
}

function convertRowToJson(
    row: string[],
    headRow: string[],
    conv: Converter,
): { [key: string]: any } | null {
    let hasValue = false;
    const resultRow = {};

    for (let i = 0, len = row.length; i < len; i++) {
        let item = row[i];

        if (conv.parseParam.ignoreEmpty && item === "") {
            continue;
        }
        hasValue = true;

        let head = headRow[i];
        if (!head || head === "") {
            head = headRow[i] = `field${i + 1}`;
        }
        const convFunc = getConvFunc(head, i, conv);
        if (convFunc) {
            const convRes = convFunc(item, head, resultRow, row, i);
            if (convRes !== undefined) {
                setPath(resultRow, head, convRes, conv, i);
            }
        } else {
            if (conv.parseParam.checkType) {
                const convertFunc = checkType(item, head, i, conv);
                item = convertFunc(item);
            }
            if (item !== undefined) {
                setPath(resultRow, head, item, conv, i);
            }
        }
    }

    if (hasValue) return resultRow;

    return null;
}

const builtInConv: { [key: string]: CellParser } = {
    string: stringType,
    number: numberType,
    omit: () => {},
};
function getConvFunc(
    head: string,
    i: number,
    conv: Converter,
): CellParser | null {
    if (conv.parseRuntime.columnConv[i] !== undefined) {
        return conv.parseRuntime.columnConv[i];
    }

    let flag = conv.parseParam.colParser[head];

    if (flag === undefined)
        conv.parseRuntime.columnConv[i] = null;

    if (typeof flag === "object")
        flag = (flag as ColumnParam).cellParser || "string";

    if (typeof flag === "string") {
        flag = flag.trim().toLowerCase();
        const builtInFunc = builtInConv[flag];

        if (builtInFunc) {
            conv.parseRuntime.columnConv[i] = builtInFunc;
        } else {
            conv.parseRuntime.columnConv[i] = null;
        }
    } else if (typeof flag === "function") {
        conv.parseRuntime.columnConv[i] = flag;
    } else {
        conv.parseRuntime.columnConv[i] = null;
    }

    return conv.parseRuntime.columnConv[i];
}

function setPath(
    resultJson: any,
    head: string,
    value: any,
    conv: Converter,
    headIdx: number,
) {
    if (!conv.parseRuntime.columnValueSetter[headIdx]) {
        if (conv.parseParam.flatKeys) {
            conv.parseRuntime.columnValueSetter[headIdx] = flatSetter;
        } else {
            if (head.indexOf(".") > -1) {
                const headArr = head.split(".");
                let jsonHead = true;

                while (headArr.length > 0) {
                    const headCom = headArr.shift();

                    if (headCom?.length === 0) {
                        jsonHead = false;
                        break;
                    }
                }
                if (
                    !jsonHead ||
                    (conv.parseParam.colParser[head] &&
                        (conv.parseParam.colParser[head] as ColumnParam).flat)
                ) {
                    conv.parseRuntime.columnValueSetter[headIdx] = flatSetter;
                } else {
                    conv.parseRuntime.columnValueSetter[headIdx] = jsonSetter;
                }
            } else {
                conv.parseRuntime.columnValueSetter[headIdx] = flatSetter;
            }
        }
    }

    if (conv.parseParam.nullObject && value === "null") {
        value = null;
    }

    conv.parseRuntime.columnValueSetter[headIdx](resultJson, head, value);
    // flatSetter(resultJson, head, value);
}

function flatSetter(resultJson: JSONResult, head: string, value: unknown) {
    resultJson[head] = value;
}

function jsonSetter(resultJson: JSONResult, head: string, value: any) {
    _.set(resultJson, head, value);
}

function checkType(
    _item: string,
    head: string,
    headIdx: number,
    conv: Converter,
) {
    if (conv.parseRuntime.headerType[headIdx])
        return conv.parseRuntime.headerType[headIdx];

    if (head.indexOf("number#!") > -1)
        conv.parseRuntime.headerType[headIdx] = numberType;

    if (head.indexOf("string#!") > -1)
        conv.parseRuntime.headerType[headIdx] = stringType;

    if (conv.parseParam.checkType)
        conv.parseRuntime.headerType[headIdx] = dynamicType;

    conv.parseRuntime.headerType[headIdx] = stringType;

    return conv.parseRuntime.headerType[headIdx];
}

function numberType(item: string) {
    const rtn = Number.parseFloat(item);
    return Number.isNaN(rtn) ? item : rtn;
}

function stringType(item: string): string {
    return item.toString();
}

function dynamicType(item: string) {
    const trimmed = item.trim();

    if (trimmed === "") return item;

    if (numReg.test(trimmed)) {
        return numberType(item);
    }

    if (
        (trimmed.length === 5 && trimmed.toLowerCase() === "false") ||
        (trimmed.length === 4 && trimmed.toLowerCase() === "true")
    ) {
        return booleanType(item);
    }

    if (
        (trimmed[0] === "{" && trimmed[trimmed.length - 1] === "}") ||
        (trimmed[0] === "[" && trimmed[trimmed.length - 1] === "]")
    ) {
        return jsonType(item);
    }

    return stringType(item);
}

function booleanType(item: string) {
    const trimmed = item.trim();
    return !(trimmed.length === 5 && trimmed.toLowerCase() === "false");
}

function jsonType(item: string): string | object {
    try {
        return JSON.parse(item);
    } catch (e) {
        return item;
    }
}
