export interface IBarParams {
  horizontal: boolean;
  ylabel: string;
  xlabel: string;
  [key: string]: string | boolean;
}

/**
 * Normalize Data from TagoIO to the EChart format
 * @param tagoData
 * @returns
 */
function parseTagoParams(tagoParams: { key: string; value: string }[] | null): IBarParams {
  const chartParams: IBarParams = { horizontal: false, xlabel: "", ylabel: "" };
  if (!tagoParams) {
    return chartParams;
  }
  // for (const key in chartParams) {
  //   const param = tagoParams.find((param) => param.key === key);
  //   if (!param) {
  //     continue;
  //   }

  //   if (key === "horizontal") {
  //     chartParams.horizontal = param.value === "true" ? true : false;
  //   } else {
  //     chartParams[key] = param.value;
  //   }
  // }

  return chartParams;
}

export { parseTagoParams };
