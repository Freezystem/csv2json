import type CSVError from "../src/CSVError";
import { Converter } from "../src/Converter";
const assert = require("assert");
const fs = require("node:fs");

describe("Converter error handling", () => {
    it("should handle quote not closed", (done) => {
        const rs = fs.createReadStream(
            `${__dirname}/data/dataWithUnclosedQuotes`,
        );
        const conv = new Converter({});
        conv.on("error", (err: CSVError) => {
            assert(err.err === "unclosed_quote");
            done();
        });
        rs.pipe(conv);
    });

    it("should handle column number mismatched error", (done) => {
        const rs = fs.createReadStream(
            `${__dirname}/data/dataWithMismatchedColumn`,
        );
        const conv = new Converter({
            checkColumn: true,
        });
        const tested = false;
        conv.on("error", (err: CSVError) => {
            if (tested === false) {
                assert(err.err === "column_mismatched");
                tested = true;
                // done();
            }
        });
        conv.on("done", () => {
            assert(tested);
            done();
        });
        rs.pipe(conv);
    });

    it("should treat quote not closed as column_mismatched when alwaysSplitAtEOL is true", (done) => {
        const rs = fs.createReadStream(
            __dirname + "/data/dataWithUnclosedQuotes",
        );
        const conv = new Converter({
            checkColumn: true,
            alwaysSplitAtEOL: true,
        });
        const tested = false;
        conv.on("error", (err: CSVError) => {
            if (tested === false) {
                assert(err.err === "column_mismatched");
                tested = true;
            }
        });
        conv.on("done", () => {
            assert(tested);
            done();
        });
        rs.pipe(conv);
    });
});
