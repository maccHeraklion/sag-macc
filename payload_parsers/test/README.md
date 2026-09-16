# Payload Parser Tests

Tests for all Milesight LoRaWAN payload parsers in this project.

---

## Guiding principle

All expected byte sequences come **exclusively from the official device documentation**,
never from reading the implementation. If a test fails, the implementation diverges
from the spec — fix the implementation, not the test.

---

## Setup

Dependencies are isolated from the root repository. Install them once:

```sh
cd payload_parsers
npm install
```

This creates `payload_parsers/node_modules/` which is completely independent from the
root `node_modules/`.

---

## Running tests

```sh
# from payload_parsers/ — run all parsers
npm test

# watch mode (re-runs on file save)
npm run test:watch

# verbose — show every test name
npm run test:verbose

# from repo root
npm test --prefix payload_parsers

# single parser file
cd payload_parsers && npx jest test/uc511_parser.test.js
```

---

## Directory structure

```
payload_parsers/
  <parser>.js              ← parser under test
  package.json             ← Jest config, isolated from root
  .eslintrc.js             ← Node.js ESLint env (separate from React frontend)
  test/
    README.md              ← this file
    sdk-mock.js            ← shared @tago-io/sdk stub (no network calls)
    uc511_parser.test.js   ← UC51x valve controller tests
    <next_parser>.test.js  ← add one file per parser
```

Jest discovers every `*.test.js` under `test/` automatically via the `testMatch`
pattern in `package.json` — no registration needed.

---

## How the test harness works

### SDK stub

`@tago-io/sdk` is intercepted via Jest's `moduleNameMapper` in `package.json`
and replaced with `test/sdk-mock.js`. The stub provides a no-op `Analysis`
class and silent async stubs for all SDK methods, so no network calls ever
happen during tests.

### Test-mode exports

Each TagoIO Analysis file wraps everything in an `Analysis(fn)` call, so its
internal functions are normally not importable. The pattern used here:

1. Add a block at the bottom of the parser:
   ```js
   if (process.env.<PARSER>_TEST_MODE === "true") {
     module.exports = { fn1, fn2, ... };
   }
   ```
2. The test file sets that env var **before** requiring the module:
   ```js
   process.env.<PARSER>_TEST_MODE = "true";
   const { fn1, fn2 } = require("../<parser>");
   ```

This exposes pure functions (downlink builders, decoders, helpers) to Jest
without changing any production behaviour.

---

## Adding tests for a new parser

1. **Add test-mode exports** to the parser file (see pattern above).

2. **Create** `payload_parsers/test/<parser_name>.test.js`:
   ```js
   "use strict";
   process.env.<PARSER>_TEST_MODE = "true";
   const { myFn } = require("../<parser_name>");

   describe("<ParserName>", () => {
     test("example from doc §X.Y", () => {
       expect(myFn(input)).toBe("expected_hex_from_doc");
     });
   });
   ```

3. **Base every expected value** on the device's official communication
   protocol document. Cite the section or page number in a comment.

4. Run `npm test` — Jest picks up the new file automatically.

---

## Parsers covered

| File | Device | Protocol docs |
|---|---|---|
| [uc511_parser.test.js](uc511_parser.test.js) | Milesight UC51x LoRaWAN Solenoid Valve Controller | [v4 protocol (HW 4.x)](https://resource.milesight.com/milesight/iot/document/uc51x-series-communication-protocol-en.pdf) · [v3 protocol (HW ≤ 3.x)](https://resource.milesight.com/milesight/iot/document/uc51x-v3-series-communication-protocol-en.pdf) |

---

## UC51x protocol quick reference

> Kept here as a lookup aid. The test file itself contains detailed byte-level
> comments for each test case.

### Payload format (both v3 and v4)

All fields are little-endian. Structure:
```
Channel(1B)  Type(1B)  Data(NB)  Channel(1B)  Type(1B)  Data(MB) ...
```

### Uplink — Sensor Data channels

| Channel | Type | Description |
|---|---|---|
| `01` | `75` | Battery level (UINT8, %) |
| `03` | `01` | Valve 1 (00=closed, 01=open) |
| `04` | `c8` | GPIO1 pulse counter (UINT32) |
| `05` | `01` | Valve 2 (00=closed, 01=open) |
| `06` | `c8` | GPIO2 pulse counter (UINT32) |
| `07` | `01` | GPIO1 digital input (00=closed, 01=open) |
| `08` | `01` | GPIO2 digital input (00=closed, 01=open) |

### Downlink — Valve Control `FF1D` (v3 and v4)

```
ff  1d  <Control Field 1B>  <Sequence 1B>  [Time 3B LE]  [Flow 4B LE]
```

Control Field: `bit7`=time-ctrl `bit6`=flow-ctrl `bit5`=open/close `bits4-2`=000 `bits1-0`=valve (00=V1, 01=V2)

| Doc example | Hex |
|---|---|
| Open valve 2 immediately | `ff1d2100` |
| Open valve 1 for 60 s | `ff1da0003c0000` |
| Open valve 2 / 16 pulses | `ff1d610010000000` |
| Open valve 1 / 60 s or 6 pulses | `ff1de0003c000006000000` |

### Downlink — Set Rule `FF55` (v4 only)

```
ff  55  <RuleID 1B>  <Enable 1B>  <Condition 13B>  <Action 13B>
```

Time condition (byte 1 = `01`): `type(1)` `startTS(4 LE)` `endTS(4 LE)` `isLoop(1)` `period(1: 00=month 01=day 02=week)` `interval(2 LE)`

Action: `02(1)` `valve(1)` `open(1)` `timeCtrl(1)` `durationSec(4 LE)` `flowCtrl(1)` `pulses(4 LE)`

### Downlink — Set Plan `FF4D` (v3 only / legacy)

```
ff  4d  <PlanNum 1B>  <CtrlField 1B>  <RepeatField 1B>
        <StartHH 1B>  <StartMM 1B>  <EndHH 1B>  <EndMM 1B>  <Volume 2B LE>
```

Control Field: `bit7`=enable `bit6`=open `bits1-0`: 01=V1, 10=V2, 11=V1+V2. Repeat Field bits 0-6 = Mon–Sun.
