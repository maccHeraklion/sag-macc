# Edge (Linux, Node 20) ↔ Siemens S7-1200 (1214C) integration for greenhouse actuators: protocols, safety, autonomy, OT security

Research date: 2026-10-29. Labels used throughout: **[OFFICIAL]** = Siemens / CISA / standards body; **[COMMUNITY]** = third-party blogs, forums, vendor KBs, package registries; **[REC]** = recommendation / inference by the researcher (not sourced as fact).
Source-quality caveat: many search hits came from `industrialmonitordirect.com` (a high-volume, partly auto-generated KB site). Its numbers often contradict each other, so it is cited only where noted and should be treated as weak.
Context assumed (from the brief): PLC is the final authority, edge only proposes setpoints, heartbeat edge→PLC every 1 s, 10 s loss → PLC local safe program, vents close on fault plus an independent hardware overheat thermostat, no actuation over LoRaWAN, command lifecycle created→authorized→queued→sent→acknowledged→verified with expiry, 9 interlocks, 6 motors with feedback.

---

## 1. Protocol options to S7-1200 and which one to use in 2026

### Takeaway
Use the **S7-1200 OPC UA server** (FW ≥ V4.4; target ≥ V4.7 for security fixes; single-CPU "SIMATIC OPC UA S7-1200 Basic" runtime license) with Basic256Sha256 Sign&Encrypt plus username authentication, and node-opcua on the edge. **Modbus TCP (MB_SERVER)** is an acceptable fallback, but only with firewall/IP allow-listing, because it has no authentication. **Do not enable PUT/GET**: it gives any S7 client on the network unauthenticated read/write of non-optimized DBs.

### Cited Findings

**OPC UA server on S7-1200**
- [OFFICIAL] OPC UA communication is supported on S7-1200 CPUs with firmware V4.4 or higher (Siemens application document "OPC UA Access to S7-1200 PLC via modeled OPC UA Server Interface", 2020-11, STEP 7 V16 project) — [Siemens SIOS 109781701](https://cache.industry.siemens.com/dl/files/701/109781701/att_1038809/v3/109781701_S7_1200_OPC_UA_Server_DOCU_V10_en.pdf); FW ≥ V4.4 also stated by [plcprogramming.io](https://plcprogramming.io/protocols/opc-ua-siemens) [COMMUNITY]
- [OFFICIAL] Siemens publishes a dedicated "TIA Portal OPC UA system limits" document (entry 109755846, dated 2024-03-11) with separate sections "1.2.1 S7-1200 CPU with Firmware V4.6" and "1.2.2 … V4.5". A snippet shows a max-sessions row of 32/48/64, but the column headings were not extractable, so it is unclear which CPUs those apply to; for S7-1200 they may be S7-1500 columns — [Siemens 109755846](https://cache.industry.siemens.com/dl/files/846/109755846/att_1163306/v4/109755846_TIA_Portal_OPC_UA_system_limits.pdf)
- [OFFICIAL, catalogue] License **6ES7823-0BA00-2BA0** "SIMATIC OPC UA S7-1200 Basic": single runtime license, OPC UA server (data access), Class A, for one CPU. It runs on every S7-1200 CPU including F CPUs with FW ≥ V4.4 and is listed as PM300 Active. **6ES7823-0BE00-2BA0** is the download variant — [Siemens Industry Mall 6ES7823-0BA00-2BA0](https://mall.industry.siemens.com/mall/en/za/Catalog/Product/6ES7823-0BA00-2BA0), [Siemens Industry Mall 6ES7823-0BE00-2BA0](https://mall.industry.siemens.com/mall/en/cz/Catalog/Product/6ES7823-0BE00-2BA0), [electricautomationnetwork listing](https://www.electricautomationnetwork.com/en/siemens/6es7823-0ba00-2ba0-siemens-simatic-opc-ua-s7-1200-basic-single-runtime-license-contains-license-certificat). Do not confuse it with 6ES7823-0BA00-1CA0 (S7-1500 Medium). One eBay price is ~€80 (not list price) [COMMUNITY]
- [COMMUNITY] Node limit: "up to 2,000 addressable nodes on firmware V4.5+", citing Siemens 109755846. Monitored items: 1,000 at a 1,000 ms sampling interval, dropping to about 100 at 100–500 ms — [Cybus](https://www.cybus.io/en/the-s7-1200-opc-ua-node-limit/)
- [COMMUNITY, conflicting] S7-1200 max OPC UA sessions are variously reported as 10 configurable (default 5), 2–4, and 2–8 — [industrialmonitordirect](https://industrialmonitordirect.com/blogs/knowledgebase/s7-1200-opc-ua-server-license-cost-and-configuration-guide), [plcprogramming.io](https://plcprogramming.io/guides/s7-1200-opc-ua). Unresolved; see Gaps.
- [COMMUNITY] The license does not raise the static limits, which are firmware-bound — [industrialmonitordirect](https://industrialmonitordirect.com/blogs/knowledgebase/simatic-opc-ua-license-tiers-for-s7-1200-and-s7-1500-cpus). Classic S7-1200 CPUs are server-only, not OPC UA clients — [industrialmonitordirect](https://industrialmonitordirect.com/blogs/knowledgebase/s7-1200-as-opc-ua-client-capability-matrix-and-migration-guide)
- [COMMUNITY, OPC Foundation marketplace] S7-1200/1500 OPC UA servers support security policies including **Basic256Sha256** and **None**, and user tokens **anonymous** and **username/password**. Communication "can be secured with encryption and authentication" — [OPC Foundation – OPC UA with SIMATIC controllers](https://opcfoundation.org/products/view/opc-ua-with-simatic-controllers/)
- [COMMUNITY] OPC UA works with **optimized** blocks and exposes selected data as structured nodes with certificates, encryption and per-user access control, which is the usual alternative to PUT/GET — [industrialmonitordirect S7-1500 optimized access](https://industrialmonitordirect.com/blogs/knowledgebase/s7-1500-optimized-block-access-getput-communication-methods), [Voltrus](https://voltrus.id/s7-explorer/blog/enable-s7-put-get-siemens/)

**Modbus TCP (MB_SERVER / MB_CLIENT)**
- [OFFICIAL] Siemens application example "S7-1200 Modbus TCP" (entry 83130159) covers MB_SERVER/MB_CLIENT between S7-1200s. It does not state register or connection limits — [Siemens 83130159](https://support.industry.siemens.com/cs/attachments/83130159/83130159_NET_S7-1200_MODBUS_TCP_en.pdf)
- [COMMUNITY] Each MB_SERVER instance serves one client connection on one port. Multiple clients need multiple instances on separate ports (e.g. 502 and 503). The holding-register area (MB_HOLD_REG) points to a global DB or M area — [DMC "using an S7-1200 as Modbus TCP slave"](https://www.dmcinfo.com/blog/27313/using-an-s7-1200-plc-as-a-modbus-tcp-slave/), [industrialmonitordirect multi-client](https://industrialmonitordirect.com/blogs/knowledgebase/s7-1200-mb-server-multiple-modbus-tcp-client-setup)
- [COMMUNITY, conflicting] The 1214C is said to support about 8 concurrent Modbus TCP connections within a shared CPU connection budget (~15–16 total). Figures vary by source and firmware — [industrialmonitordirect 8-connection limit](https://industrialmonitordirect.com/blogs/knowledgebase/s7-1214c-modbus-tcp-8-connection-limit-and-workarounds)
- [COMMUNITY] The "up to 2000 registers per request" figure comes from an S7-1500 article and is not verified for S7-1200. Standard Modbus PDU limits (125 holding registers per read, 123 per write) apply on the wire regardless — [industrialmonitordirect S7-1500 MB_SERVER](https://industrialmonitordirect.com/blogs/knowledgebase/siemens-s7-1500-mb-server-modbus-tcp-configuration-guide). The PDU limits are from the Modbus spec, not from this source; see Gaps.

**S7 protocol PUT/GET (nodes7, node-snap7, node-red-contrib-s7)**
- [OFFICIAL] PUT/GET cannot access DBs with "optimized block access", so the DB attribute must be turned off. The CPU option "Permit access with PUT/GET communication from remote partner" must also be enabled under Protection & Security → Connection mechanisms — [Siemens 82212115 (S7-1500/1200 PUT/GET)](https://cache.industry.siemens.com/dl/files/115/82212115/att_108330/v2/82212115_s7_communication_s7-1500_en.pdf), [Siemens 82212115 S7-1200/S7-300](https://support.industry.siemens.com/cs/attachments/82212115/82212115_S7_communication_Sequencer_TIA_Portal_en.pdf)
- [COMMUNITY] Once PUT/GET is enabled, any S7 client on the network can read and write arbitrary non-optimized data blocks, with no authentication and no encryption. Siemens therefore disables it by default — [Voltrus](https://voltrus.id/s7-explorer/blog/enable-s7-put-get-siemens/), [FlowFuse Node-RED S7 guide](https://flowfuse.com/blog/2025/01/integrating-siemens-s7-plcs-with-node-red-guide/)
- [COMMUNITY/maintainer] The nodeS7 README requires Slot 1, optimized block access disabled and GET/PUT enabled on S7-1200/1500. It warns that this "opens up the controller for other access by other applications" and advises considering other software "if the application could injure someone" — [plcpeople/nodes7 GitHub](https://github.com/plcpeople/nodes7)

### Inferences
- [REC] **Primary choice for 2026: OPC UA (Sign&Encrypt, Basic256Sha256, username token, anonymous disabled, application-certificate trust list holding only the edge's certificate).** It is the only option with authentication and encryption on the wire, it works with optimized DBs (so PLC-internal data layout stays private), and the license is low-cost. An interface of roughly 6 motors, 9 interlocks, ~20 setpoints, ~50 status tags and a heartbeat is about 200 nodes, far below any reported limit (≥ 1,000 nodes). Use one session. Use a 500–1000 ms sampling/publishing interval for status, and synchronous Write + Read-back for commands. Expose a modeled server interface (only the mailbox and status DBs), not the whole tag table.
- [REC] **Fallback: Modbus TCP** (PLC = MB_SERVER, edge = client via `modbus-serial`). It is simple and deterministic and easy to simulate, but unauthenticated, so it is acceptable only if the edge is the sole host on the PLC subnet or the PLC port is reachable only from the edge's IP (switch ACL / firewall). The PLC must treat MB_HOLD_REG as a *request mailbox* that its own logic validates, never as live actuator outputs.
- [REC] **Do not use PUT/GET** (nodes7/node-snap7/node-red-contrib-s7). It needs two security relaxations (PUT/GET on, optimized access off), its library maintainers disclaim safety-relevant use, and it gives no authentication.
- [REC, background, verify] The S7-1200 "classic" family (6ES7214-1…40-0XB0 for the 1214C) is now succeeded by the **S7-1200 G2** (TIA V20+). For a new 2026 purchase, consider whether to buy classic 1214C FW V4.7 or a G2 CPU (see §5 for its IEC 62443-4-2 certificate). The integration design here applies to both.

### Gaps
- Exact official S7-1200 OPC UA limits (sessions, subscriptions, monitored items, nodes per FW V4.5/V4.6/V4.7) could not be extracted from the Siemens PDF 109755846 (binary-only fetch). Read it directly before final sizing.
- Not confirmed from an official source: whether the S7-1200 OPC UA server lets you remove the "None" endpoint and anonymous access entirely (expected yes in the TIA Portal "Security policies" / "User authentication" settings), and whether newer AES-based policies (Aes128_Sha256_RsaOaep, Aes256_Sha256_RsaPss) are supported on S7-1200 V4.7.
- Not verified: S7-1200 Modbus TCP *Secure* (Modbus over TLS) support and version requirements, and the official MB_SERVER connection/register limits. Check the S7-1200 System Manual and the TIA help for MB_SERVER.
- No independent OPC UA vs Modbus performance benchmark on S7-1200 was found.

---

## 2. Node.js library maturity (node-opcua, modbus-serial / jsmodbus, nodes7 / node-snap7)

### Takeaway
node-opcua is the most mature and active of these (monorepo; Snyk shows releases in July 2026, ~1.6k stars, no known direct vulnerabilities). modbus-serial is actively maintained (v8.0.25). nodes7 (pure JS, MIT) and node-snap7 (native binding, v1.0.8) work but are tied to PUT/GET and carry weaker maintenance signals.

### Cited Findings
- [COMMUNITY/registry] node-opcua: newest versions published July 2026 (e.g. node-opcua-address-space-base 2.175.x), ~1.6k GitHub stars, ~515 forks, "healthy" maintenance rating, no known direct vulnerabilities in latest versions. One snapshot shows 21 open issues / 4 open PRs — [Snyk node-opcua-address-space-base](https://security.snyk.io/package/npm/node-opcua-address-space-base), [Snyk node-opcua-variant](https://security.snyk.io/package/npm/node-opcua-variant), [Snyk node-opcua-service-subscription](https://security.snyk.io/package/npm/node-opcua-service-subscription)
- [COMMUNITY/registry] modbus-serial is at v8.0.25 and rated actively maintained, with releases within the last ~2–6 months (snapshots disagree) — [Snyk advisor modbus-serial](https://snyk.io/advisor/npm-package/modbus-serial), [jsDelivr modbus-serial 8.0.25](https://cdn.jsdelivr.net/npm/modbus-serial@8.0.25/package.json)
- [COMMUNITY/maintainer] nodeS7: MIT, pure JavaScript (no compiler), 125 commits, 33 open issues, 4 open PRs, no published GitHub releases. It reconnects automatically and returns "bad" quality during outages. If a write is already in progress, `writeItems()` returns non-zero and the callback is not called. The README says "Fully test everything you do" — [plcpeople/nodes7](https://github.com/plcpeople/nodes7)
- [COMMUNITY/registry] node-snap7 is at v1.0.8 (native Snap7 binding), with types in @types/node-snap7. A successor-style project, napi-snap7, exists — [npm node-snap7](https://www.npmjs.com/package/node-snap7), [GitHub fabioriva/napi-snap7](https://github.com/fabioriva/napi-snap7)
- [COMMUNITY] node-red-contrib-s7 and Node-RED S7 integrations rely on PUT/GET and non-optimized DBs — [FlowFuse](https://flowfuse.com/blog/2025/01/integrating-siemens-s7-plcs-with-node-red-guide/)

### Inferences
- [REC] Pin exact versions (lockfile, `npm ci`). Run `npm audit` and an SBOM in CI. Wrap the protocol library behind a thin internal "PLC port" interface (`readStatus()`, `writeCommand(cmd)`, `heartbeat(n)`) so you can swap OPC UA for Modbus, and both are mockable in tests.
- [REC] With node-opcua, set `securityMode: SignAndEncrypt`, `securityPolicy: Basic256Sha256`, `endpointMustExist: true`, and a username identity. Keep the client certificate's private key readable only by the service user. Use `connectionStrategy` with bounded retry. Make the PLC heartbeat independent of the subscription so a stuck subscription still trips the PLC watchdog.
- [REC] jsmodbus: no current maintenance data found (see Gaps). Prefer modbus-serial.

### Gaps
- No direct GitHub release-page data for node-opcua (only Snyk mirrors). No data found for jsmodbus or node-red-contrib-s7 maintenance in 2026. No published production case studies of node-opcua against S7-1200 specifically.

---

## 3. Watchdog / heartbeat / lease, setpoint versioning, clamping, safe state, restart, HOA

### Takeaway
Standard practice is a **changing-value heartbeat** (counter or toggle, not a static flag) monitored by a PLC timer, with timeout ≈ 3–10× the update period. Commands should go through a PLC-validated **mailbox** with an ID/sequence, a TTL lease, PLC-side clamping and an explicit ack/readback. The approved 1 s / 10 s design matches community norms. No standards-level source for these patterns was found; they are established practitioner patterns.

### Cited Findings
- [COMMUNITY] The supervisor should alternate or increment a value at a fixed interval, and the PLC faults if no *change* occurs within the window. A set-only flag cannot distinguish healthy comms from stuck-at-1 — [industrialmonitordirect Modbus handshake/watchdog](https://industrialmonitordirect.com/blogs/knowledgebase/plc-scada-modbus-handshake-watchdog-timeout-fix)
- [COMMUNITY] Timeout sizing: ≥ 3× the supervisor scan as a minimum, 5× recommended. A reference table lists SCADA reads at a 1 s heartbeat with a 10 s timeout and PLC-to-PLC at 1–2 s / 5–10 s — [industrialmonitordirect watchdog types](https://industrialmonitordirect.com/blogs/knowledgebase/plc-watchdog-timer-scan-timeout-hardware-communication-types)
- [COMMUNITY] Counter handshake: the sender increments a counter per event and the PLC compares it with the cached value. A jump ≥ 2 indicates lost messages, and no change within the preset forces the fail-safe state — [industrialmonitordirect](https://industrialmonitordirect.com/blogs/knowledgebase/plc-scada-modbus-handshake-watchdog-timeout-fix)
- [COMMUNITY] For unchanged setpoints, one pattern has the PLC clear the input to 0 and treat a re-write within the interval as proof the data is fresh, because PLC logic cannot otherwise tell a new identical setpoint from stale data — [industrialmonitordirect setpoint heartbeat](https://industrialmonitordirect.com/blogs/knowledgebase/scada-plc-heartbeat-detecting-setpoint-updates-without-value-change)
- [COMMUNITY] A bi-directional pattern also has the PLC toggle a bit that the supervisor must echo, polled faster than the timeout (e.g. 1–2 s polling for a 5 s timeout) — [industrialmonitordirect Logix heartbeat](https://industrialmonitordirect.com/blogs/knowledgebase/monitoring-scada-plc-communication-status-in-allen-bradley-logix), [PLCtalk "Heartbeat code"](https://www.plctalk.net/forums/threads/heartbeat-code.3315/)
- [COMMUNITY/maintainer] Library behaviour matters for restart semantics: nodes7 returns bad quality during outages and drops writes issued while one is in flight — [nodes7](https://github.com/plcpeople/nodes7)

### Inferences — [REC] concrete interface contract (PLC = authority)
1. **Heartbeat (edge→PLC)**: `EDGE_HB` UInt16 incremented each second. PLC TON (10 s) resets on every change. If it expires, set `MODE = LOCAL_SAFE` and latch `COMM_LOST`. Recovery requires N (e.g. 5) consecutive changes plus a fresh session handshake, not just one change, to avoid flapping. **PLC→edge**: `PLC_HB` UInt16 incremented each PLC second, and `PLC_ECHO = last EDGE_HB seen`. The edge raises an alarm if `PLC_HB` stalls for more than 5 s and stops issuing commands.
2. **Session epoch**: on every edge (re)start the edge writes a random/incremented `EDGE_SESSION` UInt32. The PLC clears its command mailbox and acceptance history whenever the session changes, on OB100 (startup) and on RUN transitions. This is the "no replay" guard.
3. **Command mailbox** (one slot per actuator group or a single FIFO slot): `{session, cmd_id (UInt32 monotonic), target, value, ttl_s, crc16}`, plus `CMD_STROBE` written last. The PLC accepts only if session matches, `cmd_id > last_cmd_id[target]`, CRC is OK, `MODE == AUTO_REMOTE`, the interlocks permit, and `ttl_s ≤ max`. The PLC starts the **lease from its own clock on receipt**, so wall-clock skew does not matter. When the lease expires, the PLC reverts that actuator to its local default/auto program. The edge never writes the actuator output directly.
4. **Ack / readback**: the PLC writes `{cmd_id, status ∈ {ACCEPTED, CLAMPED, REJECTED_INTERLOCK, REJECTED_MODE, REJECTED_STALE, REJECTED_RANGE, EXPIRED}, applied_value, reason_code}`. This maps directly to the lifecycle: `sent` = write OK; `acknowledged` = matching ack `cmd_id`; `verified` = motor/position feedback (6 motors with feedback) reaches the target within a PLC-defined travel time; otherwise the PLC raises `MOTION_FAULT` and the edge marks the command failed. The edge's queue must drop (not send) anything past `expires_at` on reconnect.
5. **Hard limits in PLC**: per-setpoint `[min, max]`, max rate of change, and min on/off times for motors (anti short-cycle). Limits live in a PLC DB that is **not** exposed for writing over the edge interface (read-only node / not in the Modbus map), and changes only via TIA download.
6. **Safe state** (IEC 61131-3 practice): explicit per-actuator safe values on FB init, `LOCAL_SAFE`, CPU STOP, and output-module substitute values. Vents close on fault per the approved design, **but [REC] check the overheat case**: on a sunny Ierapetra day, closed vents with a lost edge can overheat the crop within minutes. The independent hardware thermostat therefore needs to *open* vents (or at least release the close command), and the PLC local-safe program should run a simple temperature-banded vent law rather than a hard "close". This is a design conflict to resolve explicitly: "safe" for wind/rain = closed; "safe" for heat = open. Rain/wind sensors wired to the PLC (not via LoRaWAN) should arbitrate.
7. **Restart behaviour**: OB100 sets all mailboxes invalid, `MODE = LOCAL_SAFE` until the heartbeat is healthy and the edge session is re-established. Retentive DBs hold limits and counters only, never pending commands. Edge restart creates a new session and never replays queued commands older than their TTL.
8. **HOA / manual**: hardwired Hand-Off-Auto selectors per motor. In **Hand**, the motor runs through a hardwired circuit that keeps limit switches and overloads in series and bypasses the PLC output. In **Off**, the coil circuit is open. The PLC reads auxiliary contacts for H/O/A and the contactor feedback, and publishes `mode[i] ∈ {HAND, OFF, AUTO_LOCAL, AUTO_REMOTE}` plus a global `LOCAL/REMOTE` key switch. Edge commands for non-`AUTO_REMOTE` actuators return `REJECTED_MODE`, and the edge UI must show it.

### Gaps
- No official Siemens application example was found for a supervisor-lease/mailbox pattern on S7-1200. Siemens LAD/SCL library examples (e.g. "LGF" library, OB100 handling) could be checked.
- No greenhouse-specific literature found on the "close vs open on fault" trade-off. This needs agronomic and structural input (wind load ratings of the vent mechanism).

---

## 4. Functional safety: when an S7-1200 F / safety PLC is needed

### Takeaway
Greenhouse climate and irrigation control is dominated by *economic* risk (crop loss), which is addressed with independent hardwired protections (overheat thermostat, limit switches, overloads, e-stops), not with a SIL/PL-rated PLC. A safety PLC (S7-1200 F) or certified safety relays are required only if the risk assessment of a **personnel hazard** (crushing by motorized vents or screens, accessible moving parts) assigns a safety function a required Performance Level/SIL that you choose to implement in programmable logic. From 14 Jan 2027 the EU Machinery Regulation 2023/1230 replaces the Machinery Directive, which matters if the motorized vent/screen system counts as "machinery".

### Cited Findings
- [OFFICIAL, standard] ISO 13849-1:2023 (revised April 2023) covers only the safety-related parts of control systems. It provides a method to set a required performance level (PLr) per safety function and verify the achieved level. Its scope includes simple machines such as automatic doors and gates — [newtec ISO 13849](https://www.newtec.de/en/knowledge/iso-13849-functional-safety-of-machinery/), [ANSI blog ISO 13849-1:2023](https://blog.ansi.org/iso-13849-1-2023-safety-of-machinery/)
- [OFFICIAL, EU] Directive 2006/42/EC is repealed by Regulation (EU) 2023/1230 with effect from 14 Jan 2027 — [nlfnorm.cz EU product regulation record](https://nlfnorm.cz/en/ehn/5252)
- [OFFICIAL, catalogue] The S7-1200 OPC UA license also runs on F CPUs (FW ≥ V4.4), so choosing a 1214FC does not change the integration path — [Siemens Mall 6ES7823-0BA00-2BA0](https://mall.industry.siemens.com/mall/en/za/Catalog/Product/6ES7823-0BA00-2BA0)
- [COMMUNITY] PLCSIM simulates most S7-1200 and S7-1200F instructions (relevant if an F-CPU is chosen) — [bilibili PLCSIM S7-1200 guide](https://www.bilibili.com/opus/783954475162271785)

### Inferences
- [REC] Decision rule: run a documented risk assessment (ISO 12100 method) for (a) motorized roof/side vents and thermal/shade screens (crushing/shearing at accessible heights), (b) e-stop, and (c) any burner/heater or CO₂ dosing. If a safety function gets PLr ≥ c, implement it either **hardwired** (safety relay, limit switches, torque limiters, e-stop breaking the contactor supply) or on an **S7-1200 F** (1214FC + F-I/O). Do not implement it in the standard PLC program and never via the edge.
- [REC] IEC 61508 / IEC 62061 apply when a programmable system claims risk reduction. Process-plant IEC 61511 thinking is overkill for a single greenhouse. The pragmatic and common architecture is a standard S7-1200 plus hardwired protections, which is consistent with the approved design (independent overheat thermostat; no actuation over LoRaWAN).
- [REC] Combustion heaters and gas burners must keep their own certified burner controllers (e.g. EN 298-type). The PLC only enables or requests heat. CO₂ dosing needs an independent high-CO₂ cut-off if people work inside.
- [REC] Treat the edge as having **no safety role**. Everything it does must be safe to lose at any instant, which the 10 s lease already ensures.

### Gaps
- No greenhouse-specific source was found on whether automated vent/screen installations are "machinery" under 2023/1230 or on typical PLr values. Also unconfirmed: whether ISO 13849-1:2023 is already harmonised under the Regulation (one source calls it "very likely", which is a prediction). Needs a CE/safety consultant or a sector guide (e.g. Dutch greenhouse builders' practice / NEN guidance).

---

## 5. OT security: IEC 62443 zones/conduits, S7-1200 protection, firmware, segmentation

### Takeaway
Use three zones (Control: PLC + I/O + local HMI; Edge/DMZ: Node edge; Remote/Cloud). Make the edge the **only conduit** to the PLC, with outbound-only connections from site to cloud and no inbound ports. On the PLC: firmware **≥ V4.7** (fixes CVE-2024-47100), PUT/GET off, web server off or HTTPS-only, access-level protection with a strong password, OPC UA Sign&Encrypt with user authentication, and engineering access only through a switched-on VPN. For new hardware, the S7-1200 G2 is IEC 62443-4-2 certified (TÜV SÜD).

### Cited Findings
- [OFFICIAL, standard] IEC 62443-3-2:2020 requires defining the system under consideration (SUC), partitioning it into zones and conduits, per-zone/conduit risk assessment, setting a target security level (SL-T) for each, and documenting the requirements (ZCR 3 = partitioning; ZCR 5.6 = determine SL-T) — [IEC webstore 62443-3-2](https://webstore.iec.ch/en/publication/30727), [ISA 62443-3-2 TOC](https://www.isa.org/getmedia/4cfc5f8a-1f19-4e97-9382-c7d46e3b04a5/isa-62443-3-2-toc.pdf)
- [OFFICIAL, CISA/Siemens] ICSA-25-021-02 / SSA-717113 (21 Jan 2025): all S7-1200 CPUs (1211C–1217C incl. 1214C, 1214FC, SIPLUS) **below V4.7** are vulnerable to CSRF in the web interface (CVE-2024-47100, CVSS v3.1 7.1 / v4 7.2). An unauthenticated attacker can change CPU mode via a logged-in user's click. **Fix: update to V4.7 or later.** General measures: protect network access, follow Siemens operational guidelines for industrial security, defence-in-depth — [CISA ICSA-25-021-02](https://www.cisa.gov/news-events/ics-advisories/icsa-25-021-02)
- [OFFICIAL, CISA] ICSA-25-044-01 / SSA-224824 (Feb 2025): S7-1200 DoS via crafted packets on 80/tcp and 102/tcp (CVE-2025-24812) — [CISA ICSA-25-044-01](https://www.cisa.gov/news-events/ics-advisories/icsa-25-044-01)
- [OFFICIAL, CISA] ICSA-25-294-03 covers S7-1200 CPU V1/V2 devices (legacy generation) — [CISA ICSA-25-294-03](https://www.cisa.gov/news-events/ics-advisories/icsa-25-294-03)
- [OFFICIAL, Siemens ProductCERT] Older history: SSA-830194 (2021), a missing-authentication flaw in V4.5.0 allowing program download, fixed in V4.5.1+; SSA-584286 (2018), DoS on 102/tcp, fixed in V4.3+ — [SSA-830194](https://cert-portal.siemens.com/productcert/pdf/ssa-830194.pdf), [SSA-584286](https://cert-portal.siemens.com/productcert/pdf/ssa-584286.pdf)
- [OFFICIAL, Siemens] IEC 62443-4-2 conformity document for S7-1500 / **S7-1200 G2** CPUs (dated 01/2026). The G2 series is TÜV SÜD certified from FW V1.0 against IEC 62443-4-1:2018 and 62443-4-2:2019, and supports Secure Boot and central user management — [Siemens 109988966 conformity](https://support.industry.siemens.com/cs/attachments/109988966/s71500_iec_62443_4_2_conformity_en-US_en-US.pdf), [Siemens S7-1500 62443-4-2 certificate](https://assets.new.siemens.com/siemens/assets/api/uuid:90f1bec9-a41d-404d-bb55-e74318810da3/Certificate-IEC-62443-4-2-SIMATIC-S7-1500.pdf); distributor notice [UED](https://www.ued.co.uk/news-events/post/simatic-s7-1200-g2-are-now-iec-62443-4-2-certified) [COMMUNITY]
- [OFFICIAL, Siemens press] TIA Portal V20 supports the S7-1200 G2. PLCs can connect to central user management (UMAC), and web-server/OPC UA access can be centrally managed — [Siemens press release TIA V20](https://press.siemens.com/global/en/node/7037), [ARC](https://www.arcweb.com/blog/siemens-releases-tia-portal-version-20-plcs) [COMMUNITY]
- [OFFICIAL] PUT/GET is a separate CPU opt-in under Protection & Security → Connection mechanisms — [Siemens 82212115](https://cache.industry.siemens.com/dl/files/115/82212115/att_108330/v2/82212115_s7_communication_s7-1500_en.pdf)
- [COMMUNITY, weak, conflicting] S7-1200 FW ≥ V4.0 has layered access levels (full / read / HMI / no access). The read-only level reportedly needs FW ≥ V4.2. Level numbering differs between articles — [industrialmonitordirect password protection](https://industrialmonitordirect.com/blogs/knowledgebase/s7-1200-s7-1500-cpu-password-protection-for-wincc-hmi-and-gprs), [industrialmonitordirect write protection](https://industrialmonitordirect.com/blogs/knowledgebase/simatic-s7-project-write-protection-view-only-configuration)
- [COMMUNITY] Isolate PLCs on a separate VLAN or behind a firewall — [Voltrus](https://voltrus.id/s7-explorer/blog/enable-s7-put-get-siemens/)

### Inferences — [REC] small-site zone/conduit model
- **Zone C (Control, SL-T 2)**: S7-1200, I/O, motor starters, local HMI/panel, hardwired protections. Its own physical switch or VLAN with no default gateway to the internet. Allowed in: only the edge IP to the OPC UA port 4840 (or 502 if Modbus), and the engineering laptop to 102/tcp **only when** a physical/logical maintenance switch is on.
- **Zone E (Edge, SL-T 2)**: Linux edge (Node 20). Two NICs (control NIC and uplink NIC), no IP forwarding between them, host firewall (nftables) default-deny. Services run as non-root under systemd hardening. Read-only root/A-B updates if possible. Local store-and-forward.
- **Zone R (Remote/Cloud)**: TagoIO/cloud, operator UIs. **Conduit E↔R**: outbound only (MQTT/HTTPS over TLS, or WireGuard/OpenVPN initiated by the edge). **No inbound ports** and no port-forward on the router. Remote engineering uses the same outbound VPN, enabled on demand and logged.
- **PLC hardening checklist**: FW ≥ V4.7 (or a G2 CPU), PUT/GET disabled, web server disabled (or HTTPS + users if needed), access level "HMI access" or "No access" with a strong password, OPC UA anonymous off / None policy off, OPC UA server interface restricted to the mailbox and status DBs, write-only on mailbox nodes, read-only on status, know-how/copy protection for blocks, unused ports disabled on the CPU's switch, NTP from the edge only.
- [REC, background, verify] Since TIA V17 with S7-1200 FW V4.5+, Siemens offers "secure PG/PC and HMI communication" (TLS-based) and a "password for protection of confidential PLC configuration data". Enable both on V4.5+ and keep legacy (unsecured) PG/PC/HMI communication disabled unless an older HMI needs it. This is not confirmed by a fetched source in this session.

### Gaps
- Siemens "Operational Guidelines for Industrial Security" and the S7-1200 System Manual security chapter (exact access-level names per FW, secure PG/PC communication FW/TIA requirements) were not fetched. Verify before writing the hardening procedure.
- Fixed firmware version for CVE-2025-24812 (SSA-224824) not confirmed. Check SSA-224824 on cert-portal.siemens.com.
- No ENISA/ISA small-site worked example of SL-T selection was found. The SL-T values above are a recommendation.

---

## 6. Simulation and testing without hardware

### Takeaway
**PLCSIM Advanced does not simulate S7-1200**. S7-1200 (FW ≥ V4.0) is simulated only with standard S7-PLCSIM in "PLCSIM Softbus" mode, which is good for testing PLC logic but has very limited external-client connectivity (no confirmed OPC UA/Modbus access from an external Node process). Test the edge against a **software twin of the PLC interface** (node-opcua server or modbus-serial ServerTCP), and test PLC logic in PLCSIM separately. Then do an integration test on a bench 1214C.

### Cited Findings
- [COMMUNITY] PLCSIM Advanced cannot simulate S7-1200. S7-1200 instances must be added in standard PLCSIM under the PLCSIM Softbus mode, and require CPU FW ≥ 4.0. Most S7-1200/1200F instructions are supported. Comms supported: S7 over the integrated PN port, TCP/IP and ISO-on-TCP (program connections only). Not simulated: recipes, data logging, trace, load-memory access, OB80, memory card, HSC, PID, motion, **access protection and copy protection** — [bilibili PLCSIM guide](https://www.bilibili.com/opus/783954475162271785)
- [OFFICIAL forum] PID_Compact V2.x is not supported for S7-1200 simulation in V18 — [Siemens SIOS forum 1179134](https://support.industry.siemens.com/forum/cn/en/post/1179134)
- [COMMUNITY, weak] PLCSIM V18 initial/SP1 had S7-1200 power-on failures fixed in V18 SP2 — [industrialmonitordirect](https://industrialmonitordirect.com/blogs/knowledgebase/resolving-plcsim-v18-s7-1200-instance-power-on-failure)
- [OFFICIAL, Siemens press] TIA Portal V20 supports S7 software testing including sequential testing — [Siemens press TIA V20](https://press.siemens.com/global/en/node/7037)

### Inferences
- [REC] Three test layers:
  (1) **Interface twin**: a node-opcua (or modbus-serial) server implementing the same mailbox/ack/heartbeat/lease contract and the 9 interlocks as a JS state machine. Use it for CI and fault injection: drop heartbeats, stale/duplicate `cmd_id`, expired TTL, CRC errors, PLC restart mid-command, HOA switched to Hand, motor feedback timeout.
  (2) **PLC logic in PLCSIM**: TIA test cases / watch tables for OB100, lease expiry, clamping, interlocks and the local-safe program.
  (3) **Hardware-in-the-loop bench**: a real 1214C (FW ≥ V4.7) with the OPC UA license, lamps/relays for the 6 motors and feedback switches. Run the same fault-injection suite. Do this before site commissioning, and repeat a subset (heartbeat kill, power cycle, Hand mode) as the site acceptance test.
- [REC] Because PLCSIM does not simulate access protection, security settings (OPC UA users, PUT/GET off, access level) must be verified on real hardware.

### Gaps
- Not confirmed: whether current S7-PLCSIM (V19/V20/V21) or PLCSIM Advanced V7+ can simulate the **S7-1200 G2** with an externally reachable OPC UA server. If a G2 is chosen, check this; it could change the testing strategy.
- No source found for a ready-made S7-1200 OPC UA interface simulator. Building the twin is an engineering task.
