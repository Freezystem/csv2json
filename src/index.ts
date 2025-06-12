import type { TransformOptions } from "node:stream";
import { Converter } from "./Converter";
import type { CSVParseParam } from "./Parameters";

export const helper = (
    param?: Partial<CSVParseParam>,
    options?: TransformOptions,
): Converter => new Converter(param, options);

helper.csv = helper;
helper.Converter = Converter;
