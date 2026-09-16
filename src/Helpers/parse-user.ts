export interface userData {
  timezone: string;
  dateFormat: string;
  timeFormat: string;
}

/**
 * Normalize Data from TagoIO to the EChart format
 * @param tagoData
 * @returns
 */
function parseUserSettings(userParams: any): userData {
  // [QW-6 legacy-handoff] Greek app: default to Europe/Athens + Greek date order, not America/New_York.
  const userInfo: userData = { timezone: "Europe/Athens", dateFormat: "DD/MM/YYYY", timeFormat: "24" };

  if (userParams) {
    if (userParams.timezone) {
      userInfo.timezone = userParams.timezone;
    }
    if (userParams.options?.date_format) {
      userInfo.dateFormat = userParams.options.date_format;
    }
    if (userParams.options?.time_format) {
      userInfo.timeFormat = userParams.options.time_format;
    }
  }

  userInfo.dateFormat = userInfo.dateFormat.replace("YYYY", "yyyy").replace("DD", "dd");
  // [QW-6 legacy-handoff] Restore the time-format mapping (was commented out, leaving raw "12"/"24").
  userInfo.timeFormat = userInfo.timeFormat === "24" ? "HH:mm" : "hh:mm a";

  return userInfo;
}

export { parseUserSettings };
