const EOL = {
    CRLF: '\r\n' as const,
    CR: '\r' as const,
    LF: '\n' as const,
} as const;

type EOLCharacter = typeof EOL[keyof typeof EOL];

/**
 * Detects the end-of-line (EOL) character used in the provided string.
 *
 * @param {string} data - The input string to analyze for EOL characters.
 * @return {EOLCharacter} - The detected EOL character, which could be one of `EOL.LF`, `EOL.CR`, or `EOL.CRLF`.
 */
export default function detectEOLCharacter(data: string): EOLCharacter {
    if (!data) return EOL.LF;

    for (let i = 0; i < data.length; i++) {
        const currentChar = data[i];
        const nextChar = data[i + 1];

        if (currentChar === EOL.CR) {
            if (nextChar === EOL.LF) return EOL.CRLF;
            if (nextChar) return EOL.CR;
        }

        if (currentChar === EOL.LF) return EOL.LF;
    }

    return EOL.LF;
}
