# How commercial precision-agriculture platforms and soil-sensor vendors present soil salinity to farmers

Scope note: researched 2026-10-23. The primary documents are vendor manuals and quick-start guides, so check each document's date (some are older than 2023 but are still the current manual for a product on sale). Only the instrument vendors (METER, Delta-T, Sentek) publish enough detail to show the computation. For the farmer-facing platforms (CropX, Netafim, Hortau, Phytech, Agrosmart, AquaCheck, Irriwise) only marketing material was available, so many points end up in Gaps.

---

## 1. METER Group (TEROS 12, ZENTRA Cloud): bulk EC, pore-water EC (Hilhorst offset), what ZENTRA shows, interpretation guidance

### Takeaway
The TEROS 12 measures **bulk EC** directly and normalizes it to 25 °C. METER documents an *optional* conversion to **pore-water EC** with the Hilhorst (2000) equation, using a generic offset ε_σb=0 = 4.1. METER states ±20 % accuracy in moist soil and says **not to compute it below VWC 0.10 m³/m³**. METER also warns explicitly that pore-water EC ≠ saturation-extract EC (ECe), and that a theoretical conversion "may not agree well" with a lab soil test.

### Cited Findings
- Bulk EC is computed from the resistance between two electrodes times the cell constant. It is **temperature-normalized to 25 °C** with EC25 = ECT / (1 + 0.019·(T − 25)). The manual says it is "factory calibrated to be accurate over the range found in the vast majority of soil and growth substrates". EC above 10 dS/m is sensitive to electrode contamination (skin oils). — [METER TEROS 11/12 Manual (version dated 1.6.2020), §3.3.3](https://data.ornldaac.earthdata.nasa.gov/public/above/Permafrost_ActiveLayer_NSlope/comp/20587_TEROS11-12_Manual_Web.pdf)
- Pore-water EC: σp = εp·σb / (εb − εσb=0), where εp = 80.3 − 0.37·(Tsoil − 20) comes from the sensor's own soil temperature and εb is the bulk permittivity measured in the same volume. "Hilhorst (2000) recommended that εσb=0 = 4.1 be used as a generic offset"; Hilhorst's method for finding a soil-specific offset "improves the accuracy … in most cases." — [TEROS 11/12 Manual §3.3.4](https://data.ornldaac.earthdata.nasa.gov/public/above/Permafrost_ActiveLayer_NSlope/comp/20587_TEROS11-12_Manual_Web.pdf)
- METER's accuracy statement and cutoff: pore-water EC computed this way has "good accuracy (±20%) in moist soils and other growth media". Below VWC 0.10 m³/m³ "the denominator … becomes very small, leading to large potential errors", and METER "recommends that σp not be calculated in soils with VWC < 0.10 m³/m³". — [TEROS 11/12 Manual §3.3.4](https://data.ornldaac.earthdata.nasa.gov/public/above/Permafrost_ActiveLayer_NSlope/comp/20587_TEROS11-12_Manual_Web.pdf)
- §3.3.5 "Pore water versus saturation extract EC": "pore water EC is not the same as saturation extract EC". In theory they are related through the degree of saturation (VWC/porosity). Worked example: VWC 0.10, σp 0.7 dS/m, bulk density 1.5 gives porosity 0.43 and saturation-extract EC ≈ 0.162 dS/m. "In practice, solution EC calculated from this method and solution EC taken from a laboratory soil test may not agree well because wetting soil to a saturated paste is very imprecise." — [TEROS 11/12 Manual §3.3.5](https://data.ornldaac.earthdata.nasa.gov/public/above/Permafrost_ActiveLayer_NSlope/comp/20587_TEROS11-12_Manual_Web.pdf)
- The VWC calibration for mineral soils is specified for soils with ECs of 0–8 dS/m (saturation extract). Soils with bulk EC > 10 dS/m need substrate-specific calibration. — [TEROS 11/12 Manual §4.1](https://data.ornldaac.earthdata.nasa.gov/public/above/Permafrost_ActiveLayer_NSlope/comp/20587_TEROS11-12_Manual_Web.pdf)
- Current spec sheet: bulk EC 0–20,000 µS/cm, 1 µS/cm resolution. — [METER TEROS 12 tech specs](https://metergroup.com/products/teros-12/teros-12-tech-specs/)
- ZENTRA Cloud is the cloud platform for data from the ZL6 logger ("plug and play … No programming required"). — [METER TEROS 12 product page](https://metergroup.com/products/teros-12/)
- Distributor view (Edaphic, an Australian METER partner): pore-water EC is called "plant available EC" and is the value most relevant to plants. Edaphic's own testing found an **offset of 6** more accurate than 4.1, and it notes ±20 % in moist soils and not below ~0.10 m³/m³. Bulk EC is factory calibrated ±10 % over 0–10 dS/m, and user calibration is required above 10 dS/m. — [Edaphic, "Soil salinity explained"](https://edaphic.com.au/monitoring/soil-salinity-explained/)
- Third-party platform (30MHz) that ingests TEROS 12: shows pore EC as a value derived from bulk EC, notes that the calibration and VWC choices affect it, and labels a section "pore EC requires VWC above 25 %". — [30MHz support article](https://support.30mhz.com/hc/en-us/articles/360020983957?hsLang=en)
- AROYA (a METER cannabis/greenhouse platform built on TEROS 12) warns that EC readings become less reliable as water content falls. — [AROYA SOLUS Troubleshooting Guide](https://hydrobuilder.com/media/pdf/instructions/AROYA_SOLUS_Troubleshooting_Guide.pdf)
- Independent test: TEROS 12 apparent permittivity degrades at bulk EC above ~2.5 dS/m, and multipoint calibration was most accurate. — [Sensors 2024, PMC11014125](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11014125/)

### Inferences
- METER's model has three layers. Bulk EC at 25 °C is the primary measured value. Pore-water EC is a derived, optional value with a stated error and a dry cutoff. ECe is a further, theoretical conversion that METER itself discourages relying on.
- Downstream platforms set their own validity gates: METER uses 0.10 m³/m³, and 30MHz apparently uses 25 % VWC. A "too dry → no pore-EC value" gate is standard practice.

### Gaps
- I could not reach METER's ZENTRA Cloud user guide (metergroup.com returned 403). So I could not confirm whether ZENTRA displays pore-water EC by default or only bulk EC, whether the offset is user-editable, or whether ZENTRA has EC alerts or crop thresholds.
- The METER "how to measure soil salinity" expertise-library page was blocked (403).

---

## 2. Delta-T (WET-2 / WET150 with the HH2 meter): pore-water EC and soil-specific calibration

### Takeaway
Delta-T makes **pore-water EC (ECp)** the default displayed salinity value. It is computed with the Hilhorst equation (same frequency, same sample volume). The meter shows **"Too Dry"** instead of a number when water content is too low. The soil parameter (offset) defaults to 4.1 with an explicit warning not to change it unless measured. Raw permittivity and bulk EC are shown only for reference.

### Cited Findings
- WET150: "The EC … of the water in the soil pores is calculated by applying the Hilhorst equation … works well with the WET150 because the sensor measures permittivity and ECb in the same sample volume at the same frequency (100MHz)". "The Hilhorst equation ceases to be a good approximation when there is too little water present, so the meter will display 'too dry' instead." Selecting the correct soil type "has a significant effect on the ECp reading". ECp units: mS/m, mS/cm or S/cm. — [Delta-T WET150 Kit Quick Start Guide v2.0 (2022)](https://delta-t.co.uk/wp-content/uploads/2022/07/WET150_kit_Quick_Start_Guide_v2.0.pdf)
- WET150 accuracy specs: ECb ±(6 % of reading + 10 mS/m), accurate range 0–1200 mS/m. Permittivity accuracy is tied to ECp ranges (ε′ 1–40 for ECp ≤ 800 mS/m; 40–80 for ECp ≤ 500 mS/m). Setting soil type to RAW displays permittivity, temperature and bulk EC (ECb) instead. — [WET150 Quick Start Guide v2.0](https://delta-t.co.uk/wp-content/uploads/2022/07/WET150_kit_Quick_Start_Guide_v2.0.pdf)
- WET150 ships with calibrations for mineral and organic soils plus coir, peat and mineral-wool substrates, characterized with NPL-traceable dielectric reference fluids. — [Delta-T/NPL news](https://delta-t.co.uk/?p=200672); [Greentech summary](https://www.greentech.nl/products-and-services/delta-t-devices/news/delta-t-devices-collaborated-with-uk-national-physical-laboratory-to-create-their-latest-multi-parameter-soil-sensor)
- WET sensor manual: "By default, the HH2 calculates, displays and stores the Water Content, Pore Water Conductivity (ECp) and the Temperature. It can be set to display the permittivity (εb) and bulk soil conductivity (ECb) as well, for reference." — [Delta-T WET Sensor User Manual v1.6 (© 2018), via Royal Eijkelkamp](https://www.royaleijkelkamp.com/media/hqdpwtxv/m-1933e-wet-sensor.pdf)
- Soil parameter (offset ε′b=0): "The default value is 4.1, but values between 1.0..9.0 can be used." The default suits "a range of both organic and mineral agricultural soils", but heavy clay, sand or unusual media may need a measured value. "Warning: the soil parameter should be left at the default value of 4.1 unless you have measured it for your soil. Changing it will significantly affect the ECp readings, especially in dry soils." The manual gives a bottle procedure (~300 ml of soil, wetted at several salinities) for measuring it. — [WET Sensor Manual v1.6](https://www.royaleijkelkamp.com/media/hqdpwtxv/m-1933e-wet-sensor.pdf)
- Listed ECp error sources: very fine clays, magnetic soils, artificial media, very saline soils, dry soils (a custom soil parameter is needed when reading at water contents < 30 %), temperature, and poor contact. The manual gives a graph of accurately measurable ECp vs moisture. Temperature compensation to 20 or 25 °C or none, at a user-set %/°C (default 2.0 %). — [WET Sensor Manual v1.6](https://www.royaleijkelkamp.com/media/hqdpwtxv/m-1933e-wet-sensor.pdf)
- The manual distinguishes ECp (pore water) from ECb (bulk: "a function of pore water conductivity, soil particle conductivity, soil moisture content, and soil composition") and from saturation extract (usually approximated by adding excess water and "adjusting readings … appropriately"). — [WET Sensor Manual v1.6, Technical Reference](https://www.royaleijkelkamp.com/media/hqdpwtxv/m-1933e-wet-sensor.pdf)

### Inferences
- Delta-T is the clearest "single headline number = pore-water EC" design. It applies a hard validity gate ("Too Dry") rather than showing an unreliable number, and keeps bulk EC as a secondary reference.
- Both METER and Delta-T use 4.1 as the factory offset and treat a soil-specific offset as the main lever for calibration.

### Gaps
- I did not retrieve the exact water-content threshold at which the HH2 or WET150 switches to "Too Dry".
- The full WET150 user manual (as opposed to the quick-start guide) was not retrieved.

---

## 3. Stevens HydraProbe: outputs and recommended use

### Takeaway
HydraProbe reports **bulk EC** and a **temperature-corrected bulk EC** (for comparisons that do not depend on temperature), plus real permittivity. Vendor and distributor material says pore-water EC "can be approximated by algorithms" from the permittivity. Some distributors list "Pore Water EC" as an output, but I did not find the formula in a primary source.

### Cited Findings
- "A temperature corrected bulk EC parameter is available so the user can make comparison independent of soil temperature." "Because HydraProbe also measures the dielectric permittivities, algorithms can be applied to approximate the EC of the soil pore water allowing for better soil salinity characterizations." Bulk EC range 0.01–1.5 S/m, accuracy ±2.0 % or 0.02 S/m (whichever is greater). The page also notes that bulk EC "can change substantially with water content" and that "nutrient accumulation, poor drainage and saline irrigation water can lead to the unwanted buildup of salinity in soil." — [Campbell Scientific Canada, HydraProbe page](https://www.campbellsci.ca/hydraprobe); [HydraProbe brochure](https://s.campbellsci.com/documents/ca/product-brochures/hydraprobe_br.pdf)
- A distributor lists HydraProbe measurables as VWC, temperature, EC, **Pore Water EC**, and thermal compensation. — [ICT International](https://ictinternational.com/product/stevens-hydraprobe/)
- The probe works at 50 MHz. Dielectric constant indicates water content, and conductivity "is strongly dependent on soil salinity". — [UGT HydraProbe page](https://ugt-online.de/en/solutions/stevens-water-hydraprobe/)

### Inferences
- HydraProbe's design puts bulk EC (raw and temperature-corrected) first. Pore-water EC is a secondary, model-based derivation, like METER's.

### Gaps
- I could not retrieve the Stevens HydraProbe user manual (the stevenswater.com and Campbell manual URLs were not reachable). So the exact pore-water algorithm (Hilhorst or otherwise), its offset, and the SDI-12 output order are unconfirmed.

---

## 4. Sentek (TriSCAN / Drill & Drop TriSCAN): VIC "Volumetric Ion Content"

### Takeaway
Sentek does **not** output EC. It outputs **VIC**, a nominal, unitless index from a proprietary model that combines the two raw frequencies. Sentek says VIC "does not represent the exact soil EC value". VIC is "sufficient for the monitoring of trends", and absolute EC/ECe requires **site-specific benchmarking**: a two-point (low/high EC water) linear regression of VIC against lab EC1:5 or ECe.

### Cited Findings
- "The TriSCAN sensor produces an output in volumetric ion content (VIC). VIC is a nominal instrument value that is produced by the sensor data processing model. VIC does not represent the exact soil Electrical Conductivity value. Changes of units of VIC represent changes in units of soil EC. The exact relationship between VIC and EC however, varies with soil type." — [Sentek TriSCAN Manual (hosted by Campbell Scientific)](https://s.campbellsci.com/documents/us/manuals/sentek_triscan.pdf)
- Mechanism: the first raw frequency becomes VWC. The second raw frequency, "in conjunction with the first", is fed to "a proprietary data model [that] processes the changes of both output signals simultaneously … The output of the data model is a nominal Volumetric Ion Content (VIC)", which can be "benchmarked" to soil EC through site-specific sampling. "Both outputs can be presented as dynamic trend changes over a chosen time scale." — [TriSCAN Manual](https://s.campbellsci.com/documents/us/manuals/sentek_triscan.pdf)
- Validity range: 0–17 dS/m in sand, loamy sand and sandy loam. Outside that range it is "currently unsupported by Sentek" (not for clays). Lab accuracy to predict EC is ±8.06 % (6.0–10.1 %), tested over 4–20 % VWC and 0–4.9 mS/cm. There is no temperature correction ("minor positive relationship between VIC and soil temperature"). — [TriSCAN Manual](https://s.campbellsci.com/documents/us/manuals/sentek_triscan.pdf)
- Benchmarking procedure: "The TriSCAN sensor currently provides an output in VIC … This is sufficient for the monitoring of trends in changing soil salinity." The procedure "is not a site-specific calibration as such, as it assumes a linear relationship between VIC and EC". Install two extra access tubes and soak one with low-EC water (< 0.3 dS/m) and one with high-EC water (~7 dS/m). After 24–48 h, read VIC and sample soil, then fit a linear regression of VIC against EC or ECe. Example: ECe = 1,095.5 × VIC − 50,157 (r² ≈ 0.9 in Sentek field tests). EC1:5 → ECe via WCF = −2.21 × %clay^0.5 + 23.78. — [TriSCAN Manual, "Benchmarking Soil Salinity"](https://s.campbellsci.com/documents/us/manuals/sentek_triscan.pdf)
- Early-warning use: "If TriSCAN is to be used as an early warning system to detect damaging salinity concentrations, salinity benchmarking … should be undertaken". — [TriSCAN Manual](https://s.campbellsci.com/documents/us/manuals/sentek_triscan.pdf)
- Interpretation guidance: read the soil-water trace first, then salinity. "The TriSCAN salinity model is currently unable to detect the correct soil salinity during soil water contents at or near to saturation. This rise of salinity during the irrigation event is only apparent and should be ignored." Examples show horizontal "rulers" as baselines (e.g. 832 VIC ≈ 0.1 dS/m), rises after saline irrigation, and drops after leaching or rain. TriSCAN "offers the opportunity to directly track leaching of salts through the profile". The manual's appendices give FAO/Ayars & Westcot crop ECe/ECw tolerance tables (100/90/75/50/0 % yield). — [TriSCAN Manual](https://s.campbellsci.com/documents/us/manuals/sentek_triscan.pdf)
- Peer-reviewed description: VIC is "unitless". — [Laboratory evaluation of dual-frequency multisensor capacitance probes (AGRIS)](https://agris.fao.org/search/en/records/65de477e7c7033e84bea76eb)
- Semios (a platform that resells or ingests Sentek data) Salt Map FAQ: VIC "is not an absolute value that can be compared from site to site, but it is useful to track changes over time within the soil". Note: this comes from a search snippet; the page returned 404 when fetched. — [Semios Salt Map FAQ](https://hub-support.semios.com/en/articles/10270615-salt-map-faq)
- Current Drill & Drop TriSCAN: a distributor spec lists salinity as VIC, range 0–17 dS/m, ~8 % accuracy. Data is viewed in IrriMAX Live (graphs, gauges, map view). — [UGT Sentek Drill & Drop](https://ugt-online.de/en/solutions/sentek-drill-und-drop/); [Fondriest](https://www.fondriest.com/sentek-drill-drop-bluetooth-soil-moisture-probe.htm); [Edaphic TriSCAN](https://edaphic.com.au/products/soils/triscan-water-temperature-ec-sensor/)

### Inferences
- Sentek's choice of an arbitrary unit is a deliberate UX device. It stops farmers from comparing the number with lab ECe or crop tables until a site benchmark exists, and it steers them toward trends, baselines and leaching events.
- Sentek's "rise during irrigation is apparent, ignore it" is a documented artefact of the same kind as METER's "don't compute below 0.10". In both cases the vendor tells users to discard readings at moisture extremes.

### Gaps
- The TriSCAN manual is undated (pre-Drill & Drop era). I did not find a 2023–2026 Sentek document confirming the VIC model is unchanged in Drill & Drop TriSCAN, although distributors still describe the output as VIC.
- I could not confirm whether IrriMAX Live provides salinity alerts or thresholds.

---

## 5. Farmer platforms and low-cost IoT sensors: CropX, Netafim NetBeat, Hortau, Phytech, Irriwise, Agrosmart, AquaCheck, Dragino, SenseCAP

### Takeaway
Among the farmer-facing platforms, only **CropX** clearly markets salinity. It shows soil EC per depth and a **leaching-event alert** (framed around nitrogen loss), and positions itself as an alternative to lab saturated-paste EC. I found **no evidence** that Netafim NetBeat, Hortau, Phytech, Agrosmart, AquaCheck or Irriwise show soil salinity. Low-cost LoRaWAN sensors (Dragino LSE01/SE0x, SenseCAP S2105) output **raw bulk EC in µS/cm or dS/m at 25 °C**, with no pore-water conversion or interpretation beyond a one-line irrigation-water reference.

### Cited Findings
**CropX**
- Apex 1 sensor: measures "soil moisture (VWC), temperature, salinity (EC), and EC-based leaching detection every 4" across the soil profile". Needs CropX Telemetry and an SDI-12 port. — [CropX Apex 1 brochure (2026)](https://cropx.com/wp-content/uploads/2026/02/Apex-1-Brochure-v2-Web.pdf)
- The 2025 brochure names Vertex 4 as required for "leaching and salinity" alerts and lists "proactive alerts of over-irrigation or rainfall driven leaching events". — [CropX 2025 Product Brochure v2.1](https://cropx.com/wp-content/uploads/2025/07/CropX-2025-Product-Brochure-v2.1-July-2025.pdf)
- Salinity view: "real-time measurements of salinity in the soil allowing users to see salt buildup". It is marketed as "easier, less time-consuming, and able to supply immediate results compared to conventional lab soil sample method of measuring the saturated paste EC". Leaching classifier ">90% accuracy … compared to manually labeled data by expert agronomists" (vendor claim). Notifications of leaching events go to the phone, with history and "factors behind" recorded. — [CropX Nutrition Monitoring page](https://cropx.com/cropx-system/nutrition-monitoring/); [CropX Nutrition Brochure v2 (2026)](https://cropx.com/wp-content/uploads/2026/02/CropX-Nutrition-Brochure-v2-RGB-A4.pdf)
- 2021 launch coverage: CropX "uses machine learning algorithms that learn the unique hyper-local electrical conductivity trends" per sensor. It claims older sensors measured only bulk EC with "faulty conversions to assess pore EC", and that growers can "know the exact concentration of pore water salinity in the soil". At launch, further lab and field validation was described as future work. — [Future Farming, 11 Mar 2021](https://www.futurefarming.com/smart-farming/tools-data/cropx-develops-fertiliser-and-salt-monitoring-technology/)

**Netafim NetBeat / Irriwise**
- NetBeat is an irrigation and fertigation platform with a single dashboard and threshold alerts on field sensors (flow, pressure, soil moisture, plant, weather). Its documentation does **not mention soil salinity or EC sensors**. It is an "open platform" that accepts third-party sensors. — [NetBeat brochure](https://www.netafimusa.com:443/bynder/0F6A86A1-5350-4B15-97C3DF142743686C-netbeat-brochure-usa.pdf); [NetBeat techsheet](https://www.netafimusa.com:443/bynder/14197061-280B-40A9-9CF8F016598EC601-netbeat_techsheet.pdf); [Netafim–Arable integration](https://www.netafim.com/en/news-and-events/news/netafim-integrates-arable-labs-sensing-and-analysis-technology-into-netbeat)
- Irriwise: no Netafim source found that mentions salinity or leaching-requirement features (my search returned only generic leaching-requirement literature).

**Hortau**
- Hortau's sensing and app centre on **soil tension** (tensiometers) and crop stress. Its app listing does not mention EC or salinity. — [Hortau Mobile (App Store)](https://apps.apple.com/app/id1299126092); [IICA Hortau profile](https://aguayagricultura.iica.int/en/copy-of-tecnologias-1-1/hortau)
- A patent for an in-situ porous-cup soil-solution EC probe (US9797814) belongs to an individual inventor (Adi Mottes), not Hortau. — [Google Patents US9797814](https://patents.google.com/patent/US9797814)

**Phytech, Agrosmart, AquaCheck**
- I found no source showing a soil-salinity feature for Phytech or Agrosmart. Directory profiles list plant-based IoT (Phytech) and climate/irrigation/sustainability (Agrosmart). — [CB Insights Agrosmart](https://www.cbinsights.com/company/agrosmart/alternatives-competitors)
- AquaCheck probes are listed as **soil moisture and temperature** only, with no EC. — [NSW DPI AgTech catalogue, Cropsol AquaCheck](https://www.agtech.dpi.nsw.gov.au/products/cropsol-aquacheck-sm-probe); [IPSO CoRHIZE AquaCheck](https://ipso.ro/en/new-machines-new-applications/irrigation/sonda-de-umiditate-corhize-aquacheck/)

**Dragino LSE01 (and the SE01/SE0x family)**
- Spec: soil conductivity 0–20,000 µS/cm at 25 °C, 1 µS/cm resolution, accuracy 2 % FS, "Conductivity, with temperature compensate". §2.3.6: the register lets you "obtain soluble salt concentration in soil or soluble ion concentration in liquid fertilizer or planting medium". Example 0x00C8 = 200 µS/cm. The only interpretation given is "Generally, the EC value of irrigation water is less than 800uS/cm." MOD=1 gives raw AD moisture and "original conductivity (with temperature drift compensation)". There is no pore-water conversion and no moisture-dependence caveat. — [Dragino LSE01 User Manual](https://docs.dragino.com/docs/LoRaWAN-End-Node/soil-agriculture-sensors/lse01/)

**SenseCAP S2105 (Seeed)**
- Outputs VWC, soil temperature and EC 0–23 dS/m. Retailer-listed EC accuracy is ±5 % (0–5 dS/m) and ±10 % (5–23 dS/m). I found no pore-water EC or interpretation guidance. — [The Pi Hut S2105](https://thepihut.com/products/sensecap-s2105-lorawan-soil-moisture-temperature-and-ec-sensor); [MakerLab S2105](https://www.makerlab-electronics.com/products/sensecap-s2105-lorawan-r-soil-moisture-temperature-and-ec-sensor); [Helium docs S2105](https://docs.helium.com/network-iot/devices/ready-to-use/seeed-studio/sensecap-s2105-soil-mois-tem-ec)

### Inferences
- Commercial irrigation platforms mostly **leave salinity out**, or show it only through EC-based **leaching detection** (CropX). This suggests vendors see a raw salinity number as hard to make actionable or defensible.
- Low-cost LoRaWAN sensors pass through bulk EC at 25 °C without context. Any interpretation (pore-water conversion, dry-soil gating, crop thresholds) falls on the integrating platform, which is the situation of a TagoIO/SAG-type system using Dragino SE0x/LSE01.

### Gaps
- CropX: units shown in the app, whether the displayed value is bulk, pore or ECe-equivalent, any crop thresholds, and salinity-specific (as opposed to leaching) alert logic are not published. The cropx.com salinity page (?p=1330) and the 2024 info sheet returned 404.
- Phytech, Agrosmart, Irriwise: no primary documentation found either way. Absence of evidence is not proof that the feature is absent.
- Dragino SE0x: I relied on the LSE01 manual. SE01-LB/LS spec pages were not fetched individually.

---

## 6. Common UX patterns across vendors

### Takeaway
Four patterns recur across vendors:
1. **Pick one headline value.** It is pore-water EC (Delta-T; METER optional), VIC (Sentek) or bulk EC (low-cost/HydraProbe). Bulk EC and permittivity are kept as "for reference" values.
2. **Gate on moisture.** Vendors show "Too Dry", suppress the value below a VWC cutoff, or tell users to ignore readings near saturation.
3. **Make trend-first interpretation the explicit recommendation** whenever the value is uncalibrated, with a site benchmark to lab EC1:5 or ECe required before using absolute crop thresholds.
4. **Put crop thresholds (Maas–Hoffman / FAO / Ayars & Westcot ECe tables) in manuals rather than live alerts.** I found no vendor that applies them automatically to sensor readings.

### Cited Findings
- Moisture gating: METER says not to compute σp below 0.10 m³/m³ ([TEROS manual](https://data.ornldaac.earthdata.nasa.gov/public/above/Permafrost_ActiveLayer_NSlope/comp/20587_TEROS11-12_Manual_Web.pdf)). Delta-T displays "Too Dry" ([WET150 QSG](https://delta-t.co.uk/wp-content/uploads/2022/07/WET150_kit_Quick_Start_Guide_v2.0.pdf)). Sentek says the apparent rise near saturation "should be ignored" ([TriSCAN manual](https://s.campbellsci.com/documents/us/manuals/sentek_triscan.pdf)). 30MHz requires VWC > 25 % for pore EC ([30MHz](https://support.30mhz.com/hc/en-us/articles/360020983957?hsLang=en)).
- Estimate/uncalibrated disclaimers: Sentek says VIC "does not represent the exact soil EC value", and its benchmark "will not give an absolute value of soil EC" because it assumes linearity ([TriSCAN manual](https://s.campbellsci.com/documents/us/manuals/sentek_triscan.pdf)). METER says computed vs lab ECe "may not agree well" ([TEROS manual](https://data.ornldaac.earthdata.nasa.gov/public/above/Permafrost_ActiveLayer_NSlope/comp/20587_TEROS11-12_Manual_Web.pdf)). Delta-T says to leave the offset at 4.1 unless measured ([WET manual](https://www.royaleijkelkamp.com/media/hqdpwtxv/m-1933e-wet-sensor.pdf)). Semios says VIC is not comparable from site to site ([Semios FAQ snippet](https://hub-support.semios.com/en/articles/10270615-salt-map-faq)).
- Crop thresholds: the Sentek manual's appendices reproduce FAO/Ayars & Westcot crop ECe/ECw yield-potential tables and soil-salinity classes (saline = ECe > 4 dS/m at 25 °C). They are reference material, not automated alerts. — [TriSCAN manual](https://s.campbellsci.com/documents/us/manuals/sentek_triscan.pdf)
- Leaching as the action: Sentek frames TriSCAN as a tool to "directly track leaching of salts through the profile" and to judge "whether leaching and drainage are adequate" ([TriSCAN manual](https://s.campbellsci.com/documents/us/manuals/sentek_triscan.pdf)). CropX sends leaching-event alerts ([CropX nutrition](https://cropx.com/cropx-system/nutrition-monitoring/)). Edaphic suggests flushing when root-zone salts accumulate ([Edaphic](https://edaphic.com.au/monitoring/soil-salinity-explained/)).
- Low-cost sensors give a raw number plus a single reference value ("irrigation water < 800 µS/cm"). — [Dragino LSE01](https://docs.dragino.com/docs/LoRaWAN-End-Node/soil-agriculture-sensors/lse01/)

### Inferences
- For a farmer-facing dashboard built on bulk-EC LoRaWAN sensors, vendor practice points to the following design. Show a **trend/relative** salinity indicator, or pore-water EC with a stated ±20 % error. **Suppress it when the soil is too dry** (and, Sentek-style, during or just after irrigation near saturation). Label it **"estimate / not lab ECe"**. Compare against crop Maas–Hoffman ECe thresholds only after a lab benchmark (EC1:5 or ECe) for that site.
- No surveyed vendor publishes a traffic-light salinity indicator tied to crop thresholds and computed from in-situ sensors. Doing so would go beyond what established vendors are willing to claim.

### Gaps
- I found no independent extension publication that compares how these platforms present salinity. The patterns above are synthesized from vendor documents.
- No vendor screenshots of salinity dashboards (ZENTRA, IrriMAX Live, CropX app) were retrieved, so the exact visual design (colours, gauges) is unverified.
