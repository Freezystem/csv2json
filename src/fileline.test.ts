import { Converter } from "./Converter";
import { mergeParams } from "./Parameters";
import { stringToLines } from "./fileline";
const assert = require("assert");
describe("fileline function", () => {
    it("should convert data to multiple lines ", () => {
        const conv = new Converter();
        const data = "abcde\nefef";
        const result = stringToLines(data, conv.parseRuntime);
        assert.equal(result.lines.length, 1);
        assert.equal(result.partial, "efef");
        assert.equal(result.lines[0], "abcde");
    });
});
