#!/usr/bin/env node
const minimist = require("minimist");
const argv = process.argv;
argv.shift();
argv.shift();
const args = minimist(argv);
const headers = [
    "name",
    "header1",
    "file2",
    "description",
    "header2",
    "field2",
    "header3",
];

if (args.headers) {
    headers = JSON.parse(args.headers);
}
const rowNum = args.row ? args.row : 10000;
const chars = args.chars
    ? args.chars
    : "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
const maxLength = Number.parseInt(args.max ? args.max : "15");
console.log(headers.join(","));
for (const i = 0; i < rowNum; i++) {
    const row = [];
    for (const j = 0; j < headers.length; j++) {
        row.push(genWord());
    }
    console.log(row.join(","));
}

function genWord() {
    const len = Math.round(Math.random() * maxLength);
    const rtn = "";
    for (const i = 0; i < len; i++) {
        const pos = Math.round(Math.random() * chars.length);
        rtn += chars[pos];
    }
    return rtn;
}
