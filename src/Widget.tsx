import * as echarts from "echarts";
import { DateTime } from "luxon";
import { useEffect, useRef } from "react";

import { IBarParams } from "./Helpers/parse-params";
import { ParsedData } from "./Helpers/parse-tago-data";
import { userData } from "./Helpers/parse-user";

type BarChartProps = {
  data: ParsedData;
  params: IBarParams;
  user: userData;
};

/**
 * Construct a pie chart from EChart Library
 * @param props
 * @returns
 */
function BarChart(props: BarChartProps) {
  const { data, user } = props;
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const hours = user.timeFormat === "24" ? "HH" : "hh";
  const amPm = user.timeFormat === "24" ? "" : "a";
  const dateLuxonFormat = user.dateFormat?.replace("DD", "dd").replace("YYYY", "yyyy") + " " + hours + ":mm:ss " + amPm;

  data.series = data.series.map((serie) => ({
    ...serie,
    data: serie.data.map((item) => {
      const date = DateTime.fromISO(item[0]).setZone(user.timezone).toISO() as string;
      return [date, item[1]];
    }),
  }));

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.dispose();
      }

      const chart = echarts.init(chartRef.current);
      chartInstance.current = chart;

      const options: echarts.EChartsOption = {
        tooltip: {
          textStyle: {
            fontSize: 12,
            lineHeight: 13,
            fontWeight: "normal",
            color: "#000000",
          },
          trigger: "axis",
          axisPointer: {
            type: "line",
          },
          formatter: function (params: any) {
            const data = params[0].data;
            const dateTime = DateTime.fromISO(data[0], { zone: user.timezone });

            const luxonTime = dateTime.toFormat(dateLuxonFormat);

            const timeElement = `<div>${luxonTime}</div>`;

            const seriesElements = params.map((param: any) => {
              const marker = param.marker;
              const value = param.data[1];
              return `<div style="display: flex; justify-content: space-between; gap: 10px;">
                <div>${marker} ${param.seriesName}</div>
                <div>${value}</div>
              </div>`;
            });

            const tooltipContent = `<div style="display: flex; flex-direction: column;">
              ${timeElement}
              ${seriesElements.join("")}
            </div>`;

            return tooltipContent;
          },
          displayMode: "single",
          show: true,
          renderMode: "auto",
          borderRadius: 3,
          borderWidth: 2,
        },
        legend: {
          data: data.labels,
          orient: "horizontal",
          bottom: 45,
          left: "center", // This centers the legend at the bottom,
          icon: "pin",
        },
        xAxis: {
          type: "time",
          // data: data.labels,
          // name: "Time",
          // boundaryGap: false, // This ensures the line touches the x-axis
          nameTextStyle: {
            fontStyle: "normal",
            fontWeight: "bolder",
          },
          axisLabel: {
            // Format the date
            formatter: function (value) {
              const dateTime = String(DateTime.fromMillis(value));

              const dateFormat = hours + ":mm";
              const time = DateTime.fromISO(dateTime, {
                zone: user.timezone,
              }).toFormat(dateFormat);
              return time;
            },
          },
        },
        yAxis: {
          type: "value",
          // name: "Bin Level",
          nameTextStyle: {
            fontStyle: "normal",
            fontWeight: "normal",
          },
          splitLine: {
            lineStyle: {
              color: "#c3c3c3",
            },
          },
        },
        grid: {
          top: "10%",
          left: "3%",
          right: "4%",
          bottom: "26%",
          containLabel: true,
        },
        dataZoom: [
          {
            type: "slider",
            textStyle: { width: 77, overflow: "break", fontSize: 10 },
            xAxisIndex: [0], // This applies the zoom to the first (and in this case, the only) x-axis.
            start: 0, // Initial start percentage
            end: 100, // Initial end percentage
            labelFormatter: (value) => {
              const date = DateTime.fromMillis(value, {
                zone: user.timezone,
              });
              if (!date.isValid) {
                return "";
              }
              return date.toFormat(dateLuxonFormat);
            },
          },
        ],
        series: data.series as any,
      };

      chart.setOption(options);

      const handleResize = () => {
        chart.resize();
      };

      window.addEventListener("resize", handleResize);

      return () => {
        if (chartInstance.current) {
          chartInstance.current.dispose();
        }
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [data, chartRef, user.timeFormat, user.dateFormat, user.timezone, dateLuxonFormat, hours]);

  return (
    <div style={{ width: "100%", height: "90vh" }}>
      <div ref={chartRef} style={{ width: "100%", height: "100%" }}></div>
    </div>
  );
}

export { BarChart };
