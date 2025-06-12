import getEol from "./getEol.ts";

/**
 * Splits a given string into an array of lines based on the detected end-of-line (EOL) character.
 *
 * @param {string} data - The input string to be split into lines.
 * @return {StringToLinesResult} An object containing an array of complete lines and the remaining partial line.
 */
export function stringToLines(
    data: string,
): StringToLinesResult {
    const eol = getEol(data);
    const lines = data.split(eol);
    const partial = lines.pop() || "";
    return { lines: lines, partial: partial };
}

export interface StringToLinesResult {
    lines: FileLine[];
    partial: string;
}

export type FileLine = string;
