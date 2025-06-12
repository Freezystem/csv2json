import csv from "../src";
import { Converter } from "../src/Converter";
const assert = require("assert");
const fs = require("node:fs");
const sandbox = require("sinon").sandbox.create();
describe("testCSVConverter2", () => {
    afterEach(() => {
        sandbox.restore();
    });

    it("should convert from large csv string", (done) => {
        const csvStr = fs.readFileSync(
            __dirname + "/data/large-csv-sample.csv",
            "utf8",
        );
        const conv = new Converter({});
        conv.fromString(csvStr).then((res) => {
            assert(res.length === 5290);
            done();
        });
    });

    it("should set eol", (done) => {
        const rs = fs.createReadStream(
            __dirname + "/data/large-csv-sample.csv",
        );
        const conv = new Converter({
            eol: "\n",
        });
        const count = 0;
        conv.subscribe((resultJson, index) => {
            count++;
            assert(resultJson);
            // assert(row.length === 2);
            assert(index >= 0);
        });
        conv.on("error", () => {
            console.log(arguments);
        });
        conv.then((result) => {
            assert(result);
            assert(count === 5290);
            done();
        });
        rs.pipe(conv);
    });

    it("should convert tsv String", (done) => {
        const tsv = __dirname + "/data/dataTsv";
        const csvStr = fs.readFileSync(tsv, "utf8");
        const conv = new Converter({
            delimiter: "\t",
            checkType: false,
        });
        conv.fromString(csvStr).then((res) => {
            assert(res);
            assert.equal(res.length, 200);
            done();
        });
    });

    it("should allow customised header with nohead csv string.", (done) => {
        const testData = __dirname + "/data/noheadercsv";
        const rs = fs.readFileSync(testData, "utf8");
        const conv = new Converter({
            noheader: true,
            headers: ["a", "b", "c", "e", "f", "g"],
        });
        conv.fromString(rs).then((json) => {
            assert.equal(json[0].field7, 40);
            assert.equal(json[0].a, "CC102-PDMI-001");
            done();
        });
    });

    it("should parse fromFile", (done) => {
        const csvFile = __dirname + "/data/large-csv-sample.csv";
        const conv = new Converter({});
        conv.fromFile(csvFile).then((res) => {
            assert.equal(res.length, 5290);
            done();
        });
    });

    it("should parse fromFile with encoding option", (done) => {
        const csvFile = __dirname + "/data/dataWithLatin1Encoding";
        const conv = new Converter({});
        conv.fromFile(csvFile, { encoding: "latin1" }).then((json) => {
            assert.equal(json[0].Name, "bébé");
            done();
        });
    });

    it("should fromFile should emit error", (done) => {
        const csvFile = __dirname + "/data/dataWithUnclosedQuotes";
        const conv = new Converter({});
        conv.fromFile(csvFile).then(
            (res) => {
                done();
            },
            (err) => {
                assert(err);
                done();
            },
        );
    });

    it("should parse no header with dynamic column number", (done) => {
        const testData = __dirname + "/data/noheaderWithVaryColumnNum";
        const rs = fs.readFileSync(testData, "utf8");
        const conv = new Converter({
            noheader: true,
        });
        conv.fromString(rs).then((json) => {
            assert.equal(json.length, 2);
            assert.equal(json[1].field4, 7);
            done();
        });
    });

    it("should parse tabsv data with dynamic columns", (done) => {
        const testData = __dirname + "/data/tabsv";
        const rs = fs.readFileSync(testData, "utf8");
        const conv = new Converter({
            delimiter: "\t",
        });
        conv.fromString(rs).then((json) => {
            assert.equal(json[0].Idevise, "");
            done();
        });
    });

    it("should use first line break as eol", (done) => {
        const testData = __dirname + "/data/testEol";
        const conv = new Converter({
            noheader: true,
        });
        conv.fromFile(testData).then((json) => {
            assert(json);
            done();
        });
    });

    it("should detect delimiter", (done) => {
        const testData = __dirname + "/data/dataWithAutoDelimiter";
        const rs = fs.createReadStream(testData);
        const conv = new Converter({ delimiter: "auto" });
        conv.then((res) => {
            assert.equal(res[0].col1, "Mini. Sectt:hisar S.O");
            assert.equal(res[1].col1, "#Mini. Sectt");
            done();
        });
        rs.pipe(conv);
    });

    it("should emit delimiter event", (done) => {
        const testData = __dirname + "/data/dataWithAutoDelimiter";
        const rs = fs.createReadStream(testData);
        const conv = new Converter({ delimiter: "auto" });
        const delimiterCallback = sandbox.spy((delimiter) => {
            assert.equal(delimiter, ":");
        });
        conv.on("delimiter", delimiterCallback);
        conv.then(() => {
            assert.equal(delimiterCallback.callCount, 1);
            done();
        });
        rs.pipe(conv);
    });

    it("should emit delimiter event when no header", (done) => {
        const testData = __dirname + "/data/dataWithAutoDelimiter";
        const rs = fs.createReadStream(testData);
        const conv = new Converter({ delimiter: "auto", noheader: true });
        const delimiterCallback = sandbox.spy((delimiter) => {
            assert.equal(delimiter, ":");
        });
        conv.on("delimiter", delimiterCallback);
        conv.then(() => {
            assert.equal(delimiterCallback.callCount, 1);
            done();
        });
        rs.pipe(conv);
    });

    // it("should not emit delimiter event when delimiter is specified", function (done) {
    //   const testData = __dirname + "/data/columnArray";
    //   const rs = fs.createReadStream(testData);
    //   const conv = new Converter();
    //   conv.on("delimiter", function (delimiter) {
    //     assert.fail("delimiter event should not have been emitted");
    //   });
    //   conv.then(function () {
    //     done();
    //   });

    //   rs.pipe(conv);
    // });

    it("should stripe out whitespaces if trim is true", (done) => {
        const testData = __dirname + "/data/dataWithWhiteSpace";
        const rs = fs.createReadStream(testData);
        const conv = new Converter({ trim: true });
        conv.then((res) => {
            assert.equal(res[0]["Column 1"], "Column1Row1");
            assert.equal(res[0]["Column 2"], "Column2Row1");
            done();
        });
        rs.pipe(conv);
    });

    it("should convert triple quotes correctly", (done) => {
        const testData = __dirname + "/data/dataWithTripleQoutes";
        const rs = fs.createReadStream(testData);
        const conv = new Converter({ trim: true });
        conv.then((res) => {
            assert.equal(res[0].Description, "ac, abs, moon");
            assert.equal(res[1].Model, 'Venture "Extended Edition"');
            assert.equal(
                res[2].Model,
                'Venture "Extended Edition, Very Large"',
            );
            done();
        });
        rs.pipe(conv);
    });

    it("should pre process raw data in the line", (done) => {
        const testData = __dirname + "/data/quoteTolerant";
        const rs = fs.createReadStream(testData);
        const conv = new Converter();
        conv.preRawData((d) => d.replace("THICK", "THIN"));
        conv.then((res) => {
            assert(res[0].Description.indexOf("THIN") > -1);
            done();
        });
        rs.pipe(conv);
    });

    it("should pre process by line in the line", (done) => {
        const testData = __dirname + "/data/quoteTolerant";
        const rs = fs.createReadStream(testData);
        const conv = new Converter();
        conv.preFileLine((line, lineNumber) => {
            if (lineNumber === 1) {
                line = line.replace("THICK", "THIN");
            }
            return line;
        });

        conv.then((res) => {
            assert(res[0].Description.indexOf("THIN") > -1);
            done();
        });
        rs.pipe(conv);
    });

    it("should support object mode", (done) => {
        const testData = __dirname + "/data/complexJSONCSV";
        const rs = fs.createReadStream(testData);
        const conv = new Converter(
            {},
            {
                objectMode: true,
            },
        );
        conv.on("data", (d) => {
            assert(typeof d === "object");
        });
        conv.then((res) => {
            assert(res);
            assert(res.length > 0);
            done();
        });
        rs.pipe(conv);
    });

    it("should get delimiter automatically if there is no header", (done) => {
        const test_converter = new Converter({
            delimiter: "auto",
            headers: ["col1", "col2"],
            noheader: true,
            checkColumn: true,
        });

        const my_data = "first_val\tsecond_val";
        test_converter.fromString(my_data).then((result) => {
            assert.equal(result.length, 1);
            assert.equal(result[0].col1, "first_val");
            assert.equal(result[0].col2, "second_val");
            done();
        });
    });

    it("should process escape chars", (done) => {
        const test_converter = new Converter({
            escape: "\\",
            checkType: true,
        });

        const testData = __dirname + "/data/dataWithSlashEscape";
        const rs = fs.createReadStream(testData);
        test_converter.then((res) => {
            assert.equal(res[0].raw.hello, "world");
            assert.equal(res[0].raw.test, true);
            done();
        });
        rs.pipe(test_converter);
    });

    it("should process escape chars when delimiter is between escaped quotes", (done) => {
        const test_converter = new Converter({
            escape: "\\",
        });

        const testData =
            __dirname + "/data/dataWithSlashEscapeAndDelimiterBetweenQuotes";
        const rs = fs.createReadStream(testData);
        test_converter.then((res) => {
            assert.equal(res[0].raw, '"hello,"world"');
            done();
        });
        rs.pipe(test_converter);
    });

    it("should output ndjson format", (done) => {
        const conv = new Converter();
        conv.fromString("a,b,c\n1,2,3\n4,5,6")
            .on("data", (d) => {
                d = d.toString();
                assert.equal(d[d.length - 1], "\n");
            })
            .on("done", done);
    });

    it("should parse from stream", (done) => {
        const testData = __dirname + "/data/complexJSONCSV";
        const rs = fs.createReadStream(testData);
        csv()
            .fromStream(rs)
            .then((res) => {
                assert(res);
                done();
            });
    });

    it("should set output as csv", (done) => {
        const testData = __dirname + "/data/complexJSONCSV";
        const rs = fs.createReadStream(testData);
        const numOfRow = 0;
        csv({ output: "csv" })
            .fromStream(rs)
            .subscribe((row, idx) => {
                numOfRow++;
                assert(row);
                assert(idx >= 0);
            })

            .on("done", (error) => {
                assert(!error);
                assert.equal(2, numOfRow);
                assert(numOfRow !== 0);
                done();
            });
    });

    it("should transform with subscribe function", (done) => {
        const testData = __dirname + "/data/complexJSONCSV";
        const rs = fs.createReadStream(testData);
        const numOfRow = 0;
        const numOfJson = 0;
        csv()
            .fromStream(rs)
            .subscribe((json, idx) => {
                json.a = "test";
                assert(idx >= 0);
            })
            .on("data", (d) => {
                const j = JSON.parse(d.toString());
                assert.equal(j.a, "test");
            })
            .on("end", () => {
                done();
            });
    });

    it("should parse a complex JSON", (done) => {
        const converter = new Converter({ checkType: true });
        const r = fs.createReadStream(__dirname + "/data/complexJSONCSV");
        converter.then((res) => {
            assert(res);
            assert(res.length === 2);
            assert(res[0].fieldA.title === "Food Factory");
            assert(res[0].fieldA.children.length === 2);
            assert(res[0].fieldA.children[0].name === "Oscar");
            assert(res[0].fieldA.children[0].id === 23);
            assert(res[0].fieldA.children[1].name === "Tikka");
            assert.equal(res[0].fieldA.children[1].employee.length, 2);
            assert(
                res[0].fieldA.children[1].employee[0].name === "Tim",
                JSON.stringify(res[0].fieldA.children[1].employee[0]),
            );
            assert(res[0].fieldA.address.length === 2);
            assert(res[0].fieldA.address[0] === "3 Lame Road");
            assert(res[0].fieldA.address[1] === "Grantstown");
            assert(
                res[0].description === "A fresh new food factory",
                res[0].description,
            );
            done();
        });
        r.pipe(converter);
    });

    it("should allow flatKey to change parse behaviour", (done) => {
        const conv = new Converter({
            flatKeys: true,
        });
        conv.fromString("a.b,b.d,c.a\n1,2,3\n4,5,6")
            .subscribe((d) => {
                assert(d["a.b"]);
                assert(d["b.d"]);
                assert(d["c.a"]);
            })
            .on("done", done);
    });
    it("should allow flat mods to change parse behaviour", (done) => {
        const conv = new Converter({
            colParser: {
                "a.b": {
                    flat: true,
                },
            },
        });
        conv.fromString("a.b,b.d,c.a\n1,2,3\n4,5,6")
            .subscribe((d) => {
                assert(d["a.b"]);
            })
            .on("done", done);
    });

    it("should process long header", (done) => {
        const testData = __dirname + "/data/longHeader";
        const rs = fs.createReadStream(testData, { highWaterMark: 100 });
        const numOfRow = 0;
        const numOfJson = 0;
        csv({}, { highWaterMark: 100 })
            .fromStream(rs)
            .subscribe((res, idx) => {
                numOfJson++;
                assert.equal(res.Date, "8/26/16");
                assert(idx >= 0);
            })
            .on("done", () => {
                assert(numOfJson === 1);
                done();
            });
    });

    it("should parse #139", (done) => {
        const rs = fs.createReadStream(__dirname + "/data/data#139");
        csv()
            .fromStream(rs)
            .then((res) => {
                assert.equal(res[1].field3, "9001009395 9001009990");
                done();
            });
    });

    it("should ignore column", (done) => {
        const rs = fs.createReadStream(__dirname + "/data/dataWithQoutes");
        const headerEmitted = false;
        csv({
            ignoreColumns: /TIMESTAMP/,
        })
            .fromStream(rs)
            .on("header", (header) => {
                assert.equal(header.indexOf("TIMESTAMP"), -1);
                assert.equal(header.indexOf("UPDATE"), 0);
                if (headerEmitted) {
                    throw "header event should only happen once";
                }
                headerEmitted = true;
            })
            // .on("csv", function (row, idx) {
            //   if (!headerEmitted) {
            //     throw ("header should be emitted before any data events");
            //   }
            //   assert(idx >= 0);
            //   if (idx === 1) {
            //     assert.equal(row[0], "n");
            //   }
            // })
            .subscribe((j, idx) => {
                assert(!j.TIMESTAMP);
                assert(idx >= 0);
            })
            .on("done", () => {
                assert(headerEmitted);
                done();
            });
    });
    it("should keep space around comma in csv", () => {
        const str = `"Name","Number"
    "John , space", 1234
    "Mr. , space", 4321
    `;
        return csv()
            .fromString(str)
            .then((data) => {
                assert.equal(data[0].Name, "John , space");
                assert.equal(data[1].Name, "Mr. , space");
            });
    });

    it("should include column", (done) => {
        const rs = fs.createReadStream(__dirname + "/data/dataWithQoutes");
        csv({
            includeColumns: /TIMESTAMP/,
        })
            .fromStream(rs)
            .on("header", (header) => {
                assert.equal(header.indexOf("TIMESTAMP"), 0);
                assert.equal(header.indexOf("UPDATE"), -1);
                assert.equal(header.length, 1);
            })
            .subscribe((j, idx) => {
                assert(idx >= 0);
                if (idx === 1) {
                    assert.equal(j.TIMESTAMP, "abc, def, ccc");
                }
                assert(!j.UID);
                assert(!j["BYTES SENT"]);
            })
            .on("done", () => {
                done();
            });
    });

    it("should allow headers and include columns to be given as reference to the same var", (done) => {
        const rs = fs.createReadStream(__dirname + "/data/complexJSONCSV");
        const headers = ["first", "second", "third"];

        const expected = headers;

        csv({
            headers: headers,
            includeColumns: /(first|second|third)/,
        })
            .fromStream(rs)
            .on("header", (header) => {
                expected.forEach((value, index) => {
                    assert.equal(header.indexOf(value), index);
                });
            })
            .subscribe((j, idx) => {
                assert(idx >= 0);
                assert.equal(expected.length, Object.keys(j).length);
                expected.forEach((attribute) => {
                    assert(j.hasOwnProperty(attribute));
                });
            })
            .on("done", () => {
                done();
            });
    });

    it("should leave provided params objects unmutated", () => {
        const rs = fs.createReadStream(__dirname + "/data/complexJSONCSV");
        const includeColumns = ["fieldA.title", "description"];

        return csv({
            includeColumns: /(fieldA\.title|description)/,
        })
            .fromStream(rs)
            .on("json", (j, idx) => {
                assert(idx >= 0);
            })
            .on("header", (header) => {
                includeColumns.forEach((value, index) => {
                    assert.equal(index, header.indexOf(value));
                });
            });
    });

    it("should only call done once", (done) => {
        const counter = 0;
        csv()
            .fromString('"a","b", "c""')
            .on("done", () => {
                counter++;
            });
        setTimeout(() => {
            assert.equal(counter, 1);
            done();
        }, 100);
    });
});
