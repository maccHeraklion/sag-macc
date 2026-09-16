import { parseTagoParams } from "./parse-params";

describe("parseTagoParams", () => {
  it("return null when paramsis null", () => {
    const result = parseTagoParams(null);
    expect(result).toEqual({ horizontal: false, xlabel: "", ylabel: "" });
  });

  it("return an empty json when result is empty", () => {
    const result = parseTagoParams([{ key: "any", value: "lala" }]);
    expect(result).toEqual({ horizontal: false, xlabel: "", ylabel: "" });
  });

  it("return an empty json when tagoData is empty", () => {
    const result = parseTagoParams([]);
    expect(result).toEqual({ horizontal: false, xlabel: "", ylabel: "" });
  });

  it.skip("return data with expected results", () => {
    const tagoData = [
      { key: "horizontal", value: "true" },
      { key: "xlabel", value: "x" },
      { key: "ylabel", value: "y" },
    ];
    const result = parseTagoParams(tagoData);
    expect(result).toEqual({ horizontal: true, xlabel: "x", ylabel: "y" });
  });
});
