# Data quality, missing data, provenance and presentation in agricultural decision support

Scope note: researched 2026-11-07. Every finding carries an evidence tag so that evidence and opinion stay separate:

- **[STD]** a published standard, manual or network guideline: normative, and usually consensus rather than experiment.
- **[OPS]** what a named operational network actually does.
- **[EMP]** an empirical study: experiment, trial, survey or data analysis.
- **[REV]** a review or synthesis.
- **[OPINION]** the view of an author or practitioner, without data.
- **[UNCONFIRMED]** taken from a search snippet or a secondary source. I did not read the primary text, so check it before quoting.

Primary text was read directly, in full or in the relevant sections, for: Zahumenský/WMO 2004, Shafer et al. 2000, AASC 2019, the QARTOD flags manual v1.2, the QARTOD wind manual, Rose et al. 2016 and Yuen and Mila. Hogeveen et al. 2010, the MADIS QC notes and the NEWA data page were read through a fetch-and-extract step, so check any wording before quoting it. Most other items were read as abstracts or snippets, and each is marked where it matters. Fiebrich et al. 2010 returned HTTP 403, so only secondary mentions were used.

Everything under "Inferences" is my reasoning, including the arithmetic. It is not sourced fact. Mapping to this system (latest-packet, hourly and daily cards; mixed instruments; measured and estimated values; too many alerts) appears only there.

---

## Automated QC for environmental sensor networks: tests, flag schemes, and flagged data in calculations

### Takeaway
All the major schemes converge on the same design. A layered set of cheap tests (range, step, persistence, internal consistency, spatial or like-instrument) is combined into one worst-case flag per value, and the raw value is never altered. Only a physical range failure is strong enough to condemn a value alone. The other tests produce "suspect", which needs corroboration or human review, because real weather trips them.

### Cited Findings

**Test families**
- [STD] AASC (21 US state mesonets contributed) names five automated categories: physical limits, seasonal range, sensor intercomparison, temporal consistency, spatial coherency. Each mesonet should run all five, with local nuance accepted — [AASC 2019, section 5.1](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).
- [OPS] Oklahoma Mesonet in 2000 ran five routines: range, step, persistence, spatial, like-instrument. A decision algorithm merged them into one flag, overnight on the previous day's data — [Shafer et al. 2000](http://cig.mesonet.org/staff/shafer/Mesonet_QA_final_fixed.pdf). By 2012 the tests ran every five minutes and had added climate-based range and internal consistency tests — [Fiebrich and Kloesel 2012](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/IOM-109_TECO-2012/Session3/O3_07_Fiebrich_Oklahoma_Mesonet.pdf).
- [STD] QARTOD (wind) lists 11 tests in three tiers. Required: timing/gap, syntax, location, gross range, climatology. Strongly recommended: spike, rate of change, flat line. Suggested: multi-variate, attenuated signal, neighbor — [QARTOD wind manual v1.1](https://cdn.ioos.noaa.gov/media/2017/12/QARTOD_Wind_Manual_v1.1_final_draft_signed.pdf).
- [OPS] MADIS uses three levels. Level 1 is validity. Level 2 is internal, temporal and statistical spatial consistency. Level 3 is a spatial "buddy" check using Optimal Interpolation with neighbours taken from eight direction sectors — [MADIS surface QC notes](https://madis.ncep.noaa.gov/madis_sfc_qc_notes.shtml).

**Exact thresholds, all explicitly "possible" limits from a 2004 WMO expert-team proposal.** [UNCONFIRMED] whether these are unchanged in the current WMO-No. 8 edition: the document recommends publication there, but I did not read the current text.
- [STD] Sample level, 10 s sampling, jump between consecutive samples: air temperature 2 °C; dew point 2 °C; soil temperature 2 °C; RH 5 %; pressure 0.3 hPa; wind speed 20 m/s; solar radiation 800 W/m² — [Zahumenský, WMO CIMO 2004](https://old.wmo.int/extranet/pages/prog/www/IMOP/meetings/Surface/ET-STMT1_Geneva2004/Doc6.1%282%29.pdf).
- [STD] Plausible range on one-minute values: air temperature −80 to +60 °C; dew point −80 to 35 °C; soil temperature −50 to +50 °C; RH 0–100 %; station pressure 500–1100 hPa; wind 0–75 m/s; solar 0–1600 W/m²; precipitation 0–40 mm per minute. Outside these limits is flagged erroneous — [same](https://old.wmo.int/extranet/pages/prog/www/IMOP/meetings/Surface/ET-STMT1_Geneva2004/Doc6.1%282%29.pdf).
- [STD] Step test between one-minute values, suspect limit: air temperature 3 °C; RH 10 %; pressure 0.5 hPa; wind 10 m/s; solar 800 W/m²; soil temperature 0.5 °C at 5–20 cm, 0.3 °C at 50 cm, 0.1 °C at 100 cm. Dew point is 2 °C if measured, and a larger limit if computed from T and RH, because of screen response. The document notes that real extremes can be flagged suspect while being correct — [same](https://old.wmo.int/extranet/pages/prog/www/IMOP/meetings/Surface/ET-STMT1_Geneva2004/Doc6.1%282%29.pdf).
- [STD] Persistence (minimum variability over 60 min): air temperature and dew point 0.1 °C; RH 1 %, only below 95 % RH; pressure 0.1 hPa; wind direction 10°; wind speed 0.5 m/s, only when mean wind exceeds 0.1 m/s. Soil temperature has no minimum because it can be very stable. Low standard deviation over at least one hour is recommended as a blocked-sensor and drift check — [same](https://old.wmo.int/extranet/pages/prog/www/IMOP/meetings/Surface/ET-STMT1_Geneva2004/Doc6.1%282%29.pdf).
- [STD] Internal consistency: dew point not above air temperature; gust not below wind speed; speed and direction zero together; solar radiation above 500 W/m² with zero sunshine is suspect — [same](https://old.wmo.int/extranet/pages/prog/www/IMOP/meetings/Surface/ET-STMT1_Geneva2004/Doc6.1%282%29.pdf). AASC adds the cross-sensor example of very low RH during significant rain — [AASC 2019](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).
- [STD] QARTOD flat line, example values only: 3 repeats within EPS gives suspect, 5 repeats gives fail, EPS 0.5 m/s for wind. Thresholds are operator-defined and vary between providers — [QARTOD wind manual](https://cdn.ioos.noaa.gov/media/2017/12/QARTOD_Wind_Manual_v1.1_final_draft_signed.pdf).
- [OPS] MADIS temporal limits per hour: air temperature and dew point 35 °F; wind 20 kt; soil temperature 5 °F. Validity: soil moisture 0–100 %, soil temperature −40 to 150 °F. Note these are per-hour limits, not the per-minute limits of the WMO list above — [MADIS](https://madis.ncep.noaa.gov/madis_sfc_qc_notes.shtml).
- [OPS] Oklahoma spatial test: Barnes analysis estimate with 20–25 stations in the network interior. Departure above 2σ is suspect, above 3σ is warning. No flag if fewer than six neighbours. A floor on σ (3.0 °C for air temperature) means only departures above 6 °C are flagged. The authors say this reduces false alarms but hides small errors — [Shafer 2000](http://cig.mesonet.org/staff/shafer/Mesonet_QA_final_fixed.pdf).
- [OPS] Oklahoma like-instrument test (for example air temperature at 1.5 m vs 9 m): above threshold is suspect, above twice the threshold is warning. It is also used to rescue good data. If two instruments agree with each other but disagree with neighbours, the spatial flag is downgraded, because the cause may be a real local effect such as an inversion — [Shafer 2000](http://cig.mesonet.org/staff/shafer/Mesonet_QA_final_fixed.pdf).

**Flag schemes**
- [STD] QARTOD/IOC: 1 pass, 2 not evaluated, 3 suspect or of high interest, 4 fail, 9 missing. Primary flag = worst case of all tests. Secondary flags record each test individually. QARTOD discourages flag 2, because its first data management law requires a quality descriptor on every real-time observation — [QARTOD flags manual v1.2, 2020](https://cdn.ioos.noaa.gov/media/2020/07/QARTOD-Data-Flags-Manual_version1.2final.pdf).
- [OPS] Oklahoma: 0 good, 1 suspect, 2 warning, 3 failure, 4 not installed yet, 5 likely good, 6 known good, 8 never installed, 9 missing — [Shafer 2000](http://cig.mesonet.org/staff/shafer/Mesonet_QA_final_fixed.pdf).
- [OPS] MADIS: Z preliminary, C coarse pass, S screened, V verified, X rejected, Q questioned, G and B subjective — [MADIS](https://madis.ncep.noaa.gov/madis_sfc_qc_notes.shtml).
- [STD] WMO proposal: good, inconsistent, doubtful, erroneous, missing, plus not checked and changed. A reason should accompany non-good values — [Zahumenský 2004](https://old.wmo.int/extranet/pages/prog/www/IMOP/meetings/Surface/ET-STMT1_Geneva2004/Doc6.1%282%29.pdf).
- [STD] AASC: good; good despite failing automated QC; suspicious; bad; bad despite passing automated QC. All suspect values should be reviewed by trained staff, with a comment recorded whenever a reviewer changes a flag — [AASC 2019](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).
- [STD] Conversion between schemes is normal practice: QARTOD recommends metadata translation tables rather than a forced single scheme — [QARTOD flags manual](https://cdn.ioos.noaa.gov/media/2020/07/QARTOD-Data-Flags-Manual_version1.2final.pdf).

**Combining tests**
- [OPS] Only the Oklahoma range test can declare failure alone. Step plus spatial together gives failure; step alone is downgraded to suspect (the spatial test decides whether the jump is toward or away from background); spatial alone keeps its flag — [Shafer 2000](http://cig.mesonet.org/staff/shafer/Mesonet_QA_final_fixed.pdf).
- [OPS] MADIS sticky status: an observation type that failed any check in 75 % of the previous 7 days is marked failed, and stays failed until the weekly rate drops below 25 %. Reject-list items are bad regardless of QC and are excluded from checks on neighbours — [MADIS](https://madis.ncep.noaa.gov/madis_sfc_qc_notes.shtml).
- [OPS] A hand-edited table (qualparm) holds sensor history and can raise or override automated flags. The daily report lists a parameter only if more than 10 % of its daily values are suspect, or if any are warning or failure, so the reviewer sees real problems and not noise — [Shafer 2000](http://cig.mesonet.org/staff/shafer/Mesonet_QA_final_fixed.pdf).

**What happens to flagged data downstream**
- [STD] At sample level, a value that fails range is rejected and not used in the computation. A sample that fails rate of change is not used in the average, but it is kept for checking the next sample, so noise removes only one or two samples. Below 66 % of samples in a minute, the value is flagged missing and not used further — [Zahumenský 2004](https://old.wmo.int/extranet/pages/prog/www/IMOP/meetings/Surface/ET-STMT1_Geneva2004/Doc6.1%282%29.pdf).
- [OPS] Oklahoma's archive is never altered: values are coupled with flags, and users can apply flags at retrieval or take the flags separately — [Shafer 2000](http://cig.mesonet.org/staff/shafer/Mesonet_QA_final_fixed.pdf). Delivery differs from the archive: data judged erroneous stay in the archive and are not delivered to users — [Fiebrich and Kloesel 2012](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/IOM-109_TECO-2012/Session3/O3_07_Fiebrich_Oklahoma_Mesonet.pdf). [UNCONFIRMED, snippet] Public files carry missing or failure indicators in place of the value — [Illston et al. 2008](https://www.mesonet.org/files/instruments/Illstonetal2008.pdf).
- [STD] Most users want only good data, with bad values shown as unavailable — [AASC 2019](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf). QARTOD warns that automated deletion can remove real events, such as a thunderstorm gust, and that failed data must be obviously unacceptable if disseminated at all — [QARTOD flags manual](https://cdn.ioos.noaa.gov/media/2020/07/QARTOD-Data-Flags-Manual_version1.2final.pdf).
- [OPS] Flag propagation to derived values has precedent. An earlier agricultural scheme described by Shafer flags data derived from other variables, and aggregates containing one or more flagged hourly values — [Shafer 2000](http://cig.mesonet.org/staff/shafer/Mesonet_QA_final_fixed.pdf). (Author name garbled in the two-column extraction; it reads as "… and Pruitt", probably Snyder and Pruitt: [UNCONFIRMED].)
- [STD] [UNCONFIRMED, snippet from a sibling manual] Real-time flags should not be changed afterwards; post-processing should produce a separate flag set for a revised dataset — [QARTOD ocean optics](https://cdn.ioos.noaa.gov/media/2017/12/QARTODOceanOptics_v1.1_Final.pdf). Flagging labels data and does not modify them — [QARTOD HF radar](https://cdn.ioos.noaa.gov/media/2022/07/HFR_QARTOD_Manual_Update_Final-1b.pdf).

**Why automated QC needs a human loop (documented failures of the tests themselves)**
- [OPS] The range test, thought safest, wrongly flagged 5 cm soil temperatures above 50 °C in the hot summer of 1998, and the threshold was then changed. A single 1 mm shower was wrongly flagged by the spatial test until radar confirmed it. Outflow boundaries and heatbursts also trip step and spatial tests — [Shafer 2000](http://cig.mesonet.org/staff/shafer/Mesonet_QA_final_fixed.pdf).
- [OPS] Irrigation is a real local signal: with wind crossing an irrigated farm, the Altus site read up to 3 °C cooler than nearby Tipton — [Shafer 2000](http://cig.mesonet.org/staff/shafer/Mesonet_QA_final_fixed.pdf). AASC warns that comparison stations must be chosen using site metadata to avoid flagging valid data — [AASC 2019](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).
- [OPS] A flag does not necessarily mean erroneous data, and CIMIS advises comparing with nearby stations of similar microclimate — [UNCONFIRMED, snippet: CIMIS procedures](https://cimis.water.ca.gov/Content/PDF/CIMIS%20Data%20Quality%20Control%20Procedures.pdf).

**Soil moisture specifically**
- [EMP] ISMN automated QC has two families: geophysical range plus consistency with soil temperature and precipitation, and later shape-based detection of spikes, jumps and plateaus, validated against manual flags on 40 datasets — [Dorigo et al. 2013](https://zendy.io/title/10.2136/vzj2012.0097) and [Xaver 2015](https://repositum.tuwien.at/bitstream/20.500.12708/14884/2/Xaver%20Angelika%20-%202015%20-%20Automated%20quality%20control%20procedures%20for%20the...pdf) (abstract level).
- [OPS] SaQC implements a plateau check with a default 12 h minimum duration and a variance threshold, plus a check for moisture rises without preceding rain — [SaQC docs](https://git.ufz.de/rdm-software/saqc/-/blob/692af91cc753b7a53179eacd0d1220a6122ee930/docs/funcs/SoilMoisture.md) (snippet).
- [EMP] Over 433 NASMD stations were controlled using NLDAS-2 model products, soil temperature and soil porosity — [Xia et al.](https://impacts.ucar.edu/en/publications/automated-quality-control-of-in-situ-soil-moisture-from-the-north/) (abstract).

### Inferences
- One sentence of design follows from all of the above: keep raw values immutable, compute a per-test flag and one worst-case primary flag, let only physical range and sensor faults hide a value on their own, and treat everything else as "suspect until corroborated".
- WMO step and persistence limits are defined for one-minute values and 10-second samples. They do not transfer to LoRaWAN packets 10–60 minutes apart. MADIS's per-hour limits are the closer analogue, and limits should scale with the actual interval between packets.
- A persistence test needs care with sparse packets: three equal values in one hour may just be sensor resolution. The WMO exemption for soil temperature, and the conditions on RH and wind, show that persistence limits must be conditional on state. A dry soil probe in a dry spell is likely the same case. (Opinion, not sourced for soil moisture.)
- Spatial checks transfer poorly to irrigated and covered fields, and the Altus example shows why. Fields are not comparable the way mesonet sites are. Like-instrument checks (two probes, or two depths) and internal consistency are likely more useful here than buddy checks. Any neighbour comparison should be limited to weather variables on open-air sites.

### Gaps
- I could not confirm the current WMO-No. 8 wording; the numbers above are the 2004 proposal.
- Shafer's Table 3 did not extract cleanly from the two-column PDF, so per-parameter step and persistence thresholds are not reported here.
- I did not find a published share of Oklahoma observations flagged, nor any measured false-flag rate for any of these tests.
- Fiebrich et al. 2010 full text was blocked (HTTP 403).
- I found no QC standard specific to leaf wetness sensors or low-cost LoRaWAN stations.

---

## Gap handling: when to fill, when to withhold, how to label; freshness; completeness per decision

### Takeaway
Operational networks fill only short gaps in smooth variables, always label the estimate visibly, and refuse to estimate some variables outright. NEWA never fills soil temperature or soil moisture. The common completeness threshold is 75 % per hour for non-cumulative variables, but the same source says the acceptable limit depends on the application. I found no published freshness standard for farm DSS.

### Cited Findings

**Completeness thresholds**
- [STD] At least 66 % (2/3) of samples for a one-minute value; at least 75 % for 2- or 10-minute wind averages — [Zahumenský 2004](https://old.wmo.int/extranet/pages/prog/www/IMOP/meetings/Surface/ET-STMT1_Geneva2004/Doc6.1%282%29.pdf).
- [STD] 75 % completeness minimum for hourly or shorter values of non-cumulative parameters. As an alternative, report the percentage missing with the value. The US ASOS network requires 75 % of one-minute observations for hourly values — [AASC 2019, section 6](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).
- [STD] Daily mean only if no more than 4 hours are missing and no more than 3 consecutive hours are missing, adapted from the NCEI monthly rule (no monthly mean with more than 5 days or more than 3 consecutive days missing) — [AASC 2019](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).
- [STD] Sums such as precipitation are different: NCEI publishes the total together with the number of missing days and notes multi-day totals — [AASC 2019](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).
- [STD] Acceptable missingness varies by application and by tolerated error, and gaps matter most for extremes and precipitation totals — [AASC 2019](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).
- [STD] Network target: 95 % completeness or better for any 60-minute period across all stations. NOAA's National Mesonet Program requires 95 % monthly — [AASC 2019](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).

**Fill rules in agricultural networks**
- [OPS] NEWA, temperature and RH: average of previous and next hour if both exist, otherwise nearest grid point of NCEP RTMA/URMA. Precipitation and wind direction: filled from the same analysis. Solar radiation: estimated from sky cover. **Soil temperature and soil moisture are never filled or estimated.** Estimated values appear in brown italics in data listings. The page sets no maximum gap length — [NEWA](https://newa.cornell.edu/how-newa-handles-weather-data/).
- [OPS] [UNCONFIRMED, snippet; the page redirected and then returned 404] UC IPM/CIMIS labels each estimate by method: H = up to 6 hours interpolated; S = substitute station for longer gaps; P = previous day's value when no substitute exists — [UC ANR](https://innovate.ucanr.edu/node/128167).
- [OPS] [UNCONFIRMED, snippet] CIMIS flags include M missing, R far out of historical limits, Y moderately out of limits, S sensor out of service or out of threshold — [CIMIS flags](https://cimis.water.ca.gov/Content/PDF/CurrentFlags2.pdf).
- [OPS] Where a station has no leaf wetness sensor, NEWA logs a wet hour when mean hourly RH exceeds 90 %. Where it has one, an hour counts as wet with at least 1 minute of recorded wetness — [NEWA](https://newa.cornell.edu/how-newa-handles-weather-data/).
- [STD] The WMO proposal places gap filling, correction and validation of doubtful data at the data-processing centre, and requires keeping the QC results together with how suspect or wrong data were treated — [Zahumenský 2004](https://old.wmo.int/extranet/pages/prog/www/IMOP/meetings/Surface/ET-STMT1_Geneva2004/Doc6.1%282%29.pdf).
- [REV] Linear interpolation is usually acceptable for short gaps in temperature and increasingly unconvincing as gaps lengthen — [chillR textbook](https://inresgb-lehre.iaas.uni-bonn.de/chillR_book/filling-gaps-in-temperature-records.html) (snippet).

**Freshness**
- [STD] QARTOD timing test: if now minus the time stamp exceeds the expected reporting increment, flag 9 (missing). Staleness is thus defined against each stream's own interval, not a global constant — [QARTOD wind manual](https://cdn.ioos.noaa.gov/media/2017/12/QARTOD_Wind_Manual_v1.1_final_draft_signed.pdf).
- [OPS] NEWA operator escalation: emails to station owners at 24 hours, 7 days and 21 days of outage. After 21 days the station goes inactive until fixed. State coordinators get daily summaries — [NEWA](https://newa.cornell.edu/how-newa-handles-weather-data/).
- [EMP] In dairy sensors, the time window itself sets measured performance. Sensitivity rose from 40 % to 66.7 % when the window went from under 24 h before the event to 24 h either side — [Kamphuis et al. 2010](https://consensus.app/papers/details/39fd9bee2d465c2d9958a94bee6a6ff3/?utm_source=claude_code). The review recommends a window of no more than 48 hours for clinical mastitis — [Hogeveen et al. 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC3231225).

### Inferences
- **A percentage threshold breaks at low sample rates.** At 3 packets per hour, 75 % means all 3 must arrive (2 of 3 is 67 %). At 6 per hour it means 5 of 6. At 1 per hour it means the single packet. Rules for LoRaWAN should therefore be written as a minimum count per window, and they should state the expected rate per instrument. (Arithmetic mine.)
- Three classes of variable are suggested by the evidence: smooth and spatially coherent (air temperature, RH: fill short gaps, label); site-specific state (soil moisture, soil temperature, likely leaf wetness and EC: never fill, show the last value with its age or show nothing); accumulated (rain, degree-days, infection hours: never treat missing as zero, show the total with the count missing).
- Completeness should be decision-specific. An hourly mean for a chart can tolerate more than a count of infection hours, where a missing hour directly changes the result. A daily index should carry its own complete/incomplete status and not inherit one silently.
- Freshness should be a property of the value: expected interval × a tolerance factor, per stream. A factor of 2–3 is my opinion and is unsourced.
- Estimates should keep the method in the label, as the H/S/P flags do, since "estimated" alone hides the difference between 1 hour interpolated and a value taken from another station.

### Gaps
- I found no published numeric freshness limits for agricultural DSS cards or for irrigation decisions.
- I found no published study of how gap-filled inputs affect disease model outputs. NEWA's page does not describe how its models handle gaps.
- I could not confirm the maximum interpolation length in the UC IPM rule from the primary page.
- The WMO climate-normals missing-data rule was not checked here; it is out of scope for hourly decisions.

---

## Single source of truth: one computation, no two numbers for one quantity; time-stamping and time zones

### Takeaway
Direct evidence here is thin but consistent: network guidance says aggregates must come from one base series by one documented method, because small differences in method produce real differences in results. Metadata standards then force each value to declare what it is. The data-engineering case for a single definition is practice rather than tested evidence.

### Cited Findings
- [STD] Networks should follow consistent methods for handling missing data and aggregating to hourly, daily and longer values. Subtle method differences can produce significant differences in results, and hourly, daily and monthly values should be derived only from the core five-minute observations — [AASC 2019, section 6](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).
- [STD] Procedures for computing instantaneous values and sums should be part of the station's standard documentation — [Zahumenský 2004](https://old.wmo.int/extranet/pages/prog/www/IMOP/meetings/Surface/ET-STMT1_Geneva2004/Doc6.1%282%29.pdf).
- [OPS] Two methods for "the same" value differ in published practice. An analysis of CIMIS found that hourly sums match the daily summaries best if counted from 1 am, implying an offset daily window — [UCANR IGIS note](https://ucanr-igis.github.io/sketchbook/cimis_hour2day_investigation.html) (snippet, informal analysis). ET-Demands recommends the mean of daily min and max for daily mean temperature rather than the mean of hourly values — [ET-Demands docs](https://et-demands.readthedocs.io/en/master/model_description.html) (snippet).
- [STD] CF conventions: a statistic's method is declared in the `cell_methods` attribute, and its extent in a bounds variable recording the start and end of the averaging period. Quality flags attach through `ancillary_variables` with a `status_flag` or `quality_flag` standard name — [CF conventions 1.11, sections 1.4, 2.4, 3.4, 3.5](https://cfconventions.org/Data/cf-conventions/cf-conventions-1.11/cf-conventions.html). QARTOD flag names were added to the CF table in 2020 — [QARTOD flags manual](https://cdn.ioos.noaa.gov/media/2020/07/QARTOD-Data-Flags-Manual_version1.2final.pdf).
- [STD] OGC SensorThings separates phenomenonTime (the instant or interval the result applies to), resultTime (when the result became available) and validTime (the period it is meant to be used), plus resultQuality. All are ISO 8601 — [third-party summary of the data model](https://hmc-stamplate.github.io/JSONSchema/sta-data-model.html). [UNCONFIRMED: normative OGC text not read.]
- [OPS] CIMIS reports always in Pacific Standard Time, with no daylight saving shift — [CIMIS data preparation document](https://cdpr.ca.gov/wp-content/uploads/2024/11/pt_1_iscst3_data_prep_from_cismis_2017.pdf) (snippet). PestCast documentation states that reports cover the interval before the reported time, so a label marks the end of its window — [PestCast doc](https://data.eol.ucar.edu/datafile/nph-get/92.082/pestcast_doc.htm) (snippet). The same convention for CIMIS is inferred and unconfirmed. Modern APIs take UTC — [Synoptic note](https://ucanr-igis.github.io/tech_notes/synoptic-api.html).

### Inferences
- The likely root cause of "two numbers for one quantity" here is that the same name is used for different things: a latest packet, an hourly mean and a daily statistic. The cure has two parts: compute each named quantity once, and make the name carry the statistic and the window ("last reading at 14:20" versus "mean 13:00–14:00"). Two different numbers are legitimate only when they are visibly different quantities.
- Widgets should display and not compute. Any value that a card computes for itself is a second implementation. (Opinion, from the AASC principle.)
- Suggested time convention: store UTC with ISO 8601; record window start, window end and result time separately; define the agronomic day explicitly in one place; display local time with the zone. Fixed local standard time (CIMIS) avoids 23- and 25-hour days in daily sums, which is an argument for computing daily sums on a fixed-offset day rather than a civil day. (Opinion.)
- Three times matter and should not be merged: when measured, when received, when computed. A late LoRaWAN packet shows why.

### Gaps
- I found no peer-reviewed study measuring how inconsistent numbers on a farm dashboard affect trust, and no reliable source for "single source of truth" specific to agricultural systems.
- I could not confirm a WMO statement requiring UTC time stamps in the documents read, and AASC's text has none. The end-of-interval labelling standard for hourly values was found only in PestCast.
- Exact CF `time: mean (interval: …)` syntax was not confirmed. Section 7.3 was not reached in the fetch.

---

## What should accompany a displayed value; evidence from DSS usability research

### Takeaway
Standards specify a clear list: when (interval and result time), statistic, source, quality flag, and count or percent missing. The usability evidence is weaker and pulls the other way, because farmers want quick, simple output and advisers want to see the evidence base. This points to a layered display. Showing numeric uncertainty does little harm to trust; vague verbal hedging does more.

### Cited Findings
- [STD] Every observation should carry a quality descriptor — [QARTOD flags manual](https://cdn.ioos.noaa.gov/media/2020/07/QARTOD-Data-Flags-Manual_version1.2final.pdf). The quality of data shall be known and demonstrable, and the reason for missing data should be transmitted — [Zahumenský 2004](https://old.wmo.int/extranet/pages/prog/www/IMOP/meetings/Surface/ET-STMT1_Geneva2004/Doc6.1%282%29.pdf).
- [STD] Percentage of missing observations may be provided with the value; number of missing values and any multi-period totals should accompany totals — [AASC 2019](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).
- [STD] The statistic and its averaging bounds are declared with the value (CF), and the time the result applies to is separated from the time it became available (SensorThings) — see the previous section.
- [STD] Sensor metadata lets users interpret data properly, with a separate entry per sensor where heights or depths differ — [AASC 2019, section 3.3](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).
- [OPS] Measured versus estimated is shown by visual style: brown italics on NEWA — [NEWA](https://newa.cornell.edu/how-newa-handles-weather-data/).
- [REV] Of 61 reviewed agricultural DSS articles, most centre on maps. The authors see a large opportunity for dashboards that help users understand data uncertainty — [Gutiérrez et al. 2019](https://consensus.app/papers/details/db215e802e6959b5bae0d1401e623c10/?utm_source=claude_code) (abstract). Agricultural DSS rarely offer interactivity, rarely visualise uncertainty, and are rarely evaluated with end users — [Htun et al. 2022](https://consensus.app/papers/details/32ae75138e81538f9b37d38869f8ed63/?utm_source=claude_code) (abstract).
- [EMP] Five experiments including a BBC field test (5,780 participants): numeric ranges lowered trust in the number only slightly and caused no significant change in trust in the source; verbal uncertainty lowered trust more. Domain is news, not farming, and participants were somewhat more educated than the public — [van der Bles et al. 2020](https://cir.nii.ac.jp/crid/1360576123220091264), via [summary](https://blog.aiimpacts.org/p/paper-summary-the-effects-of-communicating).
- [EMP] Non-experts made better weather and climate decisions when forecasts included uncertainty estimates, though formats differed in effect — [LeClerc thesis, supervised by Joslyn](https://digital.lib.washington.edu/researchworks/items/5005f5c9-f791-4882-84fd-5ec28581d181/full) (abstract only). Adding explicit uncertainty preserved trust better than reducing false alarms — [UNCONFIRMED secondary statement of LeClerc and Joslyn's result](https://www.stat.berkeley.edu/~aldous/157/Papers/leclerk.pdf).
- [EMP] Farmers and advisers said tools must be quick to read; one adviser reported that too many figures put farmers off. Advisers trust tools whose evidence base is robust and transparent, and adviser trust carries over to the farmer — [Rose et al. 2016](https://ueaeprints.uea.ac.uk/60758/1/Published_manuscript.pdf).
- [EMP] UK workshop participants found DST dashboards informative but often overwhelming; barriers included confusing metrics — [Grant et al. 2026](https://consensus.app/papers/details/e7f22d0569955b0ba306c54d183cbbd2/?utm_source=claude_code) (abstract; 50 farmers, 26 agronomists, 10 workshop participants).

### Inferences
- A two-layer value follows from this tension. **Layer 1 for the farmer** (always visible): value, unit, age in plain words, and a state marker only when not normal (estimated, incomplete, stale, suspect). **Layer 2 on tap for the agronomist:** window, statistic, n of expected samples, instrument and depth, method and version, flags with reasons, and uncertainty.
- Hide normality: if every card carries all metadata, the exceptions disappear. A marker should show only when something is wrong. (Opinion.)
- Withholding should be visible. A stale card should show "last reading at …", not a value that looks current and not a blank that looks like a software fault.
- Uncertainty should be numeric where it exists (range or ± from sensor accuracy), not vague words. Note that estimated-value uncertainty is rarely available from the methods surveyed above.

### Gaps
- **I found no controlled study in agriculture testing whether showing timestamp, averaging window, sample count or source improves trust or decisions.** The metadata list above comes from data standards, not usability evidence.
- Evidence on uncertainty is from news and weather, with non-farmers. Transfer is an assumption.
- Gutiérrez, Htun and Grant were read at abstract level only.

---

## Alert design and alert fatigue; thresholds, escalation, sensitivity vs false alarms; evaluation

### Takeaway
The strongest evidence, from human factors, is that low precision teaches users to ignore true alarms, and repetition does the same. Agriculture's most developed benchmark comes from dairy sensors: about 80 % sensitivity with over 99 % specificity, and most systems studied fall short of it. Sensitivity and specificity alone are not enough for rare events, because predictive value depends on the base rate. Mature practice treats alarm load as a measured quantity and fixes the top offenders first.

### Cited Findings

**Human factors**
- [EMP] 122 airport screeners: automation with a 20 % false alarm rate and PPV 0.3 led operators to ignore about half of the true alarms on difficult targets. Compliance followed PPV, and d′ and PPV are better measures of reliability than accuracy alone. Below PPV 0.5, operators need clear instructions on how to respond — [Huegli et al. 2020](https://consensus.app/papers/details/72ad5c5f8f6f5830aec175b6ee8e9f44/?utm_source=claude_code).
- [EMP] False-alarm-prone automation hurt performance more than miss-prone automation and affected both compliance and reliance (32 students, simulation) — [Dixon et al. 2007](https://consensus.app/papers/details/820e194898fa52668c90fc4141ac9413/?utm_source=claude_code).
- [EMP] 510 participants: false alarms lowered trust more than misses; feedback from experience improved trust calibration. However, the authors suggest preferring false alarms over misses for unreliable systems — [Chen et al. 2021](https://consensus.app/papers/details/c0c5580b4e715e84a152960400703754/?utm_source=claude_code).
- [EMP] 112 primary care clinicians, 2010–2013: likelihood of accepting a reminder fell 30 % per additional reminder per encounter, and 10 % per 5-percentage-point increase in repeated alerts. Work complexity and repeats mattered; total workload did not. One quarter of drug alerts and one third of reminders were repeats for the same patient within a year. Reducing repeats is the target — [Ancker et al. 2017](https://bmcmedinformdecismak.biomedcentral.com/track/pdf/10.1186/s12911-017-0430-8) (via snippets of the record; wording of the "10 %" clause is compressed in my source).

**Public warnings: mixed evidence**
- [EMP] Higher local false alarm ratio was associated with more tornado fatalities and injuries (1986–2005 model) — [Simmons and Sutter](https://ams.confex.com/ams/88Annual/webprogram/Paper135736.html).
- [EMP] Laboratory evidence for a cry-wolf effect of moderate size; a slight reduction in false alarms did not significantly change compliance, while probabilistic information helped — [LeClerc and Joslyn 2015](https://www.stat.berkeley.edu/~aldous/157/Papers/leclerk.pdf) (via search summary).
- [EMP] [UNCONFIRMED] Lim and Liu report perceived false alarm ratios not correlated with actual county ratios, and suggest complacency concerns may be overblown; much of the hazards literature finds little or no cry-wolf effect — NOAA-hosted papers ([1](https://repository.library.noaa.gov/view/noaa/52390/noaa_52390_DS1.pdf), [2](https://repository.library.noaa.gov/view/noaa/55431/noaa_55431_DS1.pdf); I did not establish which file holds which claim).

**Alarm management benchmarks (industrial)**
- [STD] [Vendor summaries of ISA-18.2, standard not read] Per operator: about 150 alarms per day target, 300 maximum (about 1 and 2 per 10 minutes). Flood: over 10 alarms in 10 minutes, under 1 % of the time. Priority mix about 80 % low, 15 % medium, 5 % high. Stale under 5 per day. Chattering and fleeting zero. Top 10 alarms about 1–5 % of load. Figures are stated as approximate — [Emerson](https://d1-live.emerson.com/documents/automation/article-alarm-management-by-numbers-deltav-en-38292.pdf), [Process Online](https://www.processonline.com.au/content/software-it/article/improving-alarm-management-with-isa-18-2-part-2-1141142642).
- [EMP] Lloyd's Register, 11 vessels, over 2,000 days, over 40 million alarm events: fewer than half met the benchmark it used (under 30 per hour, which differs from the ISA figures above). The top 10 alarms were nearly 40 % of the load, and a cruise-ship pilot cut alerts by almost 50 % over six months with no new technology — [Lloyd's Register 2026](https://www.lr.org/en/knowledge/press-room/press-listing/press-release/2026/alarm-overload-is-undermining-safety-at-sea-as-new-research-shows-crews-face-tens-of-thousands-of-daily-alerts/) (press release, no peer review).

**Agricultural evidence: dairy sensors**
- [STD] ISO/FDIS 20966 annex (noted as still under discussion in 2010): minimum sensitivity 80 % with specificity above 99 %. False alert rate is roughly 10 × (100 % − specificity) per 1,000 milkings. None of the reviewed studies met the demands. Farmers experience false alerts directly and judge the whole model inaccurate on that basis — [Hogeveen et al. 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC3231225).
- [REV] Requirements should differ by decision. Severe cases: sensitivity above 95 %, specificity above 99 %, within 12 h. Non-urgent: above 80 % and above 99.5 %, about 7 days. Herd-level: above 80 % and above 99 % — [Hogeveen et al. 2021](https://consensus.app/papers/details/ede524ffc5745f06b5d6f484d970fd52/?utm_source=claude_code).
- [EMP] Performance varied widely between herds, so some will do poorly under a generic model. At 99 % specificity only 40 % of cases were detected in the tightest window — [Kamphuis et al. 2010](https://consensus.app/papers/details/39fd9bee2d465c2d9958a94bee6a6ff3/?utm_source=claude_code).
- [EMP] Alert logic with state: a "new" alert was issued only after the risk score had been below threshold for at least 8 days, and later exceedances counted as "ongoing". Lowest false alert rate 6.5 per 1,000 milkings — [Sørensen et al. 2015](https://consensus.app/papers/details/64357f14f0725949ae07b4676206abd8/?utm_source=claude_code).
- [REV] Review of methods for reducing false alarms in livestock sensors: performance criteria were not met; among ranking methods, a Naive Bayesian Network showed the most potential — [Dominiak and Kristensen 2017](https://agris.fao.org/search/fr/records/65de4ccc63b8185d9ca81d68) (abstract). None of the models evaluated in her thesis suited a commercial herd — [Dominiak PhD](https://pigit.ku.dk/publications/PhD_Katarina_Nielsen_Dominiak.pdf) (snippet).

**Plant disease predictors**
- [EMP/REV] Lowering the decision threshold raises sensitivity and lowers specificity; threshold zero means treat every field. ROC curves show the trade-off — [Yuen and Mila](https://library.wur.nl/ojs/index.php/frontis/article/download/861/427).
- [EMP/REV] Base rate: a predictor with sensitivity and specificity both 0.9 moves a prior of 0.1 only to 0.5. It may therefore not help for rare or common pests, while moderate predictors can shift decisions for pests that are neither. Farmers combine forecasts with their own priors, and they cannot do so properly unless sensitivity and specificity are supplied — [Yuen and Mila](https://library.wur.nl/ojs/index.php/frontis/article/download/861/427). A published eyespot predictor had sensitivity 28/41 (68 %) and specificity 7/17 (41 %) — [same](https://library.wur.nl/ojs/index.php/frontis/article/download/861/427).
- [EMP] Field calibration with trap plants produced true and false positive and negative rates and allowed ROC comparison of algorithm versions — [Elsinoe forecaster, IOBC](https://iobc-wprs.org/product/calibrating-a-disease-forecaster-for-elsinoe-spot-in-organic-apples-using-receiver-operating-characteristic-curve-analysis/) (abstract).
- [REV] The key risk of a DSS is a false negative (no need to spray, followed by a severe outbreak). Validation is usually limited to few sites and seasons because field testing is costly, so value can be estimated from existing data. A cited meta-analysis reports pesticide use could be halved without yield loss — [Helps et al. 2024](https://link.springer.com/article/10.1007/s10658-024-02878-1) (snippet).

### Inferences
- **Load arithmetic (mine, assuming independence and mostly negative hours):** a rule evaluated hourly at 99 % specificity gives 0.24 false alerts per day, about 7 per month. Fourteen such indicators on one field give about 3.4 per day. A farm-acceptable load is therefore impossible at per-hour specificity levels that sound excellent. Alerts should be evaluated per event and per field-week, and the rule should fire once per episode rather than per evaluation.
- **Base-rate arithmetic (mine):** at sensitivity and specificity 0.9, a condition present in 2 % of field-days gives PPV about 16 %, well below the 0.5 line from Huegli. Rare conditions need a much stricter trigger, or should be a card status and not a push alert.
- Practical design, using the above: require a stated action for each alert (as Huegli suggests for low PPV); give each alert a state, with new, ongoing and resolved stages and a re-arm period (Sørensen); apply separate enter and exit thresholds (MADIS 75 %/25 % is a working example of this idea, though for QC); suppress repeats (Ancker); make severity levels few and most of them low (ISA mix); and rank the top 10 alert types by count and fix those first (Lloyd's Register, ISA).
- **Split data-quality alerts from agronomic alerts and route them to different people.** Oklahoma sends sensor anomalies to a QA manager, not to users. A farmer should see a device fault only when it changes what they can rely on.
- A missed severe event and a nuisance alert have different costs, and thresholds should be set per decision (Hogeveen 2021), not one global setting. False alarms cost trust (Chen, Dixon), while Helps names the false negative as the key risk to the crop. Choosing between them is a value judgment for the agronomist.
- Evaluation needs ground truth. Without field observations, only alert counts can be tracked; a one-tap "useful / not useful / acted" response plus a calendar link would give PPV per alert type. Reporting sensitivity needs scouting data, which is expensive (Helps). Per-site performance should be reported separately (Kamphuis).

### Gaps
- **I found no standard or study giving an acceptable number of alerts per field or per farmer per week for crops**, and no measured farmer-tolerance figure. Hogeveen 2010 gives none for dairy either.
- I found no operational crop DSS (NEWA and vite.net were the ones checked) publishing its own alert PPV or false alarm rate.
- ISA-18.2 and EEMUA 191 were not read directly; figures are vendor summaries. They were built for control room operators, and transfer to a farmer is an analogy.
- Gent et al. 2013 and Yuen and Hughes 2002 were not read in full. I did not check van der Sijs's override rates.

---

## Why farm DSS fail or succeed: transparency, explainability, advice vs raw data

### Takeaway
The recurring reasons for failure are low perceived benefit, poor fit to the actual decision, effort, lack of trust and weak links to advisers, and not technical sophistication. Success cases involve users in design, run two-way communication and work through advisers. Evidence on "advice vs raw data" in agriculture is qualitative; the clearest quantitative support is from medicine.

### Cited Findings
- [EMP] UK, mixed methods: list of 395 tools; 49 % of surveyed farmers used some kind of decision support, with software (28 %), paper (22 %) and apps (10 %) found most useful; every adviser interviewed used them, though from a small common set; 78 interviews, 33 of them advisers — [Rose et al. 2016](https://ueaeprints.uea.ac.uk/60758/1/Published_manuscript.pdf).
- [EMP] Fifteen factors influence uptake, including performance expectancy, ease of use, peer recommendation, trust, cost, habit, relevance to user, farmer-adviser compatibility and compliance, plus modifiers such as age, farm type and scale, IT education and infrastructure. Tools must give up-to-date, accurate output and tangible benefit. Designers tended to focus on performance, ease of use, trust, compliance and cost, and seldom mentioned others such as farmer-adviser knowledge exchange — [Rose et al. 2016](https://ueaeprints.uea.ac.uk/60758/1/Published_manuscript.pdf).
- [EMP] Relevance means local: tools must reflect local variation, and farmers cited large differences in rainfall between nearby farms as a limit on accuracy — [Rose et al. 2016](https://ueaeprints.uea.ac.uk/60758/1/Published_manuscript.pdf).
- [EMP] Farmers trusted human advice more than algorithms (median 8 vs 6, p < .001); agronomists showed the reverse (8 vs 7). Trusted advisers may be the route to adoption — [Grant et al. 2026](https://consensus.app/papers/details/e7f22d0569955b0ba306c54d183cbbd2/?utm_source=claude_code) (abstract).
- [OPS] vite.net: the authors addressed the "problem of implementation" through user involvement during development, seminars, demonstration vineyards and two-way communication. In 2013: 47 farmers on more than 3,000 ha plus 46 advisors. The authors judge it solved, on their own usage data — [Rossi et al. 2014](https://publires.unicatt.it/it/publications/addressing-the-implementation-problem-in-agricultural-decision-su-8/), [follow-up](https://publires.unicatt.it/it/publications/large-scale-application-of-a-web-based-decision-support-system-fo-8/) (abstract level).
- [REV] Review of DSS development in precision agriculture in *Precision Agriculture* 18:309–331 — [Lindblom et al. 2017](https://link.springer.com/article/10.1007/s11119-016-9491-4). [UNCONFIRMED: seen via secondary summary] Many DSS are built without end-user input, and designers should first ask what information the task requires.
- [REV] Review of 141 FMIS packages in 11 functions: commercial systems mainly target office tasks such as finance, inventory and field operations — [Fountas et al. 2015](https://oro.open.ac.uk/48329) (abstract). This is about farm records rather than sensor advice, so its relevance here is limited.
- [EMP, clinical] Decision support improved practice in 68 % of trials. Independent predictors of success: automatic delivery within workflow, delivery at the time and place of decision, computer-based, and **a recommendation rather than just an assessment** (P = 0.0187). 30 of 32 systems (94 %) with all four features improved practice — [Kawamoto et al. 2005](https://pubmed.ncbi.nlm.nih.gov/15767266/). This is medicine, not farming.
- [EMP] The Hogeveen finding above applies to adoption too: users judge a whole system by the false alerts they personally see — [Hogeveen et al. 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC3231225).

### Inferences
- "Advice plus reason plus evidence on request" fits both populations: a recommended action for the farmer (Kawamoto, Rose), and an inspectable chain for the agronomist, who is the channel through which trust reaches the farmer (Rose, Grant).
- A wrong-looking number on an open dashboard costs more than a missing one, since trust is judged from visible failures. This is the case for a conservative rule: when in doubt, withhold and say why.
- Explanations should name the actual cause in plain language, such as the missing sensor. Showing an internal index code gives the user nothing to check.
- Agronomist involvement in review of thresholds and alert wording is the cheapest adoption lever the evidence supports.

### Gaps
- I found no controlled agricultural trial comparing advice vs raw data, or explanation vs no explanation, on farmer behaviour.
- The 2016–2026 review literature on explainable AI in agriculture was not covered.
- I did not find the Jones/Brunner WSU Decision Aid System evidence. Lindblom and Fountas were read at abstract level only.

---

## Uniform processing across heterogeneous stations

### Takeaway
Networks do not make instruments identical. They apply one rule structure and let thresholds vary by sensor and site through metadata, while requiring any exclusion to be documented. They also distinguish "this station has no such sensor" from "the sensor is not reporting", and they keep overlap stations when instruments change.

### Cited Findings
- [STD] QARTOD: test tiers are common, thresholds are set by operators, and an operator with a defensible reason to skip a required test must state it in station metadata. Its authors say a methodology applicable to every sensor is hard to establish — [QARTOD flags manual](https://cdn.ioos.noaa.gov/media/2020/07/QARTOD-Data-Flags-Manual_version1.2final.pdf), [wind manual](https://cdn.ioos.noaa.gov/media/2017/12/QARTOD_Wind_Manual_v1.1_final_draft_signed.pdf).
- [STD] AASC: QC systems will not look identical and this is expected; tests may apply to all stations or be excluded for unusual microclimates such as irrigated agriculture, but all five categories should exist. Physical limit tests come from each specific sensor's operating range — [AASC 2019](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).
- [OPS] Oklahoma's flags 4 (not installed yet) and 8 (never installed) separate absence by design from flag 9 (missing) — [Shafer 2000](http://cig.mesonet.org/staff/shafer/Mesonet_QA_final_fixed.pdf).
- [OPS] MADIS handles many data providers through one pipeline: the same levels and descriptors, with statistics kept by network and per-station, per-variable reject and accept lists. The page does not state outright that QC is identical for all providers — [MADIS](https://madis.ncep.noaa.gov/madis_sfc_qc_notes.shtml).
- [OPS] Instrument changes: Oklahoma keeps five continuity stations that run old and new sensors side by side, and all sensors are lab-tested before deployment and rotated back at set intervals — [Fiebrich and Kloesel 2012](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/IOM-109_TECO-2012/Session3/O3_07_Fiebrich_Oklahoma_Mesonet.pdf).
- [STD] AASC requires separate sensor metadata per height or depth, and notes that for volumetric water content, soil properties are key metadata — [AASC 2019](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf).
- [STD] US National Coordinated Soil Moisture Monitoring Network guidance (December 2024) sets out a Data Quality Tiering system that rates data from different networks and sensors using measurable parameters, as "living guidelines" — [NCSMMN Chapter 9](https://www.drought.gov/sites/default/files/2025-10/Soil-Moisture-Data-Quality-Guidance-Chapter-9.pdf). Tier details are in other chapters, which I did not read — [Appendix C](https://www.drought.gov/sites/default/files/2025-10/Soil-Moisture-Data-Quality-Guidance-Appendix-C.pdf).
- [STD] AASC's Version 1 came after about 2.5 years of subcommittee work, because US mesonets had grown independently with inconsistent practices — [AASC](https://stateclimate.org/docs/AASC%20Recommendations%20and%20Best%20Practices%20for%20Mesonets%20-%20Final,%20Ver%201;%20approved%2026%20Jun%2019.pdf); a peer-reviewed companion is likely [Fiebrich et al. 2020](https://ams.confex.com/ams/2020Annual/webprogram/Paper366482.html) [UNCONFIRMED link between them].
- [EMP] Validation of generic models across sites can fail: detection varied strongly by herd — [Kamphuis et al. 2010](https://consensus.app/papers/details/39fd9bee2d465c2d9958a94bee6a6ff3/?utm_source=claude_code).

### Inferences
- A declarative per-instrument table is the natural form of this: one rule engine, and a table per instrument type giving variables, expected interval, range, step per interval, persistence condition, resolution and accuracy. Adding a device means adding a row. A per-field exception should exist only as metadata with a stated reason.
- Four states should be separate on every field: **not installed**, **installed and silent**, **installed but failed QC**, **value withheld as stale**. Without them, a field with fewer instruments looks broken, or a broken field looks merely simple.
- Comparing fields across a fleet requires tiering by capability, as in NCSMMN: a value inferred from a nearby station or dew rule should not sit beside a field with a real sensor as if equal. Output could carry a capability tier.
- A fleet check should test that every field produces the same flags from the same inputs, using a fixed set of fault cases (replayed stuck, spiking and gap series) rather than manual review.
- When a sensor model changes, a side-by-side period is the only way to tell an instrument change from a real change, as the continuity stations show.

### Gaps
- WIGOS metadata (WMO-No. 1192) was not reached; no result returned.
- I found no published case of a commercial or public agricultural network describing uniform QC across mixed LoRaWAN instruments.
- NCSMMN tier thresholds were not read, and the full text of Fiebrich et al. 2020 was not available.
