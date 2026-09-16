/**
 * Dataset format for the runPerTich browser simulator.
 *
 * Users can either:
 *  a) Click "Use sample data" to load the built-in generated dataset.
 *  b) Upload a JSON file matching this schema (e.g. exported from TagoIO).
 *
 * The simulator feeds this data into the mocked TagoIO SDK so that
 * runPerTich.js behaves as if it is running against a real field.
 */

export interface DataPoint {
  /** ISO 8601 timestamp, e.g. "2024-03-01T08:00:00Z" */
  time: string;
  value: number;
  unit?: string;
}

export interface DeviceDataset {
  /** TagoIO device id (used to match Resources.devices.list() results) */
  id: string;
  /** Human-readable name */
  name: string;
  /**
   * Device type tag value — must match a key in DEVICE_TYPE_VARIABLES.
   * e.g. "s2120", "se0x", "lse02", "lse01", "lms01_ls", "em300_th"
   */
  type: string;
  /** Sensor readings keyed by variable name */
  data: Record<string, DataPoint[]>;
}

export interface FieldDataset {
  /** Unique field id */
  fieldId: string;
  /** Human-readable field name */
  fieldName: string;
  /** Crop type — must match a key in CROP_PROFILE, e.g. "olive", "wine_grapes" */
  cropType: string;
  /** ISO start of the simulation window */
  startTime: string;
  /** ISO end of the simulation window */
  endTime: string;
  /** All sensor devices attached to this field */
  devices: DeviceDataset[];
}
