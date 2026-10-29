# Commercial greenhouse climate controllers vs a custom S7-1200 program, and site resilience (UPS, failover, alarms, time, cabinet)

Research date: 2026-10-29. About 24 tool calls. Labels used below: **[official]** = vendor's own page or datasheet; **[reported]** = trade press, distributor, forum or third party; **[estimate]** = my calculation or inference. Several vendor PDFs (Priva API overview, Argus "TITAN vs Axia") could not be read because they are image-only or compressed. Priva's support pages returned 401/403, and Ridder's tech-spec URLs returned 404. Those gaps are listed explicitly.

## (A1) How commercial controllers are built, how they behave offline, and which interfaces they expose

### Takeaway
The established Dutch/North-American controllers follow one of two patterns. In the first, a **local process controller holds the control loops and the cloud is used only for remote operation, backup and analytics**: Priva Compass/Connext, Ridder HortiMaX-Go/Synopta, Argus Titan/Axia. The second pattern is **cloud-first**, as in Hoogendoorn IIVO, which is described as running "entirely via the internet". Only Argus Axia states in public both that it keeps working through an internet outage and that it syncs afterwards, and it also lists Modbus/BACnet. For Priva, Hoogendoorn, Ridder, Netafim NetBeat and Autogrow, I found no public document that clearly states offline behaviour or a local register map/API. Third-party write access to setpoints is typically through a cloud API (Priva) or must be negotiated with the vendor.

### Cited Findings
**Priva (Compass, Connext)**
- [official] Priva Compass comes in two base versions, 2S and 4S, with 2X/4X expansion units for more cultivation zones. It is Priva's entry-level controller line. — [Priva Compass brochure 2024-04](https://www.priva.com/media/pddb31zq/en-brochure-compass-202404.pdf); [Priva Compass product page](https://www.priva.com/products/priva-compass)
- [reported] The Compass 2S enclosure is built around a Priva Blue ID C4 controller with built-in I/O: 8 universal inputs, 12 digital inputs, 6 analog outputs, 8 digital outputs. — [Hortispares Compass 2S listing](https://www.hortispares.com/product/compass-2s/)
- [official] Priva's brochure markets Compass at an "affordable price point" but publishes no figure. — [Priva Compass brochure](https://www.priva.com/media/pddb31zq/en-brochure-compass-202404.pdf)
- [official, from search snippet; page returned 401 on fetch] Priva's FAQ says that steering climate/irrigation **via Connext Operator** (the remote web interface) needs an active internet connection on the operator device. This is about the operator UI, not the control loop. — [Priva help: "Do I always need an internet connection to control via Connext Operator"](https://help.priva.com/en/articles/458191-do-i-always-need-an-internet-connection-to-control-via-connext-operator); [Priva support mirror](https://support.priva.com/hc/en-us/articles/360021209731-Do-I-always-need-an-internet-connection-to-control-via-Connext-Operator)
- [official, snippet] A **Connext Gateway** is required to connect Priva Connext to the cloud. The Compass gateway and controller are released separately. — [Priva support: CPCs per Gateway](https://support.priva.com/hc/en-us/articles/360011849980-How-many-CPC-s-can-be-connected-to-a-Gateway); [Priva: what changed in Compass software](https://support.priva.com/hc/en-us/articles/360030774472-What-has-changed-in-the-Compass-software)
- [official, snippet] Priva's API lets users "access and change controller data across the internet". It uses OpenID Connect / OAuth2. So the official third-party route is a **cloud API, not a local fieldbus**. Modbus/M-Bus is mentioned only for meters connected *into* Priva controllers. — [Priva API overview PDF](https://www.priva.com/media/ov0oot20/priva-api-en.pdf); [Priva APIs (buildings)](https://www.priva.com/buildings/solutions/automation-software/priva-digital-services/priva-apis)
- [reported] A used Priva Compact CC (a smaller Connext) was listed in New Zealand with a stated replacement cost of "approximately 100K" (NZD, full system incl. installation implied). — [grower2grower.co.nz listing](https://www.grower2grower.co.nz/priva-compact-cc-greenhouse-climate-control-system-for-sale/)

**Hoogendoorn (iSii, IIVO)**
- [official] Hoogendoorn stops selling the iSii climate computer from 1 January 2026 to focus fully on IIVO. — [Hoogendoorn news](https://hoogendoorn.com/en/projects/hoogendoorn-discontinues-sales-of-the-isii-climate-computer-full-focus-on-iivo)
- [reported] Hortidaily describes IIVO as the first Hoogendoorn platform to operate entirely via the internet, with no hard disks or moving parts. — [Hortidaily: climate computer pioneer reflects](https://www.hortidaily.com/article/9819508/climate-computer-pioneer-reflects-on-half-a-century-with-hoogendoorn)
- [official] IIVO keeps settings in the cloud with automatic backups and over-the-internet updates. It is "completely integrated with LetsGrow.com". — [Hoogendoorn: Smart Greenhouse Control with IIVO](https://hoogendoorn.com/en/projects/smart-greenhouse-control-with-iivo/); [IIVO brochure 2024](https://tomatoworld.nl/media/xy5dpm1d/hgm-iivo-productbrochure-ia_update_2024-digital-d1.pdf)
- [official, snippet] The (discontinued) iSii Compact could be operated from any browser on the **local network**. — search result summary, Hoogendoorn materials (same search as above)
- [reported] IIVO process computer is sold through Royal Brinkman (NL distributor). — [Royal Brinkman IIVO](https://royalbrinkman.nl/klimaattechniek/klimaatcomputer/iivo-process-computer-999701232)

**Ridder (HortiMaX-Go!, Synopta, HortiMaX Plus)**
- [official/reported] HortiMaX-Go! (since 2016) is Ridder's modular entry-level system for growers starting protected cultivation. It covers climate, irrigation and fertiliser dosing, with "low investment costs" but no published price. — [Ridder HortiMaX Go](https://ridder.com/hortimax-go); [FAO Agritech Observatory entry](https://agritechobservatory.review.fao.org/en/ridder-hortimax-go); [Hortidaily: one year of HortiMaX Go](https://www.hortidaily.com/article/35558/From-Uganda-to-Mexico,-celebrating-one-year-of-HortiMaX-Go)
- [official] In 2026 Ridder launched HortiMaX Plus, which sits between HortiMaX Go and HortiMaX Pro. — [Ridder news](https://ridder.com/insights/news/ridder-expands-possibilities-with-hortimax-plus); [Hortidaily](https://www.hortidaily.com/article/9843138/ridder-expands-possibilities-with-hortimax-plus/)
- [official] Ridder has a dedicated smartphone app for greenhouse control. — [Ridder project: smartphone app](https://ridder.com/insights/projects/detail/greenhouse-control-with-dedicated-smartphone-app)
- [official] Ridder job ads describe "(Modbus) integration of the climate control products". Synopta "can be linked to a variety of platforms". The IoT layer connects third-party wireless sensors (2Grow, Aranet, Grodan, others on request). I found **no Ridder source mentioning OPC UA**. — [Ridder careers](https://ridder.com/about-us/careers/detail/technical-consultant-climate); [Ridder blog: Synopta](https://blog.ridder.com/turn-complexity-into-simplicity-with-ridder-synopta); [Ridder: wireless sensors and climate computer](https://ridder.com/insights/news/essential-connections-between-wireless-sensors-and-your-climate-computer)

**Argus Controls (Titan, Axia)**
- [official] Argus Axia: "Should the Internet go down, Axia runs on a local web app" and it "syncs to the cloud once reconnected". It lists "industry standard ModBus, BACnet, WiFi, Bluetooth, LoRaWAN, and 5G", with a footnote that "LoRaWAN and mobile version coming soon in 2026". The page says nothing on APIs or pricing ("prepare a proposal"). Target: "From modest greenhouses to sophisticated multi-zone…". — [Argus Axia page](https://arguscontrols.com/products-and-solutions/control-systems/argus-axia); [Axia brochure 2025](https://arguscontrols.com/uploads/documents/Axia-brochure-2025-MK0322-Rev-00-Web.pdf); [Hortidaily: diving into Argus Axia](https://www.hortidaily.com/article/9773946/diving-into-the-newly-launched-argus-axia/)
- [official, snippet] Argus's own TITAN-vs-Axia sheet describes TITAN as a "traditional on-site server-based system requiring local infrastructure". Titan integrates with a BMS, with setpoints/actuals visible on both systems, but the protocol is not named. — [TITAN vs Axia PDF](https://arguscontrols.com/uploads/documents/TITAN-vs.-Axia-MK0356-Rev-00.pdf) (could not be parsed; snippet only); [Argus Titan system](https://arguscontrols.com/products-and-solutions/control-systems/titan-system)
- [reported, old] A control.com forum post says a Titan site uses a local Argus server PC connected by serial to Titan controllers, with no standard protocol referenced by the vendor. — [control.com thread](https://control.com/forums/threads/25255)

**Netafim NetBeat, Autogrow, others**
- [official] NetBeat tech sheet: the main control unit runs Linux with a cellular modem, LAN and RS-485/RS-232 ports. A power tile accepts 10–15 VDC from battery/solar. The sheet does not say what happens when the link is down. — [NetBeat tech sheet](https://www.netafimusa.com:443/bynder/14197061-280B-40A9-9CF8F016598EC601-netbeat_techsheet.pdf); [NetBeat brochure USA](https://www.netafimusa.com:443/bynder/0F6A86A1-5350-4B15-97C3DF142743686C-netbeat-brochure-usa.pdf)
- [official] Autogrow IntelliClimate (now under Bluelab) offers USB to PC/Mac plus cloud connectivity via the IntelliLink gateway. Remote access, data logging and alerts need an IntelliGrow subscription. "many fail safe functions built in". No Modbus is mentioned. It is a grow-room/small-greenhouse class product. — [IntelliClimate owner manual](https://www.sylvane.com/cdn/shop/files/owner-manual-autogrow-intelliclimate-kit.pdf); [Bluelab support: IntelliGrow](https://support.bluelab.com/intelliclimate-supercharge-your-intelliclimate-with-intelligrow); [Bluelab IntelliClimate kit](https://bluelab.com/autogrow-intelliclimate-kit)
- [official, non-greenhouse comparison] Hunter Hydrawise and OpenSprinkler controllers run stored schedules offline and need the internet only for advanced or weather features. This shows the category norm of "local schedule + cloud extras". — [Hunter offline mode](https://hunterindustries.com/support/setting-controller-offline-mode); [OpenSprinkler forum](https://opensprinkler.com/forums/topic/need-opensprinkler-to-work-offline/)

**Spanish / Greek / Mediterranean**
- [official, Spanish ministry journal, 2003] Low-end Almería controllers handle a single actuator from one setpoint, for example vents from air temperature. Higher tiers add heating, misting and screens. No prices. — [MAPA Vida Rural 2003](https://mapa.gob.es/ministerio/pags/Biblioteca/Revistas/pdf%5Fvrural%2FVrural%5F2003%5F179%5F58%5F61%2Epdf)
- [reported] University of Almería + IFAPA run "AgroConnect", an experimental IoT-connected greenhouse. — [Diario del Sur](https://www.diariodelsur.com.co/?p=637499)
- [reported, academic] TEI of Crete has a thesis on a PLC-based greenhouse controller with a GSM modem for remote status and fault reporting. This is precedent for the PLC + GSM pattern in Crete. — [search: HMU/TEI Crete repository](https://apothesis.hmu.gr/items/4653226f-a934-4590-b8ee-efc3b7da9481)

### Inferences
- [estimate] Most of the "local controller + optional cloud" products (Priva Compass/Connext, Ridder, Argus Titan/Axia) almost certainly keep closed-loop control without internet, because the controller holds the I/O. What is unclear is **remote visibility, alarm delivery and how far data buffering/backfill reaches**. Only Argus Axia confirms sync-on-reconnect in public.
- [estimate] IIVO's "entirely via the internet" positioning is a red flag for a site whose top requirement is autonomy under WAN loss. A written statement from Hoogendoorn on fail-safe local behaviour would be needed before considering it.
- [estimate] For SAGDSS_GH as an advisory layer, the most realistic integration paths are: (a) Priva's OAuth cloud API (internet-dependent, so it suits the advisory layer); (b) Modbus/BACnet on Argus Axia; (c) negotiated Modbus with Ridder. None of the vendors publishes a register map, so a write-setpoint interface has to be confirmed contractually before purchase.

### Gaps
- No public price for Priva Compass, Ridder HortiMaX-Go/Plus, Argus Axia, IIVO or NetBeat. All are "contact dealer". The NZ Priva Compact "~100K" figure is a single second-hand listing.
- Could not verify Priva Compass/Connext local-operator (touchscreen/LAN) behaviour offline, or whether the gateway buffers history for backfill. Support pages blocked fetch (401/403).
- Not researched within budget: Link4 (iGrow), Growlink, Galcon, Eldar-Shany, Hortisystems, Ingeniería Agrícola, Novedades Agrícolas, MicroGrow. No search hit gave their offline behaviour, APIs or prices.
- **No Crete/Ierapetra greenhouse-automation vendor was found by web search.** Greek-language search returned only theses. Local installers/dealers of Priva, Ridder or Spanish brands in Crete must be identified by phone or through cooperatives/agronomists.
- Argus "TITAN vs Axia" table rows could not be read, so it is unconfirmed which product the "Local mode available for offline control" row refers to.

## (A2) Buy a commercial controller vs program a custom S7-1200: pros and cons

### Takeaway
I found no published head-to-head comparison. The trade-off below is reasoned from the vendor facts above. Buying a controller gives proven horticultural control logic, mature fail-safes and someone else's liability. The costs are an opaque quote-based price, closed or cloud-only interfaces and weak local support in Crete. A custom S7-1200 gives full openness and fits SAGDSS_GH, but every safety behaviour (watchdogs, fail-safe vent/curtain states, alarm escalation) has to be written, tested and owned in-house.

### Cited Findings
- [official] Commercial entry-level controllers already bundle climate + irrigation + fertigation in one product (HortiMaX-Go!) and are positioned for growers new to protected cultivation. — [Ridder HortiMaX Go](https://ridder.com/hortimax-go)
- [official] Vendors increasingly ship "local web app + cloud sync" and standard fieldbuses (Argus Axia: Modbus/BACnet), which is the same architecture SAGDSS_GH plans to build. — [Argus Axia](https://arguscontrols.com/products-and-solutions/control-systems/argus-axia)
- [official] Some vendors tie remote access, logging and alerts to a subscription (Autogrow IntelliGrow) or to a cloud gateway (Priva Connext Gateway). — [Bluelab IntelliGrow](https://support.bluelab.com/intelliclimate-supercharge-your-intelliclimate-with-intelligrow); [Priva support](https://support.priva.com/hc/en-us/articles/360011849980-How-many-CPC-s-can-be-connected-to-a-Gateway)
- [official] Product lifecycle risk is real: Hoogendoorn ended iSii sales on 1 Jan 2026. — [Hoogendoorn](https://hoogendoorn.com/en/projects/hoogendoorn-discontinues-sales-of-the-isii-climate-computer-full-focus-on-iivo)
- [reported] Ridder treats Modbus integration as a specialist service role, which suggests integration is done per project rather than self-service. — [Ridder careers](https://ridder.com/about-us/careers/detail/technical-consultant-climate)

### Inferences
- [estimate] **Commercial controller, pros:** horticulture-specific algorithms (vent/screen/heating/misting coordination, rain/wind protection) are proven. Time-to-market is weeks, not months. Product liability and CE documentation sit with the vendor. Growers and agronomists recognise the brands.
- [estimate] **Commercial controller, cons:** price is quote-only and likely a multiple of an S7-1200 hardware bill for a single small compartment. SAGDSS_GH would likely be limited to reading data and maybe writing a handful of setpoints via a cloud API, which defeats "local autonomy for the decision layer". Vendor lock-in covers sensors, spares and software updates. Local service in Crete is unconfirmed. Cloud-first products (IIVO) conflict with the autonomy requirement.
- [estimate] **Custom S7-1200, pros:** full control of I/O, an open OPC UA/Modbus/S7 interface for the edge computer, logic tailored to Ierapetra's hot-summer regime, no subscription, and Siemens spares/support widely available in Greece.
- [estimate] **Custom S7-1200, cons:** the team must write and verify fail-safe states (vents open on overtemperature, close on wind/rain), sensor plausibility checks and alarm chains. Liability for crop loss from logic errors stays with the project. Development and testing time is longer.
- [estimate] **Hybrid worth pricing:** a commercial controller with documented Modbus/BACnet (Argus Axia class) for low-level loops, with SAGDSS_GH writing a bounded set of setpoints through the edge computer. This needs a written register map and a setpoint-limits contract before purchase.

### Gaps
- No cost data for building an S7-1200 solution was researched here (engineering hours, panel build). No public TCO comparison was found.
- No information on vendor liability terms or warranty conditions for third-party setpoint writes.

## (B1) UPS sizing for about 50 W of control load for 4–8 h: DC vs AC, LiFePO4 vs lead-acid in hot cabinets

### Takeaway
For roughly 50 W of 24 VDC control load (PLC, IPC, gateway, switch), a **24 VDC DIN-rail UPS with external battery** is the natural fit. It avoids double conversion and integrates with the PLC. Energy needed is 200–400 Wh, about 15–30 Ah at 24 V after margins. **LiFePO4 is preferred over standard lead-acid in a hot cabinet.** Siemens itself cites LiFePO4's "high temperature resilience and a longer lifespan", and Siemens LiFePO4 modules show strong current derating as ambient approaches 60 °C.

### Cited Findings
- [official] A Siemens application note: LiFePO4 batteries combine "high temperature resilience and a longer lifespan". A high-temperature lead battery variant is rated −40 to +60 °C. With UPS1600, up to six battery modules can be paralleled, for flexible combinations up to 72 Ah. Buffering of "up to several hours" is possible. — [Siemens DC UPS application note](https://assets.new.siemens.com/siemens/assets/api/uuid:ebcdb3af4a9bc128e72e1a6bb5a513d42f004e25/application-note-dc-usv-en.pdf)
- [official datasheet via Conrad] The SITOP BAT1600 24 V 2.5 Ah LiFePO4 module datasheet shows typical current falling with ambient temperature, from 11 A at 30 °C to 2 A at 60 °C. This is a strong derating, so cabinet temperature matters. — [Conrad datasheet 6EP4132-0JA00-0AY0](https://asset.conrad.com/media10/add/160267/c1/-/en/002879440DS01/tehnicni-podatki-2879440-siemens-6ep4132-0ja00-0ay0-specialni-akumulatorji-lifepo-4-24-v-1-kos.pdf)
- [reported] SITOP BAT1600 24 V 7.5 Ah LiFePO4 (6EP4134-0JA00-0AY0) is listed by Polish distributors as "not for air freight" (logistics note). — [Enexon listing](https://sklep.enexon.pl/sitop-bat1600-24-v-dc-7-5-ah-lifepo4-lithium-battery-for-sitop-ups1600-not-for-air-freight-6ep4134-0ja00-0ay0-siemens-3029618)
- [reported] Distributor listing gives −15 to +50 °C ambient for SITOP UPS1100 battery modules (not clearly the LiFePO4 variant). — [Mouser SITOP UPS1100 modules](https://www.mouser.fr/siemens-sitop-ups1100-battery-modules)
- [official/reported] Mean Well DRS-240 is an all-in-one 240 W DIN-rail PSU + UPS charger (90–305 VAC input) supporting lead-acid **and lithium** batteries. The battery is not included. Prices: USD 239.88 for one unit ([TRC Electronics](https://www.trcelectronics.com/products/mean-well-drs-240-24)), USD 190 ([Master Electronics](https://www.masterelectronics.com/cn/mean-well/drs24024-56536616.html)), CHF 163.60 ex VAT ([Simpex](https://www.simpex.ch/en/shop/power-supplies/ups-and-security/drs-240-24/)). — [Mean Well DRS-240/480 announcement](https://www.meanwell.com/es/newsInfo.aspx?c=1&i=1069)
- [reported] Bicker Elektronik offers 24 V DIN-rail UPS units with an integrated LiFePO4 battery, for example a listing at €672.35. — [Bürklin UPSI-2412DP3](https://buerklin.com/en/p/bicker-elektronik/ups/upsi-2412dp3/70C1508)

### Inferences
- [estimate] **Sizing:** 50 W × 4 h = 200 Wh, and 50 W × 8 h = 400 Wh. Allowing about 90% DC-path efficiency, 80% usable depth of discharge and 80% end-of-life capacity gives about 350 Wh (4 h) to 700 Wh (8 h) nominal. At 24 V that is about **15 Ah (4 h) to about 29 Ah (8 h)**, i.e. 2–4 × SITOP BAT1600 7.5 Ah in parallel (within the 6-module/72 Ah limit), or one 24 V 30 Ah LiFePO4 pack on a Mean Well DRS-240.
- [estimate] **Cost bands:** the Mean Well DRS-240 at about €170–230 plus a third-party 24 V/30 Ah LiFePO4 pack (price not researched) is the budget route. Siemens SITOP UPS1600 + BAT1600 is the integrated Siemens route at a higher cost. My understanding, unverified here, is that UPS1600 has an Ethernet/PROFINET variant that reports battery state to an S7-1200. Confirm this in the datasheet.
- [estimate] **AC UPS:** consumer/office AC UPS units for 4–8 h at 50 W need large external battery packs. They double-convert (DC→AC→DC), so they waste energy, and their lead-acid batteries degrade in heat. They suit only a larger load such as a Wi-Fi AP or a non-24 V IPC.
- [estimate] **Heat:** the common rule of thumb that VRLA lead-acid life roughly halves for every ~8–10 °C above 25 °C is **not sourced here**. Treat it as general engineering knowledge to verify. Combined with the Siemens LiFePO4 derating above, it means batteries should sit in the coolest part of the cabinet, or in a separate shaded/ventilated enclosure.
- [estimate] The UPS covers only the control stack. Fans, vent motors and pumps will not run on 50 W. The PLC must therefore move actuators to safe states on mains loss (e.g. vents to a safe position before power fails, or spring/gravity-safe designs). A generator or ATS is a separate decision.

### Gaps
- No price or datasheet found for Phoenix Contact QUINT4-UPS or Siemens UPS1600 + BAT1600 kits. Euro prices for SITOP were not retrieved.
- No source confirmed SITOP UPS1600 PROFINET/OPC UA status reporting to S7-1200 (my claim, unverified).
- No authoritative lead-acid temperature-life curve was retrieved.

## (B2) Dual-WAN/4G failover routers, SMS/GSM alarm dialers without internet, PLC alarm integration

### Takeaway
An industrial cellular router such as the Teltonika RUTX11 covers dual-SIM failover, **SMS alarms that need only GSM, not internet**, a digital input for a hard-wired PLC alarm relay, and Modbus TCP master/slave. A PLC can therefore raise alarms either by a dry contact (most robust) or over Modbus TCP. Price is roughly €300–450 in Europe.

### Cited Findings
- [reported, from vendor specs on reseller pages] RUTX11: dual SIM (+eSIM on some codes) with automatic switching on weak signal, data limit, SMS limit, roaming, no network, network denied, data-connection failure and SIM idle protection. It has 1 digital input (0–6 V low / 8–30 V high) and 1 digital output. Events can be sent by **SMS**, email or RMS. Modbus TCP master/slave (functions 01–06, 15, 16). Feature availability varies by order code. — [GridConnect RUTX11](https://www.gridconnect.com/products/teltonika-rutx11-cat6-industrial-cellular-router-with-dual-sim-and-wi-fi); [DeployDepot RUTX11](https://deploydepot.ca/products/teltonika-rutx11-dual-sim-gigabit-router)
- [reported] RUTX11 prices: £336 ([Stream Networks UK](https://www.streamnetworks.co.uk/hardware/teltonika-rutx11/)), USD 366 ([GridConnect](https://www.gridconnect.com/products/teltonika-rutx11-cat6-industrial-cellular-router-with-dual-sim-and-wi-fi)). One UK listing at £129 ex VAT looks anomalous. — [Comms Express](https://commsexpress.net/products/teltonika-rutx11-dual-sim-gigabit-router/)
- [reported, academic precedent in Crete] PLC + GSM modem for remote status and fault reporting in a greenhouse. — [HMU/TEI Crete repository](https://apothesis.hmu.gr/items/4653226f-a934-4590-b8ee-efc3b7da9481)

### Inferences
- [estimate] Recommended alarm path: a PLC safety-alarm output (e.g. overtemperature, mains fail, PLC fault, watchdog from edge PC) is wired to the router's DI, which triggers SMS to 2–3 numbers. This works with the WAN down as long as the cellular voice/SMS network is up and the router is on UPS. Richer alarms can go over Modbus TCP, and cloud alerts via SAGDSS_GH when online.
- [estimate] Use two different Greek operators on the two SIMs (e.g. Cosmote + Vodafone/Nova) so that a single carrier outage does not take down both data and SMS. Coverage at the specific Ierapetra site was not checked.
- [estimate] A standalone GSM alarm dialer (with its own battery) is a cheap independent second channel in case the router itself fails. No specific models/prices were researched.
- [estimate] Cheaper Teltonika RUT-series (e.g. RUT241/RUT956) also do SMS + DI. The RUT956 additionally has GNSS (see B3).

### Gaps
- No Greek pricing for Teltonika routers. No standalone GSM alarm-dialer models or prices.
- No 4G coverage data for the Ierapetra pilot site.

## (B3) Offline time synchronisation (GNSS, RTC) and cabinet cooling in Mediterranean greenhouses

### Takeaway
GNSS-disciplined time is available offline from Teltonika routers with GNSS, or from the dedicated Teltonika NTP001 Stratum-1 server. Users report, however, that **some Teltonika routers serve NTP at stratum 16 (unsynchronised) to PLCs even when the router clock is GPS-correct**, so this must be tested on site. A dedicated GNSS NTP box, or the edge PC running chrony with a GNSS receiver, avoids that issue. No usable sourced data on cabinet cooling was retrieved within the budget.

### Cited Findings
- [official] Teltonika RUTX12 docs (firmware 00.07.24.2): "GPS sync" (off by default) enables periodic system time sync from the GPS module "which does not require an Internet connection". A separate "NTPD server" option makes the router serve time to LAN devices. — [Teltonika wiki RUTX12 Administration](https://wiki.teltonika-networks.com/view/RUTX12_Administration)
- [reported] A Teltonika community user with a RUT956 serving NTP to a **Phoenix Contact PLC** found the router clock correct from GPS, but the internal NTP daemon stayed unsynchronised at stratum 16, so the PLC rejected it. No resolution was shown. — [Teltonika community: NTP Server Synch](https://community.teltonika.lt/t/ntp-server-synch/17415); [NTP Server issue](https://community.teltonika.lt/t/ntp-server-issue/17411)
- [official/reported] Teltonika NTP001 is a GNSS-referenced Stratum-1 NTP server, also with RS232/RS485, able to sync "online or offline". — [Comms Express NTP001](https://www.comms-express.com/products/teltonika-ntp001-ip-communication-server-0u-gps/); [100mega NTP001](https://b2b.100mega.com/en/319224-teltonika-ntp001)

### Inferences
- [estimate] Time architecture: GNSS (NTP001, or a GNSS router after the stratum issue is verified) feeds the edge PC (chrony), which feeds the S7-1200 NTP client. The S7-1200's internal real-time clock (buffered by a supercap, or an optional battery board on some models; verify for the chosen CPU) holds time through short outages. All logs and the store-and-forward outbox should be stamped in UTC with a "time quality" flag so that cloud backfill can detect unsynchronised periods.
- [estimate] Cabinet cooling (unsourced, general engineering): in Ierapetra summers a sun-exposed cabinet can exceed 50–60 °C internally. Countermeasures: place the cabinet in shade or a service room outside the greenhouse air volume, use a sun shield/double-wall, a filtered fan with thermostat for moderate loads, or a closed-loop cabinet air conditioner/heat exchanger when inside air is humid or chemically aggressive (sprays). Also monitor cabinet temperature as a PLC input with an alarm. These need sourcing before use in a report.
- [estimate] Given the LiFePO4 derating (11 A at 30 °C → 2 A at 60 °C), cabinet thermal management directly decides whether the UPS actually delivers its rated hold-up time in July–August.

### Gaps
- No sourced data on enclosure cooling sizing (W/K, Rittal/Pfannenberg calculators), greenhouse-specific cabinet humidity/corrosion, or prices of cabinet coolers. Not searched due to tool budget.
- No sourced spec on the S7-1200 RTC hold-up time without power.
- Not confirmed whether the Teltonika stratum-16 issue is fixed in current RUTX/RUT956 firmware (late 2026).
