import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { JSONResult } from "./lineToJson";
import { Converter } from "./Converter.ts";
import { ProcessorLocal } from "./ProcessorLocal.ts";
const __dirname = path.resolve();
const dataDir = path.join(__dirname, "/test/data");

describe("ProcessLocal", () => {
    it("should process csv chunks and output json", async () => {
        const processor = new ProcessorLocal(new Converter());
        const data = readFileSync(`${dataDir}/complexJSONCSV`);
        const lines = await processor.process(data);

        assert(lines.length === 2);

        const line0 = lines[0] as JSONResult;

        assert.equal(line0.fieldA.title, "Food Factory");
        assert.equal(line0.fieldA.children.length, 2);
        assert.equal(line0.fieldA.children[1].employee[0].name, "Tim");
    });

    it("should process csv chunks and output csv rows", async () => {
        const processor = new ProcessorLocal(new Converter({ output: "line" }));
        const data = readFileSync(`${dataDir}/complexJSONCSV`);
        const lines = await processor.process(data);

        assert(lines.length === 2);
    });

    it("should return empty array if preRawHook removed the data", () => {
        const conv = new Converter();

        conv.preRawData((_str) => {
            return "";
        });

        const processor = new ProcessorLocal(conv);
        const data = readFileSync(`${dataDir}/complexJSONCSV`);

        return processor.process(data).then((list) => {
            assert.equal(list.length, 0);
        });
    });
});
