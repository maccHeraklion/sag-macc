import "@tago-io/custom-widget";
import "@tago-io/custom-widget/dist/custom-widget.css";

import { useEffect, useState } from "react";

import { IBarParams, parseTagoParams } from "./Helpers/parse-params";
import { ParsedData, parseTagoData } from "./Helpers/parse-tago-data";
import { parseUserSettings, userData } from "./Helpers/parse-user";
import { BarChart } from "./Widget";

/**
 * Widget view component.
 *
 * Responsible for managing state and synchronizing the internal state for the custom widget's
 * data with TagoIO (Admin and RUN), and also for providing callbacks for the presentational
 * component to use the functions from the Custom Widget Library.
 *
 * This separation of concerns makes it easier to test the widget and leaving some state (e.g. UI state, etc.)
 * in the presentational component and its sub-components.
 */
function WidgetView() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [params, setParams] = useState<IBarParams>({ horizontal: false, xlabel: "", ylabel: "" });
  const [user, setUser] = useState<userData>({ timezone: "Europe/Athens", dateFormat: "", timeFormat: "" }); // [QW-6] Greek default TZ

  useEffect(() => {
    // Start communication with TagoIO Admin/RUN.
    window.TagoIO.ready();

    window.TagoIO.onStart((widgetInfo: any) => {
      const parsedParams = parseTagoParams(widgetInfo.display?.parameters);
      const parsedUserSettings = parseUserSettings(widgetInfo.display?.user);
      setParams(parsedParams);
      setUser(parsedUserSettings);
    });

    // Receive the widget's data and realtime data updates.
    // For more control over updating the state, the callback passed to `onRealtime` can check if
    // the data has changed before updating the state to avoid re-rendering unnecessarily.
    window.TagoIO.onRealtime((data: any) => {
      const parsedData = parseTagoData(data);
      setData(parsedData);
    });
  }, []);

  if (!data) return null;

  return <BarChart data={data} params={params} user={user} />;
}

export { WidgetView };
