# Local (on-site) LoRaWAN network-server options and offline behaviour for an autonomous greenhouse

Scope: Milesight UG67 embedded NS, Milesight D2D, ChirpStack v4 on-prem, The Things Stack, Actility ThingPark Enterprise on-prem, and migrating devices off ThingPark cloud. Region EU868. Research date 2026-10-29.
Source labels: **[OFFICIAL]** = vendor docs or datasheet. **[COMMUNITY]** = forum or third-party guide. **[VENDOR-MKT]** = marketing or reseller copy. **[INFERENCE]** = my reasoning, not stated by a source.

Note on the UG67 documentation: Milesight does not publish a separate UG67 web manual that I could retrieve. The UG65 user guide (V2.14, April 2026, ~4700 lines, extracted locally with pdftotext) is the closest official reference. UG65 and UG67 use the same firmware family: ChirpStack's guide gives a single firmware threshold, 60.0.0.43, for both models. UG67 behaviour below is inferred from the UG65 guide unless stated otherwise. Milesight's "mini-gateway" (UG63-class) web docs give much smaller limits (20 devices, 500 packets) and do NOT apply to UG67.

---

## Q1. Milesight UG67 embedded network server: capacity, MQTT/HTTP integration, buffering, dual forwarding, multi-gateway, firmware

### Takeaway
On firmware V2.11+ (2025–2026), the UG65/UG67 embedded NS covers most of the approved design without extra parts:
- **Dual delivery:** each application can push to one MQTT broker and one HTTP(S) endpoint at the same time, so a local edge broker and a cloud endpoint can both receive data.
- **Offline buffering:** MQTT data retransmission stores up to 10,000 messages while the link is down.
- **Multi-gateway:** "Gateway Fleet" mode lets one gateway's NS serve up to 100 agent gateways.

The gateway has no documented built-in MQTT broker, so the broker has to run on the edge computer. Whether the buffer survives a reboot, and whether HTTP is also retransmitted, are undocumented.

### Cited Findings
**Capacity and hardware**
- UG67 "supports up to 2000+ nodes" [VENDOR-MKT / OFFICIAL product page]. It uses the SX1302 chip and a quad-core 1.5 GHz Cortex-A53 with 512 MB DDR4 and 8 GB eMMC. — [Milesight UG67 product page](https://milesight.com/iot/product/lorawan-gateway/ug67); the same 2000-node figure appears in the datasheet mirror — [UG67 datasheet (spectra.de mirror)](https://spectra.de/media/f8/2e/7a/1639734930/Datasheet-UG67.pdf)
- The UG65 guide says it "supports connection with more than 2000 nodes" with "integrated mainstream network servers (such as The Things Industries, ChirpStack, etc.) and built-in network server" [OFFICIAL] — [Milesight UG65 User Guide V2.14 (titan.ie mirror of official PDF)](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)
- No source states a hard limit on how many devices the embedded NS can register (as opposed to radio nodes served). The "2000+" figure is a radio/throughput marketing number. See Gaps.

**Application integration (MQTT/HTTP)** [OFFICIAL, UG65 guide §3.2.2.2]
- "Data will be sent to your custom server using the MQTT, HTTP or HTTPS protocol. One application can only add one MQTT transmission and one HTTP (HTTPS) transmission." — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)
- MQTT client settings:
  - broker address/port, client ID, connection timeout, keep-alive
  - username/password
  - TLS (CA-signed or self-signed with client cert/key)
  - Last Will (topic/QoS/retain/message)
  - per-topic QoS 0/1/2 and a Retain flag
- MQTT topic types:
  - Uplink Data
  - Downlink Data (`$deveui` wildcard in topic)
  - Multicast Downlink
  - Join Notification
  - ACK Notification
  - Error Notification
  - Request/Response data, used "to enquire and configure the gateway NS" over MQTT — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)
- HTTP/HTTPS integration has configurable **custom HTTP headers** (Header Name/Value) and a separate URL per data type (Uplink, Join, ACK, Error) — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)
- "Metadata" option (V2.11.1+): selected uplink details are added automatically when the device uses a payload codec. A built-in Payload Codec library for Milesight devices supports custom codecs for other brands — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)
- Uplink JSON format [OFFICIAL, Milesight MQTT API docs, other gateway lines]: "All messages between the gateway embedded network server and MQTT brokers are transmitted via JSON". Fields:
  - applicationID, applicationName, devEUI, deviceName, fCnt, fPort
  - data (base64 raw payload)
  - rxInfo[] (gateway mac, rssi, loRaSNR, name, time, lat/lon/alt)
  - txInfo (frequency, dataRate{modulation, bandwidth, spreadFactor}, adr, codeRate)
  - This is a ChirpStack-v3-like shape, NOT ChirpStack v4's `deviceInfo.devEui` — [Milesight UG/MQTT API doc](https://resource.milesight.com/milesight/iot/document/ug-mqtt-api-documentation-en.pdf); [Milesight Uplink Data (mini-gateway app guide)](https://www.milesight.com/docs/en/mini-gateway/application-guide/uplink-data.html)
- A local broker is not mentioned in the guide. The MQTT client points to an external "MQTT broker address". Node-RED runs on the gateway (V2.1+, with SSL access V2.11.1) — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)
- Other local interfaces (V2.12–2.14): BACnet server (BACnet/IP and /SC) and Modbus server, exposing device objects. Global objects include per-device online status, RSSI, SNR, frame count, and up to 10,000 objects — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)
- There is a per-device "Timeout" parameter: "Offline: No device packet received within the timeout" — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)

**Buffering / retransmission** [OFFICIAL, UG65 guide]
- Application MQTT: "Data Retransmission — After enabled, it supports data storage of up to **10,000 pieces of data** when the network is disconnected and re-transmits the data after network recovery." Added in V2.11 (April 2025, "Add MQTT data re-transmission and retain option") — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)
- Packet Forwarder (when forwarding raw packets to an external NS): "Data Retransmission — When enabled, it supports storing up to **1 million data items** when the network is disconnected and retransmits them after network recovery". V2.14 adds a "data retransmission and packet filter limitation when multiple packet forwarders are enabled" — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)
- For comparison only, the smaller Milesight mini gateway stores 500 uplinks in packet-forward mode and 100 MQTT packets. "The gateway does not save Join Request packets." It lists no retransmission for Embedded NS mode — [Milesight mini-gateway Packet Forward](https://www.milesight.com/docs/en/mini-gateway/user-guide/packet-forward.html); [mini-gateway Network Server](https://www.milesight.com/docs/en/mini-gateway/user-guide/network-server.html)
- No source states whether the 10,000-message MQTT buffer survives a reboot or power loss, or whether HTTP has a retransmission buffer. HTTP retransmission is not listed in the guide.

**Simultaneous local + cloud forwarding**
- Per application, one MQTT plus one HTTP(S) destination run at once (quote above). Option: MQTT → local edge broker and HTTPS → cloud app (e.g. TagoIO), or the reverse — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)
- Packet-forwarder multi-destination: "If more than one destination is enabled, only Semtech packet forwarders or Semtech + Embedded NS are supported". With a single destination, ChirpStack, Semtech, Embedded NS, Remote Embedded NS and Basic Station types are supported — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)

**Multi-gateway**
- "Gateway Fleet: Milesight gateways can connect to the gateway network server. Each gateway supports a maximum of **100 agent gateways**." There is a status page for the number and details of online agent gateways (V2.14), and a packet-forwarder type "Remote Embedded NS" — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)

**Device management features**
- FUOTA (unicast and multicast) for end devices.
- Class B/C multicast groups.
- Batch device import from a template, and "Export all device info".
- The guide documents a published default Milesight AppKey and a default DevAddr derived from the serial number. Devices left on defaults have publicly known keys.
- Source: [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)

**Firmware update practice** [OFFICIAL]
- "It is suggested that you contact Milesight technical support first before you upgrade gateway firmware. Gateway firmware file suffix is '.bin'". Upgrade is done at Maintenance > Upgrade, with an optional "Reset Configuration to Factory Default". Remote mass management is available via Milesight DeviceHub 1.0/2.0 or the Milesight Development Platform — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)
- Backup and restore:
  - Full Backup includes the embedded NS settings.
  - "Batch Backup" deliberately excludes the packet-forwarder gateway ID, all embedded NS settings, and all app settings.
  - So devices and keys must be backed up with Full Backup or device export.
  - Source: [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)
- Community report: the UG67's built-in ChirpStack-v4 MQTT forwarder appeared to be an outdated gateway bridge [COMMUNITY] — [ChirpStack forum: ACK not being seen by UG67](https://forum.chirpstack.io/t/ack-not-being-seen-by-milesight-ug67-gateway/23678)

### Inferences
- [INFERENCE] The approved design (UG67 embedded NS → MQTT to edge broker) fits the documented features:
  - **Local MQTT path:** the MQTT broker runs on the edge computer (Mosquitto or similar). The edge is not affected by WAN loss, because the gateway reaches it over the LAN.
  - **Cloud copy:** the HTTPS integration can push in parallel to the cloud.
  - **WAN-loss gap:** the 10,000-message MQTT buffer protects the MQTT leg. The HTTP leg to the cloud has no documented buffer, so cloud data would be lost during WAN outages unless the edge re-publishes to the cloud from its own store-and-forward queue (recommended).
- [INFERENCE] Scale check: 10,000 messages ≈ 34 h for a greenhouse with ~50 devices at 10-min reporting, but ≈ 1 h for 329 devices at ~2-min aggregate rates. Use QoS 1 to a broker on the same LAN, so this buffer only matters if the edge PC itself is down.
- [INFERENCE] The JSON format differs from ThingPark's DevEUI_uplink and from ChirpStack v4. Edge and cloud parsers need an adapter layer, written once per NS type.
- [INFERENCE] Because "Batch Backup" excludes NS settings, a replacement UG67 needs a Full Backup restore or a device re-import (CSV). Keep a device list with keys under version control (encrypted) for the greenhouse.

### Gaps
- Official per-UG67 maximum number of devices *registered* on the embedded NS: not found (only "2000+ nodes").
- Whether the MQTT retransmission buffer persists across reboot or power loss: not documented.
- Whether HTTP(S) integration retries or buffers: not documented.
- Whether a local MQTT broker exists on the gateway (other than via Node-RED nodes): not documented.
- Exact UG67 firmware version mapping to UG65 guide V2.14 features: not confirmed for UG67 specifically. Verify on the unit (Status page firmware 60.0.0.x).

---

## Q2. Milesight D2D (device-to-device)

### Takeaway
Milesight D2D is a proprietary LoRa (not LoRaWAN) one-way trigger:
- **How it works:** a "controller" broadcasts a 2-byte command, encrypted with a shared D2D key, on the RX2 frequency/data-rate. "Agents" with the same key act on it.
- **Latency:** Milesight claims under 1 s.
- **Acknowledgement:** no ACK or retry mechanism is documented.
- **Security:** keys are readable by NFC on unpatched firmware (July 2026 advisory). UC511/UC512 fixed at v1.7.
- **Supervision:** only indirect, through the normal LoRaWAN uplinks that controller and agent can send after acting.

### Cited Findings
**How it works**
- "Milesight D2D protocol is developed by Milesight and used for setting up transmission among Milesight devices without gateway, which is able to reduce the latency and achieve the quick control" [OFFICIAL] — [Milesight D2D Setting (EM300 family)](https://www.milesight.com/products/docs/en/em300-di/steps/em300/d2d-setting.html); [UC100 D2D Settings](https://www.milesight.com/products/docs/en/uc100/steps/uc100v2/d2d-setting.html)
- Controller and agents need the same D2D key, and the same RX2 data rate and RX2 frequency. Milesight suggests changing defaults where many LoRaWAN devices are nearby. Commands are 2-byte hex — [UC100 D2D Settings](https://www.milesight.com/products/docs/en/uc100/steps/uc100v2/d2d-setting.html); [EM300-DI D2D Setting](https://www.milesight.com/products/docs/en/em300-di/steps/em300/d2d-setting.html)
- EM300-DI as controller:
  - A threshold or alarm triggers a D2D command.
  - An optional "LoRa Uplink" sends a LoRaWAN uplink with the alarm status to the gateway **after** the D2D packet.
  - Source: [EM300-DI D2D Setting](https://www.milesight.com/products/docs/en/em300-di/steps/em300/d2d-setting.html)
- UC100 as agent: on "Received a D2D control command" it can restart, "send a server message", send another D2D command, send RS485, or upload a data packet — [UC100 D2D Settings](https://www.milesight.com/products/docs/en/uc100/steps/uc100v2/d2d-setting.html)
- UC51x (UC511/UC512) as agent [OFFICIAL]:
  - `d2d_enable` "ONLY takes effect with hardware version 4.x", and Milesight suggests using it in **Class C** work mode.
  - `d2d_key` is 16 hex characters; "the last 16 characters are set to all 0".
  - A rule `condition_mode = 2` (Milesight D2D) matches `d2d_condition.cmd` (4 hex characters).
  - The action is valve 1/2 open/close, optionally for `time_continue` seconds or `count_continue` pulses.
  - Source: [Milesight Development Platform — UC51x properties](https://www.milesight.com/development-platform/docs/en/device-reference/uc51x-properties.html)

**Latency, ack, behaviour**
- Brochure: "Fast Response in ONE Second", "Low latency (less than 1 second in the same room)", and "As secure as the standard LoRaWAN network" [VENDOR-MKT, official brochure] — [Milesight D2D brochure](https://resource.milesight.com/milesight/all/our-brand/milesight-d2d-brochure-en.pdf)
- Brochure FAQ:
  - On the WS136/WS156 panels, "the initial 6 times of operation will get an immediately treatment. After that, the command will be sent with a latency of 4 seconds" (battery protection).
  - One controller can drive many agents, and one agent can be triggered by many controllers.
  - D2D is recommended within "the same floor, i.e. line of sight area".
  - Source: [Milesight D2D brochure](https://resource.milesight.com/milesight/all/our-brand/milesight-d2d-brochure-en.pdf)
- Conflict: brochure FAQ A1 says "When the D2D is enabled, device will stop the data transmission in the standard LoRaWAN network, and prior the Milesight D2D protocol". Newer device docs (EM300-DI) show the device sending a LoRaWAN uplink after the D2D packet, and UC100 agents can "send a server message". [OFFICIAL vs OFFICIAL, different dates] — [D2D brochure](https://resource.milesight.com/milesight/all/our-brand/milesight-d2d-brochure-en.pdf) vs [EM300-DI D2D Setting](https://www.milesight.com/products/docs/en/em300-di/steps/em300/d2d-setting.html)
- No official or community source describes D2D acknowledgements, confirmations, retries, or behaviour when the agent misses the frame (searched device D2D pages, brochure, UC51x reference).

**Encryption and security**
- D2D has a published default key on device pages. Users should set a unique key — [UC100 D2D Settings](https://www.milesight.com/products/docs/en/uc100/steps/uc100v2/d2d-setting.html)
- Milesight security advisory (15 July 2026) [OFFICIAL]:
  - **The flaw:** an attacker with physical NFC access can read ABP keys and D2D keys in plaintext, then decrypt and tamper with data and "send unauthorized commands to D2D terminals".
  - **Affected:** devices that use ABP or D2D in uncontrolled spaces. OTAA devices without D2D are not affected.
  - **Mitigations:** restrict physical access, move ABP to OTAA, disable D2D, update firmware.
  - **Patched:** UC511/UC512 v1.7, EM300-TH v1.11, EM320-TH v1.8, among others.
  - **Not yet patched:** UC521, among others. Batches are scheduled through 30 Oct and 30 Dec 2026.
  - Source: [Milesight — Vulnerabilities in some Milesight sensors](https://www.milesight.com/legal/vulnerabilities-in-some-milesight-sensors)

**Supported devices** [OFFICIAL unless noted]
- D2D setting pages exist for:
  - EM300-DI, EM300-TH, EM300-MLD, EM300-SLD
  - EM500-PP, EM500-SMTC
  - UC100
  - WS50x, WS51x/52x
  - WT30x, WT2x1
  - VS34x
  - Sources: [EM300-DI](https://www.milesight.com/products/docs/en/em300-di/steps/em300/d2d-setting.html), [EM500-SMTC](https://www.milesight.com/products/docs/en/em500-smtc/steps/em500/d2d-setting.html), [WS50x](https://www.milesight.com/products/docs/en/ws50x/steps/ws50x/d2d-setting.html), [WT30x](https://www.milesight.com/products/docs/en/wt30x/steps/wt/wt30x-d2d-settings.html), [VS34x](https://www.milesight.com/products/docs/en/vs34x/steps/vs3xx/vs34x-d2d.html)
- The brochure says only UC100, UC300, WS52x and WS50x can act as either controller or agent. Others have a fixed role — [D2D brochure](https://resource.milesight.com/milesight/all/our-brand/milesight-d2d-brochure-en.pdf)
- WS558 "supports Milesight D2D communication protocol ... controlled without gateway" [third-party repo quoting vendor] — [TTN device repository WS558](https://www.thethingsnetwork.org/device-repository/devices/milesight-iot/ws558/)
- UC511/UC512: D2D agent on hardware v4.x only (above).

### Inferences
- [INFERENCE] D2D is open-loop. A lost frame (interference, collision on the shared RX2 channel, agent asleep) is not detected by the controller. For irrigation/valve control it should only be a **fallback or interlock** (e.g. a fail-safe "close valve"), never the only path. Closed-loop supervision is needed: the agent (UC511) reports valve status by LoRaWAN uplink, and the edge compares expected vs actual state within a timeout.
- [INFERENCE] With the UC511 D2D key fixed at 16 hex characters plus zero padding, the effective key material appears to be 64 bits, not 128. This is a weaker margin than LoRaWAN AES-128 session keys. Interpret with caution; confirm with Milesight.
- [INFERENCE] Class C is recommended for UC511 D2D agents (they listen continuously). A solar or battery UC511 in Class C will drain much faster. Check the energy budget before relying on D2D at a valve.
- [INFERENCE] Any UC511 below firmware v1.7 that uses D2D (or ABP) has extractable keys. Update before enabling D2D.

### Gaps
- D2D ACK/retry/confirmation behaviour: no documentation found. Ask Milesight support directly.
- Measured latency in a greenhouse (metal structure, humidity): only the vendor claim "<1 s same room" exists.
- D2D cipher (AES-128-CTR? MIC?) and replay protection: not documented.
- Full current device compatibility matrix (which firmware enables D2D on UC511 HW4.x, AM319, EM320): not found.

---

## Q3. ChirpStack v4 on-premise

### Takeaway
ChirpStack v4 is a single Rust binary that needs:
- PostgreSQL ≥13 (with `pg_trgm`) or the SQLite build
- Redis ≥6.2
- an MQTT v5 broker (Mosquitto)

It runs fully offline. The UG65/UG67 connects natively via its built-in "ChirpStack-v4" MQTT forwarder (firmware ≥60.0.0.43). The HTTP integration posts Protobuf or JSON with `?event=up`, the uplink JSON carries `deviceInfo.devEui`, and custom headers are set per integration in the UI. The ChirpStack forwarder itself does not persist-buffer during broker outages unless QoS ≥1 or a local bridge is used.

### Cited Findings
- Requirements [OFFICIAL] — [ChirpStack requirements](https://www.chirpstack.io/docs/chirpstack/requirements.html):
  - MQTT broker supporting MQTT v5.0 and shared subscriptions (Mosquitto is the popular choice)
  - PostgreSQL ≥13 with the `pg_trgm` extension, or SQLite via the `chirpstack-sqlite` binary
  - Redis ≥6.2.0 for device sessions, metrics and cache
  - No hardware sizing given
- HTTP integration [OFFICIAL] — [ChirpStack HTTP integration](https://www.chirpstack.io/docs/chirpstack/integrations/http.html):
  - POSTs to one or more comma-separated endpoints with an `event` query parameter (`up`, `join`, ...)
  - Encoding is Protobuf (default) or JSON (Protobuf JSON mapping)
  - The page does not document retries or delivery guarantees
- Event JSON contains a `deviceInfo` object (tenant/application IDs, `devEui`, tags) and rxInfo/txInfo [OFFICIAL] — [ChirpStack event types](https://www.chirpstack.io/docs/chirpstack/integrations/events.html)
- v3 → v4 change: "the device EUI has been changed from 'devEUI' : <base64> to 'deviceInfo.devEui' : <hex string>" [COMMUNITY] — [ChirpStack forum: Device integration](https://forum.chirpstack.io/t/device-integration/18611)
- Custom headers: added per HTTP integration in the UI ("+ Add header", e.g. `Authorization: Bearer …`) [COMMUNITY / vendor tutorials] — [MeteoScientific ChirpStack integrations](https://meteoscientific.com/docs/tutorial-basics/chirpstack-integrations); [Ubidots ChirpStack guide](https://help.ubidots.com/en/articles/6326842-integrate-your-chirpstack-data-with-ubidots); [ChirpStack forum: HTTP integration authorization](https://forum.chirpstack.io/t/http-integration-authorization/10078)
- TagoIO notes that ChirpStack v4 requires a new connector (format change) [COMMUNITY] — [TagoIO community: Chirpstack v4 requires a new connector](https://help.tago.io/portal/en/community/topic/chirpstack-v4-requires-a-new-connector)
- UG65/UG67 with ChirpStack v4 [OFFICIAL ChirpStack guide] — [ChirpStack: Milesight gateway configuration](https://www.chirpstack.io/docs/gateway-configuration/milesight.html):
  - "UG65/UG67 has built-in ChirpStack MQTT Forwarder", firmware ≥60.0.0.43.
  - Steps: disable Embedded NS under Packet Forward > Multi-Destination, add destination Type "ChirpStack-v4", server address, MQTT port 1883, Region ID.
  - Then register the gateway EUI in ChirpStack.
- Offline buffering at the gateway → ChirpStack link [COMMUNITY] — [ChirpStack support Q&A: MQTT forwarder QoS 0 / offline buffering](https://support.chirpstack.io/questions/D1br); [ChirpStack forum: Buffer if connection lost](https://forum.chirpstack.io/t/buffer-if-connection-lost/19008):
  - The mqtt-forwarder has a `qos` option under `[mqtt]` (0/1/2), confirmed by the maintainer.
  - One user saw no buffering at all when connecting directly to a remote broker.
  - With a Mosquitto bridge, 23–62 % of uplinks were still lost after reconnection, partly because ChirpStack 4.18 processes replayed uplinks out of order ("FCntUp already updated").
- A non-persistent Redis restart loses device sessions, which forces devices to rejoin [COMMUNITY] — [ChirpStack forum: Sensor not re-joining gateway](https://forum.chirpstack.io/t/sensor-not-re-joining-gateway/17954)
- A "UG67 built-in ChirpStack-v4 forwarder appears outdated" report exists [COMMUNITY] — [ChirpStack forum thread](https://forum.chirpstack.io/t/ack-not-being-seen-by-milesight-ug67-gateway/23678)

### Inferences
- [INFERENCE] For a single-gateway greenhouse, ChirpStack adds three services (PostgreSQL/SQLite, Redis, Mosquitto) and maintenance for no functional gain over the UG67 embedded NS. That matches the approved decision: ChirpStack only for multi-gateway sites.
- [INFERENCE] With multiple gateways, ChirpStack's real advantage is deduplication across gateways and a single device registry, which the UG67 "Gateway Fleet" (≤100 agents) also offers but with less transparency.
- [INFERENCE] If ChirpStack runs on the edge PC on the same LAN as the gateways, WAN loss does not affect it. The buffering problems above only apply when the NS is remote. Configure Redis with AOF/RDB persistence, so sessions survive restarts and no mass re-join happens after an edge reboot.
- [INFERENCE] Resource needs are not officially documented. The SQLite build plus Redis plus Mosquitto commonly run on Raspberry-Pi-class hardware (ChirpStack Gateway OS full image), but no official sizing was found.

### Gaps
- Official hardware sizing for ChirpStack v4: none published.
- Official ChirpStack HTTP integration retry/timeout semantics: not on the docs page.
- Whether the UG67's built-in forwarder honours QoS 1 / buffers: not documented (the Milesight packet-forwarder "Data Retransmission 1 million items" likely applies, but this is not confirmed for the ChirpStack-v4 type on UG67).

---

## Q4. The Things Stack (Open Source / Enterprise) and Actility ThingPark Enterprise on-prem / edge

### Takeaway
- **The Things Stack Open Source:** free (Apache-2.0) and self-hostable, but TTI calls it "limited in features and not suitable for production", with no multi-tenancy.
- **TTS Enterprise on-prem:** paid, quote-only.
- **ThingPark Enterprise (TPE):** can be self-hosted on-premise "with or without internet access", including offline install/upgrade, with licensing by device or gateway volume. There is also an "All-in-One" gateway-embedded NS. Prices are not public.

Both are heavier than needed for one greenhouse, but TPE on-prem would keep the ThingPark tooling and data format.

### Cited Findings
- The Things Stack Open Source is described as "limited in features and is not suitable for production". Multi-tenancy is supported on all deployments "except Open Source and AWS Launcher" [OFFICIAL] — [TTI: The Things Stack basics](https://thethingsindustries.com/docs/getting-started/the-things-stack-basics)
- Enterprise is installed with Docker on own hardware (docs) — [TTI Enterprise docs](https://www.thethingsindustries.com/docs/enterprise); Enterprise on-prem pricing is "email sales" [VENDOR-MKT reseller] — [MCCI store](https://store.mcci.com/products/the-things-stack-cloud-lorawan-network-server-solution)
- TTI supports the UG67 as a packet forwarder or Basic Station gateway [OFFICIAL] — [TTI: Milesight UG67](https://thethingsindustries.com/docs/gateways/models/milesightug67)
- ThingPark Enterprise [OFFICIAL] — [ThingPark Enterprise key highlights](https://docs.thingpark.com/thingpark-enterprise/latest/docs/overview-tpe/key-highlights/):
  - SaaS, on-premise ("can run with or without internet access; offline installation and upgrade are supported"), AWS/Azure/Alibaba images, and "All-in-one" autonomous gateway with an embedded NS
  - Up to 50,000 gateways / 12 M devices
  - Licensing "based on device volumes or gateway volumes", with optional HA (3-node cluster, Docker Swarm/Kubernetes) and geolocation
  - HTTP/MQTT/AMQP connectors
  - The LRR packet forwarder buffers uplinks during backhaul disconnections
- ThingPark Enterprise All-in-One: "entry-level, single gateway, LoRaWAN private network", upgradeable to full TPE [OFFICIAL] — [ThingPark Enterprise overview](https://docs.thingpark.com/thingpark-enterprise/latest/docs/overview-tpe/); its devices move to full TPE via an export file and migration key — [TPE All-in-One: migrate to TPE full](https://docs.thingpark.com/thingpark-enterprise-all-in-one/advanced/migrate-to-tpe-full)
- No public TPE price: "contact Actility or channel partner"; per-device or per-base-station licensing [third-party] — [FitGap ThingPark Enterprise](https://us.fitgap.com/products/thingpark-enterprise); [G2](https://www.g2.com/products/thingpark-enterprise/pricing)
- Advantech + Actility "edge solution ready package" (TPE on an industrial edge PC) [VENDOR-MKT] — [Advantech news](https://www.advantech.com/zh-tw/resources/news/advantech-and-actility-launch-an-edge-solution-ready-package-to-deploy-enterprise-iot-lorawan-networks)

### Inferences
- [INFERENCE] The LRR buffering in ThingPark SaaS protects only the gateway → cloud leg. Uplinks still need the internet to reach the NS and come back to a local controller, so cloud ThingPark is unsuitable as the control path for an autonomous greenhouse. That is the reason for the approved local-NS decision.
- [INFERENCE] TPE All-in-One on the gateway is functionally equivalent to the UG67 embedded NS, but needs an Actility-supported gateway and a license. It makes sense only if keeping ThingPark's data format and tooling is a priority. Nothing found indicates the UG67 can run TPE All-in-One.
- [INFERENCE] "Local breakout" in ThingPark SaaS (routing uplinks locally while the NS stays in the cloud) was not found in current docs. It should not be assumed to exist.
- [INFERENCE] Cost ranking for one greenhouse: UG67 embedded NS (0 €) < ChirpStack/TTS Open Source (0 € license, ops effort) < TTS Enterprise / TPE on-prem (quote-only, likely annual license). Not sourced.

### Gaps
- Actual TPE on-prem / All-in-One and TTS Enterprise prices: not published. Quotes are needed from Actility or TTI partners.
- Whether Actility offers a "local breakout" or edge NS on third-party (Milesight) gateways in 2026: not found.
- Exact feature diff between TTS Open Source and Enterprise (e.g. HA, packet broker, device claiming): no official comparison table retrieved.

---

## Q5. Migrating devices off ThingPark

### Takeaway
OTAA devices can move by registering the same DevEUI/JoinEUI/AppKey on the local NS and forcing a re-join:
- Remove or disable the device in ThingPark first, or change its AppKey there, so ThingPark cannot answer the join.
- Trigger the join by reboot, downlink, or the device's own link-check rejoin.

A device holds one session, so it can only be on one NS at a time. ABP devices must be reprogrammed or moved to OTAA, which Milesight's July 2026 security advisory also recommends. Keys are only exportable if ThingPark holds them in plaintext (not with an external Join Server or HSM). Per-device downtime is one reporting interval to roughly one link-check cycle, plus join time.

### Cited Findings
- ThingPark import/export CSV has an AppKey column, "Mandatory if External Join Server option is DEACTIVATED, Forbidden otherwise". An "HSM exchange key" can be used to encrypt AppKey/NwkKey [OFFICIAL] — [ThingPark Enterprise: Importing devices](https://docs.thingpark.com/thingpark-enterprise/latest/docs/user-guide/devices-multicasts-connections/devices/activate-new-devices/import-devices); bulk operations — [ThingPark bulk operations](https://docs.thingpark.com/thingpark-enterprise/latest/docs/user-guide/devices-multicasts-connections/devices/bulk-operations/)
- Datacake describes exporting identifiers and keys from ThingPark to CSV and reusing the same DevEUI, JoinEUI/AppEUI and AppKey on the new NS [VENDOR-MKT] — [Datacake: migrate from Actility](https://datacake.co/migrate/from-actility)
- Generic NS-to-NS migration guidance (TTI) [OFFICIAL, TTS-specific but applicable in principle] — [TTI: migrate without persisting sessions](https://www.thethingsindustries.com/docs/concepts/migration/migrating-between-tts-distributions/establish-new-session/):
  - **OTAA:** do a new join on the target and get a new DevAddr. First stop the old NS from sending Join Accepts/downlinks, then change the AppKey on the old NS or delete the device there, so it cannot rejoin the old NS.
  - **ABP:** reprogram with new DevAddr/NwkSKey/AppSKey, or switch to OTAA. Keeping the old ABP keys requires frame-counter resets, which "violate" the session.
  - Some devices rejoin automatically after deletion. Others need a downlink or a power cycle.
- Milesight rejoin behaviour [OFFICIAL] — [EM320-TILT LoRaWAN settings](https://www.milesight.com/products/docs/en/em320-tilt/steps/em320/em320-tilt-lorawan-settings.html); [EM300-TH LoRaWAN settings](https://www.milesight.com/products/docs/en/em300-th/steps/lorawan-settings.html):
  - "Rejoin mode" is supported only in OTAA.
  - The device sends LinkCheckReq periodically. If there is no answer, it re-joins after a model-dependent number of reports.
  - On EM320-TILT, the documented rule depends on whether the reporting interval is ≤ or > 35 min.
- Milesight advisory: switch ABP devices to OTAA (Toolbox or remote downlink) and "the old ABP configuration should be removed from the network server" [OFFICIAL] — [Milesight vulnerabilities advisory](https://www.milesight.com/legal/vulnerabilities-in-some-milesight-sensors)
- Re-joining a Milesight sensor to a new server: set the join mode to OTAA and write the matching AppKey/EUI with the ToolBox (NFC) [COMMUNITY] — [DEV Community: UG56 + WS101 to ThinkLink](https://dev.to/zhao_mingfei_8d86042f64c2/how-to-connect-milesight-ug56-lorawan-gateway-ws101-sensor-to-manthink-thinklink-server-a9c)
- Community migration pitfalls [COMMUNITY] — [ChirpStack forum: Sensor can't rejoin after migration to V4](https://forum.chirpstack.io/t/sensor-cant-rejoin-after-migration-to-v4/25671); [ChirpStack forum: Sensor not re-joining](https://forum.chirpstack.io/t/sensor-not-re-joining-gateway/17954):
  - devices stuck in join loops after migration
  - lost Redis sessions requiring a node reboot
  - "newer LoRaWAN nodes will force a rejoin if no downlink from server for a period of time"
- The Milesight embedded NS supports batch device import from a template, and per-device AppKey options include the Milesight default key or "Device EUI+Device EUI" [OFFICIAL] — [UG65 User Guide](https://www.titan.ie/wp-content/uploads/Milesight-ug65-user-guide.pdf)

### Inferences
- [INFERENCE] Why one NS at a time: after OTAA, a device has a single DevAddr and session keys (NwkSKey/AppSKey) issued by whichever NS accepted the join. Only that NS can verify the MIC and decrypt. If both ThingPark and the local NS hold the AppKey and both hear the join (e.g. the UG67 forwarding to ThingPark while running an embedded NS), both may answer. The device takes one Join Accept and the other NS holds a dead session. Ensure only one NS can answer joins: delete or disable in ThingPark, or change the AppKey there.
- [INFERENCE] Practical per-greenhouse procedure:
  1. Inventory the DevEUI, JoinEUI and AppKey of the greenhouse's devices from the ThingPark export or CSV. Check whether ThingPark returns plaintext AppKeys. If not (HSM or external Join Server), get the AppKeys from the original provisioning records, device stickers (Dragino), or the SenseCAP app (Seeed S2120), or set new AppKeys via NFC/ToolBox for Milesight.
  2. Bulk-import the devices into the UG67 embedded NS (CSV template) under an application with MQTT → edge broker (+ HTTPS → cloud).
  3. Switch the UG67 packet forwarder from ThingPark to Embedded NS. This migrates every device heard by that gateway at once, so plan per site.
  4. Delete or disable the devices in ThingPark.
  5. Force re-joins: reboot via downlink before cut-over, a power cycle or NFC "reset" on site, or wait for link-check rejoin.
  6. Verify each DevEUI's first uplink on the edge broker, then on the cloud.
- [INFERENCE] Expected downtime per OTAA device:
  - **With a forced reboot:** minutes.
  - **Relying on link-check rejoin:** possibly several reporting intervals (hours for 30–60-min reporters).
  - **ABP devices:** stay down until reprogrammed on site.
- [INFERENCE] Devices registered with Milesight's published default AppKey are a security issue (the key is public). Migration is the moment to assign unique AppKeys via ToolBox/NFC.
- [INFERENCE] Dragino LSE01/SE0X/LSPH01 and Seeed S2120 have no Milesight-style downlink "rejoin"/reboot command documented in this research. Plan on-site power cycles (Dragino: button/ATZ via UART; S2120: SenseCAP app via Bluetooth).

### Gaps
- Whether the team's ThingPark account exposes plaintext AppKeys in CSV export (depends on account and HSM settings): must be checked in the ThingPark UI.
- Which of the 329 devices are ABP vs OTAA: unknown from this research. Check the ThingPark device list.
- Dragino and Seeed remote rejoin/reboot downlink commands: not researched in this pass.
- No source gives measured fleet-migration downtime figures.
