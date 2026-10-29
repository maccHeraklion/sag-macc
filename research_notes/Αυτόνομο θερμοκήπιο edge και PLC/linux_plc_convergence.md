# Linux-capable PLCs and merging L1 (PLC) with L2 (edge) for the Ierapetra autonomous greenhouse

Scope: whether one device can host both deterministic control (vents fail-closed, 10 s edge-heartbeat fallback) and the Node 20 + SQLite + MQTT + store-and-forward app, compared with the approved standard (Siemens S7-1200 1214C + separate edge). Research date 2026-10-29.
Source labels: **[OFFICIAL]** = manufacturer doc/page; **[RETAIL]** = distributor/shop listing; **[COMMUNITY]** = vendor forum/maker blog; **[3RD]** = third-party blog/aggregator (lower trust); **[INFERENCE]** = my reasoning, not stated in a source.
Note: phoenixcontact.com product pages returned HTTP 403 to the fetch tool; Phoenix data below comes from plcnext.help (official docs), search snippets of official pages, and retailers.

## Q1. Phoenix Contact PLCnext (AXC F 1152/1252/2152/3152, EPC 1502/1522)

### Takeaway
PLCnext is the most mature "real-time runtime + open Linux" PLC: PREEMPT_RT Yocto Linux, IEC 61131-3 plus C++/C#/Python/Simulink, and Podman (Docker-compatible) built in since firmware 2023.0, with OCI-container Store apps formally supported from FW 2025.0. But Phoenix itself warns that extra apps can degrade real-time behaviour, publishes no per-app CPU/RAM isolation guarantee, and the EPC 1502/1522 edge PCs appear discontinued.

### Cited Findings
- Per-model hardware [OFFICIAL]: AXC F 1152 = Cortex-A9 800 MHz, 1 core/1 real-time (ESM) core, 512 MB RAM; AXC F 1252 = Cortex-A55 1.7 GHz, 2 cores/1 ESM, 1024 MB; AXC F 2152 = Cortex-A9 800 MHz, 2 cores/2 ESM, 512 MB; AXC F 3152 = Intel Atom x5-E3930 1.3 GHz, 2 cores/2 ESM, 2048 MB; RFC 4072R = Core i5, 2 cores/1 ESM, 4 GB — [plcnext.help: PLCnext Control and Runtime features](https://plcnext.help/te/Features_and_roadmaps/PLCnext_Control_and_Runtime_features.htm)
- Note: on AXC F 2152 and 3152 *both* cores are ESM (real-time) cores, i.e. Linux apps/containers share cores with the PLC tasks; only the 1252 and RFC 4072R leave a non-ESM core — [plcnext.help features table](https://plcnext.help/te/Features_and_roadmaps/PLCnext_Control_and_Runtime_features.htm)
- EPC 1502 / EPC 1522: not in the current feature table; firmware table stops at 2024.0.9 LTS and newer releases are marked "product discontinued" [OFFICIAL] — [plcnext.help features](https://plcnext.help/te/Features_and_roadmaps/PLCnext_Control_and_Runtime_features.htm)
- OS: Yocto/Linux (real-time) [OFFICIAL, via product PDF snippet] — [Phoenix Contact 2404267 PDF](https://www.phoenixcontact.com/gb/products/2404267/pdf); PLCnext is built on OSADL real-time Linux, PREEMPT_RT patches — [plcnext.help PLCnext Technology features](https://plcnext.help/te/Features_and_roadmaps/PLCnext_Technology_features.htm)
- ESM (Execution and Synchronization Manager) assigns each task to an ESM/CPU core and drives the PREEMPT_RT Linux scheduler; task priorities 0–15; docs recommend sizing hardware so CPU load stays ~70–80 % for task-synchronous logging [OFFICIAL] — [plcnext.help ESM](https://plcnext.help/te/PLCnext_Runtime/ESM.htm)
- Two execution paths: programs inside the PLCnext Runtime (real-time scheduled by ESM) vs. applications running directly on Linux outside the runtime (not real-time) [COMMUNITY/official community site] — [PLCnext Community: schedule applications real-time](https://www.plcnext-community.net/news/schedule-applications-real-time/)
- Vendor warning [OFFICIAL]: "Additional apps can have an adverse affect on real-time behavior"; do not operate the Apps page during productive operation; apps can activate/deactivate other system services — [plcnext.help Administration – PLCnext Apps](https://plcnext.help/te/WBM/Administration_PLCnext_Apps.htm)
- Containers: Podman (lightweight, Docker-compatible) has been an integral part of the PLCnext OS since FW 2023.0 [OFFICIAL, Phoenix page snippet] — [phoenixcontact.com PLCnext Technology](https://www.phoenixcontact.com/en-il/products/plcnext-technology?p=2); OCI-container app part supported from FW 2025.0, integrated via Podman systemd units (Quadlets) [OFFICIAL] — [PLCnext App Integration Guide: OCI container](https://store.plcnext.help/st/PLCnext_App_Integration_Guide/Apps_parts/OCI_container.htm)
- Older firmware used balena-engine for OCI containers [COMMUNITY] — [PLCnext forum: Node-RED with balena-engine on AXC F 3152](https://forum.plcnext-community.net/t/question-about-installing-node-red-with-balena-engine-on-axc-f-3152-help/10915); an earlier forum post said Podman was "work in progress", root-only and intended for Store apps (pre-2025.0) — [PLCnext forum: Podman/Container on AXC 2152](https://forum.plcnext-community.net/t/podman-container-on-axc-2152/12966)
- Node.js / Node-RED: run as containers; community guide "How to install Node-RED in PLCnext with Podman"; SD card ≥2 GB needed on 1152/2152 [COMMUNITY] — [PLCnext Makers Blog](https://www.plcnext-community.net/makersblog/how-to-install-node-red-in-plcnext-with-podman/); image architecture pitfall: arm32v7 images for 1152/2152 vs x86-64 for 3152 ("exec format error") — [PLCnext forum thread](https://forum.plcnext-community.net/t/question-about-installing-node-red-with-balena-engine-on-axc-f-3152-help/10915); reports of Node-RED taking 15–20 min first start on 2152 and occasional boot retries with balena [COMMUNITY, anecdotal] — same forum sources as summarised in search
- Programming: IEC 61131-3 (LD, FBD, ST, SFC), C++, C#, Python, Simulink, Java [RETAIL listing] — [RS Components AXC F 2152](https://ie.rs-online.com/web/p/plcs-programmable-logic-controllers/2055853)
- Security: Phoenix product page headline "Development process certified in accordance with IEC 62443-4-1 / Certified in accordance with IEC 62443-4-2" for AXC F 2152 [OFFICIAL, search title] — [phoenixcontact.com AXC F 2152](https://www.phoenixcontact.com/en-nl/products/controller-axc-f-2152-2404267)
- Operating temperature AXC F 2152: −25 °C to +60 °C [RETAIL, consistent across RS listings] — [RS Components](https://ie.rs-online.com/web/p/plcs-programmable-logic-controllers/2055853); forum thread on max temperature exists — [PLCnext forum](https://forum.plcnext-community.net/t/max-temperature-on-axc-f-2152/11347)
- Prices (EU, single unit): AXC F 2152 €823.41 ex VAT (RS France), €830.11 ex VAT (RS Italy), €1,027.48 ex VAT (RS Belgium) [RETAIL] — [RS FR](https://fr.rs-online.com/web/p/automates-programmables/1771391), [RS IT](https://it.rs-online.com/web/p/plc/1771391), [RS BE](https://befr.rs-online.com/web/p/plcs-programmable-logic-controllers/1771391); Van Egmond NL "gross 649.00" (currency/VAT unclear) [RETAIL] — [vanegmond.nl](https://oci.vanegmond.nl/producten/phoenix-contact-plc-basiseenheid-axc-f-2152/3067279)
- AXC F 1252 (new, Cortex-A55 2×1.7 GHz [OFFICIAL]) — [phoenixcontact.com AXC F 1252](https://www.phoenixcontact.com/en-ch/products/controller-axc-f-1252-1646469); €440.50 ex VAT at industry-electronics.com (DE), out of stock [RETAIL] — [industry-electronics.com](https://industry-electronics.com/phoenix-contact/1646469-axc-1252-steuerung-lieske_897318.htm); Mouser lists it as New Product (page dated 2026-06-11) — [Mouser TW](https://www.mouser.tw/new/phoenix-contact/phoenix-contact-plcnext-axc-f-1252-controller)
- AXC F 3152: 2 ESM cores [OFFICIAL]; product pages describe OCI-container delivery for virtual PLCnext Control (not hardware) — [phoenixcontact.com AXC F 3152](https://www.phoenixcontact.com/en-gb/products/controller-axc-f-3152-1069208)

### Inferences
- [INFERENCE] AXC F 1252 is the most sensible PLCnext candidate for a merged L1+L2: it is the only current compact model with a non-real-time core (2 cores, 1 ESM) and 1 GB RAM, so the Node/SQLite container can be confined to core 1 while ESM tasks own core 0. On 2152/3152 every core is an ESM core, so the app competes with control tasks.
- [INFERENCE] AXC F 2152 (512 MB RAM, 32-bit armv7, 800 MHz) is tight for Node 20 + SQLite + MQTT client + store-and-forward buffer + PLCnext runtime; expect memory pressure and slow container starts (consistent with the 15–20 min Node-RED anecdote).
- [INFERENCE] Node 20 reached upstream end-of-life in April 2026 (general knowledge, not verified in this session); by late 2026 any new platform should target Node 22/24 — check that armv7 images exist for the chosen version if a 2152 is used.
- [INFERENCE] Phoenix's own warning that apps "can have an adverse affect on real-time behavior" means the vendor does not guarantee isolation; any merged design would need explicit cgroup/cpuset limits and a measured jitter test.

### Gaps
- No official PLCnext doc found stating cgroup/CPU/RAM quotas for Store apps or containers, or a guaranteed jitter bound with containers running.
- Official datasheet temperature for AXC F 1252/3152 not retrieved (product pages 403). EPC 1502/1522 specs not retrieved (discontinued).
- No Greek Phoenix Contact subsidiary or authorised Greek distributor found in searches; no Greek EUR price. Must be checked via Phoenix's country selector or a quote.
- No PLCnext Store app pricing collected.

## Q2. WAGO PFC200 / CC100 / Edge Controller 752-8303

### Takeaway
WAGO's PFC200 and CC100 run real-time Linux with CODESYS V3 (e!COCKPIT/CODESYS 3.5), and WAGO positions Docker and Node-RED as optional add-ons; the 752-8303 Edge Controller is a Docker-oriented edge device, not a PLC. Temperature and price data are fragmentary and partly contradictory; official datasheets should be checked per order number.

### Cited Findings
- CC100: real-time Linux; programmable with CODESYS or "IEC 61131-independent" tools (Node-RED, Python, C++); "Docker can also be easily installed later on the device" [OFFICIAL] — [WAGO CC100 news (PL)](https://www.wago.com/pl/nowe-produkty/nowy-sterownik-cc100-maksymalna-wydajnosc-na-minimalnej-przestrzeni), [WAGO Compact Controller 100](https://www.wago.com/us/products/automation-technology/plcs/compact-controller-100)
- PFC200: Docker and Node-RED listed as platform options; CODESYS development system offered free of charge by WAGO [OFFICIAL datasheet hosted by distributor] — [WAGO PFC200 datasheet (Farnell)](https://www.farnell.com/datasheets/3816247.pdf)
- WAGO's "PFC200 Docker" landing page contains no technical Docker information (firmware, resource limits, real-time impact) [OFFICIAL, checked] — [wago.com PFC200 Docker page](https://www.wago.com/in/automation-technology/wireless-ethernet-gateway/pfc200-docker)
- PFC200 temperature varies by variant: 750-8210 −20…+60 °C [RETAIL] — [RS 750-8210](https://ie.rs-online.com/web/p/plcs-programmable-logic-controllers/2793062); 750-8202 0…55 °C [OFFICIAL datasheet copy] — [750-8202 datasheet (SOS)](https://cdn.soselectronic.com/productdata/f5/e9/16d01841/750-8202.pdf)
- PFC200 750-8210 price: $2,834 (Newark) / $2,520 (DigiKey) [RETAIL, USD] — per search summary of distributor listings (not individually verified)
- CC100 751-9301: −25…+50 °C on a Mexican reseller page [RETAIL, low trust] — [Cyberpuerta](https://www.cyberpuerta.mx/Energia/Control-Industrial/Relevadores/Wago-Relevador-de-Relevador-inteligente-751-9301-Entrada-100-240V-25-50-C.html); a related 751-9401 lists −25…+60 °C [RETAIL] — [RS 751-9401](https://uk.rs-online.com/web/p/plcs-programmable-logic-controllers/0303275)
- Edge Controller 752-8303/8000-002: −20…+80 °C on one US retailer (ambiguous label) [RETAIL] vs "no especificada" at another, which lists Docker Hub access in package [RETAIL] — [IIDM](https://shop.iidm.com/752-8303-8000-002-edge-controller-2-x-ethernet-2-x-usb-1-x-usb-c-hdmi-can-di-do-rs-232-485-audio-control-p-45806), [Syscom](https://www.syscom.mx/productosinfo/256820); WAGO edge computers (different family) are fanless with −20…+60 °C [3RD trade press] — [computer-automation.de](https://www.computer-automation.de/industrial-computing/data-usage-in-the-field.htm)

### Inferences
- [INFERENCE] WAGO's model is the same as PLCnext's (RT-Linux PLC runtime + optional Docker on the same CPU) but with even less published guidance on isolation; the 752-8303 is best treated as an L2 device paired with a PLC, not a merged L1+L2.
- [INFERENCE] CODESYS skills transfer across WAGO, Revolution Pi and (unsupported) Unipi, which reduces lock-in compared with PLCnext Engineer or TIA Portal.

### Gaps
- No official CC100 or 752-8303 operating temperature or EUR price found; no WAGO statement on container resource isolation or CODESYS real-time impact.
- No Greek WAGO distributor checked.

## Q3. Revolution Pi (KUNBUS) Connect 5 / Connect 4 / Core

### Takeaway
RevPi Connect 5 is a cheap (~€500–640 ex VAT), well-documented industrial Raspberry Pi CM5 (quad A76, 4–8 GB, −25…+60 °C, CE/UL, TPM 2.0, two hardware watchdogs) that runs Debian, Docker and CODESYS — an excellent L2 edge box, but it is a Linux computer with a soft-PLC, not a PLC with a certified deterministic runtime, and CODESYS needs a paid licence.

### Cited Findings
- Connect 5: Broadcom BCM2712 quad Cortex-A76 2.4 GHz (CM5), 4 or 8 GB LPDDR4, 32/64 GB eMMC, passive cooling; RevPi Trixie/Bookworm images; 2× GbE, isolated RS485, CAN FD, TPM 2.0, RTC; 10.8–28.8 V DC, 22 W max; up to 10 PiBridge I/O modules [OFFICIAL] — [Revolution Pi docs: RevPi Connect 5](https://revolutionpi.com/en/knowledge/../docs/revpi-connect-5)
- Operating temperature −25…+60 °C "for typical use rather than maximum load"; storage −40…+85 °C [OFFICIAL] — same source
- Two hardware watchdogs (/dev/watchdog0 internal, /dev/watchdog1 in RTC module), not active by default; systemd configuration recommended [OFFICIAL] — same source
- Certifications: CE, UL (File E494534, Class 2/SELV supply), EMC IEC 61000-6-2/-6-4; family "developed in accordance with EN 61131-2" (design basis, not listed as a device certification) [OFFICIAL] — same source
- CODESYS supported (tutorials incl. CANopen/PROFINET); permanent operation needs a paid CODESYS licence, else runtime stops after 2 h; licence bound to one device; pricing via CODESYS [OFFICIAL] — [revolutionpi.com/codesys](https://revolutionpi.com/codesys)
- Docker: product pages say you can start with CODESYS, Node-RED, Python, C#, Docker; Docker appears as an application tutorial rather than device-level support statement [OFFICIAL] — [Revolution Pi products](https://revolutionpi.com/en/products)
- logi.CAD: not mentioned in the Connect 5 docs retrieved [OFFICIAL, absence] — [RevPi Connect 5 docs](https://revolutionpi.com/en/knowledge/../docs/revpi-connect-5)
- Prices: official shop €499–€639 ex tax by variant; PR100419 (8 GB, WLAN, RS485, CAN FD) €579; PR100420 €639 [OFFICIAL shop] — [RevPi shop PR100420](https://revolutionpi.com/shop/en/revpi-connect-5-100420); DigiKey EUR €707–751 ex VAT [RETAIL] — [DigiKey PR100419](https://www.digikey.fr/en/products/detail/kunbus-gmbh/PR100419/26266696); Connect 4 8 GB €484.88 ex VAT (RS IE) [RETAIL] — [RS IE Connect 4](https://ie.rs-online.com/web/p/industrial-computers/2713625)
- DigiKey has a Greek storefront listing RevPi Connect 5 (digikey.gr) [RETAIL] — [DigiKey GR PR100419](https://www.digikey.gr/en/products/detail/kunbus-gmbh/PR100419/26266696)

### Inferences
- [INFERENCE] As a merged L1+L2 it fails the "vents must close on fault" philosophy unless a separate hardware fail-safe exists: one Linux kernel hosts both the soft-PLC and the app, so a kernel panic, eMMC wear-out or a bad apt upgrade takes down control. Its strength is as the L2 edge box beside an S7-1200 (Modbus TCP / S7 / OPC UA), where its watchdog and TPM are directly useful.
- [INFERENCE] Temperature rating "for typical use" plus passive cooling means a sun-heated cabinet in Ierapetra summer could exceed 60 °C internally; cabinet ventilation/shading is required regardless of vendor.

### Gaps
- No PREEMPT_RT / jitter figures found for RevPi Connect 5 with CODESYS + Docker load. No CODESYS licence price found. "Core" variant not researched separately.

## Q4. Unipi Patron / Neuron / Iris

### Takeaway
Unipi Patron is a low-cost (~€396 ex VAT) Debian-based Linux PLC whose officially supported runtime is Mervis; CODESYS is explicitly unsupported by Unipi, Node-RED needs a different OS image, and Docker is only anecdotally confirmed. Not a strong candidate for safety-relevant L1 control.

### Cited Findings
- Mervis is the primary officially supported platform; Patron factory image = Debian + Mervis; using Mervis does not block access to Linux, "you can use your software along with Mervis on a single controller" [OFFICIAL KB] — [Unipi KB: choosing the right software](https://kb.unipi.technology/software), [Unipi Patron first steps](https://kb.unipi.technology/en:hw:007-patron:01-first-steps)
- CODESYS: not developed or supported by Unipi; full functionality "not guaranteed" [OFFICIAL KB] — [Unipi KB software](https://kb.unipi.technology/software)
- Mervis OS ≥2.3.0 requires a licence (demo mode otherwise); Patron ships with Mervis licence included [OFFICIAL] — [Unipi KB](https://kb.unipi.technology/software), [Unipi FAQ](https://unipi.technology/faq)
- Different software stacks (Mervis, Node-RED) need different OS images; Unipi offers a pre-assembled Node-RED image [OFFICIAL] — [Unipi FAQ](https://unipi.technology/faq), [Unipi news: Node-RED image](https://www.unipi.technology/news/node-red-for-unipi-plcs-easy-installation-thanks-to-a-pre-assembled-os-image-346)
- Docker "is able to run on Patron" — forum moderator statement [COMMUNITY] — [Unipi forum](https://forum.unipi.technology/user/martin-kudláček/posts)
- Patron S107 price €479.00 incl. VAT / €395.87 ex VAT (Unipi EU shop) [OFFICIAL shop] — [unipi.technology S107](https://www.unipi.technology/unipi-patron-s107-p381); datasheet with operating conditions — [S107 datasheet](https://kb.unipi.technology/_media/files:products:patron:unipi-patron-s107-product-datasheet-v1.0-en.pdf)

### Inferences
- [INFERENCE] The "one image per stack" model (Mervis OR Node-RED) undercuts the idea of one box running a supported PLC runtime plus a supported app stack.

### Gaps
- No operating temperature extracted for Patron S107 (datasheet section not parsed). "Iris" product line: no results found. Neuron is older generation; not researched in depth.

## Q5. Siemens options: S7-1500 CPU 1518 MFP, ET 200SP Open Controller (CPU 1515SP PC2), SIMATIC IOT2050 as S7-1200 companion

### Takeaway
Siemens does not offer a Docker-capable S7-1200. The CPU 1518 MFP adds a separate Linux C/C++ runtime subsystem to a high-end S7-1500 (overkill and costly for one greenhouse); the 1515SP PC2 pairs the S7-1500 Software Controller with Windows 10 IoT (independent of Windows, but not Linux/Docker); the IOT2050 is the natural Siemens-branded L2 companion to an S7-1200, but its 0…50 °C operating range is a concern for a Cretan greenhouse cabinet.

### Cited Findings
- CPU 1518-4 PN/DP MFP datasheet: C/C++ Runtime and OPC UA licence included; 1,024 MB integrated for C/C++ runtime application; 1 GB available for a Linux runtime application; memory card ≥2 GB; C/C++ blocks from ODK 1500S / Target 1500S [OFFICIAL datasheet reproduced by distributors] — [6ES7518-4AX00-1AC0 datasheet (sterowniki-plc.net)](https://sterowniki-plc.net/image/catalog/Karty%20katalogowe/Siemens/6ES7518-4AX00-1AC0.pdf), [fega.pl datasheet](https://sklep.fega.pl/amfile/file/download/file/518920/product/147232)
- MFP architecture: Cortex-A-class subsystem running a Linux C/C++ runtime alongside S7 firmware, communicating via shared memory/IPC; SSH enabled in TIA Portal [3RD, unverified by Siemens doc] — [industrialmonitordirect.com](https://industrialmonitordirect.com/blogs/knowledgebase/integrating-siemens-plc-with-cc-s7-1500-winac-odk-mfp) (on re-fetch, the page body did not actually contain the MFP section — treat as unreliable)
- ET 200SP Open Controller CPU 1515SP PC2: one device combining controller functions and PC platform; ships with Windows 10 IoT Enterprise 64-bit and S7-1500 Software Controller CPU 1505SP pre-installed; Siemens brochure: software controller "operates completely independent of Windows" so a Windows failure does not stop control; Windows apps/WinCC can run on same CPU; engineering TIA Portal ≥V17 [OFFICIAL catalog/brochure via distributors] — [E&M ET200SP Open Controller PDF](https://www.eandm.com:443/Products/Content/Siemens/PDFs/ET200SP_Open_Controller.pdf), [PI UK product guide](https://uk.profibus.com/products/product-guide/cpu-1515sp-pc2-open-controller), [Siemens Industry Mall](https://mall.industry.siemens.com/mall/en/us/Catalog/Product/6ES76772SB420GL0)
- IOT2050 Advanced (6ES7647-0BA00-1YA2): TI AM6548 CPU, 2 GB DDR4 [RETAIL] — [RS IT](https://it.rs-online.com/web/p/gateway-iot/2017732); operating temperature 0…50 °C [RETAIL/datasheet] — [RS ZA](https://za.rs-online.com/web/p/iot-gateways/2017732), [Rapid datasheet](https://static.rapidonline.com/pdf/07-0768_v1.pdf); prices ≈ AUD/USD 1,175 (AU), 1,386 (NZ) [RETAIL, non-EU]
- IOT2050 software: Siemens open-source meta-iot2050 Yocto/Debian layer with optional Docker fragment; example image bundles Node-RED [OFFICIAL GitHub] — [github.com/siemens/meta-iot2050](https://github.com/siemens/meta-iot2050); Node-RED S7 nodes pre-installed per Siemens forum post [COMMUNITY] — [Siemens SIOS forum](https://support.industry.siemens.com/forum/bd/en/post/1132665)

### Inferences
- [INFERENCE] The ET 200SP Open Controller is the closest Siemens equivalent to a "merged" device and uses a hypervisor-like separation (real-time software controller independent of the OS); but the general-purpose side is Windows, not Linux/Docker, and it is a much more expensive class than S7-1200 (price not retrieved).
- [INFERENCE] Staying with S7-1200 + a separate Linux edge (IOT2050, RevPi Connect 5, or similar) keeps TIA Portal skills and the approved standard intact; the IOT2050's 0…50 °C rating vs RevPi's −25…+60 °C favours RevPi (or a wider-range IPC) for Ierapetra unless the cabinet is climate-controlled.

### Gaps
- No official Siemens manual retrieved for CPU 1518 MFP Linux runtime (OS distro, Docker/Node.js support not confirmed); no price for 1518 MFP or 1515SP PC2; no official EU price for IOT2050.
- Did not research S7-1200 G2 (newer generation) features.

## Q6. Engineering argument: merge L1 (PLC) and L2 (edge) or keep separate? (IEC 61131-3 determinism, IEC 62443 zones/conduits, update risk, single point of failure, vendor guidance)

### Takeaway
The evidence favours keeping L1 and L2 on separate hardware for this greenhouse: vendors themselves warn that co-hosted apps can degrade real-time behaviour and give no isolation guarantee; IEC 62443 practice puts safety/control in its own zone with minimal conduits; and the design's own fail-safe logic (PLC detects edge heartbeat loss in 10 s and runs a safe program) only makes sense if the edge can fail independently of the PLC. Merging is defensible only on a platform with dedicated real-time cores (e.g. AXC F 1252, or a hypervisor-partitioned controller) plus an independent hardware fail-safe at L0.

### Cited Findings
- Phoenix: "Additional apps can have an adverse affect on real-time behavior" [OFFICIAL] — [plcnext.help Apps admin](https://plcnext.help/te/WBM/Administration_PLCnext_Apps.htm)
- PLCnext distinguishes real-time programs scheduled by ESM from Linux apps outside the runtime, which are not real-time [COMMUNITY/official] — [PLCnext Community](https://www.plcnext-community.net/news/schedule-applications-real-time/); a third-party guide: don't assume native Linux apps are real-time; measure jitter on target [3RD] — [industrialmonitordirect PLCnext C code](https://industrialmonitordirect.com/blogs/knowledgebase/plcnext-configuring-c-code-for-real-time-execution)
- Generic Docker can pin containers to cores with `--cpuset-cpus`, but per-thread locality needs app-level affinity [3RD] — [OneUptime blog](https://oneuptime.com/blog/post/2026-02-08-how-to-use-docker-with-cpu-pinning-for-latency-sensitive-apps/markdown)
- Siemens' Open Controller design point: software controller runs independently of Windows so a Windows crash doesn't stop control — i.e. even the "merged" Siemens product relies on hard partitioning [OFFICIAL brochure] — [E&M ET200SP Open Controller PDF](https://www.eandm.com:443/Products/Content/Siemens/PDFs/ET200SP_Open_Controller.pdf)
- IEC 62443: zones group assets with similar security requirements; conduits (firewall, ACL switch, data diode) are the only allowed crossings, deny-by-default; safety systems should be in their own zone with minimal connectivity; containerised apps at the edge shift attack surface [3RD summaries of the standard] — [fabrico.io zones & conduits](https://www.fabrico.io/blog/iec-62443-zones-conduits/), [Trout Software](https://www.trout.software/blog/iec-62443-zones-and-conduits-explained), [Red Lion whitepaper](https://www.redlion.net/sites/default/files/The%20Best%20Approach%20to%20Zones%20and%20Conduits%3A%20IT%20Cybersecurity%20Lessons%20for%20Industrial%20Applications.pdf)
- Pro-merge argument: one device = fewer devices/links, internal function calls instead of network comms, analytics feeding control loops [3RD/academic] — [arXiv 2106.04449, computation offloading at field level](https://arxiv.org/pdf/2106.04449), [computer-automation.de: PLC in the data center](https://www.computer-automation.de/industrial-controls/the-plc-in-the-data-center.htm?thema=server-368739)
- Contra: TTTech-sourced view that configuring/maintaining an edge platform hosting control is "a completely different task than programming and using a PLC"; tight integration "not very promising" [3RD trade press] — [computer-automation.de](https://www.computer-automation.de/industrial-controls/the-plc-in-the-data-center.htm?thema=server-368739); single-point-of-failure warning [3RD vendor blog] — [Rockwell: industrial edge computing](https://www.rockwellautomation.com/de-at/company/news/blogs/industrial-edge-computing.html); HA in PLC+edge is uncommon due to cost/complexity, Emerson proposes a synchronised spare [3RD vendor] — [Emerson white paper](https://emersonexchange365.com/community-hubs/deltav-community-connect/f/plc-pac-systems-industrial-computing-forum/10210/in-plc-and-edge-applications-get-high-availability-for-the-price-of-a-spare-white-paper)
- Phoenix AXC F 2152 is certified to IEC 62443-4-2 (component) with 4-1 development process [OFFICIAL headline] — [phoenixcontact.com](https://www.phoenixcontact.com/en-nl/products/controller-axc-f-2152-2404267)

### Inferences
- [INFERENCE] The 10 s heartbeat fallback is a *cross-device* watchdog. If PLC and edge share one CPU/kernel, the most likely edge failures (OOM from SQLite/Node growth, disk-full from store-and-forward backlog, a botched OS/container update, kernel panic) are exactly the failures that also stop the PLC — the heartbeat no longer protects anything. On separate hardware the S7-1200 keeps closing vents even if the edge bricks itself.
- [INFERENCE] Update cadence mismatch: the Node app and its dependencies need frequent security updates; PLC firmware should change rarely and under change control. Co-hosting forces either stale app updates or risky PLC-host updates. A component certified to IEC 62443-4-2 loses much of that assurance once arbitrary third-party containers with network exposure (MQTT, cloud uplink) run on it.
- [INFERENCE] IEC 62443 mapping for the greenhouse: Zone A (L0+L1: S7-1200, thermostat, actuators) ↔ conduit (single Modbus TCP/S7/OPC UA link, firewall or ACL) ↔ Zone B (L2 edge: Node app, MQTT, LoRaWAN) ↔ conduit (outbound-only TLS) ↔ L3 cloud. A merged device collapses Zones A and B into one asset, so the conduit becomes an in-host software boundary.
- [INFERENCE] Conditions under which merging could be acceptable: (1) platform with a dedicated non-RT core for apps (AXC F 1252) or hypervisor partition (1515SP-style); (2) cgroup memory/CPU limits on the container; (3) L0 hardwired thermostat and fail-closed vent wiring independent of any software; (4) measured jitter under worst-case app load; (5) separate update windows. Even then, the cost saving vs. S7-1200 (~€350–415) + RevPi Connect 5 (~€500–640) is small.

### Gaps
- No IEC 62443-3-3 or IEC 61508 primary text retrieved addressing co-hosted containers on a controller; IEC summaries are secondary.
- No vendor whitepaper found (Phoenix/WAGO/Siemens) giving quantitative jitter with containers running.
- No real-world greenhouse case study of a merged PLC+edge found.

## Q7. Fit with existing commitment to S7-1200 1214C (switching cost, skills, tools)

### Takeaway
Switching L1 to PLCnext/CODESYS/Mervis means a new engineering tool (PLCnext Engineer or CODESYS instead of TIA Portal), new I/O ecosystem and re-validation of the approved standard, for a hardware saving that is near zero; keeping S7-1200 as L1 and adding a separate Linux edge preserves the approved standard and skills.

### Cited Findings
- S7-1200 CPU 1214C DC/DC/DC (6ES7214-1AG40-0XB0) €414.20 ex VAT (Farnell IE/FR) [RETAIL]; other offers €278–513 incl. VAT on eBay (grey/unverified sources) — [Farnell IE](https://ie.farnell.com/siemens/6es7214-1ag40-0xb0/cpu-simatic-s7-16i-p-10-o-p-24v/dp/2484607), [eBay.de](https://www.ebay.de/itm/396815912385)
- Comparable merged-candidate prices: AXC F 2152 ~€823–1,027 ex VAT [RETAIL]; AXC F 1252 ~€440 ex VAT [RETAIL]; RevPi Connect 5 €499–639 ex VAT + CODESYS licence [OFFICIAL shop]; Unipi Patron S107 €396 ex VAT [OFFICIAL shop] — sources as cited in Q1, Q3, Q4
- Tools: PLCnext uses PLCnext Engineer plus C++/C#/Python/Simulink [RETAIL listing] — [RS AXC F 2152](https://ie.rs-online.com/web/p/plcs-programmable-logic-controllers/2055853); WAGO uses CODESYS (free) — [WAGO PFC200 datasheet](https://www.farnell.com/datasheets/3816247.pdf); Siemens Open Controller engineered in TIA Portal ≥V17 — [Siemens mall](https://mall.industry.siemens.com/mall/en/us/Catalog/Product/6ES76772SB420GL0)

### Inferences
- [INFERENCE] Indicative BOM: S7-1200 1214C (~€415) + RevPi Connect 5 8 GB (~€580) ≈ €1,000 ex VAT for two-box L1+L2, vs AXC F 2152 alone (~€830–1,030) or AXC F 1252 (~€440) + I/O. The merged option does not save meaningful money, while adding a new toolchain and losing the independent fail-safe.
- [INFERENCE] In Crete, Siemens support/integrator availability is likely far better than Phoenix/WAGO/Unipi (no Greek Phoenix distributor surfaced in searches); this favours keeping S7-1200 for L1.
- [INFERENCE] Recommended architecture: keep S7-1200 1214C (L1) with the fail-closed vent wiring and 10 s heartbeat; put the Node app on a separate industrial Linux box (RevPi Connect 5 preferred for −25…+60 °C, watchdogs, TPM, Docker; IOT2050 if Siemens branding matters and the cabinet stays <50 °C); connect via one firewalled conduit (Modbus TCP or S7/OPC UA).

### Gaps
- No Greek distributor pricing for any of the options; no labour/training cost data for TIA vs PLCnext Engineer vs CODESYS.
- S7-1200 G2 capabilities (if any Linux/app features) not checked.
