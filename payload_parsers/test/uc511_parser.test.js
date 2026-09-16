/**
 * Tests for uc511_parser.js — UC51x LoRaWAN Solenoid Valve Controller
 *
 * All expected payloads are derived exclusively from the official Milesight
 * communication protocol documents:
 *
 *   HW v4.x:  UC51x Series Communication Protocol (Doc V4.1, Jan 2025)
 *   HW v1-3:  UC51x v3 Series Communication Protocol (Doc V3.0, Mar 2023)
 *
 * The tests call parser functions with realistic inputs and compare the
 * resulting hex strings to the exact byte sequences specified in those docs.
 *
 * If a test fails the implementation diverges from the protocol spec —
 * fix the implementation, not the test.
 */

"use strict";

process.env.UC511_PARSER_TEST_MODE = "true";
// Jest moduleNameMapper in package.json routes @tago-io/sdk → sdk-mock.js
const { buildDownlink, parseHwMajor } = require("../uc511_parser");

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Build the minimal scope array that buildDownlink expects. */
function makeScope(pairs) {
  return pairs.map(([variable, value]) => ({ variable, value: String(value) }));
}

const noLog = { log: () => {} };
const hwV4   = { raw: "v4.1", major: 4 };
const hwV3   = { raw: "v3.0", major: 3 };
const hwNull = { raw: null,   major: null };

function downlinkHex(scope, hw = hwV4) {
  const result = buildDownlink(scope, hw, noLog);
  if (!result) return null;
  return result.payload_raw.toLowerCase();
}

// ─── parseHwMajor ─────────────────────────────────────────────────────────────

describe("parseHwMajor", () => {
  test.each([
    ["v4.1",  4],
    ["v4.0",  4],
    ["v3.0",  3],
    ["V3",    3],
    ["4",     4],
    ["1.2",   1],
    ["",      null],
    [null,    null],
    ["abc",   null],
  ])('parseHwMajor("%s") → %s', (input, expected) => {
    expect(parseHwMajor(input)).toBe(expected);
  });
});

// ─── Valve Control (cmd: "valve") ────────────────────────────────────────────
//
// Protocol reference (both v3 and v4, section 3.1 Valve Control):
//
//   Format: ff  1d  <Control Field>  <Sequence>  [<Time 3B LE>]  [<Flow 4B LE>]
//
//   Control Field (1 byte):
//     Bit 7 : 1 = enable time control,  0 = disable
//     Bit 6 : 1 = enable flow control,  0 = disable
//     Bit 5 : 1 = valve open,           0 = valve close
//     Bit 4-2: 000 (reserved)
//     Bit 1-0: 00 = valve 1,  01 = valve 2
//
//   Sequence: 1 byte (01–ff for tracked commands, 00 = untracked)
//
// Doc examples (sequence = 00 in all examples):
//   Open valve 2 immediately          → ff 1d 21 00
//   Open valve 1 for 60 s             → ff 1d a0 00 3c 00 00
//   Open valve 2 / 16 pulses          → ff 1d 61 00 10 00 00 00
//   Open valve 1 / 60 s or 6 pulses   → ff 1d e0 00 3c 00 00 06 00 00 00

describe("valve command — Control Field encoding (v4 and v3, protocol §3.1)", () => {

  describe("immediate open/close (no time, no flow)", () => {

    test("open valve 1 → ff1d2000 (control=0x20: bit5=open, bits0-1=valve1)", () => {
      const scope = makeScope([
        ["cmd", "valve"],
        ["valve", "1"],
        ["operation", "1"],   // 1 = open
      ]);
      // Control Field 0x20 = 0010 0000
      //   bit5 = 1 (open), bits0-1 = 00 (valve 1)
      expect(downlinkHex(scope)).toBe("ff1d2000");
    });

    test("open valve 2 → ff1d2100 (control=0x21: bit5=open, bits0-1=valve2)", () => {
      const scope = makeScope([
        ["cmd", "valve"],
        ["valve", "2"],
        ["operation", "1"],
      ]);
      // Control Field 0x21 = 0010 0001
      //   bit5 = 1 (open), bits0-1 = 01 (valve 2)
      expect(downlinkHex(scope)).toBe("ff1d2100");
    });

    test("close valve 1 → ff1d0000 (control=0x00: bit5=close, bits0-1=valve1)", () => {
      const scope = makeScope([
        ["cmd", "valve"],
        ["valve", "1"],
        ["operation", "0"],   // 0 = close
      ]);
      // Control Field 0x00 = 0000 0000
      expect(downlinkHex(scope)).toBe("ff1d0000");
    });

    test("close valve 2 → ff1d0100 (control=0x01: bit5=close, bits0-1=valve2)", () => {
      const scope = makeScope([
        ["cmd", "valve"],
        ["valve", "2"],
        ["operation", "0"],
      ]);
      // Control Field 0x01 = 0000 0001
      expect(downlinkHex(scope)).toBe("ff1d0100");
    });

  });

  describe("timed open (time control, no flow)", () => {

    test("open valve 1 for 60 s → ff1da0003c0000 (doc example §3.1 ex. 2)", () => {
      // Control Field 0xa0 = 1010 0000
      //   bit7 = 1 (time enabled), bit5 = 1 (open), bits0-1 = 00 (valve 1)
      // Time = 60 s → 3c 00 00 (3-byte LE)
      const scope = makeScope([
        ["cmd", "valve"],
        ["valve", "1"],
        ["operation", "1"],
        ["timed_close", "1"],
        ["duration_sec", "60"],
        ["flow_ctrl", "0"],
      ]);
      expect(downlinkHex(scope)).toBe("ff1da0003c0000");
    });

  });

  describe("flow-controlled open (flow control, no time)", () => {

    test("open valve 2 until 16 pulses → ff1d610010000000 (doc example §3.1 ex. 3)", () => {
      // Control Field 0x61 = 0110 0001
      //   bit6 = 1 (flow enabled), bit5 = 1 (open), bits0-1 = 01 (valve 2)
      // Flow = 16 pulses → 10 00 00 00 (4-byte LE)
      const scope = makeScope([
        ["cmd", "valve"],
        ["valve", "2"],
        ["operation", "1"],
        ["timed_close", "0"],
        ["duration_sec", "0"],
        ["flow_ctrl", "1"],
        ["pulses", "16"],
      ]);
      expect(downlinkHex(scope)).toBe("ff1d610010000000");
    });

  });

  describe("combined time + flow control", () => {

    test("open valve 1 until 60 s OR 6 pulses → ff1de0003c000006000000 (doc example §3.1 ex. 4)", () => {
      // Control Field 0xe0 = 1110 0000
      //   bit7 = 1 (time), bit6 = 1 (flow), bit5 = 1 (open), bits0-1 = 00 (valve 1)
      // Time = 60 s → 3c 00 00
      // Flow = 6   → 06 00 00 00
      const scope = makeScope([
        ["cmd", "valve"],
        ["valve", "1"],
        ["operation", "1"],
        ["timed_close", "1"],
        ["duration_sec", "60"],
        ["flow_ctrl", "1"],
        ["pulses", "6"],
      ]);
      expect(downlinkHex(scope)).toBe("ff1de0003c000006000000");
    });

  });

  test("fport is 85 by default", () => {
    const scope = makeScope([["cmd", "valve"], ["valve", "1"], ["operation", "1"]]);
    const result = buildDownlink(scope, hwV4, noLog);
    expect(result.fport).toBe(85);
  });

});

// ─── Rule Set (cmd: "rule_set") ───────────────────────────────────────────────
//
// Protocol reference: v4 doc §3.5.1 Set Rule
//
//   Format: ff  55  <RuleID 1B>  <Enable 1B>  <Condition 13B>  <Action 13B>
//
//   Condition (13 bytes) — Time type (byte 1 = 0x01):
//     B1      : 01 (time condition)
//     B2–B5   : Start timestamp, UINT32 little-endian
//     B6–B9   : End timestamp, UINT32 little-endian
//     B10     : Is loop (00=no, 01=yes)
//     B11     : Loop period (00=month, 01=day, 02=week)
//     B12–B13 : Interval, UINT16 little-endian
//
//   Action (13 bytes):
//     B1      : 02 (valve action type)
//     B2      : Valve (01=valve1, 02=valve2)
//     B3      : 00=close, 01=open
//     B4      : Time control (00=disable, 01=enable)
//     B5–B8   : Duration seconds, UINT32 little-endian
//     B9      : Flow control (00=disable, 01=enable)
//     B10–B13 : Water volume pulses, UINT32 little-endian
//
// ── Doc example (§3.5.1, page 10 of v4 protocol doc) ────────────────────────
//   Rule 1, enabled
//   Condition: Time 2024/03/01 00:00:00 UTC → 2024/09/01 00:00:00 UTC
//              Is loop: yes, period: day, every: 2
//   Action: Valve 1, open, time control ON, duration 5 min (300 s), no flow
//
//   Expected: ff5501010100aae065003ed36601010200020101012c0100000000000000
//
//   Breakdown (hex, no spaces):
//   ff55 — channel + type
//   01   — rule ID = 1
//   01   — enabled
//   01   — cond type: time
//   00aae065 — start TS = 0x65E0AA00 = 1709222400 (LE)
//   003ed366 — end   TS = 0x66D33E00 = 1725120000 (LE)
//   01   — is loop
//   01   — loop period: day
//   0200 — every 2 days
//   02   — action type: valve
//   01   — valve 1
//   01   — open
//   01   — time control enable
//   2c010000 — 300 s (LE)
//   00   — flow control disable
//   00000000 — 0 pulses (LE)

describe("rule_set command — FF55 format (v4 protocol §3.5.1)", () => {

  const START_TS = 1709222400; // 2024/03/01 00:00:00 UTC
  const END_TS   = 1725120000; // 2024/09/01 00:00:00 UTC

  function ruleScope(overrides = {}) {
    const defaults = {
      cmd: "rule_set",
      rule_id: "1",
      enabled: "1",
      start_ts: String(START_TS),
      end_ts:   String(END_TS),
      loop: "1",
      unit: "day",
      every: "2",
      action_valve: "1",
      action_operation: "1",
      timed_close: "1",
      duration_sec: "300",
      flow_ctrl: "0",
      pulses: "0",
    };
    return makeScope(Object.entries({ ...defaults, ...overrides }));
  }

  test("doc example: rule 1, daily every 2 days, valve 1 open 5 min", () => {
    expect(downlinkHex(ruleScope())).toBe(
      "ff5501010100aae065003ed36601010200020101012c0100000000000000"
    );
  });

  test("structure: starts with ff55", () => {
    expect(downlinkHex(ruleScope())).toMatch(/^ff55/);
  });

  test("total payload length: 30 bytes = 60 hex chars (header 2 + ruleId 1 + enable 1 + cond 13 + action 13)", () => {
    expect(downlinkHex(ruleScope())).toHaveLength(60);
  });

  test("rule ID is encoded as byte 3 (offset 4 in hex)", () => {
    // rule_id = 5 → byte at offset [2] = 0x05
    const hex = downlinkHex(ruleScope({ rule_id: "5" }));
    expect(hex.slice(4, 6)).toBe("05");
  });

  test("enable flag: enabled=1 → byte 4 = 01", () => {
    expect(downlinkHex(ruleScope({ enabled: "1" })).slice(6, 8)).toBe("01");
  });

  test("enable flag: enabled=0 → byte 4 = 00", () => {
    expect(downlinkHex(ruleScope({ enabled: "0" })).slice(6, 8)).toBe("00");
  });

  test("condition type byte is 01 (time)", () => {
    // Condition starts at byte 5 (offset 8 in hex)
    expect(downlinkHex(ruleScope()).slice(8, 10)).toBe("01");
  });

  describe("start timestamp LE encoding", () => {
    // 1709222400 = 0x65E0AA00 → LE bytes: 00 AA E0 65
    test("start_ts = 1709222400 → 00aae065 at condition bytes 2-5", () => {
      const hex = downlinkHex(ruleScope());
      // offset 10..17 (bytes 5-8 of payload = cond bytes 2-5)
      expect(hex.slice(10, 18)).toBe("00aae065");
    });
  });

  describe("end timestamp LE encoding", () => {
    // 1725120000 = 0x66D33E00 → LE bytes: 00 3E D3 66
    test("end_ts = 1725120000 → 003ed366 at condition bytes 6-9", () => {
      const hex = downlinkHex(ruleScope());
      expect(hex.slice(18, 26)).toBe("003ed366");
    });

    test("end_ts = 0 (open-ended) → 00000000", () => {
      const hex = downlinkHex(ruleScope({ end_ts: "0" }));
      expect(hex.slice(18, 26)).toBe("00000000");
    });
  });

  describe("loop and period", () => {

    test("loop=1 → condition byte 10 = 01", () => {
      expect(downlinkHex(ruleScope({ loop: "1" })).slice(26, 28)).toBe("01");
    });

    test("loop=0 → condition byte 10 = 00", () => {
      expect(downlinkHex(ruleScope({ loop: "0" })).slice(26, 28)).toBe("00");
    });

    test("unit=day → loop period byte = 01 (condition byte 11)", () => {
      expect(downlinkHex(ruleScope({ unit: "day" })).slice(28, 30)).toBe("01");
    });

    test("unit=week → loop period byte = 02 (condition byte 11)", () => {
      expect(downlinkHex(ruleScope({ unit: "week" })).slice(28, 30)).toBe("02");
    });

    test("unit=month with hw.major >= 4 → loop period byte = 00 (native month, condition byte 11)", () => {
      expect(downlinkHex(ruleScope({ unit: "month", every: "1" }), hwV4).slice(28, 30)).toBe("00");
    });

    test("unit=month with hw.major < 4 → loop period byte = 01 (approx as 30 days, condition byte 11)", () => {
      // Legacy hw: month approximated as 30-day intervals → loopPeriod = 0x01
      expect(downlinkHex(ruleScope({ unit: "month", every: "1" }), hwV3).slice(28, 30)).toBe("01");
    });

    test("every=2, unit=day → interval bytes 12-13 = 02 00 (UINT16 LE)", () => {
      expect(downlinkHex(ruleScope({ unit: "day", every: "2" })).slice(30, 34)).toBe("0200");
    });

    test("every=7, unit=day → interval bytes 12-13 = 07 00", () => {
      expect(downlinkHex(ruleScope({ unit: "day", every: "7" })).slice(30, 34)).toBe("0700");
    });

  });

  describe("action field", () => {

    // Action starts at byte 18 of payload → hex offset 34

    test("action type byte = 02 (valve)", () => {
      expect(downlinkHex(ruleScope()).slice(34, 36)).toBe("02");
    });

    test("action_valve=1 → action byte 2 = 01", () => {
      expect(downlinkHex(ruleScope({ action_valve: "1" })).slice(36, 38)).toBe("01");
    });

    test("action_valve=2 → action byte 2 = 02", () => {
      expect(downlinkHex(ruleScope({ action_valve: "2" })).slice(36, 38)).toBe("02");
    });

    test("action_operation=1 (open) → action byte 3 = 01", () => {
      expect(downlinkHex(ruleScope({ action_operation: "1" })).slice(38, 40)).toBe("01");
    });

    test("action_operation=0 (close) → action byte 3 = 00", () => {
      expect(downlinkHex(ruleScope({ action_operation: "0" })).slice(38, 40)).toBe("00");
    });

    test("timed_close=1 (time control enabled) → action byte 4 = 01", () => {
      expect(downlinkHex(ruleScope({ timed_close: "1" })).slice(40, 42)).toBe("01");
    });

    test("duration_sec=300 (5 min) → action bytes 5-8 = 2c010000 (LE)", () => {
      // 300 = 0x12C → LE: 2C 01 00 00
      expect(downlinkHex(ruleScope({ duration_sec: "300" })).slice(42, 50)).toBe("2c010000");
    });

    test("duration_sec=3600 (1 hr) → action bytes 5-8 = 100e0000 (LE)", () => {
      // 3600 = 0x0E10 → LE: 10 0E 00 00
      expect(downlinkHex(ruleScope({ duration_sec: "3600" })).slice(42, 50)).toBe("100e0000");
    });

    test("flow_ctrl=0 → action byte 9 = 00", () => {
      expect(downlinkHex(ruleScope({ flow_ctrl: "0" })).slice(50, 52)).toBe("00");
    });

    test("flow_ctrl=1 → action byte 9 = 01", () => {
      expect(downlinkHex(ruleScope({ flow_ctrl: "1" })).slice(50, 52)).toBe("01");
    });

    test("pulses=0 → action bytes 10-13 = 00000000", () => {
      expect(downlinkHex(ruleScope({ pulses: "0" })).slice(52, 60)).toBe("00000000");
    });

    test("pulses=500 → action bytes 10-13 = f4010000 (LE)", () => {
      // 500 = 0x01F4 → LE: F4 01 00 00
      expect(downlinkHex(ruleScope({ flow_ctrl: "1", pulses: "500" })).slice(52, 60)).toBe("f4010000");
    });

  });

  test("fport is 85 by default", () => {
    const result = buildDownlink(ruleScope(), hwV4, noLog);
    expect(result.fport).toBe(85);
  });

});

// ─── Unknown / missing commands ───────────────────────────────────────────────

describe("unknown or missing commands", () => {

  test("no cmd variable → null", () => {
    const scope = makeScope([["valve", "1"]]);
    expect(buildDownlink(scope, hwV4, noLog)).toBeNull();
  });

  test("empty cmd → null", () => {
    const scope = makeScope([["cmd", ""]]);
    expect(buildDownlink(scope, hwV4, noLog)).toBeNull();
  });

  test("unknown cmd → null", () => {
    const scope = makeScope([["cmd", "not_a_real_command"]]);
    expect(buildDownlink(scope, hwV4, noLog)).toBeNull();
  });

});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("byte-encoding edge cases", () => {

  test("rule_id clamped to [1, 255]: rule_id=0 → 01", () => {
    const scope = makeScope([
      ["cmd", "rule_set"], ["rule_id", "0"], ["enabled", "1"],
      ["start_ts", "0"], ["end_ts", "0"], ["loop", "0"], ["unit", "day"], ["every", "1"],
      ["action_valve", "1"], ["action_operation", "0"],
      ["timed_close", "0"], ["duration_sec", "0"], ["flow_ctrl", "0"], ["pulses", "0"],
    ]);
    const hex = downlinkHex(scope);
    expect(hex.slice(4, 6)).toBe("01"); // clamped to min 1
  });

  test("rule_id clamped to [1, 255]: rule_id=300 → ff", () => {
    const scope = makeScope([
      ["cmd", "rule_set"], ["rule_id", "300"], ["enabled", "1"],
      ["start_ts", "0"], ["end_ts", "0"], ["loop", "0"], ["unit", "day"], ["every", "1"],
      ["action_valve", "1"], ["action_operation", "0"],
      ["timed_close", "0"], ["duration_sec", "0"], ["flow_ctrl", "0"], ["pulses", "0"],
    ]);
    const hex = downlinkHex(scope);
    expect(hex.slice(4, 6)).toBe("ff"); // 255
  });

  test("UINT32 LE overflow clamped: duration_sec > 0xFFFFFFFF treated as 0xFFFFFFFF", () => {
    const scope = makeScope([
      ["cmd", "rule_set"], ["rule_id", "1"], ["enabled", "1"],
      ["start_ts", "0"], ["end_ts", "0"], ["loop", "0"], ["unit", "day"], ["every", "1"],
      ["action_valve", "1"], ["action_operation", "1"],
      ["timed_close", "1"], ["duration_sec", String(0xFFFFFFFF + 1)], ["flow_ctrl", "0"], ["pulses", "0"],
    ]);
    const hex = downlinkHex(scope);
    // 0xFFFFFFFF LE = ffffffff
    expect(hex.slice(42, 50)).toBe("ffffffff");
  });

});
