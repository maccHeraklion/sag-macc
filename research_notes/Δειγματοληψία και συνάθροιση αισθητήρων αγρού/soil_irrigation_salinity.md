# Soil moisture, soil temperature and EC sensor data in irrigation and salinity decisions (field and greenhouse): aggregation of 20-minute readings

Context: Dragino LSE01 and SE0X capacitive/FDR probes at one or two depths, pore-water EC by the Hilhorst model, irrigation advice computed hourly, greenhouse crops with hygrometers inside.

Evidence tags on each finding:
- **[FT]** full text read this session.
- **[EX]** only an abstract, record or search excerpt was seen. Numbers are as excerpted and should be checked before being quoted as final.
- **[PN]** carried over from the earlier project notes in `research_notes/Αλατότητα εδάφους από αισθητήρες/` (not re-read this session).

Everything under "Inferences" is reasoning or arithmetic by this researcher, not a published rule.

---

## Q1. Which soil moisture value drives an irrigation decision, and how are refill point and field capacity read from a trace?

### Takeaway
No source reviewed drives irrigation from an instantaneous or hourly value. Accepted practice has three parts:
- A repeatable once-per-cycle reading taken before irrigation, at a fixed time.
- An upper limit read from the trace after rapid drainage has ended.
- A lower limit set either from soil properties (MAD) or from the point where daily uptake slows, which is not caused by lower demand.

Spanish research practice (IRTA) uses sensors only to tune a daily FAO water balance, not as the direct trigger. Almería work shows that upper and lower limits should be set dynamically per site, because absolute capacitive θ is unreliable.

### Cited Findings

**Timing of the decision value**
- Almería greenhouse trials read tensiometers "at 8 a.m., immediately prior to any irrigation", at 10 cm, close to the dripper. The same paper reports daily mean, maximum and minimum separately for continuous sensors: pepper daily mean −12 to −22 kPa, daily maximum −7 to −12 kPa, daily minimum −17 to −40 kPa. So daily mean and pre-irrigation values are not interchangeable. — [Thompson, Gallardo & Fernández 2003, ISHS 664_82 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/irrigation-scheduling-of-drip-irrigated.pdf)
- Under a tensiometer-managed reference (10–30 kPa), 8 a.m. matric potential at 10 cm was mostly −14 to −20 kPa, and irrigation was 123 mm. A capacitance protocol with a poorly chosen upper limit gave −7 to −12 kPa and 179 mm. — [Thompson et al. 2003 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/irrigation-scheduling-of-drip-irrigated.pdf)
- Two indices from continuous θ were tested in Almería. ADCWU is the reduction in soil water content during daylight. DSWL is the reduction over 24 h. Under stable weather they detected crop water stress within 1–2 days of leaf water potential. Under variable weather detection took 1, 2 and 6 days in some cycles (0–20 cm layer). The authors state stable climatic conditions are needed. — [Thompson, Gallardo, Valdez & Fernández 2007, AWM 92:13–28 [EX]](https://ideas.repec.org/a/eee/agiwat/v92y2007i1-2p13-28.html)
- The Valencian GoCitrics guide (EnviroSCAN, citrus) describes the "staircase" trace. An irrigation is followed by rapid drainage, then a daytime decline (drainage plus uptake) and a night period with drainage only and no plant uptake. The staircase itself shows active roots. — [GoCitrics guide, §6.2.7 [FT]](https://www.avaasaja.org/index.php/de-interes/proyectos2/gos-citricos/item/download/2128_13cea774bafebde26b06084f6f03e6a3)
- Reading a Watermark meter 2–3 times between irrigations is the manual's stated practice. — [Irrometer 701 meter manual (Auburn copy) [EX]](https://htmlscript.auburn.edu/ws-test-subdomain/nurserycoop/membersonly/meetings/ShortCourse/2018/10%20-%20Irrigation%20and%20Soil-Water%20Relations/701%20Meter%20Manual-WEB.pdf)

**Upper limit (full point, field capacity)**
- Field capacity can be taken as the sensor θ 12–24 h after heavy irrigation or rain. — [Univ. of Minnesota Extension [EX]](https://extension.umn.edu/irrigation/soil-moisture-sensors-irrigation-scheduling)
- METER describes a similar field approach: saturate around the sensor, let it drain for several hours, and read the next morning. Field capacity is typically −10 to −30 kPa, permanent wilting point about −1500 kPa. — [METER webinar and guide excerpts [EX]](https://metergroup.com/webinars/how-to-improve-irrigation-scheduling-using-soil-moisture/)
- WSU tree fruit: the full point is at the transition on the trace where the line stops dropping quickly and starts stepping down slowly. — [WSU, moisture sensors in pears [EX; site now redirects to an "unavailable" page]](https://treefruit.wsu.edu/article/moisture-sensors-pears/)
- GoCitrics gives two options. Option 1: the full level comes from irrigations that infiltrate but do not exceed the active root depth (combining the summed graph with the stacked per-depth graph). Option 2: full is estimated after the rapid drainage following a rain or irrigation that fills the profile. — [GoCitrics §6.2.7 [FT]](https://www.avaasaja.org/index.php/de-interes/proyectos2/gos-citricos/item/download/2128_13cea774bafebde26b06084f6f03e6a3)
- Virginia Tech: if the deepest sensor rises above field capacity, water is leaving the root zone. Adequate irrigation makes the deep sensor rise but stay at or below field capacity. If the deep sensor does not rise at all, only shallow soil was wetted. — [VT BSE-339 [FT]](https://pubs.ext.vt.edu/BSE/BSE-339/BSE-339.html)
- Sentek's protocol, as described by Thompson et al.: upper limit by preventing or reducing drainage, lower limit by selecting a value above which crop uptake is reduced, applied to soil water in mm for a given depth of soil. — [Thompson et al. 2003 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/irrigation-scheduling-of-drip-irrigated.pdf)
- **Limit of the deep-sensor rule.** In compacted greenhouse soil (bulk density 1.6 g/cm³ at 0–10 cm, 1.8 g/cm³ at 10–20 cm), a flat 30–40 cm sensor did not prove correct irrigation. Water moved sideways and irrigation was 46 % higher than the reference (179 vs 123 mm; percentage by this researcher). An edge-of-bulb sensor fixed this: 293 vs 294 mm, and 6.3 vs 6.7 kg/m² yield in pepper. — [Thompson et al. 2003 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/irrigation-scheduling-of-drip-irrigated.pdf)

**Lower limit (refill point)**
- Most crops begin to experience stress at a depletion of 30–50 % of available water (MAD). — [Oklahoma State, BAE-1543 / trend-value fact sheet [EX]](https://extension.okstate.edu/fact-sheets/using-trend-values-from-soil-moisture-sensors-for-irrigation-decisions)
- VT lists MAD of about 30 % for lettuce, potatoes, peppers and onions, 50–55 % corn, 65 % cotton. Tension triggers: loamy sand 25–30 cb, sandy loam 30–40 cb, loam 35–50 cb, silt loam 40–60 cb, clay loam 60–80 cb. — [VT BSE-339 [FT]](https://pubs.ext.vt.edu/BSE/BSE-339/BSE-339.html)
- Tree fruit generally uses 50 % of AWC. If AWC is unknown, a rough refill is 75–80 % of the full point. — [WSU [EX]](https://treefruit.wsu.edu/article/moisture-sensors-pears/)
- METER's worked example sets refill roughly halfway between field capacity and wilting point, and calls the process iterative. — [METER webinar excerpt [EX]](https://metergroup.com/webinars/how-to-improve-irrigation-scheduling-using-soil-moisture/)
- Sentek-style dynamic method: stress level is taken at the change of slope that shows a lower extraction rate not caused by lower ET0. The GoCitrics guide states this directly. MSU's Sentek note says the same: under steady weather and canopy, a reduced depletion rate suggests the crop is short of water around the probe. — [GoCitrics §6.2.7 [FT]](https://www.avaasaja.org/index.php/de-interes/proyectos2/gos-citricos/item/download/2128_13cea774bafebde26b06084f6f03e6a3); [MSU Sentek Drill & Drop interpretation [EX]](https://extension.msstate.edu/publications/sentek-drill-drop-series-data-interpretation)
- GoCitrics also describes a "daily replacement" variant with a management level, for example 10 % below full, and warns it ignores soil storage and can keep heavy soils saturated. An example in the guide of a stress level set as a percentage of full led to actual water stress. — [GoCitrics §6.2.7 [FT]](https://www.avaasaja.org/index.php/de-interes/proyectos2/gos-citricos/item/download/2128_13cea774bafebde26b06084f6f03e6a3)
- Withholding water to find the lower limit was judged an unsatisfactory method for fast-growing greenhouse crops: melon went from 0.7 to 3.7 m in 6 weeks, and limits would need re-defining repeatedly. Uptake at depth (30–40 cm) was adopted as the sign that water was becoming limiting. — [Thompson et al. 2003 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/irrigation-scheduling-of-drip-irrigated.pdf)
- **Conflict between two papers by the same group.** The short Las Palmerillas summary says withholding water from melon "was detrimental to growth and production". The 2003 ISHS paper reports yield and biomass 12 % and 9 % lower, not statistically significant, and says no data demonstrated a deleterious effect, only a risk. — [Thompson, Gallardo & Fernández, Las Palmerillas summary [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/continuous-soil-moisture-monitoring.pdf); [Thompson et al. 2003 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/irrigation-scheduling-of-drip-irrigated.pdf)
- Greenhouse matric thresholds: −58 kPa pepper, −35 kPa melon, −38 to −58 kPa tomato, more negative under low demand (autumn–winter). Thresholds were found from divergence of leaf water potential between watered and unwatered plants. The authors found matric potential thresholds much more reliable than available-water thresholds, which differed appreciably with depth and calculation method. — [Thompson et al. 2007, AWM 88:147–158 [EX]](https://ideas.repec.org/a/eee/agiwat/v88y2007i1-3p147-158.html)
- Refill changes during the season as roots develop, and wrong thresholds make an accurate trace misleading. — [FAR NZ moisture monitoring report 2025 [EX]](https://assets.far.org.nz/438525-FAR-Moisture-Monitoring-Project-Report-2025-PROOF.pdf)
- Sandy soils have a higher refill (about −8 kPa) and clay soils a lower one (about −20 kPa), in the Australian mango guide. These differ from the US values above, so they are crop- and programme-specific. — [Australian Mangoes, water monitoring systems [EX]](https://industry.mangoes.net.au/resources/resources-library/water-monitoring-systems)

**Absolute vs relative θ**
- Pre-defined absolute θ limits are "unsuitable" for capacitance sensors, because θ differs between sites at equal matric potential. "Dynamic" site limits do not need precise calibration, only a constant one. EnviroSCAN read about 50 % above actual in this greenhouse. — [Thompson et al. 2003 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/irrigation-scheduling-of-drip-irrigated.pdf)
- A soil-water deficit in depth units is (FC − current θ) × represented depth. — [Utah State soil sensor setup guide [EX]](https://extension.usu.edu/crops/tools/soil-sensor-setup)

**Institutional positions**
- **IRTA (Catalonia).** The scheduling algorithm pairs a simple daily irrigation-need model with a feedback step tuned by an irrigation fitness indicator from soil or plant sensors. Its purpose is to correct model bias. In the drip apple test (IRRIX web application, 10HS capacitance sensors), the larger-tree sector matched lysimeter ET and an experienced irrigator, and the smaller-tree sector was cut by about the expected amount. — [Domínguez-Niño, Oliver-Manera, Girona & Casadesús 2020, AWM 228 [EX, abstract]](https://ideas.repec.org/a/eee/agiwat/v228y2020ics0378377419315641.html)
- Casadesús et al. 2012 (Comput. Electron. Agric. 83:11–20) is the root paper. Plum study: water-balance scheduling plus feedback using 15 capacitive sensors. The excerpt notes that interpreting sensors under drip is difficult because soil water is heterogeneous. — [Millán et al. 2019, Water 11:2061 [EX]](https://www.doi.org/10.3390/w11102061)
- **SIAR (Spain).** The network provides Penman-Monteith ET0. Soil temperature is measured only at some stations, and soil moisture probes are not among the standard station sensors. — [MAPA, SiAR presentation [EX]](https://www.mapa.gob.es/es/desarrollo-rural/temas/gestion-sostenible-regadios/sistema-informacion-agroclimatica-regadio/presentacion.aspx); [Comunidad de Madrid SiAR page [EX]](https://www.comunidad.madrid/node/72893)
- The advice chain is ETc = ET0 × Kc, net need = ETc − effective rain, adjusted by the grower for soil and timing. A 2025 MAPA deck gives 461 stations, 91 % of irrigated area in 12 regions. — [La Rioja, SIAR water needs [EX]](https://larioja.org/agricultura/en/informacion-agroclimatica/informacion-siar.files/600180-734354_Documentacion_Necesidades_hidricas.pdf); [MAPA 2025 [EX]](https://www.mapa.gob.es/dam/jcr:1cde255d-81a6-481b-a0a3-50b2b8e71304/presentacion20anossiar.2025-06-09-16-43-02.pdf)
- **Mississippi State (Watermark).** The trigger depends on the irrigation cycle length, not only on soil: 100 cb for 1 day, 92 for 2, 84 for 3, 76 for 4, 68 for 5, 60 for 6, 52 for 7, 44 for 8 days. — [MSU P3541 [FT]](https://www.accessibility.extension.msstate.edu/sites/default/files/publications/P3541_web.pdf)

**Temperature artefact relevant to choosing a time of day**
- A 10–20 °C soil temperature range can shift apparent capacitive θ by more than 0.04 m³/m³. Below about 10 cm, θ is only mildly affected, and at 30 cm the diurnal temperature amplitude is about 2 °C. Sensitivity rises with clay and is larger at low frequency: one α sufficed at 38 MHz, but at 5 MHz α depended on water content. Uncorrected signals showed θ rising in daytime and falling at night, which is unrealistic. — [Chanzy, Gaudu & Marloie 2012, Sensors 12:9773 [FT via fetch summary]](https://pmc.ncbi.nlm.nih.gov/articles/PMC3444127/)
- Sentek lab factors: 0.04–0.13 mm/°C (EnviroSCAN), 0.19–0.33 mm/°C (Drill & Drop). The authors propose reporting at a standard 18 °C and suggest diurnal fluctuation has been overestimated previously. — [SSSA 2016 abstract [EX]](https://scisoc.confex.com/crops/2016am/webprogram/Paper99246.html)

### Inferences
- **Recommended decision value for hourly advice.** Keep one daily anchor per probe and depth layer: the median of the last samples before the first irrigation of the day, or a fixed early-morning clock window if no irrigation is logged. This matches the Almería 8 a.m. practice. Because it is taken at the same clock time every day, it largely cancels the diurnal temperature artefact.
- With daily drip this anchor is close to the daily minimum. With less frequent irrigation, the daily minimum falls in late afternoon and carries the largest temperature artefact, so a fixed morning time is the safer anchor.
- The hourly run should update an estimate between anchors (last anchor minus ETc since then, plus metered water), not re-read θ as truth. This is the IRTA structure scaled to hourly output.
- **Pre-dawn:** no source uses pre-dawn specifically for soil sensors. The pre-dawn idea comes from plant water potential. The sources support "same time, before irrigation".
- **Automatic full-point detector (mine).** Night slope is usable because GoCitrics states that night decline is drainage only. Full is reached when the night-time slope falls to about zero after a filling event. Using it needs a filling event with no later irrigation inside the window. Under daily drip such events are rare, so this will fire mainly after rain or winter wet-ups.
- Use daily loss (ADCWU/DSWL analogues) against ETc to detect the lower limit, and only when weather is stable (Thompson 2007). Suppress the stress inference on days when ET0 changes sharply. Up to 6 days' lag is documented under variable weather.
- For LSE01/SE0X the literature favours site-learned limits over generic θ values. Generic θ limits should be treated as provisional until a trace supplies a full point.

### Gaps
- FAO-56 was not re-read for a sensor statement. It is a daily root-zone depletion balance, and no FAO text was found that prescribes a sensor sampling or aggregation rule (unconfirmed, background knowledge).
- The UC ANR sensor pages returned 403. Statements from them are excerpt-level (see Q3).
- The IRTA fitness-indicator definition (which daily sensor value, which depth) was not retrievable. MDPI and core.ac.uk copies returned 403, and the Casadesús 2012 full text was not found.
- Sentek's own training manual was not found. Its protocol is known here only through Thompson et al.
- No Greek extension document on reading sensor traces was found. The NSW DPI capacitance page returned 403.
- Time to the end of rapid drainage by soil texture: only the 12–24 h extension figure and METER's "next morning" were found. No Mediterranean or clay-specific number was found.

---

## Q2. Handling wetting fronts and spikes; filters such as median, spike rejection, rate-of-change limits

### Takeaway
The best-documented scheme is the ISMN one (Dorigo 2013, Xaver 2015/2016). It separates a spike (one sample that returns to the prior level) from a real rise (which does not return), using shape and not rate alone. It was designed for hourly data and flags, rather than deletes, data. No irrigation extension or manufacturer source gives a wetting-front filter, so a rate-of-change limit on rises is not supported: rises during irrigation and rain are real.

### Cited Findings
- **Spike (ISMN).** All three conditions must hold:
  1. Step between consecutive samples: x(t)/x(t−1) > 1.15 or < 0.85. The 15 % is about three times a typical maximum sensor uncertainty.
  2. The second-derivative neighbours on each side are similar: ratio between about 0.8 and 1.2.
  3. Coefficient of variation in the 12 h before and 12 h after, excluding the point, is below 1 (avoids over-flagging noisy data).

  — [Xaver 2015 thesis, TU Wien [FT]](https://repositum.tuwien.at/bitstream/20.500.12708/14884/2/Xaver%20Angelika%20-%202015%20-%20Automated%20quality%20control%20procedures%20for%20the...pdf); [Xaver, Dorigo & Wagner 2016 [FT]](https://www.dgpf.de/src/tagung/jt2016/proceedings/papers/08_KKP_DLT2016_Xaver_et_al.pdf)
- The first condition alone "does not suffice to distinguish a spike from natural precipitation"; the shape conditions do that. — [Xaver 2015 [FT]](https://repositum.tuwien.at/bitstream/20.500.12708/14884/2/Xaver%20Angelika%20-%202015%20-%20Automated%20quality%20control%20procedures%20for%20the...pdf)
- **Break (ISMN).** Relative change ≥ 10 % and absolute change ≥ 0.01 m³/m³; first-derivative jump at least 10× the mean of a 25-hour window; second-derivative values on each side of near-equal size. Breaks can leave a lasting offset in the series. — [Xaver et al. 2016 [FT]](https://www.dgpf.de/src/tagung/jt2016/proceedings/papers/08_KKP_DLT2016_Xaver_et_al.pdf)
- **Saturated plateau (ISMN).** Variation over at least 12 h no more than 1 % of a typical average uncertainty of 0.05 m³/m³; sharp rise at start and drop at end; level ≥ 95 % of the record maximum.
- **Low-level plateau (ISMN).** A negative break followed by coefficient of variation below 0.01 (typical of power loss or frozen soil). — [Xaver et al. 2016 [FT]](https://www.dgpf.de/src/tagung/jt2016/proceedings/papers/08_KKP_DLT2016_Xaver_et_al.pdf)
- **Performance on 40 datasets from 19 networks vs visual flags:** spikes 80.0 %, positive breaks 41.5 %, negative breaks 57.4 %, low plateaus 59.6 %, saturated plateaus 92.2 %. False alarms stayed under 2 %. Failures came from gaps (multiple missing values disturb the filter), thresholds and noisy data. — [Xaver et al. 2016 [FT]](https://www.dgpf.de/src/tagung/jt2016/proceedings/papers/08_KKP_DLT2016_Xaver_et_al.pdf)
- The method uses Savitzky-Golay derivatives and needs equidistant data. ISMN data are harmonised to hourly, which fulfils this. Saturated plateaus used a filter width of 25 points. — [Xaver 2015 [FT]](https://repositum.tuwien.at/bitstream/20.500.12708/14884/2/Xaver%20Angelika%20-%202015%20-%20Automated%20quality%20control%20procedures%20for%20the...pdf)
- ISMN also has a geophysical-range and consistency family: threshold on values, and checks of θ change against soil temperature and precipitation. Exact range values were not retrieved. — [Dorigo et al. 2013, VZJ, doi 10.2136/vzj2012.0097 [EX]](https://doi.org/10.2136/vzj2012.0097)
- **SaQC (UFZ) toolbox.** Includes a median/MAD test with modified Z-score (default threshold 3.5) and a spectrum-based test generalising Dorigo 2013 (defaults: raise factor 0.15, derivative factor 0.2). Some variants need a regular grid and others handle irregular timestamps. — [SaQC SpikeDetection docs [EX]](https://git.ufz.de/rdm-software/saqc/-/raw/7fe796ab55acdd2154315c8c5bc08ccd76a9c0ae/docs/funcs/SpikeDetection.md)
- Applied-study cases show that trend changes can be real faults: a blocked filter, under-irrigation, a double irrigation from a programming error and over-irrigation were all identified from θ trends. Regular inspection of data was recommended because of installation artefacts. A dried slurry could give channels; slurry could take up to 8 weeks to dry at depth. — [Thompson et al. 2003 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/irrigation-scheduling-of-drip-irrigated.pdf); [Thompson et al., Las Palmerillas summary [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/continuous-soil-moisture-monitoring.pdf)
- **Salinity-driven false trends.** A large fall in soil EC produced a large apparent fall in θ, despite a rise in matric potential and vertical drainage. A rise in EC during tomato maturity gave the reverse, and the authors say the protocols apply only when soil EC is relatively constant. — [Thompson et al. 2003 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/irrigation-scheduling-of-drip-irrigated.pdf)

### Inferences
- **Filter design for 20-minute data (mine, not published).**
  1. Hourly value is the median of the (usually three) samples, requiring at least 2. A median of 3 removes any single-sample spike without a separate test, and does not flatten a real step, which simply shifts by one sample.
  2. Do not cap upward rates. Flag a rise as "wetting event" and hold decision values until the drainage logic releases them.
  3. Treat downward steps as suspect. Natural falls are slower than rises, except during rapid drainage straight after a wetting event. A fall of ≥ 10 % and ≥ 0.01 m³/m³ between samples with no prior wetting event matches the ISMN break test and should raise a flag, not a correction.
  4. Flag, do not delete.
- **Rescaling ISMN thresholds.** Thresholds are per time step on hourly data. Applying them raw to 20-minute steps is more lenient for gradual change. Applying them to hourly medians keeps them comparable with the validation, so the hourly median stage is the correct place.
- The 12-hour and 25-hour windows translate to 36 and 75 samples at 20 min. Gaps from LoRa packet loss matter: Xaver reports multiple missing values disturb the filter. A resample with a gap mask is needed, and tests should be skipped when a window is mostly empty.
- Spike rejection for EC can use the same median of 3, but only after per-sample conversion (see Q4).
- **Wetting-event gate.** Use the logged valve or meter state when available. Otherwise use a rise of at least 0.01 m³/m³ between hourly medians (the ISMN absolute floor, reused here by analogy) with rain from the station as a cross-check. Field-test this before use, as sensor noise on LSE01 is not known.

### Gaps
- No published filter or threshold specifically for wetting fronts under drip was found, from extension services, manufacturers or the ISMN group.
- No published rate-of-change limit for soil θ was found. Treat any such value as a project choice.
- Exact Dorigo range limits for θ (flags C01–C03) and the numeric first-derivative thresholds for plateaus were not retrieved (Xaver's thesis contains them; only the spike, break and plateau conditions above were extracted).
- Noise floor of LSE01/SE0X at 20-minute intervals: no datasheet figure. It would need measuring from the fleet's own data on rain-free, irrigation-free nights.

---

## Q3. Multiple probes or depths: averaging vs root-zone weighting vs driest sensor; spatial variability; one faulty probe

### Takeaway
Depths are combined as water storage in the active root zone (sum in mm, or weights by the soil layer each sensor represents), with the deep sensor used as a diagnostic for drainage rather than averaged blindly. Replicate probes are recommended at 3 per location (absolute minimum 2 in Almería). No source reviewed recommends managing irrigation by the driest sensor. No source reviewed gives a formal faulty-probe rule, but replication and regular data checks are the stated safeguards.

### Cited Findings

**Depth**
- Summed mm graph of all sensors, plus stacked per-depth graph to see where roots are active and how far water reaches. Unless salts need leaching, irrigation should not infiltrate below active roots. — [GoCitrics §6.2.7 [FT]](https://www.avaasaja.org/index.php/de-interes/proyectos2/gos-citricos/item/download/2128_13cea774bafebde26b06084f6f03e6a3)
- Almería: limits applied to soil water in mm in 0–20 cm (melon, tomato) or 0–30 cm (pepper). The 30–40 cm sensor was used as a diagnostic of drainage (rise) and shortage (uptake at depth). In the final protocol: 3 replicate probes close to the plant, with sensors at 15, 25, 35, 45 cm; plus 2 replicate edge-of-bulb probes with a sensor at 15 cm. — [Thompson et al. 2003 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/irrigation-scheduling-of-drip-irrigated.pdf); [Thompson et al., summary [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/continuous-soil-moisture-monitoring.pdf)
- Mississippi: weights are 0.5/0.5 for 6" and 12"; 0.25/0.25/0.50 when 24" joins; 0.17/0.17/0.33/0.33 when 36" joins. A sensor enters the average only when its cb have risen progressively for some time, and then stays in for the season. The weighted mean therefore follows the root zone. — [MSU P3541 [FT]](https://www.accessibility.extension.msstate.edu/sites/default/files/publications/P3541_web.pdf)
- UC ANR: two depths per location, with the shallow sensor where most active roots are and the deep one toward the bottom of the root zone. The irrigation threshold is applied to the shallow readings, and the deep sensor shows how much water reached the bottom. — [UC ANR irrigation and nutrient management [EX; page returned 403 on fetch]](https://ucanr.edu/node/139738)
- Irrometer: one depth may be adequate for shallow vegetables (roots < 30 cm); deeper rooted crops (small grains, vines, trees) need at least two depths. Sensors must be in the active root zone. — [Irrometer meter manual [EX]](https://htmlscript.auburn.edu/ws-test-subdomain/nurserycoop/membersonly/meetings/ShortCourse/2018/10%20-%20Irrigation%20and%20Soil-Water%20Relations/701%20Meter%20Manual-WEB.pdf)
- VT: a shallow sensor (about 6") gives early warning and a deep one (about 18–24") confirms depth of irrigation. It gives no averaging method. — [VT BSE-339 [FT]](https://pubs.ext.vt.edu/BSE/BSE-339/BSE-339.html)
- USCRN: TOP layer is the plain average of 5 and 10 cm. COLUMN layer uses all available depths; no thickness weighting is described. This is a climate product, not an irrigation one. — [USCRN soil climatology readme [FT]](https://www.ncei.noaa.gov/pub/data/uscrn/products/soil/soilclim01/readme.txt)

**Horizontal position under drip**
- Sensors usually go 10–15 cm from the dripper, depending on texture, in a representative place with active roots, moist but not excessive. Ideally start with two probes, one near the dripper and one at the bulb edge or between drippers. The second shows if the bulb grows or shrinks. — [GoCitrics §6.2.6 [FT]](https://www.avaasaja.org/index.php/de-interes/proyectos2/gos-citricos/item/download/2128_13cea774bafebde26b06084f6f03e6a3)
- In Almería, Position 1 was 8 cm to the side of the dripper and 6–14 cm from the line. The edge-of-bulb position was 24 cm from the line. — [Thompson et al. 2003 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/irrigation-scheduling-of-drip-irrigated.pdf)
- Greek modelling study: sensor position changed irrigation efficiency by up to 16 % in specific cases, but differences between nearby positions were generally low. Sensor error mattered more: ±0.01 cm³/cm³ gave 2.5–6.4 %, and ±0.03 gave 10.2–18.7 %. Soil-specific calibration is stressed. — [Soulis, Elmaloglou & Dercas 2015, AWM 148:258–268 [EX]](https://ideas.repec.org/a/eee/agiwat/v148y2015icp258-268.html)
- Dragino LSE01 measurement volume is a cylinder around the centre pin, 7 cm in diameter and 10 cm high. — [Dragino LSE01 docs [FT via fetch summary]](https://docs.dragino.com/docs/LoRaWAN-End-Node/soil-agriculture-sensors/lse01/)

**Replication and spatial variability**
- Almería: minimum three replicate pairs of probes, with two an absolute minimum in commercial practice. — [Thompson et al. 2003 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/irrigation-scheduling-of-drip-irrigated.pdf)
- VT: at least three sensor stations per field. — [VT BSE-339 [FT]](https://pubs.ext.vt.edu/BSE/BSE-339/BSE-339.html)
- METER: suggested minimum of three sensors in each soil type. A METER presenter also says the exact number is unknown, and the answer depends on the purpose. — [METER Office Hours 11 [EX]](https://metergroup.com/office-hours-qa/office-hours-11-soil-moisture-measurements/)
- GoCitrics: install at points representative of soil map units, crop, variety and irrigation sector. — [GoCitrics §6.2.6 [FT]](https://www.avaasaja.org/index.php/de-interes/proyectos2/gos-citricos/item/download/2128_13cea774bafebde26b06084f6f03e6a3)
- A probabilistic study on granular matrix sensors found that where the goal is to keep water adequate on a fraction of land on average, the benefit of more sensor sets may be smaller than traditionally expected. — [J. Irrig. Drain. Eng., doi 10.1061/(ASCE)IR.1943-4774.0001093 [EX]](https://ascelibrary.com/doi/10.1061/%28ASCE%29IR.1943-4774.0001093)
- USCRN measures soil moisture and temperature in triplicate. The readme does not state how triplicates are merged or failures handled. — [USCRN readme [FT]](https://www.ncei.noaa.gov/pub/data/uscrn/products/soil/soilclim01/readme.txt)

**Faulty probes**
- Replication and regular review were recommended as protection against poor installation. — [Thompson et al., summary [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/continuous-soil-moisture-monitoring.pdf)
- For comparing sensors, METER advises looking at differences in trends and water content between the two. — [METER webinar excerpt [EX]](https://metergroup.com/webinaires/interpreting-soil-moisture-data-panel-discussion/)
- A wet spot from excessive dripper output is shown as a bad installation location. — [GoCitrics Fig. 22 caption [FT]](https://www.avaasaja.org/index.php/de-interes/proyectos2/gos-citricos/item/download/2128_13cea774bafebde26b06084f6f03e6a3)

### Inferences
- **Depths.** Convert to mm per represented layer, sum over layers in the current root depth, and keep the deep sensor as a separate state variable (rising = drainage, falling = uptake at depth, flat = neither). With two depths the MSU template gives 0.5/0.5 when layers are equal in thickness. Weight by represented layer thickness otherwise. Do not average θ across a depth outside the active root zone.
- **Single-depth probe.** Treat it as an index of the root-zone state, not as storage. Do not convert to mm of the whole root zone without saying so.
- **Across probes.** With 3 or more, use the median. With 2, use the mean and raise a disagreement flag if their trends diverge; compare trends, not levels, because levels differ by location and calibration. With 1, no averaging and lower confidence.
- **Driest sensor.** No literature supports it for scheduling. Project experience points the same way: the 29/10 record in project memory says v50.164 ("driest") was withdrawn after a probe out of soil caused a very large false demand. That is project history, not a published source.
- **Faulty probe (mine).** Exclude on the Q2 flags, or on a persistent trend mismatch with its siblings, or on a missing response to several logged irrigations. The cross-check must happen at trend level. Drop a probe for that day and note it. Do not silently renormalise weights if the excluded probe was the only one in a layer. An excluded probe needs a visible state in the field record.
- **Edge of bulb.** The Almería result implies that one probe near the dripper cannot detect sideways loss. If fields carry only one or two probes per zone, placing the second at the bulb edge gives more information than a second one beside the dripper.
- **Representativeness.** LSE01's sensing volume is roughly 385 cm³ (π × 3.5² × 10, this researcher's arithmetic), so it sees a small part of the bulb. Its reading is a local index and should not be scaled to the field without replication.

### Gaps
- No Mediterranean study was found that compares median vs mean vs weighted combination of replicate probes for irrigation outcomes.
- A report of three UC monitoring sites within 800 ft that behaved very differently (Kern County) appeared in one search summary, but a follow-up search could not confirm it. Do not cite it until located.
- A formal published rule for excluding a faulty probe was not found.
- Number of probes needed for a given precision in Cretan soils: not found. Classic time-stability literature (Vachaud et al. 1985) was not retrieved this session.

---

## Q4. Soil EC: bulk vs pore vs ECe; Hilhorst limits at low water content; temperature correction; when an EC reading is valid; averaging nonlinear quantities

### Takeaway
Bulk EC depends on θ. Pore-water EC is what roots experience but changes through every irrigation cycle. ECe is the reference used for all crop thresholds. A sensor pore-water value is usable only when wet and is best compared at a consistent water content, after the wetting front has passed and not straight after irrigation. Compute it per sample before any averaging, then average the conserved or normalised quantity. Check whether the probe already temperature-compensates before correcting again.

### Cited Findings

**Three quantities**
- ECw is ideally "the best index of soil salinity because this is the salinity actually experienced by the plant root", but it "varies throughout the irrigation cycle as the soil water content changes so it is not single valued". Crop thresholds use ECe. Gypsum samples deviate most under dilution. — [Corwin & Yemoto, Methods of Soil Analysis, Salinity (USDA-ARS P2558) [FT]](https://ars.usda.gov/arsuserfiles/20361500/pdf_pubs/P2558.pdf)
- All standard yield rules (Maas–Hoffman, FAO-29, FAO-56 Ks) use average root-zone ECe. FAO-56 calls its Ks salinity equations only approximate estimates over weeks or months, not daily. — [FAO-56 Ch. 8 [PN]](https://www.fao.org/4/x0490e/x0490e0e.htm)
- ECw·θ ≈ ECe·ρb·SP/100 and SP·ρb/100 ≈ 2·θfc. Conservation is "not sufficiently valid" for accurate work, especially with gypsum. — [FAO-57 [PN]](https://www.fao.org/4/x2002e/x2002e.pdf)

**Hilhorst limits**
- σp = εp·σb/(εb − ε0). The default ε0 = 4.1. Published validity: θ from 0.10 to saturation, σp up to 0.3 S/m (3 dS/m), at 20 °C. Fitted ε0 ranged from 1.9 to 7.6 across materials. — [Hilhorst 2000 [PN]](https://stevenswater.com/resources/documentation/1922HilHorst.pdf)
- Vendor accuracy about ±20 % only above 25 % VWC. Below that, large potential errors, and METER advises back-calculating from a wet-state value assuming salt conservation. — [METER app note 18190 [PN]](https://library.metergroup.com/Retired%20and%20Discontinued/Application%20Notes/18190%20Soil%20Electrical%20Conductivity_Web.pdf)
- Below about θ 0.10 ECw cannot be determined from ECa, and measurements should stay above about half of field capacity. — [FAO-57 [PN]](https://www.fao.org/4/x2002e/x2002e.pdf)
- Clayey Mediterranean soils (Valencia): RMSD 3.1 dS/m (WET) and 4.1 dS/m (5TE), falling to 1.5 and 2.6 for θ > 0.22. — [Visconti et al. 2014 [PN]](https://www.publish.csiro.au/SR/SR13331)
- The offset varied with depth and irrigation event in sand columns. — [Aljoumani et al. 2018 [PN]](https://pmc.ncbi.nlm.nih.gov/articles/PMC6308429/)

**Probe specification (LSE01)**
- EC range 0–20,000 µS/cm "at 25 ℃", resolution 1 µS/cm, accuracy 2 % FS, with temperature compensation. MOD=1 reports raw EC, raw moisture and raw dielectric constant as 2-byte fields, with no conversion given. Moisture ±3 % (0–53 %), ±5 % above 53 %, FDR "with temperature and EC compensation". Temperature accuracy under 0.3 °C between −10 and 50 °C. No compensation formula or coefficient is published. — [Dragino LSE01 docs [FT via fetch summary]](https://docs.dragino.com/docs/LoRaWAN-End-Node/soil-agriculture-sensors/lse01/)
- The SE01-LS retail listing gives the same moisture figures. A dedicated SE0X datasheet was not obtained. — [Tindie SE01-LS [EX]](https://www.tindie.com/products/edwin/se01-ls-lorawan-soil-moisture-ec-sensor)

**Temperature correction**
- EC25 = ft·ECt, with ft = 0.4470 + 1.4034·exp(−t/26.815), from Sheets & Hendrickx 1995. — [Corwin & Yemoto [FT]](https://ars.usda.gov/arsuserfiles/20361500/pdf_pubs/P2558.pdf)
- Comparison in Precision Agriculture: the Sheets–Hendrickx exponential as corrected by Corwin & Lesch 2005 performed best, and the ratio model did well between 3 and 47 °C. Conductivity is cited as rising about 1.9 %/°C. The form of the equation in Corwin & Lesch vs the original was discussed in that paper. — [doi 10.1007/s11119-009-9156-7, mirror [EX; title and authors not retrieved]](https://springerlink.bibliotecabuap.elogim.com/doi/10.1007/s11119-009-9156-7)
- Ma et al. 2010, as cited in a 2024 package paper, compared models over about 0–50 °C and highlighted Sheets & Hendrickx. — [Pedophysics, arXiv 2403.07473 [EX]](https://arxiv.org/pdf/2403.07473)
- Besson et al. 2008: models are reliable when soil is near saturation, and validation above 20 °C was still needed. — [HAL 02662787 [EX]](https://hal.inrae.fr/hal-02662787)
- About 2 %/°C is the usual rule. Per-ion coefficients are 1.5–2.1 %/°C. — [METER article [EX]](https://publications.metergroup.com/Sales%20and%20Support/METER%20Environment/Website%20Articles/electrical-conductivity-soil-predictor-plant-response%20(1).pdf); Delta-T values via [earlier project note [PN]](https://delta-t.co.uk/wp-content/uploads/2022/07/WET150_kit_Quick_Start_Guide_v2.0.pdf)
- εp also depends on temperature: εp = 80.3 − 0.37(T − 20). — [Hilhorst 2000 [PN]](https://stevenswater.com/resources/documentation/1922HilHorst.pdf)

**When a reading is valid**
- Field 5TE study (10, 30, 50 cm; waters of 2 and 8+ dS/m): pore-water estimates were lower directly after irrigation and rose as θ fell through uptake. The sensors were useful "in a relative sense". — [McCann, Fraj & Dakheel, ICBA [EX]](https://agris.fao.org/search/ru/records/65dfb87b4c5aef494fe4a5af)
- In a salinity field study, EC of resident soil solution was usually above the wetting-front EC because draining and resident water mix incompletely, and sampling was done 24 h after the event. This does not derive 24 h as an equilibrium time. — [core.ac.uk 80889889 [EX; authors not verified]](https://core.ac.uk/download/80889889.pdf)
- Suction cups approximate resident concentration, and zero-tension cups flux concentration. Preferred suction is that at field capacity, so the reference state for field soil solution is field capacity. — [Corwin & Yemoto [FT]](https://ars.usda.gov/arsuserfiles/20361500/pdf_pubs/P2558.pdf)
- METER: use the combined equation "when water contents are highest to maximize accuracy". — [METER note 18190 [PN]](https://library.metergroup.com/Retired%20and%20Discontinued/Application%20Notes/18190%20Soil%20Electrical%20Conductivity_Web.pdf)
- Almería used suction samples at 10 cm every 2 weeks for soil-solution EC, and recommends adding this type of independent monitoring with hand-held EC meters. — [Thompson et al. 2003 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/irrigation-scheduling-of-drip-irrigated.pdf); [summary [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/continuous-soil-moisture-monitoring.pdf)
- Under drip, near-emitter salinity reflects irrigation water. ECe at the bulb edge is higher. Compare near-emitter samples with crop thresholds. — [UC ANR 8447 [PN]](https://soilhealth.ucdavis.edu/download_file/view/238/224)
- Soilless media: Hilhorst was reported as unsuitable in a 2024 study. — [Univ. Udine copy [PN]](https://air.uniud.it/retrieve/764ac392-0635-459f-a3aa-784be27781d3/1-s2.0-S0168169924001376-main.pdf)

### Inferences
- **Compute per sample, then aggregate.** The Hilhorst ratio is nonlinear. Illustration (this researcher's arithmetic, εp = 80, ε0 = 4.1): a dry resident sample with εb 8, σb 0.25 dS/m gives σp 5.13 dS/m. A diluted post-irrigation sample with εb 20, σb 0.5 gives 2.52 dS/m. Mean of per-sample values is 3.82. Hilhorst on the means (εb 14, σb 0.375) gives 3.03, which is 21 % lower. The bias is small when θ is steady and largest within a window that spans an irrigation. No published source states this rule for EC sensors: it follows from the form of the equation.
- **Mask before aggregating.** Apply per-sample validity first: θ above a floor, not within the wetting-event hold, T plausible. The dry sample in the example is also the least reliable, so a plain mean of per-sample values is not enough. Use the median of valid samples.
- **Valid-reading rule (mine, from the sources above).** Accept pore-water EC only when: (a) θ ≥ max(0.20–0.25, ½·θfc, or above 0.22 in clays); (b) outside the wetting-event hold; (c) in a fixed daily window. Compare day to day only within a similar θ band, for example ±0.02 m³/m³.
- **Better daily index.** Normalise per sample to a reference water content, ECref = σp·θ/θref, with θref the learned full point. This is the conserved-salt idea in FAO-57 and METER and removes much of the rise as soil dries. Conservation is imperfect, especially in gypsum or calcite soils. Use it as a trend index only.
- **High-frequency drip issue.** Under daily irrigation a soil rarely gets 24 h undisturbed. The practical choice is the same pre-irrigation window as the θ anchor, which yields a consistent θ, rather than the daily θ maximum, which sits inside the fresh-water pulse. This refines the earlier project note's "daily post-irrigation maximum". The earlier suggestion would be biased low and vary with pulse size.
- **Do not double-correct.** Dragino states EC is compensated to 25 °C, so applying ft again would inflate cold-soil EC. For example ft(15 °C) ≈ 1.25 and ft(35 °C) ≈ 0.83 (this researcher's arithmetic). Because the compensation algorithm is unpublished, a bucket test (known solution at two temperatures) is the only direct check. The project's memory records this as an open item. εp(T) still has to use actual soil temperature in the Hilhorst step, even if σb is normalised to 25 °C, because g(θ) = (εb − ε0)/εp is a property at soil temperature.
- **Spec-level uncertainty.** If "2 % FS" means ±400 µS/cm on a 20,000 µS/cm scale, that is ±0.4 dS/m on bulk EC. Through the Hilhorst multiplier εp/(εb − ε0) this gives about ±2.6 dS/m pore EC at εb 16.5 (θ ≈ 0.30) and about ±1.5 dS/m at εb 25 (θ ≈ 0.40), using the εb values from the earlier project note. This is a worst-case reading of the datasheet, and part of it is likely a fixed offset per probe. It does support using trends rather than absolute values, and using ECe thresholds with caution in low-salinity soils.
- **Time scale.** FAO-56 Ks is for weeks to months. Salinity decisions should use multi-day medians of the daily index, not hourly values. Hourly advice need not recompute salinity effects hourly: holding a daily or weekly value is consistent with the sources.
- **Depth aggregation for EC.** Use the 70/30 or root-zone-weighted mean for yield-related indices and the worst layer only for alerts, as in the earlier project note.
- **Cross-effect.** Because EC changes bias capacitive θ (Thompson), a sustained EC step and a θ step in the same probe at the same time should be flagged, not interpreted as water change. Whether Dragino's "EC compensation" removes this was not found.

### Gaps
- No study was found that measures the time for sensor pore-water EC to stabilise after a drip pulse. The 24 h figure is one study's sampling choice.
- No published rule about computing per sample before averaging was found. It is presented here as a mathematical consequence.
- Compensation algorithm, reference temperature handling and raw-mode behaviour of LSE01/SE0X: undocumented. The meaning of "2 % FS" (of full scale or of reading) was not clarified by Dragino's page.
- The exact corrected form in Corwin & Lesch 2005 was not compared with Sheets & Hendrickx 1995. The ft form quoted above is from Corwin & Yemoto. The mirrored paper's text was not accessible.
- No validation of Hilhorst with LSE01/SE0X was found, and none in Cretan soils.

---

## Q5. Greenhouse: which sensors feed crop models; inside vs outside station; radiation and ET0 inside greenhouses; VPD control practice

### Takeaway
Greenhouse crop water models use inside climate. Outside rain and wind do not apply. ET0 inside is well below outside: about 60 % of outdoor ET0 in one ventilated-greenhouse study, and a further 21 % lower under whitening in Almería. When inside radiation is not measured, the Almería approach derives it from outside radiation and a transmissivity that changes with whitening. Simple radiation or Hargreaves methods are preferred. If Penman-Monteith is used, it needs a fixed aerodynamic resistance: the corrected Almería value is 295 s/m, not the 150 s/m in the original abstract. No single VPD target is established for Mediterranean tomato.

### Cited Findings

**Inside vs outside and ET0**
- Almería lysimeters, 1993–2004, grass inside a plastic greenhouse. Best performers: FAO-56 PM with fixed aerodynamic resistance, FAO-24 pan with Kp 0.79, a locally calibrated radiation method, and Hargreaves. Hargreaves and radiation are recommended for simplicity. Whitening reduced measured ET0 by 21.4 % on average. — [Fernández et al. 2010, Irrig. Sci. 28 [EX]](https://sidalc.net/search/Record/dig-ias-es-10261-89549)
- **Erratum:** the correct fixed aerodynamic resistance is 295 s/m, not 150 s/m. With it, FAO-56 PM slightly underestimated ET0, by about 6 % without whitening and 2 % with whitening. Statistics given for the unwhitened case: RMSE 0.37 mm/day, MBE −0.078 mm/day, RE −3.3 %. — [Erratum, Irrig. Sci., doi 10.1007/s00271-010-0233-5 [EX]](https://link.springer.com/article/10.1007/s00271-010-0233-5)
- Measured greenhouse ET0 ranged from about 0.5 mm/day in winter to close to 4.0 mm/day in spring. Seasonal crop ET 170–371 mm. Weekly water balance, 2 lysimeters per greenhouse. Kc values (Kcini/Kcmid/Kcend): sweet pepper 0.2/1.3/0.9, unsupported watermelon 0.2/1.1/1.0. Kc depends on crop and management: high LAI and more diffuse radiation raise Kc compared with outdoor values, and the authors question using outdoor Kc directly. A thermal-time Kc model was proposed. — [Orgaz, Fernández, Bonachela, Gallardo & Fereres 2005, AWM 72:81–96 [FT, partial]](https://publicacionescajamar.es/wp-content/uploads/2023/03/evapotranspiration-of-horticultural.pdf)
- The climate station in the same work was mounted at 1.5 m inside, with a ventilated aspiro-psychrometer from 1990 on and a Class A pan. — [Orgaz et al. 2005 [FT]](https://publicacionescajamar.es/wp-content/uploads/2023/03/evapotranspiration-of-horticultural.pdf)
- Radiation-based method: uses daily outside solar radiation and greenhouse transmissivity determined monthly from paired outside/inside readings. Inside average temperature comes from a simple linear relation with outside temperature, calibrated in Almería. Transmissivity changes with roof whitening. — [Search excerpts of Las Palmerillas and related papers [EX; exact paper not verified]](https://publicacionescajamar.es/?p=1788); [Univ. Jaén copy [EX]](https://rujapre.ujaen.es/bitstreams/c30e6ae7-5463-45ae-84e7-fea5641dd296/download)
- FAO-56 PM adaptation with clear-sky radiation corrected for plastic transmissivity and with cool/warm-period coefficients; the authors say these should be tested elsewhere. — [Italian J. Agrometeorology [EX]](https://riviste.fupress.net/index.php/IJAm/article/download/2144/1500/15662)
- Lebanon, polycarbonate, two years inside and outside: under typical ventilated conditions greenhouse ET0-PM was 60 % of outdoor ET0-PM, and it can be predicted from measured radiation and the square root of transmissivity. — [AUB, Determining reference evapotranspiration in greenhouses from external climate [EX]](https://scholarworks.aub.edu.lb/items/1200337d-68df-4e78-a425-0bff37c04229/full)
- The European review covers adaptations of FAO-56 and simpler ET0 equations, adjusted Kc, sensors for soil and substrate, salinity effects on them, and plant sensors. — [Incrocci et al. 2020, AWM 242 [EX, abstract]](https://ideas.repec.org/a/eee/agiwat/v242y2020ics0378377420308209.html)

**Transpiration models**
- Simplified Penman-Monteith form: λE = A(1 − exp(−k·LAI))·Rg + B·LAI·VPD, explaining 92, 85 and 94 % of transpiration per soil area across three climate treatments, in greenhouse sweet pepper. A single coefficient set for the whole cycle underestimated, and the authors advise checking in other cycles. Inputs inside the greenhouse: aspirated psychrometers at 1.5 m, a solarimeter (±0.2 °C, ±0.04 kPa, ±5 W/m²), plus LAI. Coefficients A and B were not extracted. — [Gázquez et al., ISHS 797_36 [FT, partial]](https://publicacionescajamar.es/wp-content/uploads/2023/03/effects-of-vapour-pressure-deficit.pdf)
- Rose canopy in a fan-ventilated greenhouse: transpiration depended on solar radiation and air VPD in daytime. — [Kittas, Katsoulas & Baille, ISHS 548_34 [EX]](https://ishs.org/ishs-article/548_34/)

**VPD practice**
- Almería fog set point 1.5 kPa. Fogging at this set point "was probably not the best", because it limited transpiration. The authors say VPD set points of 1.5 kPa or lower are not advisable during the first stage of pepper. Under fog, transpiration barely responded to radiation above 350 W/m². — [Gázquez et al. [FT, partial]](https://publicacionescajamar.es/wp-content/uploads/2023/03/effects-of-vapour-pressure-deficit.pdf)
- Fog use to keep VPD below 1.5 kPa in pepper: 219 L/m² total. — [Cajamar cooling strategies [EX]](https://publicacionescajamar.es/wp-content/uploads/2023/03/effects-of-different-cooling-strategies.pdf)
- Upper limit: tomato at 30 °C without VPD control showed undesirable traits above 2.0 kPa, and holding at or below 2.0 kPa kept traits desirable. California, not Mediterranean-Crete, but semi-arid. — [Alcorn, Giacomelli & Scott 2023, Acta Hort. 1377 [EX, abstract]](https://ishs.org/ishs-article/1377_11/)
- A micro-fog trigger of VPD > 0.5 kPa improved tomato in a summer greenhouse (not Mediterranean). — [PLoS ONE, doi 10.1371/journal.pone.0133919 [EX]](https://doi.org/10.1371/journal.pone.0133919)
- Lower limit: a 0.20 kPa (0.030 psi) VPD disease and condensation threshold is attributed to Ohio State AEX-800 (Prenger & Ling 2000). Another Ohio State item says keep RH below 85 %. — [FarmHub summary of AEX-800 [EX, secondary]](https://docs.farmhub.ag/support/vapor-pressure-deficit.html)

### Inferences
- **Sensor routing.** For a covered field, feed inside hygrometer temperature and RH into anything about the crop canopy: VPD, disease hours, thermal time, inside ET0 temperature terms. Use outside data only for radiation (scaled) and as the driver of a default transmissivity. Exclude outside rain and wind from the soil water balance. The earlier project memory about rain text being hidden for covered fields is in line with this.
- **ET0 method with hygrometers only.** Inside T and RH are available; inside radiation and wind are not. Candidates, with sources:
  1. Radiation method: outside Rs × τ, with τ set by month and whitening status.
  2. Hargreaves from inside Tmax and Tmin.
  3. FAO-56 PM with ra fixed at 295 s/m and Rs,in = τ·Rs,out.

  Using outside ET0 directly would overestimate. Scaling by a fixed 0.6 is a defensible first approximation, based on the AUB figure, but it comes from a polycarbonate house in Lebanon. Whitening alone moves this by about a fifth, so it must be a declared parameter per greenhouse, ideally measured once with a handheld radiation reading inside and outside.
- **Do not cite 150 s/m.** Only the erratum value of 295 s/m should be used. Both come from one site.
- **Sensor position.** Consistent practice in these papers is aspirated or ventilated psychrometers at 1.5 m. Non-aspirated hygrometers in sun will read warm and dry. No figure was found for that bias.
- **Soil probes in greenhouses.** Rain does not reset the profile, so full-point detection must rely on irrigation only. Salts are not leached by winter rain, so the EC trend has a different meaning from open field. Foot traffic and compaction can cause sideways movement.
- **VPD advice.** Do not state a single target. A defensible, clearly labelled working band is condensation risk below about 0.2 kPa and stress risk above about 2.0 kPa, and no blanket 1.5 kPa cap in early crop stages. The 0.5–1.5 kPa band often quoted was not confirmed in a Mediterranean tomato source.

### Gaps
- FAO Plant Production and Protection Paper 217 (Good Agricultural Practices for greenhouse vegetable crops, Mediterranean climate, 2013) could not be opened (403 at openknowledge.fao.org). Its climate-control chapter should be read for humidity set points and sensor placement.
- Radiation method coefficients and Hargreaves calibration for greenhouses (Fernández 2010) were not retrieved.
- Typical transmissivity of Cretan greenhouses by cover age and whitening: not found. Almería data were not extracted either.
- Katsoulas group VPD target values for tomato or cucumber were not retrieved. Their 2009 eggplant fogging paper appeared only as a citation.
- Greek-language guidance on hygrometer placement or inside ET0: not found.

---

## Q6. Sampling intervals recommended by manufacturers and researchers

### Takeaway
No manufacturer or extension source found gives a recommended logging interval for irrigation. Network and research practice centres on hourly outputs. Dragino's default of 20 minutes is finer than these and is sufficient. It gives three samples per hour, enough for a median, but only one to three samples of a typical short drip pulse.

### Cited Findings
- Dragino LSE01 default uplink interval: 20 minutes, changeable by AT command or downlink. — [Dragino LSE01 docs [FT via fetch summary]](https://docs.dragino.com/docs/LoRaWAN-End-Node/soil-agriculture-sensors/lse01/)
- ISMN harmonises all datasets to hourly. — [Xaver 2015 [FT]](https://repositum.tuwien.at/bitstream/20.500.12708/14884/2/Xaver%20Angelika%20-%202015%20-%20Automated%20quality%20control%20procedures%20for%20the...pdf)
- USCRN publishes hourly values calculated over the 60-minute period ending at the stated time, and also daily sets. — [USCRN readme [FT]](https://www.ncei.noaa.gov/pub/data/uscrn/products/soil/soilclim01/readme.txt)
- A network table lists USCRN, SoilSCAPE and ARM as hourly and AWDN as daily, with some "hourly" instruments actually at 3 or 6 h. — [North American soil moisture network table, PMC5891330 [EX]](https://pmc.ncbi.nlm.nih.gov/articles/PMC5891330)
- The US national strategy notes that networks differ in whether reported values are means of higher-frequency sensing, and that most stations could report hourly once standardised. — [NCSMMN Strategy Ch. 2 [EX]](https://www.drought.gov/sites/default/files/2025-10/NCSMMN-Strategy-Chapter-2.pdf)
- Nebraska's Watermark programme used a logger with one-hour intervals. — [UNL CropWatch newsletter [EX]](https://cropwatch.unl.edu/2024/weekly-irrigation-newsletter)
- Battery rather than agronomy sets the limit in vendor documents. HOBO warns that solar motes can miss data if logged too fast, and the interval applies network-wide. — [HOBO RXW-GP manual [EX]](https://manuals.online/test-equipment-depot/measuring-instrument/rxw-gp-series/user-manual/sh90)
- A patent describes intervals of about 1–100 minutes. It is not a recommendation. — [US 8,308,077 [EX]](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8308077)
- Chanzy et al.'s temperature corrections use 2-hour windows starting 1 h after sunrise and ending 2 h before sunset, which needs sub-hourly or hourly data. — [Chanzy et al. 2012 [FT via fetch summary]](https://pmc.ncbi.nlm.nih.gov/articles/PMC3444127/)
- METER's search returned no specific interval. — [METER guide search result [EX]](https://metergroup.com/education-guides/the-researchers-complete-guide-to-soil-moisture/)

### Inferences
- 20 minutes suits both hourly median and event timing. Going finer adds battery and airtime cost without a sourced benefit. Going to 1 hour would remove the median's spike protection and blur wetting events.
- Decision logic should be declared by window and step: 20-minute raw, hourly median, daily anchor, multi-day salinity index. This fits the project rule that time-derived quantities declare their window and step.
- Soil temperature is slow at depth (about 2 °C daily amplitude at 30 cm, Chanzy), so hourly medians lose nothing there.
- A short pulse (for example 15–30 minutes) can fall between uplinks, so logged valve or meter data should be preferred over inferring events from θ.

### Gaps
- No explicit manufacturer or extension recommendation was found for Sentek, METER, Irrometer or Dragino on a logging interval for irrigation. Sentek's interval in the Almería work is not stated.
- No research was found that tests how sampling interval changes irrigation outcomes or how often soil sensors must sample to capture drip wetting. TERENO/SoilNet intervals were not found.
- METER's guide returned 403, so the claim of "no interval" reflects a search result, not a full reading.
