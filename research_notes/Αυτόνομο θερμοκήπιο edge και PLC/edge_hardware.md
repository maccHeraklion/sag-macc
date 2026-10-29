# Edge-computer hardware for the autonomous greenhouse (L2 between the LoRaWAN gateway and the S7-1200)

Researched 2026-10-29. Source labels:
- **[DS]**: official manufacturer datasheet or documentation.
- **[RET]**: retailer or distributor listing.
- **[3P]**: third-party article or reseller documentation.
- **[EST]**: my own estimate or inference.

Prices are indicative and exclude VAT unless stated.

Workload requirements (from the brief):
- Node 20, Fastify and SQLite in WAL mode, ideally under Docker.
- MQTT link to a LoRaWAN network server.
- An outbox that keeps 30+ days of data while offline.
- Modbus TCP or OPC UA to an S7-1200.
- A PWA served on the LAN.

All candidates below are ARM64 or x86-64, and Node 20 has official builds for both (linux-arm64 / linux-x64). The exception is the Moxa UC-8200, whose 32-bit Cortex-A7 needs armv7l Node builds.

---

## 1. Specs per candidate

### Takeaway
No candidate meets every requirement. The ARM gateways that also run Docker are:
- **RAK7391/7393:** the only all-in-one with a LoRa concentrator.
- **SIMATIC IOT2050:** official Siemens, but 0–50 °C.
- **RevPi Connect 4:** −25..55 °C.
- **Moxa UC-8200:** −40..70 °C, but 32-bit and only 2 GB RAM.

Among the x86 boxes, the **OnLogic Karbon 410** (−40..70 °C [3P], 9–48 VDC, fanless, DIN rail) has the strongest thermal rating. The currently named **CL210G-10** is the weakest for this site: 0–50 °C, or **0–40 °C with the standard adapter**, 12 V barrel jack, and an older successor-superseded model.

### Cited findings

#### OnLogic CL210G-10 (current choice in tier.json)
- CPU Intel Celeron N3350 (x86-64, dual-core); 4 GB LPDDR4 onboard; 32 GB eMMC plus a microSD slot. [3P] — [HARDWARIO docs](https://docs.hardwario.com/smart-devices/onlogic/cl210g-10)
- 2× GbE; **12 V DC barrel jack**; fanless; DIN-rail clips or wall bracket. [3P] — [HARDWARIO docs](https://docs.hardwario.com/smart-devices/onlogic/cl210g-10)
- **Operating temperature 0..50 °C, or 0..40 °C with the standard power adapter.** [3P] — [HARDWARIO docs](https://docs.hardwario.com/smart-devices/onlogic/cl210g-10)
  - A search-engine snippet of the same page showed "0 °C to 60 °C", but the fetched page states 0–50 °C. Sibling models CL200G-10 and CL210G-11 are listed at 0–40 °C. [RET] — [Touchpoint CL200G-10](https://www.touchpoint.com.au/shop/onlogic-fanless-industrial-usff-edge-device-cl200g-10/), [Touchpoint CL210G-11](https://www.touchpoint.com.au/shop/onlogic-ultra-small-quad-core-fanless-industrial-edge-computer-cl210g-11/)
- Certifications: CE, FCC. [3P] — [HARDWARIO docs](https://docs.hardwario.com/smart-devices/onlogic/cl210g-10)
- **Successor:** the CL210G-11 (quad-core). Neither source marks the -10 as discontinued. [3P] — [HARDWARIO docs](https://docs.hardwario.com/smart-devices/onlogic/cl210g-10)
- The OnLogic store URL for the CL210G-10 returns HTTP 404 (checked 2026-10-29), which suggests it is no longer sold directly. [Observed] — onlogic.com/store/cl210g-10/
- Price:
  - About $335 configurable at launch. [3P, old] — [Liliputing](https://liliputing.com/?p=106145)
  - $199 on the secondary market. [RET, unreliable] — [ubbcentral](https://ubbcentral.com/store/item/OnLogic-CL210G-10-Ultra-Small-Edge-Device-New_226113556219.html)
  - B2B reseller lists "call". [RET] — [Touchpoint](https://www.touchpoint.com.au/shop/onlogic-fanless-industrial-usff-edge-device-w-dual-lan-cl210g-10/)
- Variant **CL210G-10-RS** adds a serial port and 32 GB eMMC. [RET] — [Touchpoint CL210G-10-RS](https://www.touchpoint.com.au/shop/onlogic-fanless-industrial-usff-edge-device-w-dual-lan-cl210g-10-rs/)

#### OnLogic Karbon 410 / Karbon 300
- **K410:** Intel Elkhart Lake Atom; passive cooling (Hardshell fanless); DIN rail, VESA or wall mount; **9–48 VDC**.
  - Operating temperature is **−40..70 °C** per DirectIndustry and the Red Hat catalog, but **−25..70 °C** per reseller Touchpoint. The sources conflict, so verify on onlogic.com. — [DirectIndustry](https://www.directindustry.com/prod/onlogic/product-240361-2489463.html), [Red Hat catalog (certified HW)](https://catalog.redhat.com/hardware/detail/216667), [Touchpoint K410](https://www.touchpoint.com.au/shop/onlogic-karbon-410-intel-elkhart-lake-compact-rugged-computer-k410/)
  - The 2021 launch coverage of the Karbon 400 series states fanless and −40..70 °C. [3P] — [Guru3D](https://www.guru3d.com/news-story/onlogic-releases-helix-300-and-karbon-400-intel-elkhart-lake-fanless-mini-pcs.html)
- **K300:** −25..70 °C; 9–36 VDC. [RET] — [Touchpoint K300](https://touchpoint.com.au/shop/onlogic-karbon-300-compact-rugged-computer-k300)
- The K410 is listed in the Red Hat certified-hardware catalog, so RHEL/Ubuntu-class x86 Linux and Docker run natively. [3P] — [Red Hat catalog](https://catalog.redhat.com/hardware/detail/216667)

#### Siemens SIMATIC IOT2050 (6ES7647-0BA00-1YA2), official Siemens datasheet dated 17 May 2026
- CPU **ARM TI AM6548 HS** (Cortex-A53, ARM64); **2 GB DDR4**; **16 GB eMMC** plus a microSD slot. [DS] — [Siemens datasheet (via Rapid)](https://static.rapidonline.com/pdf/07-0768_v1.pdf)
- **12/24 V DC**; mains buffering of 5 ms. [DS] — [same](https://static.rapidonline.com/pdf/07-0768_v1.pdf)
- Interfaces [DS] — [same](https://static.rapidonline.com/pdf/07-0768_v1.pdf):
  - 2× Industrial Ethernet, 10/100/1000.
  - **1× COM (RS232/422/485).**
  - DisplayPort, 2× USB 2.0.
  - Arduino-header I/O: 20 DI/DO at 3.3–5 V, 6 AI at 0–5 V.
  - Temperature monitoring.
- **Operating temperature 0..50 °C**; storage −20..70 °C; max 85 % RH; IP20; 37×142×100 mm. [DS] — [same](https://static.rapidonline.com/pdf/07-0768_v1.pdf)
- Pre-installed OS: **SIMATIC Industrial OS**. [DS] — [same](https://static.rapidonline.com/pdf/07-0768_v1.pdf)
- Approvals: CE, UL, cULus, RCM, KC, EAC, FCC. [DS] — [same](https://static.rapidonline.com/pdf/07-0768_v1.pdf)
- The Siemens product page also lists an mPCIe slot for wireless cards (e.g. 4G). [DS] — [siemens.com IOT2050](https://www.siemens.com/global/en/products/automation/pc-based/iot-gateways/simatic-iot2050.html)
- Distributors also list 0–50 °C. RS calls this part number "IOT2050 Advanced" and shows 2 GB RAM. [RET] — [RS Online 2017732](https://au.rs-online.com/web/p/iot-gateways/2017732), [Farnell 4008389](https://ie.farnell.com/siemens/6es7647-0ba00-1ya2/gateway-24vdc-20-digital-i-o/dp/4008389)

#### Siemens SIMATIC IPC127E / IPC227G
- **IPC127E:** Intel Atom; 0..+55 °C (distributor spec table). Offered without an OS or with Windows 10 Enterprise LTSB 2016. [RET] — [RS 2519141](https://nl.rs-online.com/web/p/iot-gateways/2519141); [Siemens operating instructions 01/2019](https://cache.industry.siemens.com/dl/files/673/109762673/att_975119/v1/ipc127e_operating_instructions_enUS_en-US.pdf)
- **IPC227G:** an RS page shows 0..60 °C, but the table appears to belong to a different SKU, so this is unconfirmed. [RET] — [RS 2713574](https://uk.rs-online.com/web/p/ipc-industrial-computers/2713574)

#### Advantech UNO-127 / UNO-2271G V2
- **UNO-127:** Intel Atom x6413E (quad-core x86-64); DIN-rail fanless; **10–30 VDC**; 15.8 W typical, 35 W max. [DS] — [Advantech UNO-127 datasheet 2026-03](https://advdownload.advantech.com/productfile/PIS/UNO-127/file/UNO-127_DS(030326)20260303105408.pdf); [RET] [PB Tech E23BA](https://www.pbtech.com/au/product/IPCAVH120007/Advantech-UNO-127-E23BA-ATOM-X6413E8G64G-2x-RJ45-2)
- UNO-127 operating range **−20..60 °C** across most sources. [RET/3P] — [ipc2u](https://ipc2u.com/news/product-news/advantech-s-new-lightweight-compact-din-rail-controller-uno-127/), [Elmark](https://elmark-automation.com/shop/advantech/uno-127)
- The **E23BA** SKU = Atom x6413E, 8 GB RAM, 64 GB eMMC, 2× RJ45. [RET] — [PB Tech](https://www.pbtech.com/au/product/IPCAVH120007/Advantech-UNO-127-E23BA-ATOM-X6413E8G64G-2x-RJ45-2)
- **UNO-2271G V2:**
  - Operating temperature "dependent on iDoor module installed"; the N221AE SKU is −20..60 °C, IP30. [DS/RET] — [Elmark UNO-2271G V2](https://elmark-automation.com/shop/advantech/uno-2271g-v2), [PB Tech N221AE](https://www.pbtech.com/au/product/IPCAVH221418/Advantech-UNO-2271G-N221AE-Pocket-Size-Edge-IoT-Ga)
  - Older (non-V2) UNO-2271G SKUs are 0..50 °C.
  - DIN rail needs a separate kit, UNO-2271G-DMKAE.

#### Moxa UC-8200 series
- Arm **Cortex-A7 dual-core 1 GHz** (32-bit armv7); 2 GB RAM. [RET] — [RS 0620707](https://uk.rs-online.com/web/p/ipc-industrial-computers/0620707)
- **−40..70 °C** in datasheet v3.1/v3.2; the older v1.1 lists −40..85 °C for the UC-8210-T-LX. [DS] — [Moxa UC-8200 datasheet v3.2](https://www.moxa.com/getmedia/ef31c38d-dfd5-4b6b-9134-90ad9cf1ecac/moxa-uc-8200-series-datasheet-v3.2.pdf), [v1.1](https://www.moxa.com/getmedia/3425bcc8-bd86-4e7b-92bd-ae8e04f36c75/moxa-uc-8200-series-datasheet-v1.1.pdf%7D)
- OS: **Moxa Industrial Linux** (MIL1 = Debian 9, MIL3 = Debian 11). MIL3 models are **IEC 62443-4-2 SL2 certified**. [DS] — [v1.5](https://moxa.com/getmedia/5ef72578-4e49-40cd-8250-265e089af40b/moxa-uc-8200-series-datasheet-v1.5.pdf), [v3.2](https://www.moxa.com/getmedia/ef31c38d-dfd5-4b6b-9134-90ad9cf1ecac/moxa-uc-8200-series-datasheet-v3.2.pdf)

#### Revolution Pi Connect 4 (KUNBUS)
- 4-core ARM Cortex (A72) at 1.5 GHz; 20 W max; IP20 polycarbonate housing; **−25..55 °C**; ≤93 % RH. [RET] — [RS UK 2713625](https://uk.rs-online.com/web/p/industrial-computers/2713625), [RS 2713629](https://uk.rs-online.com/web/p/industrial-computers/2713629)
- RAM listings conflict: one says 2 GB RAM with 8 GB flash, another 4 GB RAM with 32 GB flash. [RET]
- Price:
  - RS NL: about **€485 (8 GB) / €647 (32 GB)**, excl. VAT. [RET] — [RS NL 2713625](https://nl.rs-online.com/web/p/industrial-computers/2713625), [RS NL 2713629](https://nl.rs-online.com/web/p/industrial-computers/2713629)
  - RS UK: £415 / £554. [RET]

#### RAKwireless RAK7391 WisGate Connect (indoor board)
- CM4: BCM2711, 4× Cortex-A72 at 1.5 GHz; 1/2/4/8 GB RAM; 8/16/32 GB eMMC, or microSD with CM4 Lite. [DS] — [RAK7391 datasheet](https://docs.rakwireless.com/product-categories/wisgate/rak7391/datasheet/)
- OS:
  - **RAKPiOS**, a Raspberry Pi OS fork with **Docker preinstalled** and curated IoT containers.
  - ConnectOS, which is OpenWrt-based.
  - [DS] — [same](https://docs.rakwireless.com/product-categories/wisgate/rak7391/datasheet/)
- −20..85 °C, except USB3 and buzzer at 0..70 °C. **Not fanless:** it has a temperature-controlled fan connector. Mini-ITX 170×170 mm board, **no DIN rail mentioned**. [DS] — [same](https://docs.rakwireless.com/product-categories/wisgate/rak7391/datasheet/)
- Power and network:
  - 10–28 VDC via jack or Phoenix terminal, or PoE 802.3at/bt.
  - 1 GbE (PoE) plus 2.5 GbE.
  - LTE via mPCIe/M.2 (EC25, RM510Q 5G).
  - Up to 4 LoRa concentrators (RAK2287/5146).
  - Modbus via WisBlock IO.
  - [DS] — [same](https://docs.rakwireless.com/product-categories/wisgate/rak7391/datasheet/)
- RTC PCF85063A with CR2032; **no dedicated watchdog** (the RTC alarm can serve as one); supercapacitor power-fail backup. [DS] — [same](https://docs.rakwireless.com/product-categories/wisgate/rak7391/datasheet/)
- Certifications: CE, REACH, RoHS, FCC, ISED. [DS] — [same](https://docs.rakwireless.com/product-categories/wisgate/rak7391/datasheet/)

#### RAKwireless RAK7393 WisGate Connect Outdoor
- Compute: CM4 (BCM2711, 1.5 GHz, 1–8 GB, 0–32 GB eMMC) or **CM5** (BCM2712, 4 cores at 2.4 GHz, 2/4/8/16 GB DDR4-4267, 0/16/32/64 GB eMMC). [DS] — [RAK7393 datasheet](https://docs.rakwireless.com/product-categories/wisgate/rak7393/datasheet/)
- OS: RAKPiOS with **Docker preinstalled**, or ConnectOS. [DS] — [same](https://docs.rakwireless.com/product-categories/wisgate/rak7393/datasheet/)
- **Operating temperature "−20º C to 55º C"**; 0–95 % RH. [DS] — [same](https://docs.rakwireless.com/product-categories/wisgate/rak7393/datasheet/)
  - A search-engine summary claimed −20..85 °C for the RAK7393. The fetched datasheet says **−20..55 °C**, and that is what I report.
- Enclosure: **IP67 / NEMA-6**, aluminium and plastic, 240×240×89.5 mm, pole or wall mount. [DS] — [same](https://docs.rakwireless.com/product-categories/wisgate/rak7393/datasheet/)
- Power:
  - 9–36 VDC via Kway 4-pin (with RS485 and surge protection), or PoE 802.3at (42–57 V).
  - Budget 25 W for the CM.
  - 3 supercapacitors for dying gasp.
  - [DS] — [same](https://docs.rakwireless.com/product-categories/wisgate/rak7393/datasheet/)
- I/O and extras [DS] — [same](https://docs.rakwireless.com/product-categories/wisgate/rak7393/datasheet/):
  - 1 GbE (PoE).
  - 3× mPCIe (USB + SPI).
  - RS485 via the onboard USB-UART.
  - GNSS, ATECC608, PCF85063AT RTC with CR2032; RTC-alarm watchdog only.
  - Certifications: CE, REACH, RoHS, FCC, IC, KC, UKCA.
- **Official store price (USD), EU868** [RET/official store] — [RAK store](https://store.rakwireless.com/products/rak7393-wisgate-connect-outdoor-industrial-iot-gateway):

  | Variant | Without LTE | With LTE (EG95-E) |
  |---|---|---|
  | 8-channel | $439 | $519 |
  | 16-channel | $499 | $579 |

  - The store says the CM4 is included. It lists 3 nano-SIM slots and includes a PoE injector, but **no LoRa antennas** (1 needed for 8-channel, 2 for 16-channel).
  - EU reseller listings with EG95-E exist. [RET] — [OpenELAB](https://openelab.io/de/products/rakwireless-rak7393-wisgate-connect-outdoor)

#### Teltonika (router-class edge)
- **RUTX11:** RutOS; **−40..75 °C**. [RET] — [Mouser](https://www.mouser.hn/new/teltonika/teltonika-rutx11-router/), [Datek](https://store.datek.co.uk/teltonika-rutx11-cellular-network-router-rutx11000300)
  - No source confirms Docker on the RUTX line.
- **Docker is officially supported as an installable package on the RUTC series**, e.g. the RUTC41. [DS/vendor blog] — [Teltonika: Docker on industrial cellular routers](https://www.teltonika-networks.com/blog/edge-control-how-to-deploy-docker-on-industrial-cellular-routers), [PB Tech RUTC41](https://www.pbtech.com/au/product/NETTTK2217/Teltonika-RUTC41-4G-CAT4-AX2402-Dual-Band-WiFi-6-I)

### Inferences
- **[EST]** IOT2050 (2 GB), RevPi Connect 4, RAK739x and UC-8200 can all host the Node 20 + Fastify + SQLite stack. The UC-8200 is the tightest: 32-bit, 2 GB RAM and a 1 GHz dual-core. Each x86 box (CL210G, K410, UNO-127, IPC127E) gives more headroom and a standard Debian/Ubuntu install.
- **[EST]** Each 30-day outbox of LoRa telemetry is small (tens of MB). The issue is flash wear and corruption from SQLite WAL writes, not capacity. Prefer devices with 16–64 GB eMMC and run root on eMMC, not microSD, to avoid write wear.
- **[EST]** Teltonika routers are good for WAN/4G failover and a small container. They are not a suitable host for the full SAGDSS stack with a SQLite store, given limited RAM and flash.

### Gaps
- No official OnLogic spec sheet fetched for the CL210G-10, K300 or K410. The store page 404s, and the K410 temperature rating conflicts between −40 and −25 °C.
- No source found for:
  - Docker on SIMATIC Industrial OS / IOT2050 (not checked).
  - Docker on Moxa MIL.
  - Docker on the RevPi Connect 4.
  - Moxa UC-3100 specs.
  - The Advantech ARK series.
  - The IPC227G official temperature rating.
- **MTBF:** not found for any candidate.
- **Watchdog:** not confirmed for the OnLogic, Advantech or RevPi units; RAK has only the RTC-alarm watchdog.
- **Greek distributor availability and prices:** not researched (no Greek listings found within the call budget).
- **UG67 price:** not researched.

---

## 2. Which suits a hot Mediterranean greenhouse cabinet, and what cooling is needed

### Takeaway
Rated maximums (all ambient-air ratings):

| Candidate | Max operating temp | Source |
|---|---|---|
| Karbon 410 | 70 °C | 3P |
| Moxa UC-8200 | 70 °C | DS |
| Teltonika RUTX11 | 75 °C | RET |
| Advantech UNO-127 | 60 °C | RET |
| IPC127E | 55 °C | RET |
| RevPi Connect 4 | 55 °C | RET |
| RAK7393 | 55 °C | DS |
| IOT2050 | 50 °C | DS |
| CL210G-10 | 50 °C (40 °C with standard adapter) | 3P |

With greenhouse air above 50 °C, **only the 60–75 °C-rated units have real margin.** Anything rated 50–55 °C must sit in a ventilated or shaded cabinet **outside** the greenhouse envelope, or in the cooled electrical room.

### Cited findings
- IOT2050: operating 0..50 °C, max altitude 2000 m, max 85 % RH, IP20. [DS] — [Siemens datasheet](https://static.rapidonline.com/pdf/07-0768_v1.pdf)
- RAK7393: −20..55 °C despite its IP67 outdoor enclosure. [DS] — [RAK7393 datasheet](https://docs.rakwireless.com/product-categories/wisgate/rak7393/datasheet/)
- RAK7391: −20..85 °C for the board, but it needs a fan connector for CPU cooling. [DS] — [RAK7391 datasheet](https://docs.rakwireless.com/product-categories/wisgate/rak7391/datasheet/)
- CL210G-10: 0..40 °C with the standard (external) power adapter. [3P] — [HARDWARIO](https://docs.hardwario.com/smart-devices/onlogic/cl210g-10)
- Karbon 410: −40..70 °C (some sources −25..70 °C), fanless, 9–48 VDC. [3P/RET] — [DirectIndustry](https://www.directindustry.com/prod/onlogic/product-240361-2489463.html), [Touchpoint](https://www.touchpoint.com.au/shop/onlogic-karbon-410-intel-elkhart-lake-compact-rugged-computer-k410/)
- Moxa UC-8200: −40..70 °C, and also −40..70 °C with LTE enabled per distributors. [DS/RET] — [Moxa v3.2](https://www.moxa.com/getmedia/ef31c38d-dfd5-4b6b-9134-90ad9cf1ecac/moxa-uc-8200-series-datasheet-v3.2.pdf)
- UNO-127: −20..60 °C; up to 35 W max dissipation inside the cabinet. [RET] — [PB Tech](https://www.pbtech.com/au/product/IPCAVH120007/Advantech-UNO-127-E23BA-ATOM-X6413E8G64G-2x-RJ45-2)

### Inferences (all [EST], engineering judgement, not sourced)
- **Ratings are ambient-air ratings.** A closed sheet-metal cabinet in sun reaches roughly 10–20 °C above outside air. In Ierapetra, with summer outdoor air around 35–40 °C (not researched here), that puts cabinet air at 50–60 °C. Even a 60 °C-rated box has little margin there, and a 50 °C IOT2050 or 40 °C CL210G does not.
- Precautions:
  - Mount the cabinet **outside the greenhouse film**, on a north-facing wall or under a sun shade/canopy.
  - Use a light-coloured or double-skin (rain-roof) enclosure.
  - Fit a filtered fan with thermostat, or a heat-exchanger / Peltier unit for IP54+.
  - Add a cabinet temperature sensor wired to the PLC so overheating triggers an alarm.
  - Use 24 VDC DIN-rail PSUs instead of external bricks; the CL210G's 40 °C limit comes from its adapter.
- The **RAK7393's IP67 sealing is a disadvantage for heat**: it is sealed and solar-loaded, and its 55 °C ceiling means it should be shaded and not mounted inside the greenhouse. The UG67 is in the same outdoor-gateway class, but its rating was not researched here.
- **Humidity and condensation** (greenhouses are near 100 % RH at night) matter as much as heat. The IOT2050 is rated ≤85 % RH and the RevPi ≤93 %. Use cabinet anti-condensation heaters or desiccant, conformal-coated boards where offered, and IP54+ cabinets.

### Gaps
- No measured cabinet-temperature data for Ierapetra.
- Thermal derating curves were not found for any candidate.
- Humidity specs were not found for OnLogic or Advantech.

---

## 3. Cost: "UG67 + industrial PC" vs "RAK7393 all-in-one"

### Takeaway
On hardware alone, the **RAK7393 16-channel with LTE (~$579 list, official store)** is cheaper than any UG67 + IPC pair, because the IPC alone costs about €335–650+. The UG67 is already owned, though, so the real incremental cost of option A is the IPC only (~€335–700) against ~€500–600 for a RAK7393. The trade-off is thermal margin and separation of concerns, not price.

### Cited findings
- RAK7393 EU868: $439 (8-ch), $499 (16-ch); +$80 for EG95-E LTE ($519 / $579). Antennas are not included. [Official store] — [RAK store](https://store.rakwireless.com/products/rak7393-wisgate-connect-outdoor-industrial-iot-gateway)
- RevPi Connect 4: €485 / €647 excl. VAT. [RET] — [RS NL](https://nl.rs-online.com/web/p/industrial-computers/2713625)
- CL210G-10: about $335 at launch (old) or $199 on the secondary market (unreliable). [3P/RET] — [Liliputing](https://liliputing.com/?p=106145), [ubbcentral](https://ubbcentral.com/store/item/OnLogic-CL210G-10-Ultra-Small-Edge-Device-New_226113556219.html)

### Inferences ([EST])

| Option | Hardware | Indicative incremental cost | Pros | Cons |
|---|---|---|---|---|
| A. UG67 (owned) + IPC | e.g. Karbon 410 or UNO-127 or IOT2050 | IPC ≈ €300–900 (price for K410/UNO-127/IOT2050 not researched) + 24 V PSU and cabinet | Gateway stays outdoors near the antenna; IPC sits in a cooled indoor cabinet; x86 option; failure isolation (the NS keeps running if the IPC dies) | Two boxes; UG67 has no documented Docker, so the NS runs on the UG67 and the IPC subscribes via MQTT |
| B. RAK7393 all-in-one | CM4/CM5 + concentrator + LTE in one IP67 box | $499–579 + antennas + CM5 upgrade if wanted | One box; Docker native; LoRa + NS + SAGDSS + outbox co-located | 55 °C max in a sun-exposed IP67 shell; RTC-alarm watchdog only; single point of failure; Raspberry Pi CM, not a "PLC-grade" IPC |

- A pragmatic **hybrid**: keep the UG67 outdoors as gateway plus NS, and put the edge app on a 60–70 °C-rated, DIN-rail, 24 VDC fanless box in the PLC cabinet. The candidates are Karbon 410, UNO-127 or Moxa UC-8200, in that order for headroom. Only if the cabinet is climate-controlled can the IOT2050 (Siemens ecosystem, 0..50 °C) or CL210G-10 be acceptable.

### Gaps
- UG67 street price; current EU prices for the K410, UNO-127, IOT2050, IPC127E and UC-8200.
- Greek-distributor availability.
- Cost of CM5 upgrades and antennas for the RAK7393.
- Shipping/VAT for the RAK direct store into Greece.
