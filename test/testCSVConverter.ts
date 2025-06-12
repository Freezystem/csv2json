import csv from "../src";
import { Converter } from "../src/Converter";
const assert = require("assert");
const fs = require("node:fs");
const sandbox = require("sinon").sandbox.create();
const file = __dirname + "/data/testData";
const trailCommaData = __dirname + "/data/trailingComma";
describe("CSV Converter", () => {
    afterEach(() => {
        sandbox.restore();
    });

    it("should create new instance of csv", () => {
        const obj = new Converter();
        assert(obj);
    });

    it("should read from a stream", (done) => {
        const obj = new Converter();
        const stream = fs.createReadStream(file);
        obj.then((obj) => {
            assert.equal(obj.length, 2);
            done();
        });
        stream.pipe(obj);
    });

    it("should call onNext once a row is parsed.", (done) => {
        const obj = new Converter();
        const stream = fs.createReadStream(file);
        let called = false;
        obj.subscribe((resultRow) => {
            assert(resultRow);
            called = true;
        });
        obj.on("done", () => {
            assert(called);
            done();
        });
        stream.pipe(obj);
    });

    it("should emit end_parsed message once it is finished.", (done) => {
        const obj = new Converter();
        obj.then((result) => {
            assert(result);
            assert(result.length === 2);
            assert(result[0].date);
            assert(result[0].employee);
            assert(result[0].employee.name);
            assert(result[0].employee.age);
            assert(result[0].employee.number);
            assert(result[0].employee.key.length === 2);
            assert(result[0].address.length === 2);
            done();
        });
        fs.createReadStream(file).pipe(obj);
    });

    it("should handle traling comma gracefully", (done) => {
        const stream = fs.createReadStream(trailCommaData);
        const obj = new Converter();
        obj.then((result) => {
            assert(result);
            assert(result.length > 0);
            done();
        });
        stream.pipe(obj);
    });

    it("should handle comma in column which is surrounded by qoutes", (done) => {
        const testData = __dirname + "/data/dataWithComma";
        const rs = fs.createReadStream(testData);
        const obj = new Converter({
            quote: "#",
        });
        obj.then((result) => {
            assert(result[0].col1 === '"Mini. Sectt');
            assert.equal(result[3].col2, "125001,fenvkdsf");
            // console.log(result);
            done();
        });
        rs.pipe(obj);
    });

    it("should be able to convert a csv to column array data", (done) => {
        const columArrData = __dirname + "/data/columnArray";
        const rs = fs.createReadStream(columArrData);
        const result: any = {};
        const csvConverter = new Converter();
        //end_parsed will be emitted once parsing finished
        csvConverter.then(() => {
            assert(result.TIMESTAMP.length === 5);
            done();
        });

        //record_parsed will be emitted each time a row has been parsed.
        csvConverter.subscribe((resultRow, rowIndex) => {
            for (const key in resultRow) {
                if (resultRow.hasOwnProperty(key)) {
                    if (!result[key] || !(result[key] instanceof Array)) {
                        result[key] = [];
                    }
                    result[key][rowIndex] = resultRow[key];
                }
            }
        });
        rs.pipe(csvConverter);
    });

    it("should be able to convert csv string directly", (done) => {
        const testData = __dirname + "/data/testData";
        const data = fs.readFileSync(testData).toString();
        const csvConverter = new Converter();
        //end_parsed will be emitted once parsing finished
        csvConverter.then((jsonObj) => {
            assert.equal(jsonObj.length, 2);
        });
        csvConverter.fromString(data).then((jsonObj) => {
            assert(jsonObj.length === 2);
            done();
        });
    });

    it("should be able to convert csv string with error", (done) => {
        const testData = __dirname + "/data/dataWithUnclosedQuotes";
        const data = fs.readFileSync(testData).toString();
        const csvConverter = new Converter();
        csvConverter.fromString(data).then(undefined, (err) => {
            assert(err);
            assert.equal(err.err, "unclosed_quote");
            done();
        });
    });

    it("should be able to convert csv string without callback provided", (done) => {
        const testData = __dirname + "/data/testData";
        const data = fs.readFileSync(testData).toString();
        const csvConverter = new Converter();
        //end_parsed will be emitted once parsing finished
        csvConverter.then((jsonObj) => {
            assert(jsonObj.length === 2);
            done();
        });
        csvConverter.fromString(data);
    });

    it("should be able to handle columns with double quotes", (done) => {
        const testData = __dirname + "/data/dataWithQoutes";
        const data = fs.readFileSync(testData).toString();
        const csvConverter = new Converter();
        csvConverter.fromString(data).then((jsonObj) => {
            assert(
                jsonObj[0].TIMESTAMP === '13954264"22',
                JSON.stringify(jsonObj[0].TIMESTAMP),
            );

            assert(
                jsonObj[1].TIMESTAMP === "abc, def, ccc",
                JSON.stringify(jsonObj[1].TIMESTAMP),
            );
            done();
        });
    });

    it("should be able to handle columns with two double quotes", (done) => {
        const testData = __dirname + "/data/twodoublequotes";
        const data = fs.readFileSync(testData).toString();
        const csvConverter = new Converter();
        csvConverter.fromString(data).then((jsonObj) => {
            assert.equal(jsonObj[0].title, '"');
            assert.equal(jsonObj[0].data, "xyabcde");
            assert.equal(jsonObj[0].uuid, 'fejal"eifa');
            assert.equal(jsonObj[0].fieldA, 'bnej""falkfe');
            assert.equal(jsonObj[0].fieldB, '"eisjfes"');
            done();
        });
    });

    it("should handle empty csv file", (done) => {
        const testData = __dirname + "/data/emptyFile";
        const rs = fs.createReadStream(testData);
        const csvConverter = new Converter();
        csvConverter.then((jsonObj) => {
            assert(jsonObj.length === 0);
            done();
        });
        rs.pipe(csvConverter);
    });

    it("should parse large csv file", (done) => {
        const testData = __dirname + "/data/large-csv-sample.csv";
        const rs = fs.createReadStream(testData);
        const csvConverter = new Converter();
        const count = 0;
        csvConverter.subscribe(() => {
            //console.log(arguments);
            count++;
        });
        csvConverter.then(() => {
            assert(count === 5290);
            done();
        });
        rs.pipe(csvConverter);
    });

    it("should parse data and covert to specific types", (done) => {
        const testData = __dirname + "/data/dataWithType";
        const rs = fs.createReadStream(testData);
        const csvConverter = new Converter({
            checkType: true,
            colParser: {
                column6: "string",
                column7: "string",
            },
        });
        csvConverter.subscribe((d) => {
            assert(typeof d.column1 === "number");
            assert(typeof d.column2 === "string");
            assert.equal(d["colume4"], "someinvaliddate");
            assert(d.column5.hello === "world");
            assert(d.column6 === '{"hello":"world"}');
            assert(d.column7 === "1234");
            assert(d.column8 === "abcd");
            assert(d.column9 === true);
            assert(d.column10[0] === 23);
            assert(d.column10[1] === 31);
            assert(d.column11[0].hello === "world");
            assert(d["name#!"] === false);
        });
        csvConverter.on("done", () => {
            done();
        });
        rs.pipe(csvConverter);
    });

    it("should turn off field type check", (done) => {
        const testData = __dirname + "/data/dataWithType";
        const rs = fs.createReadStream(testData);
        const csvConverter = new Converter({
            checkType: false,
        });
        csvConverter.subscribe((d) => {
            assert(typeof d.column1 === "string");
            assert(typeof d.column2 === "string");
            assert(d["column3"] === "2012-01-01");
            assert(d["colume4"] === "someinvaliddate");
            assert(d.column5 === '{"hello":"world"}');
            assert.equal(d["column6"], '{"hello":"world"}');
            assert(d["column7"] === "1234");
            assert(d["column8"] === "abcd");
            assert(d.column9 === "true");
            assert(d.column10[0] === "23");
            assert(d.column10[1] === "31");
            assert(d["name#!"] === "false");
        });
        csvConverter.then(() => {
            done();
        });
        rs.pipe(csvConverter);
    });

    it("should emit data event correctly", (done) => {
        const testData = __dirname + "/data/large-csv-sample.csv";

        const csvConverter = new Converter({});
        const count = 0;
        csvConverter.on("data", (d) => {
            count++;
        });
        csvConverter.on("end", () => {
            assert.equal(count, 5290);
            done();
        });
        const rs = fs.createReadStream(testData);
        rs.pipe(csvConverter);
    });

    it("should process column with linebreaks", (done) => {
        const testData = __dirname + "/data/lineBreak";
        const rs = fs.createReadStream(testData);
        const csvConverter = new Converter({
            checkType: true,
        });
        csvConverter.subscribe((d) => {
            assert(d.Period === 13);
            assert(d["Apparent age"] === "Unknown");
            done();
        });
        rs.pipe(csvConverter);
    });

    it("be able to ignore empty columns", (done) => {
        const testData = __dirname + "/data/dataIgnoreEmpty";
        const rs = fs.createReadStream(testData);
        const st = rs.pipe(csv({ ignoreEmpty: true }));
        st.then((res) => {
            const j = res[0];
            assert(res.length === 3);
            assert(j.col2.length === 2);
            assert(j.col2[1] === "d3");
            assert(j.col4.col3 === undefined);
            assert(j.col4.col5 === "world");
            assert(res[1].col1 === "d2");
            assert(res[2].col1 === "d4");
            done();
        });
    });

    it("should allow no header", (done) => {
        const testData = __dirname + "/data/noheadercsv";
        const rs = fs.createReadStream(testData);
        const st = rs.pipe(new Converter({ noheader: true }));
        st.then((res) => {
            const j = res[0];
            assert(res.length === 5);
            assert(j.field1 === "CC102-PDMI-001");
            assert(j.field2 === "eClass_5.1.3");
            done();
        });
    });

    it("should allow customised header", (done) => {
        const testData = __dirname + "/data/noheadercsv";
        const rs = fs.createReadStream(testData);
        const st = rs.pipe(
            new Converter({
                noheader: true,
                headers: ["a", "b"],
            }),
        );
        st.then((res) => {
            const j = res[0];
            assert(res.length === 5);
            assert(j.a === "CC102-PDMI-001");
            assert(j.b === "eClass_5.1.3");
            assert(j.field3 === "10/3/2014");
            done();
        });
    });

    it("should allow customised header to override existing header", (done) => {
        const testData = __dirname + "/data/complexJSONCSV";
        const rs = fs.createReadStream(testData);
        const st = rs.pipe(
            new Converter({
                headers: [],
            }),
        );
        st.then((res) => {
            const j = res[0];
            assert(res.length === 2);
            assert(j.field1 === "Food Factory");
            assert(j.field2 === "Oscar");
            done();
        });
    });

    it("should handle when there is an empty string", (done) => {
        const testData = __dirname + "/data/dataWithEmptyString";
        const rs = fs.createReadStream(testData);
        const st = rs.pipe(
            new Converter({
                noheader: true,
                headers: ["a", "b", "c"],
                checkType: true,
            }),
        );
        st.then((res) => {
            const j = res[0];

            // assert(res.length===2);
            assert(j.a === "green");
            assert(j.b === 40);
            assert.equal(j.c, "");
            done();
        });
    });

    it("should detect eol correctly when first chunk is smaller than header row length", (done) => {
        const testData = __dirname + "/data/dataNoTrimCRLF";
        const rs = fs.createReadStream(testData, { highWaterMark: 3 });

        const st = rs.pipe(
            new Converter({
                trim: false,
            }),
        );
        st.then((res) => {
            const j = res[0];
            assert(res.length === 2);
            assert(j.name === "joe");
            assert(j.age === "20");
            assert.equal(res[1].name, "sam");
            assert.equal(res[1].age, "30");
            done();
        });
    });

    it("should detect eol correctly when first chunk ends in middle of CRLF line break", (done) => {
        const testData = __dirname + "/data/dataNoTrimCRLF";
        const rs = fs.createReadStream(testData, { highWaterMark: 9 });

        const st = rs.pipe(
            new Converter({
                trim: false,
            }),
        );
        st.then((res) => {
            const j = res[0];
            assert(res.length === 2);
            assert(j.name === "joe");
            assert(j.age === "20");
            assert.equal(res[1].name, "sam");
            assert.equal(res[1].age, "30");
            done();
        });
    });

    it("should emit eol event when line ending is detected as CRLF", (done) => {
        const testData = __dirname + "/data/dataNoTrimCRLF";
        const rs = fs.createReadStream(testData);

        const st = rs.pipe(new Converter());
        const eolCallback = sandbox.spy((eol) => {
            assert.equal(eol, "\r\n");
        });
        st.on("eol", eolCallback);
        st.then(() => {
            assert.equal(
                eolCallback.callCount,
                1,
                "should emit eol event once",
            );
            done();
        });
    });

    it("should emit eol event when line ending is detected as LF", (done) => {
        const testData = __dirname + "/data/columnArray";
        const rs = fs.createReadStream(testData);

        const st = rs.pipe(new Converter());
        const eolCallback = sandbox.spy((eol) => {
            assert.equal(eol, "\n");
        });
        st.on("eol", eolCallback);
        st.then(() => {
            assert.equal(
                eolCallback.callCount,
                1,
                "should emit eol event once",
            );
            done();
        });
    });

    it("should remove the Byte Order Mark (BOM) from input", (done) => {
        const testData = __dirname + "/data/dataNoTrimBOM";
        const rs = fs.createReadStream(testData);
        const st = rs.pipe(
            new Converter({
                trim: false,
            }),
        );
        st.then((res) => {
            const j = res[0];

            assert(res.length === 2);
            assert(j.name === "joe");
            assert(j.age === "20");
            done();
        });
    });
});
