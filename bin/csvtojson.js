function csvtojson() {
    const Converter = require("../v2").Converter;
    const fs = require("node:fs");
    const { commands, options, examples } = require("./options.json");
    const pkg = require("../package.json");
    const { EOL } = require("node:os");

    /**
     * {
     *   "cmd": "parse", command to run
     *   "options": {}, options to pass to the command
     *   "inputStream": process.stdin // input stream for the command. default is stdin. can be a file read stream.
     * }
     */

    function _showHelp(errno) {
        process.stdout.write(`csv2json: Convert csv to JSON format${EOL}`);
        process.stdout.write(`version: ${pkg.version}${EOL}`);
        process.stdout.write(
            `Usage: csv2json [<command>] [<options>] filepath${EOL}`,
        );

        if (commands?.length) {
            process.stdout.write(`Commands: ${EOL}`);
            for (const [key, value] of Object.entries(commands)) {
                process.stdout.write(`\t${key}: ${value}${EOL}`);
            }
        }

        if (options?.length) {
            process.stdout.write(`Options: ${EOL}`);
            for (const [key, value] of Object.entries(options)) {
                process.stdout.write(`\t${key}: ${value.desc}${EOL}`);
            }
        }
        if (examples?.length) {
            process.stdout.write(`Examples: ${EOL}`);
            for (const exp of examples) {
                process.stdout.write(`\t${exp}${EOL}`);
            }
        }

        process.exit(typeof errno === "number" ? errno : 0);
    }
    function stringToRegExp(str) {
        const lastSlash = str.lastIndexOf("/");
        const source = str.substr(1, lastSlash);
        const flag = str.substr(lastSlash + 1);
        return new RegExp(source, flag);
    }
    function parse() {
        const is = parsedCmd.inputStream;
        if (parsedCmd.options.maxRowLength === undefined) {
            parsedCmd.options.maxRowLength = 10240;
        }
        if (is === process.stdin && is.isTTY) {
            process.stdout.write(
                `Please specify csv file path or pipe the csv data through.${EOL}`,
            );
            _showHelp(1);
        }
        if (parsedCmd.options.delimiter === "\\t") {
            parsedCmd.options.delimiter = "\t";
        }
        if (parsedCmd.options.ignoreColumns) {
            parsedCmd.options.ignoreColumns = stringToRegExp(
                parsedCmd.options.ignoreColumns,
            );
        }
        if (parsedCmd.options.includeColumns) {
            parsedCmd.options.includeColumns = stringToRegExp(
                parsedCmd.options.includeColumns,
            );
        }
        const conv = new Converter(parsedCmd.options);
        let isFirst = true;

        conv.on("error", (err, pos) => {
            if (!parsedCmd.options.quiet) {
                process.stdout.write(`csvtojson got an error: ${EOL}`, err);

                if (pos) {
                    process.stdout.write(
                        `The error happens at following line: ${EOL}${pos}${EOL}`,
                    );
                }
            }
            process.exit(1);
        })
            .on("data", (dataStr) => {
                process.stdout.write(
                    (isFirst ? "" : `,${EOL}`) +
                        dataStr.toString().substring(0, dataStr.length - 1),
                );
                isFirst = false;
            })
            .on("done", () => {
                process.stdout.write(`${EOL}]${EOL}`);
            });

        process.stdout.write(`[${EOL}`);
        is.pipe(conv);
        // is.pipe(conv);
    }

    function run(cmd, options) {
        if (cmd === "parse") {
            parse();
        } else if (cmd === "version") {
            process.stdout.write(`${pkg.version}${EOL}`);
        } else {
            process.stdout.write(`unknown command ${cmd}.${EOL}`);
            _showHelp(1);
        }
    }

    function commandParser() {
        const parsedCmd = {
            cmd: "parse",
            options: {},
            inputStream: process.stdin,
        };

        function parseObject(val, optional) {
            try {
                return JSON.parse(val);
            } catch (e) {
                if (optional) return val;

                process.stdout.write(e);
                process.exit(1);
            }
        }

        function parseBool(str, optName) {
            const trueValues = new Set(["true", "yes", "on", "1"]);

            return trueValues.has(str.toLowerCase());
        }

        for (const item of process.argv.slice(2)) {
            if (item.indexOf("--") > -1) {
                const itemArr = item.split("=");
                const optName = itemArr[0];

                if (!options[optName]) {
                    process.stdout.write(
                        `Option ${optName} not supported.${EOL}`,
                    );
                    _showHelp(1);
                }

                const key = optName.replace("--", "");
                const val = itemArr[1] || "";
                const type = options[optName].type;

                if (type === "string") {
                    parsedCmd.options[key] = val.toString();
                } else if (type === "boolean") {
                    parsedCmd.options[key] = parseBool(val, optName);
                } else if (type === "number") {
                    parsedCmd.options[key] = Number.parseFloat(val);
                } else if (type === "object") {
                    parsedCmd.options[key] = parseObject(val, false);
                } else if (type === "~object") {
                    parsedCmd.options[key] = parseObject(val, true);
                } else {
                    throw {
                        name: "UnimplementedException",
                        message:
                            "Option type parsing not implemented. See bin/options.json",
                    };
                }
            } else if (commands[item]) {
                parsedCmd.cmd = item;
            } else if (fs.existsSync(item)) {
                parsedCmd.inputStream = fs.createReadStream(item);
            } else {
                process.stdout.write(`unknown parameter ${item}${EOL}`);
            }
        }

        return parsedCmd;
    }

    process.stdin.setEncoding("utf8");
    const parsedCmd = commandParser();
    run(parsedCmd.cmd, parsedCmd.options);
}

module.exports = csvtojson;
if (!module.parent) {
    csvtojson();
}
