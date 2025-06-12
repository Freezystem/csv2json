import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Converter } from "./Converter.ts";
import { Result } from "./Result.ts";

describe("Result", () => {
    it("should return need push downstream based on needEmitAll parameter", () => {
        const conv = new Converter();
        const res = new Result(conv);

        assert.equal(res["#needEmitAll"], false);

        conv.then();

        assert.equal(res["#needEmitAll"], true);

        conv.parseParam.needEmitAll = false;

        assert.equal(res["#needEmitAll"], false);
    });
});
