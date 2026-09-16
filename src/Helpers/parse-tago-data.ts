import { TagoData } from "~/types";

type assetName = string;
export interface ParsedData {
  series: {
    name: assetName;
    type: string; /// line
    data: [string, number][];
  }[];

  labels: string[];
}

/**
 * Normalize Data from TagoIO to the EChart format
 * @param tagoData
 * @returns
 */
function parseTagoData(tagoData: TagoData[] | null): ParsedData {
  const allChartData: ParsedData = { series: [], labels: [] };

  if (!tagoData || tagoData.length === 0) {
    return allChartData;
  }

  const dataList = tagoData
    .map((item) => item.result)
    .flat()
    .filter((x) => x.metadata);

  // check if the key is a valid ISO date
  const filterISOKeys = (key: string) => {
    const date = new Date(key);
    return date instanceof Date && !isNaN(date.getTime());
  };

  for (const item of dataList) {
    if (!item.metadata) {
      continue;
    }

    const seriesData = {
      name: item.value as string,
      type: "line",
      data: Object.keys(item.metadata)
        .filter(filterISOKeys)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .map((key) => [key, item.metadata?.[key]] as [string, number]),
    };

    allChartData.series.push(seriesData);
    allChartData.labels.push(item.value as string);
  }

  return allChartData;
}

export { parseTagoData };
