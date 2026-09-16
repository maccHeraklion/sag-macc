import { parseTagoData } from "./parse-tago-data";

describe("parseTagoData", () => {
  it("return null when tagoData is null", () => {
    const result = parseTagoData(null);
    expect(result).toEqual({ series: [], labels: [] });
  });

  it("return an empty array when result is empty", () => {
    const result = parseTagoData([{ result: [] }]);
    expect(result).toEqual({ series: [], labels: [] });
  });

  it("return an empty array when tagoData is empty", () => {
    const result = parseTagoData([]);
    expect(result).toEqual({ series: [], labels: [] });
  });

  it("return an array with the correct values", () => {
    const result = parseTagoData([
      {
        result: [
          {
            variable: "bin_chart",
            group: "binID",
            value: "binName",
            time: new Date().toISOString(),
            metadata: {
              "2023-10-05T12:19:30.269Z": 10,
              "2023-10-05T12:20:30.269Z": 11,
              "2023-10-05T12:21:30.269Z": 12,
              "2023-10-05T14:57:30.269Z": 98,
              "2023-10-05T14:58:30.269Z": 99,
              "2023-10-05T14:59:30.269Z": 100,
            },
          },
        ],
      },
    ]);

    expect(result.labels).toStrictEqual(["binName"]);
    expect(result.series[0]).toStrictEqual({
      data: [
        ["2023-10-05T12:19:30.269Z", 10],
        ["2023-10-05T12:20:30.269Z", 11],
        ["2023-10-05T12:21:30.269Z", 12],
        ["2023-10-05T14:57:30.269Z", 98],
        ["2023-10-05T14:58:30.269Z", 99],
        ["2023-10-05T14:59:30.269Z", 100],
      ],
      name: "binName",
      type: "line",
    });
  });
});
