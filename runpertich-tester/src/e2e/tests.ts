/**
 * E2E test suite for runPerTich.js
 *
 * Each test receives the raw source code string and returns { passed, message }.
 *
 * Phase 1: Structural checks — verify expected functions and constants exist.
 * Phase 2 (TODO): Execution checks — actually run calculations with known inputs
 *   and assert expected outputs once the require() shim is wired up.
 */

import type { TestCase } from "./runner";

// ── helpers ─────────────────────────────────────────────────────────────────

function containsFunction(code: string, name: string): boolean {
  // matches: function name(, const name =, async function name(
  return new RegExp(
    `(function\\s+${name}\\s*\\()|(const\\s+${name}\\s*=)|(async\\s+function\\s+${name}\\s*\\()`
  ).test(code);
}

function containsConstant(code: string, name: string): boolean {
  return new RegExp(`(const|let|var)\\s+${name}\\s*=`).test(code);
}

function pass(): { passed: true; message: "" } {
  return { passed: true, message: "" };
}

function fail(msg: string): { passed: false; message: string } {
  return { passed: false, message: msg };
}

// ── test cases ───────────────────────────────────────────────────────────────

export const tests: TestCase[] = [
  // ── Structure ──────────────────────────────────────────────────────────────

  {
    name: "Code is not empty",
    description: "runPerTich.js must contain at least 100 characters of code",
    run: async (code) => {
      if (code.trim().length < 100) return fail("Code appears to be empty or too short");
      return pass();
    },
  },

  {
    name: "Uses @tago-io/sdk",
    description: "Must import the TagoIO SDK (Analysis, Resources, Utils)",
    run: async (code) => {
      if (!code.includes("@tago-io/sdk")) return fail('Missing require("@tago-io/sdk")');
      return pass();
    },
  },

  // ── Core calculation functions ─────────────────────────────────────────────

  {
    name: "calculate_VPD exists",
    description: "Vapor Pressure Deficit calculation function must be defined",
    run: async (code) => {
      if (!containsFunction(code, "calculate_VPD")) return fail("calculate_VPD not found");
      return pass();
    },
  },

  {
    name: "calculate_IPSI exists",
    description: "Irrigation/Plant Stress Index calculation function must be defined",
    run: async (code) => {
      if (!containsFunction(code, "calculate_IPSI")) return fail("calculate_IPSI not found");
      return pass();
    },
  },

  {
    name: "calculate_BPI exists",
    description: "Biophysical Productivity Index calculation function must be defined",
    run: async (code) => {
      if (!containsFunction(code, "calculate_BPI")) return fail("calculate_BPI not found");
      return pass();
    },
  },

  {
    name: "calculate_GDD exists",
    description: "Growing Degree Days calculation function must be defined",
    run: async (code) => {
      if (!containsFunction(code, "calculate_GDD")) return fail("calculate_GDD not found");
      return pass();
    },
  },

  {
    name: "calculate_FIR exists",
    description: "Field Infection Risk calculation function must be defined",
    run: async (code) => {
      if (!containsFunction(code, "calculate_FIR")) return fail("calculate_FIR not found");
      return pass();
    },
  },

  {
    name: "calculate_InfectionHours exists",
    description: "Infection hours counter function must be defined",
    run: async (code) => {
      if (!containsFunction(code, "calculate_InfectionHours"))
        return fail("calculate_InfectionHours not found");
      return pass();
    },
  },

  // ── Configuration constants ────────────────────────────────────────────────

  {
    name: "CROP_PROFILE defined",
    description: "Crop profile configuration object must be present",
    run: async (code) => {
      if (!containsConstant(code, "CROP_PROFILE")) return fail("CROP_PROFILE not found");
      return pass();
    },
  },

  {
    name: "PATHOGEN_PROFILE defined",
    description: "Pathogen profile configuration object must be present",
    run: async (code) => {
      if (!containsConstant(code, "PATHOGEN_PROFILE")) return fail("PATHOGEN_PROFILE not found");
      return pass();
    },
  },

  {
    name: "DEVICE_TYPE_VARIABLES defined",
    description: "Device-type to sensor variable mapping must be present",
    run: async (code) => {
      if (!containsConstant(code, "DEVICE_TYPE_VARIABLES"))
        return fail("DEVICE_TYPE_VARIABLES not found");
      return pass();
    },
  },

  {
    name: "FIELD_BUNDLE_VAR defined",
    description: "The field_bundle variable name constant must be declared",
    run: async (code) => {
      if (!containsConstant(code, "FIELD_BUNDLE_VAR")) return fail("FIELD_BUNDLE_VAR not found");
      return pass();
    },
  },

  // ── Error propagation ─────────────────────────────────────────────────────

  {
    name: "Error propagation: vpdError passed to calculate_IPSI",
    description:
      "calculate_IPSI must accept an upstream error argument to propagate VPD failure",
    run: async (code) => {
      // Look for vpdError being passed as an argument in the IPSI call
      if (!code.includes("vpdError")) return fail("vpdError not referenced in code");
      return pass();
    },
  },

  {
    name: "Error propagation: ipsiError passed to calculate_BPI",
    description:
      "calculate_BPI must accept an upstream error argument to propagate IPSI failure",
    run: async (code) => {
      if (!code.includes("ipsiError")) return fail("ipsiError not referenced in code");
      return pass();
    },
  },

  // ── field_bundle packing ───────────────────────────────────────────────────

  {
    name: "packCalculatedIndicators exists",
    description: "field_bundle packing function must be defined",
    run: async (code) => {
      if (!containsFunction(code, "packCalculatedIndicators"))
        return fail("packCalculatedIndicators not found");
      return pass();
    },
  },

  // ── Timing logic ──────────────────────────────────────────────────────────

  {
    name: "hourTich logic present",
    description: "Hourly tick gate must be implemented (55 min threshold)",
    run: async (code) => {
      if (!code.includes("hourTich")) return fail("hourTich not referenced");
      return pass();
    },
  },

  {
    name: "dailyTich logic present",
    description: "Daily tick gate must be implemented (≈24 h threshold)",
    run: async (code) => {
      if (!code.includes("dailyTich")) return fail("dailyTich not referenced");
      return pass();
    },
  },

  // ── TODO: Execution tests (Phase 2) ───────────────────────────────────────
  // These will be added once the require() shim is wired up.
  // Template for a future execution test:
  //
  // {
  //   name: "VPD calculation — known inputs",
  //   description: "calculate_VPD(25°C, 60%RH) should return ~1.27 kPa",
  //   run: async (code) => {
  //     const { calculate_VPD } = await loadModule(code);
  //     const result = calculate_VPD({ air_temperature: 25, air_humidity: 60 });
  //     const expected = 1.27;
  //     if (Math.abs(result.vpdData - expected) > 0.05)
  //       return fail(`Expected ~${expected} kPa, got ${result.vpdData}`);
  //     return pass();
  //   },
  // },
];
