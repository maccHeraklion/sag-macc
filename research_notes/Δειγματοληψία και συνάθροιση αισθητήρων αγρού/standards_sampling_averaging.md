# International standards for sampling, averaging and completeness of automatic sensor data

Context: farm decision-support system in Crete; LoRaWAN stations report every 5–10 min, hygrometers every 10 min, computation once per hour. Researched 2026-11-07.

How to read the evidence tags:
- **[read]** = I read the text of the document itself (PDF text extraction or page fetch).
- **[extract]** = I only saw a search-engine excerpt or a fetch summary of the page; the document body was not read. Treat as unconfirmed until checked.
- **Standard** = WMO, FAO or ASCE text. **Network choice** = one operator's own rule, not a standard.
- Source wording is paraphrased; numbers are given exactly as printed.

Edition caveat for all WMO-No. 8 items: Volume V was read in the 2023 edition. Volume I and III chapters were read from the 2018 preliminary edition hosted on WMO's own site, because the 2023 Volume I and III PDFs exceeded the fetch size limit. A search excerpt says the 2023 update lists changes to Volume I chapters 12, 13 and 14 only ([WMO community](https://community.wmo.int/en/node/246032) [extract]); I did not confirm that the surface chapters are unchanged.

## WMO: sampling interval, averaging period, instantaneous vs mean, minimum samples

### Takeaway
WMO defines an "instantaneous" value as a 1 min average (up to 10 min acceptable; wind 2 or 10 min), computed from many quality-controlled samples, and it gives numeric completeness rules only at that level: 66 % of samples for a 1 min value and 75 % for a 2 or 10 min wind average. I found no WMO numeric rule for a valid hourly value or for a valid daily value from hourly data. A single spot reading every 5–10 min is not what WMO calls an observation, so hourly thresholds must be declared as the system's own choice.

### Cited Findings
**Definitions and averaging periods (Standard)**
- Annex 1.A column 4 defines three modes: I = instantaneous, where a 1 min average is the minimum and most suitable, and averages up to 10 min are acceptable; A = average over a fixed period set by coding requirements; T = total over a fixed period — [WMO-8 Vol I ch 1, Annex 1.A](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_1_en_MR_clean.pdf) [read]
- Annex 1.A rows: air temperature mode I, time constant 20 s, output averaging 1 min, required uncertainty 0.1 K between −40 and +40 °C (0.3 K outside), achievable 0.2 K; extremes of air temperature mode I, 20 s, 1 min, required 0.3 K in the same range (0.5 K outside); relative humidity mode I, required 1 %, solid-state sensors time constant 40 s, output 1 min, achievable 3 %; dew point mode I, 20 s, 1 min, required 0.1 K, achievable 0.25 K — [same](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_1_en_MR_clean.pdf) [read; table extraction is partly scrambled, check against a clean copy before quoting in a contract]
- Annex 1.A rows: wind speed and direction mode A, 2 and/or 10 min, direction averages computed over Cartesian components; gusts = highest 3 s average; daily precipitation amount mode T, 0.1 mm resolution, required 0.1 mm up to 5 mm and 2 % above 5 mm, achievable the larger of 5 % or 0.1 mm; global solar radiation mode T, achievable 5 % (daily) and 8 % (hourly) — [same](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_1_en_MR_clean.pdf) [read]
- Annex 1.A note 11: dew point, RH and air temperature are linked, and when averaging, absolute humidity is the preferred principal variable — [same](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_1_en_MR_clean.pdf) [read]
- For international exchange and many operational uses, the reported value must represent the previous 2 or 10 min for wind and, by convention, 1 to 10 min for other quantities — [WMO-8 Vol V (2023) §3.5](https://amc.namem.gov.mn/wp-content/uploads/WMO1/1.%208_V-2023_en.pdf) [read]
- These averaged values are the "instantaneous" values for operational use and must not be confused with raw sensor samples or with means over longer periods; 1 min averages are suggested for most variables — [WMO-8 2008 ed., Part II ch 1 §1.3.2.4](https://www.hidmet.gov.rs/data/download/wmo%20no.8_eng.pdf) [read]; the same idea is restated in [Vol III ch 1 §1.4.2](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_II_1_en_MR_clean.pdf) [read]
- Vocabulary: sample = one spot reading; observation = the result derived from several samples; sampling time = length of time over which one observation is made; sampling interval = time between successive observations. Worked example: temperature measured each minute, 10 min average computed, average transmitted every 3 h — [WMO-8 Vol V §2.1.1–2.1.2](https://amc.namem.gov.mn/wp-content/uploads/WMO1/1.%208_V-2023_en.pdf) [read]

**Sampling rates (Standard, CIMO Recommendation 3, CIMO-X, 1989)**
- Samples for averages should be equispaced at intervals that do not exceed the sensor time constant (or that of an analogue low-pass filter), or be numerous enough to bring the uncertainty of the average below the requirement. Samples for extremes should be taken at least 4 times as often. The first two criteria are for automatic sampling; the statistical criterion is described as more applicable to the much lower rates of manual observations. Uncertainty of the mean falls with the square root of the number of observations — [WMO-8 Vol V §2.4.2](https://amc.namem.gov.mn/wp-content/uploads/WMO1/1.%208_V-2023_en.pdf) [read]
- Most meteorological and climatological uses need observations every 30 min to 24 h, each with a sampling time of about 1 to 10 min. A spot reading relying on the thermometer's time constant is a common practice for routine observations; fast AWS sensors need several readings averaged — [same](https://amc.namem.gov.mn/wp-content/uploads/WMO1/1.%208_V-2023_en.pdf) [read]
- Aliasing example: eight 3-hourly temperatures give a stable daily average when temperature changes smoothly, but a thunderstorm that drops temperature for 30 min corrupts the mean. Reliability of daily averages depends on weak mesoscale energy — [same](https://amc.namem.gov.mn/wp-content/uploads/WMO1/1.%208_V-2023_en.pdf) [read]
- Recommended thermometer time constant is about 20 s; if electrical thermometers are used, max and min may be taken from the measured data provided recording is continuous and the measuring frequency is sufficient — [WMO-8 Vol I ch 2](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_2_en_MR_clean.pdf) [read]
- For most purposes humidity time constants of the order of 1 min are appropriate — [WMO-8 Vol I ch 4](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_4_en_MR_clean.pdf) [read]

**Minimum samples and QC limits (Guidance; WMO words these limits as possible values, adjustable to local climate)**
- At least 66 %, or two thirds, of samples should be available to compute an instantaneous 1 min value; at least 75 % for a 2 or 10 min wind direction and speed average. Below 66 % the value fails and is flagged missing — [WMO-488 (2010, upd. 2017) App. VI.2 §2](https://amc.namem.gov.mn/wp-content/uploads/WMO/8.%20488-2017_en.pdf) [read]
- Sample-to-sample limits, stated for 5–10 samples per minute (6–12 s spacing): air temperature 2 °C; dew point 2 °C; ground and soil temperature 2 °C; RH 5 %; pressure 0.3 hPa; wind speed 20 m/s; irradiance 800 W/m². A suspect sample is left out of the average but still used to check the next sample — [same](https://amc.namem.gov.mn/wp-content/uploads/WMO/8.%20488-2017_en.pdf) [read]
- Fixed plausible limits: air temperature −90 to +70 °C; dew point −80 to +50 °C; RH 0–100 %; wind speed 0–75 m/s (2 or 10 min average); gust 0–150 m/s; irradiance 0–1600 W/m²; precipitation 0–40 mm per 1 min — [same](https://amc.namem.gov.mn/wp-content/uploads/WMO/8.%20488-2017_en.pdf) [read]
- Step test between successive instantaneous values, suspect / erroneous: air temperature 3 / 10 °C; RH 10 / 15 %; soil 5–20 cm 0.5 / 1 °C; soil 50 cm 0.3 / 0.5 °C; soil 100 cm 0.1 / 0.2 °C; wind speed (2 min average) 10 / 20 m/s; irradiance 800 / 1000 W/m². Dew point suspect limit 2–3 °C if measured, 4–5 °C if calculated from T and RH, because a screen responds differently to temperature and vapour; erroneous 4 °C — [same](https://amc.namem.gov.mn/wp-content/uploads/WMO/8.%20488-2017_en.pdf) [read]
- Persistence test over 60 min, minimum required change: air temperature 0.1 °C; dew point 0.1 °C; RH 1 % (only when RH < 95 %); pressure 0.1 hPa; wind direction 10°; wind speed 0.5 m/s (both only if 10 min mean wind > 0.1 m/s); soil temperature no minimum. Extreme weather can trip these; such data are flagged suspect, not rejected — [same](https://amc.namem.gov.mn/wp-content/uploads/WMO/8.%20488-2017_en.pdf) [read]
- Internal consistency: dew point not above air temperature; gust not below wind speed. If a value is changed by QC, the original should be preserved; the processing specification for 1 min data and sums should be documented. Five flags: good, inconsistent, doubtful, erroneous, missing — [same](https://amc.namem.gov.mn/wp-content/uploads/WMO/8.%20488-2017_en.pdf) [read]
- "Number of valid samples in a period" is named as a check that decides whether an average is usable, without giving a number there. Hygrometer maxima tracked over long periods can reveal drift at saturation — [WMO-8 Vol III ch 1 §1.5](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_II_1_en_MR_clean.pdf) [read]
- Temporal-consistency QC works best on high-rate data, since correlation between adjacent samples rises with sampling rate; each observation should be built from a reasonably large number of QC'd samples so a bad sample can be excluded — [WMO-8 Vol V §2.4.3](https://amc.namem.gov.mn/wp-content/uploads/WMO1/1.%208_V-2023_en.pdf) [read]

**Daily and longer completeness (Standard for climate normals, not for operational daily values)**
- Monthly means: the 3/5 rule (not more than 5 missing days in total, not more than 3 consecutive) comes from WMO/TD-No. 341; a sum such as rainfall needs all days, unless the missing days are captured in an accumulated reading on the day observations resume — [WMO-100 (2011) §4.8.4](https://posmet.ufv.br/wp-content/uploads/2017/04/MET-480-WMO-100.pdf) [read]. A 2018 edition of WMO-100 exists and was not read ([copy](https://biotech.law.lsu.edu/blog/100-2018_en.pdf)).
- WMO-No. 1203 is reported to allow no missing days for total precipitation, degree-days and "days with" counts — [WMO-1203](https://www.ncei.noaa.gov/pub/data/normals/WMO/Guidelines%20for%20the%20Calculation%20of%20Climate%20Normals.WMO%20No1203_en.pdf) [extract; direct fetch returned 404]. Counts are converted to a percentage of days with data so that gaps do not undercount — [WMO normals submission guidelines, Annex 2](https://www.nodc.noaa.gov/archive/arc0216/0253808/2.2/data/0-data/documents/Annex_2_SubmissionGuidelines.pdf) [read]
- WMO-100 warns that consecutive gaps matter more than scattered gaps because of autocorrelation, and that totals and event counts are much more sensitive to gaps than mean temperature, especially if rain fell during the gap — [WMO-100 §3.4.5, §4.8.4](https://posmet.ufv.br/wp-content/uploads/2017/04/MET-480-WMO-100.pdf) [read]
- The 3/5 rule permits an average error of about 0.06–0.07 standard deviations in a monthly mean — [Anderson & Gough 2018](https://bibbase.org/network/publication/anderson-gough-accountingformissingdatainmonthlytemperatureseriestestingruleofthumbomissionofmonthswithmissingvalues-2018) [extract]

**Averaging method**
- Best statistical daily average comes from integrating continuous observations; yet WMO-100 recommends (Tmax+Tmin)/2 as the standard daily mean for comparability across stations, while noting it is not the best statistical approximation, and encourages services to also compute other daily means — [WMO-100 §4.8.5](https://posmet.ufv.br/wp-content/uploads/2017/04/MET-480-WMO-100.pdf) [read]
- WMO-488 says that without a clear regulation the averaging method should be well defined and explained; an arithmetic mean is not right in every case and a median can be better in some — [WMO-488 Part V end](https://amc.namem.gov.mn/wp-content/uploads/WMO/8.%20488-2017_en.pdf) [read]

### Inferences
- A 5–10 min spacing exceeds the 20–60 s sensor time constants by a factor of 5–30, so these streams fail WMO criteria (i)/(ii). Unless the device firmware averages internally, each uplink is a spot sample, not a 1 min "instantaneous" value. An hourly mean from 6–12 spot samples rests on criterion (iii) alone, which is defensible for slowly varying T and RH but should be stated.
- The 66 % and 75 % rules apply to samples inside 1, 2 or 10 min. Using 66 % or 75 % for "samples within an hour" is a reasonable analogy, but it is an adaptation, not a WMO rule.
- The sample-level limits (2 °C, 5 % RH, 800 W/m²) assume 6–12 s spacing and do not transfer to 10 min spacing. The step-test table is the closer fit, though it was also written for successive instantaneous (1 min) values, so limits for 10 min data must be set locally.
- Under criterion (b), Tmax/Tmin picked from 10 min spot samples are under-sampled extremes: expect them to be less extreme than a 1 min-based max/min. The size is not given by WMO.

### Gaps
- I found no WMO statement of a minimum number of minutes or samples for a valid hourly mean, nor of a minimum number of hours for a valid daily mean. Absence here means not found in WMO-8 Vol V, Vol III ch 1, WMO-488 App. VI.2 or WMO-100 (2011); WMO-1203, WMO-1269 and WMO-100 (2018) were not read in full.
- WMO-No. 134 (GAMP) could not be read. The chapter PDFs at wamis.org returned 404 and the 24 MB full PDF is on SharePoint. Only the table of contents was seen ([TOC](https://old.wmo.int/extranet/pages/prog/wcp/agm/gamp/documents/134_Cover_TOC.pdf)). WMO-100 points to it for agrometeorological instrument detail. Its content on sampling is unconfirmed.

## Which quantities are means, extremes or sums

### Takeaway
Temperature, humidity and wind speed are means with extremes kept separately; radiation and rain are totals; gust is a maximum of a 3 s average. Means must be taken on the linear variable: vapour pressure or absolute humidity for humidity, Cartesian components for wind direction, and energy for radiation.

### Cited Findings
| Variable | Hourly value in practice | Daily value in practice | Class and source |
|---|---|---|---|
| Air temperature | Mean of the full hour, and a separate end-of-hour value. USCRN publishes both: last 5 min and entire hour, plus hourly max and min | Tmax, Tmin; mean = (Tmax+Tmin)/2 in WMO-100, FAO-56, ASCE; USCRN also gives a true average | Mean + extremes. [USCRN hourly](https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/README.txt), [USCRN daily](https://www.ncei.noaa.gov/pub/data/uscrn/products/daily01/readme.txt) [read via fetch summary] |
| RH | Hourly average (USCRN, from 5 min averages) | RHmax, RHmin; RHmean is the least preferred input in FAO-56 and ASCE | Mean + extremes. [FAO-56 ch 3](http://www.fao.org/4/x0490e/x0490e07.htm) [read via fetch summary] |
| Dew point | Quantity to average is absolute humidity, then convert | Daily mean dew point, or ea averaged | Derived mean. [WMO-8 Vol V §3.6](https://amc.namem.gov.mn/wp-content/uploads/WMO1/1.%208_V-2023_en.pdf) [read] |
| Wind speed and direction | Climatological statistics need averages over the entire hour, day and night. Direction from components | Mean speed | Mean. [WMO-8 Vol I ch 5](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_5_en_MR_clean.pdf) [read] |
| Gust | Peak gust in last full hour; highest 3 s average | Daily highest; Mesonet needs one observation | Extreme. [same](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_5_en_MR_clean.pdf) [read] |
| Solar radiation | Mean irradiance (W/m²) or hourly exposure | Radiant exposure (MJ/m²), sometimes expressed as mean daily irradiance | Total. [WMO-8 Vol I ch 7](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_7_en_MR_clean.pdf) [read] |
| Rain | Amount in the stated period | 24 h amount for a stated day definition | Total. [WMO-8 Vol I ch 6](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_6_en_MR_clean.pdf) [read] |

- Linearize before averaging: average-then-linearize gives a different result from linearize-then-average when the signal changes during the period — [WMO-8 Vol V §3.4](https://amc.namem.gov.mn/wp-content/uploads/WMO1/1.%208_V-2023_en.pdf) [read]
- Conversion table in §3.6: wind speed and direction → average Cartesian components; dew point → average absolute humidity; visibility → average extinction coefficient — [same](https://amc.namem.gov.mn/wp-content/uploads/WMO1/1.%208_V-2023_en.pdf) [read]
- AWS statistics are listed as extremes (temperature), totals (rain), means over periods, and integrated values (radiation) — [WMO-8 2008 Part II ch 1 §1.3.2.6](https://www.hidmet.gov.rs/data/download/wmo%20no.8_eng.pdf) [read]
- Averages of 1 min are too short to smooth turbulence and should be called long gusts; the mean vector speed is a few per cent below the mean of instantaneous speeds; component averaging is preferable in principle, but differences are very small; calm means mean speed below 0.2 m/s — [WMO-8 Vol I ch 5](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_5_en_MR_clean.pdf) [read]

### Inferences
- Reporting "the hourly value" without saying last-sample or full-hour mean is ambiguous. USCRN solves this by publishing both under separate names, which is a pattern worth copying.
- A last-sample value differs from the full-hour mean by a predictable amount in ramps: with six 10 min samples on a 3 °C/h morning rise, the last sample is 1.25 °C above the mean of the six (my arithmetic).

### Gaps
- I found no standard for "daytime mean" or "night mean" VPD or RH used in agronomic indicators. These appear to be application-defined.

## How RH should be averaged and how VPD should be computed

### Takeaway
The standards point the same way: average vapour pressure (or absolute humidity), not RH, and compute non-linear quantities per sample before averaging. The error is small within an hour (about 1 % of VPD in my calculation) and large across a day (about 10 %, confirmed by a MeteoSwiss study). Hourly T and RH means are therefore acceptable for an hourly VPD, but daily VPD must not come from daily mean T and RH.

### Cited Findings
- WMO prefers absolute humidity as the averaged variable (Annex 1.A note 11; Vol V §3.6) — [WMO-8 Vol V](https://amc.namem.gov.mn/wp-content/uploads/WMO1/1.%208_V-2023_en.pdf) [read]
- ASCE hourly preference table ranks three methods equal first: ea averaged over the period, dew point averaged over the period, and average RH and T for the hour. Data loggers may compute ea or Tdew internally for output as averages — [ASCE-EWRI 2005, Table 4](https://www.mesonet.org/images/site/ASCE_Evapotranspiration_Formula.pdf) [read]
- ASCE daily preference table puts ea or dew point averaged over the day, from hourly or more frequent humidity, at the top, and daily mean RH at the bottom — [ASCE-EWRI 2005, Table 3](https://www.mesonet.org/images/site/ASCE_Evapotranspiration_Formula.pdf) [read; rank column garbled in extraction, the top and bottom positions are clear]
- FAO-56 says Eq. 19 with RHmean is less desirable than Eq. 17 or 18, and that if RHmin is doubtful RHmax alone should be used — [FAO-56 ch 3](http://www.fao.org/4/x0490e/x0490e07.htm) [read via fetch summary]
- FAO-56 Annex 5 asks that RH and temperature be taken over the same period, of no more than about one hour — [FAO-56 Annex 5](http://www.fao.org/4/x0490e/x0490e0m.htm) [read via fetch summary]
- Conversions between humidity variables are strictly valid only for instantaneous values. From 10 min data at Swiss stations, computing daily mean VPD from daily mean RH and temperature gives a bias of about 10 %; conversions starting from dew point are less prone to error — [Frei, MeteoSwiss, EMS 2022](https://meetingorganizer.copernicus.org/EMS2022/EMS2022-58.html) [read; conference abstract, not a peer-reviewed paper]
- Arithmetic averaging of RH almost always overestimates mean RH, with larger error at higher temperature and longer intervals; the recommended approach is to average T, e and es, then form RH from the averages — [Campbell Scientific](https://campbellsci.com.au/blog/averaging-relative-humidity) [extract; manufacturer blog, page fetch failed]
- FAO-56 uses es = mean of e°(Tmax) and e°(Tmin), because es at mean temperature gives lower values and underestimates ETo. Its Example 3 gives 2.39 kPa against 2.30 kPa at 19.75 °C — [FAO-56 ch 3](http://www.fao.org/4/x0490e/x0490e07.htm) [read via fetch summary]

### Inferences
My own synthetic calculation, with a sinusoidal day and constant dew point. These are order-of-magnitude illustrations, not measurements.

| Day (Tmin/Tmax/Tdew, °C) | True mean VPD (kPa) | From daily mean T and RH | FAO-style es − ea | Mean RH vs mean e / mean es |
|---|---|---|---|---|
| 20/32/16 Crete summer | 1.64 | 1.48 (−9.7 %) | 1.73 (+5.7 %) | 56.0 vs 52.6 % |
| 24/38/12 hot and dry | 3.25 | 3.03 (−6.8 %) | 3.40 (+4.8 %) | 32.6 vs 30.2 % |
| 12/22/10 autumn | 0.75 | 0.68 (−10.3 %) | 0.80 (+5.7 %) | 65.2 vs 62.0 % |
| 14/34/13 large greenhouse swing | 1.72 | 1.33 (−22.9 %) | 1.96 (+13.8 %) | 55.5 vs 46.5 % |

- The −7 to −10 % outdoor range agrees with Frei's "about 10 %". The error grows with the diurnal amplitude, so covered crops with large swings are the worst case.
- Within one hour, using six 10 min samples: VPD from hourly means minus mean of per-sample VPD was −0.005 kPa on about 1.0 kPa for a 3 °C/h ramp, −0.016 on 1.5 for 5 °C/h, −0.012 on about 0.9 with 1 °C noise added, and −0.03 on about 3.0 with 2 °C noise. That is about 0.5–1.3 %. Mean RH bias was +0.2 to +0.4 % RH.
- This hourly error is far below sensor uncertainty: the WMO achievable 3 % RH alone is about 0.13 kPa at 30 °C (3 % of es = 4.24 kPa).
- Ordering for a system that has per-sample data: compute e and es per sample, average them, then derive VPD, Td and mean RH. Averaging hourly T and RH is an acceptable fallback for hourly values, and ASCE allows it. For daily VPD, average the hourly VPD values.
- The bias direction differs by method: daily-mean inputs underestimate and FAO-style es overestimates true 24 h mean VPD. FAO's es is designed for ET, not for reporting a true mean VPD, so the two should not be mixed in one indicator series.

### Gaps
- I found no peer-reviewed paper directly quantifying per-sample versus hourly-mean VPD at sub-hourly resolution. The figures above are my own.
- A south Florida study using 15 min data was reported as finding daily mean temperature the best daily VPD method, followed by the Tmax/Tmin average. I saw this only in a search summary and could not identify the source document, so it is unconfirmed.

## FAO-56 and ASCE standardized Penman-Monteith: time step, inputs, Tmax/Tmin, missing data

### Takeaway
Both accept daily and hourly steps. Daily uses Tmax and Tmin as defined over a 24 h day from midnight, with es from the two extremes; hourly uses means over the hour. Summed hourly ETo generally matches daily ETo, and hourly is preferred where wind and humidity shift within the day. Both prefer estimating a missing input over dropping to a lesser method, but neither gives a numeric completeness threshold in the text I read.

### Cited Findings
- FAO-56 defines Tmax and Tmin as the maximum and minimum air temperature observed in the 24 h period beginning at midnight, and Tmean for 24 h as their mean, not the mean of hourly readings; Tmean is used only for the slope and for air density — [FAO-56 ch 3](http://www.fao.org/4/x0490e/x0490e07.htm) [read via fetch summary]
- ASCE: for a daily step, T is preferred as (Tmax+Tmin)/2 rather than the average of hourly temperatures, for consistency across data sets; es = mean of e°(Tmax) and e°(Tmin). For an hourly step, T is an average over the period — [ASCE-EWRI 2005](https://www.mesonet.org/images/site/ASCE_Evapotranspiration_Formula.pdf) [read]
- ASCE required inputs: air temperature, humidity, solar radiation, wind speed. T and humidity at 1.5–2.5 m, wind at 2 m. Coefficients for short reference: daily Cn 900, Cd 0.34; hourly Cn 37, Cd 0.24 by day and 0.96 by night. Tall reference: daily 1600, 0.38; hourly 66, 0.25 by day and 1.7 by night — [same](https://www.mesonet.org/images/site/ASCE_Evapotranspiration_Formula.pdf) [read]
- Hourly capability matters where wind and humidity shift significantly within the day. The hourly equations also work for shorter periods using fractional hours: a 30 min input gives mm/h that must be multiplied by 0.5 — [same](https://www.mesonet.org/images/site/ASCE_Evapotranspiration_Formula.pdf) [read]
- Negative night-time hourly values may be zeroed before summing, yet may reflect real dew, and retaining them is generally appropriate; the impact on the 24 h sum is usually less than a few percent — [same](https://www.mesonet.org/images/site/ASCE_Evapotranspiration_Formula.pdf) [read]
- FAO-56 hourly: Eq. 53 presumes constant rs of 70 s/m; Ghr = 0.1 Rn by day and 0.5 Rn at night; hourly differences tend to compensate, and sums are generally equivalent to the 24 h calculation — [FAO-56 ch 3](http://www.fao.org/4/x0490e/x0490e07.htm), [ch 4](http://www.fao.org/4/x0490e/x0490e08.htm) [read via fetch summary]
- Note a difference between the two: FAO-56 hourly holds rs at 70 s/m, whereas ASCE varies Cd between day and night, as listed above.
- A study across Australia found better agreement between summed hourly ASCE-PM and daily ETo when aggregated over 24 h rather than daylight hours — [Australian comparison, 2015](https://katalog.lib.cas.cz/KNAV/EdsRecord/edsair,edsair.doi...........cb858a42126a7fc0203fe0588d7caecb) [extract]
- Missing data, FAO-56: strongly recommends estimating missing variables and keeping Penman-Monteith rather than switching to an alternative method, and validating against full data. Tdew can be taken near Tmin; Rs from Tmax − Tmin; u2 = 2 m/s as a temporary estimate — [FAO-56 ch 4](http://www.fao.org/4/x0490e/x0490e08.htm) [read via fetch summary]
- Missing data, ASCE: Appendix E gives substitutes for humidity, radiation and wind "for daily and longer time periods"; Tdew from Tmin should be verified locally — [ASCE-EWRI 2005](https://www.mesonet.org/images/site/ASCE_Evapotranspiration_Formula.pdf) [read main text only]
- Data integrity: hourly and 24 h clear-sky Rso envelopes for solar radiation, net radiation checks, and vapour-versus-temperature checks — [Allen 1996](https://ascelibrary.com/doi/10.1061/%28ASCE%290733-9437%281996%29122%3A2%2897%29) [extract]; humidity sensors in reference settings should approach about 100 % in early morning, and persistently low RHmax in irrigated areas signals a problem or a non-reference site — [FAO-56 Annex 5](http://www.fao.org/4/x0490e/x0490e0m.htm) [read via fetch summary]

### Inferences
- There are two legitimate but different daily temperatures: (Tmax+Tmin)/2 for ET and climate comparability, and a true 24 h mean for thermal-time or biological models. A system should name which one each indicator uses.
- Summing 24 hourly ETo values requires a policy for missing hours. Neither standard gives one in the text I read, so CIMIS-style summing needs a declared rule.
- Because the hourly equations accept fractional hours, irregular periods can be handled by scaling, provided inputs represent that same period.

### Gaps
- The PDF hosted by the Oklahoma Mesonet contains the 70-page main report only. Appendices D (integrity), E (missing data) and F (ratios of hourly sum to daily ETo) were not available, so I could not report any hourly-to-daily ratios or Appendix numbers.
- A search excerpt attributed a sum-of-hourly to daily ETo ratio of 1.02–1.08 to Djaman, Irmak and colleagues. I could not confirm it. Itenfisu et al. 2003 ([ASCE](https://ascelibrary.com/doi/10.1061/%28ASCE%290733-9437%282003%29129%3A6%28440%29)) is the primary comparison across 49 sites; its ratios were not accessible.

## Operating agromet networks: hourly production, QC, completeness thresholds

### Takeaway
Networks sample fast, store 1–15 min data and aggregate centrally. Published daily completeness rules are network choices and vary widely: Oklahoma Mesonet uses 90 % (99 % for solar), Météo-France 24 hourly values with limited gaps. Several major networks publish no numeric threshold at all.

### Cited Findings
**Oklahoma Mesonet (Network choice)**
- Above-ground sensors sampled every 3 s, averaged over 5 min. Air temperature and RH at 1.5 m; wind at 10 m and a 2 m speed; RH readings above 100 % restricted to 100 %; rain gauge event-driven, 0.254 mm per tip, accumulator resets at 0000 UTC — [Mesonet instruments](https://www.mesonet.org/about/instruments) [read via fetch summary]
- Daily data run midnight to midnight CST. Max and min are the highest and lowest 5 min observations, with the page noting true extremes may differ slightly. Daily solar is the sum of 5 min energy accumulations in MJ/m² — [Mesonet monthly summaries](https://m.mesonet.org/about/data-descriptions/monthly-summaries) [read via fetch summary]
- Most variables need at least 90 % of observations for the day; an asterisk marks at least one missing but under 10 %; NA marks 10 % or more. Daily solar needs 99 %. Maximum gust needs only one observation — [same](https://m.mesonet.org/about/data-descriptions/monthly-summaries) [read via fetch summary]
- Automated QA uses range, step, persistence, spatial and like-instrument tests; a 2007 addition flags solar readings at least 5 W/m² above the theoretical maximum; rainfall gets manual review — [Mesonet TECO-2012](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/IOM-109_TECO-2012/Session3/O3_07_Fiebrich_Oklahoma_Mesonet.pdf) and related papers [extract]. Automated tests can flag real cold-air pooling and similar events, so manual review remains ([same](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/IOM-109_TECO-2012/Session3/O3_07_Fiebrich_Oklahoma_Mesonet.pdf) [extract]).

**CIMIS (Network choice)**
- The logger reads each sensor once per minute for an hour, then averages the 60 readings or accumulates them for a total — [CIMIS documents](https://cimis.water.ca.gov/Content/PDF/CIMIS%20Data%20Quality%20Control%20Procedures.pdf) [extract; the excerpt's exact host document is uncertain, and CIMIS PDFs returned only a title on fetch]
- Hourly ETo is computed from hourly data and the 24 values are summed for a midnight-to-midnight day; polling is referenced to midnight PST; hourly records reflect the preceding 60 min — [CIMIS Resources](https://cimis.water.ca.gov/Resources.aspx), [DWR service](https://gis.water.ca.gov/arcgis/rest/services/Climatology/i04_CIMIS_Weather_Stations/MapServer) [extract]
- Flags include M (missing), S (out of service or threshold), R and Y (far or moderately outside historical limits). A flag does not necessarily mean a wrong value, and users decide — [CIMIS flags](https://cimis.water.ca.gov/Content/PDF/CurrentFlags2.pdf) [extract]. Historical limits use control charts built on station means and standard deviations — [CIMIS control charts](https://cimis.water.ca.gov/Content/PDF/Statistical%20Control%20Charts%20for%20QC.pdf) [extract]

**USCRN (reference climate network, not agromet)**
- Hourly fields separate the last 5 min from the entire hour; hourly data cover the 60 min ending at the stated time. Daily values use the station's 24 h local standard time day. Derived values are not computed from flagged raw data and appear as missing. A month is valid with fewer than 4 consecutive and no more than 5 total missing days — [hourly README](https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/README.txt), [daily readme](https://www.ncei.noaa.gov/pub/data/uscrn/products/daily01/readme.txt) [read via fetch summary], [monthly readme](https://www.ncei.noaa.gov/pub/data/uscrn/products/monthly01/readme.txt) [extract]
- Neither the hourly nor the daily readme states a minimum sample count. Daily records are regenerated several times so late-arriving data are included ([daily readme](https://www.ncei.noaa.gov/pub/data/uscrn/products/daily01/readme.txt) [extract]).

**NEWA (Network choice)**
- Missing hourly temperature and RH: mean of the previous and next hours if both exist, otherwise nearest NCEP RTMA/URMA grid value. Rain and wind direction: RTMA/URMA. Solar: estimated from RTMA/URMA sky cover. Soil temperature and moisture: never estimated. Estimated values shown in brown italics — [NEWA](https://newa.cornell.edu/how-newa-handles-weather-data) [read via fetch summary]
- An hour counts as wet if at least 1 min of sensor leaf wetness is recorded; without a sensor, if the hourly average RH is above 90 %. Airport and forecast RH is adjusted by adjRH = RH / (0.0047·RH + 0.53). Station inactive after 21 days without data — [same](https://newa.cornell.edu/how-newa-handles-weather-data) [read via fetch summary]
- Data collected every 15 min and tabulated into hourly and daily summaries — [Onset on NEWA](https://www.onsetcomp.com/newa) [extract]. The NEWA page itself does not describe aggregation.

**AgWeatherNet**
- Measurements are summarized every 15 min, pulled to a database, with daily QA/QC — [Hoogenboom 2011](https://www.nwpotatoresearch.com/images/documents/Hoogenboom2011.pdf) [read]. No numeric thresholds found.

**Météo-France (Network choice, stated as following WMO for normals)**
- For normals, daily means are recomputed from hourly data over 00h–23h. Daily mean from 24 hourly values: more than 2 consecutive or more than 4 total missing → fall back to 8 three-hourly values; more than 1 of these missing → daily mean missing. Min and max: all gaps tolerated. Counts and cumulative totals: no gaps. Monthly mean: more than 4 consecutive or more than 10 total missing → missing — [Météo-France normals method 1991–2020](https://donneespubliques.meteofrance.fr/client/document/normales-methode_299.pdf) [read]
- This is a rule for climate normals, not necessarily for operational daily products, and the monthly limits are looser than the WMO 3/5 rule cited above.

**SiAR/RIAA Spain**
- Tests cover record structure, range, internal and temporal consistency, persistence and spatial consistency, flagged for users — [Estévez et al. 2011, J. Hydrol.](https://ucocris.uco.es/entities/publication/6ebb8581-013a-4d1b-ad22-e51e4c98723c), [Estévez et al. 2011, ASR](https://asr.copernicus.org/articles/6/141/2011/) [extract]. Thresholds not retrieved.

### Inferences
| Network | Sample | Stored step | Day | Published daily threshold |
|---|---|---|---|---|
| Oklahoma Mesonet | 3 s | 5 min | CST midnight | 90 %; solar 99 %; gust 1 obs |
| CIMIS | 1 min | 1 h | PST midnight | not found |
| USCRN | seconds (2–10 s reported) | 5 min, 1 h | LST | not stated |
| NEWA | not found | 15 min, 1 h | not stated | not found; gaps filled |
| Météo-France (normals) | not read | 1 h | 00h–23h | 24 h: ≤2 consecutive, ≤4 total missing |

- In hourly terms, Météo-France's limit (at most 4 of 24 missing) is about 83 % complete, close to Mesonet's 90 %. A daily threshold around 80–90 % for means therefore sits within observed practice, but it remains a network choice.
- Different thresholds per variable class are the common pattern: strict for totals, moderate for means, permissive for extremes. Tolerating gaps in max/min (Météo-France) or needing one observation (Mesonet gust) yields a value that is a lower bound on the true extreme, so it should be marked as such.
- A sound practice common to USCRN and CIMIS: keep flags, do not derive from flagged inputs, and recompute when late data arrive. LoRaWAN late or lost uplinks make the last one relevant.

### Gaps
- No ARPA (Italy) documentation found; the single Météo-France search did not confirm an 80 % rule or RADOME detail. I could not find how Météo-France's operational daily Tn/Tx windows are defined.
- Hourly completeness thresholds were not found for any network. Mesonet's 90 % is explicitly daily.
- CIMIS primary documents could not be opened with the tools here, so all CIMIS points need a check against the PDFs.
- NEWA and AgWeatherNet aggregation methods remain undocumented in what I could read. The exact Fiebrich 2010 thresholds were not accessible.

## Solar radiation and light: integrating irregular samples, DLI, lux to PAR

### Takeaway
A daily total is an integral of flux over time, so each sample must be weighted by the time it represents. A plain sum of samples scales with sampling rate and with packet loss, and has no physical unit. Lux-to-PPFD conversion is spectrum-dependent, about 0.0185 µmol m⁻² s⁻¹ per lux for sunlight.

### Cited Findings
- Radiation requirements are best met by sampling faster than the instrument's 1/e time constant, even when only hourly or longer totals are recorded; data points may be integrated totals or an average flux from samples. Daily radiant exposure is often expressed as mean daily irradiance — [WMO-8 Vol I ch 7 §7.1.3](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_7_en_MR_clean.pdf) [read]
- Radiation times should refer to local apparent (true solar) time. Standard or universal time is acceptable for automatic systems only if conversion loses no significant information, meaning high enough sampling and storage rates — [same](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_7_en_MR_clean.pdf) [read]
- Achievable pyranometer uncertainty at 95 %: hourly totals 3 % / 8 % / 20 % and daily totals 2 % / 5 % / 10 % for the three quality classes in the table — [same](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_7_en_MR_clean.pdf) [read]
- Mesonet sums 5 min energy accumulations and requires 99 % of observations — [Mesonet](https://m.mesonet.org/about/data-descriptions/monthly-summaries) [read via fetch summary]; USCRN integrates hourly average irradiance into MJ/m² — [USCRN daily](https://www.ncei.noaa.gov/pub/data/uscrn/products/daily01/readme.txt) [read via fetch summary]
- Sampling uncertainty falls rapidly as the averaging interval grows up to 24 h — [ARM SGP study](https://www2.atmos.umd.edu/%7Ezli/PDF_papers/2004JD005028.pdf) [extract]
- DLI is PPFD integrated over a day, in mol m⁻² d⁻¹ — [review citing Faust & Logan 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC10310645) [extract]
- Lux to PPFD factors: sunlight 0.0185; cool white fluorescent 0.0135; mogul HPS 0.0122; dual-ended HPS 0.0130; metal halide 0.0141; CMH 4200 K 0.0154; CMH 3100 K 0.0170. Example 108,000 lux ≈ 2000 µmol m⁻² s⁻¹ — [Apogee](https://www.apogeeinstruments.com/conversion-ppfd-to-lux/) [read via fetch summary]. These are manufacturer figures; the classic source is Thimijan & Heins, HortScience 18:818–822 ([DOI 10.21273/hortsci.18.6.818](https://doi.org/10.21273/hortsci.18.6.818)), not read (403), and cited with both 1982 and 1983 dates.
- From global radiation: daily 2.02–2.19 mol PAR per MJ and PAR fraction 0.45–0.48 at a coastal California site, growing-season means about 2.16 and 0.47 — [PPFD study](https://bvbvf1.bib-bvb.de/vufind/PrimoRecord/cdi_proquest_miscellaneous_883041250) [extract]. A US DLI map poster uses 0.007265 mol/Wh assuming 45 % PAR — [Logan & Faust poster](https://ashs.confex.com/ashs/2017/webprogramarchives/Presentation/Paper26645/New%20Daily%20Light%20Integral%20Maps%20for%20the%20United%20POSTER.pdf) [extract]; MSU uses about 1.96 µmol m⁻² s⁻¹ per W m⁻² — [MSU](https://www.canr.msu.edu/floriculture/uploads/files/MakingSenseofLightSensors.pdf) [extract]

### Inferences
Formula: energy E = Σ Iᵢ·Δtᵢ, where Δtᵢ is the true span each sample represents, for example by the trapezoid rule on real timestamps. DLI (mol m⁻² d⁻¹) = Σ PPFDᵢ·Δtᵢ / 10⁶ with Δt in seconds. 0.007265 mol/Wh ÷ 3600 ≈ 2.02 µmol/J, so that factor already includes the 45 % PAR fraction and must not be multiplied by 0.45 again (my arithmetic).

My own synthetic test (11 h day, 850 W/m² peak; one simulated broken-cloud series with mean dwell of 8 min and transmittance switching 1.0 / 0.3). It is one realisation and illustrative only.

| Sampling step | Clear day worst error | Broken cloud worst error, across sampling phase |
|---|---|---|
| 5 min | 0.0 % | 7.0 % |
| 10 min | 0.0 % | 8.7 % |
| 30 min | 0.2 % | 18.4 % |
| 60 min | 0.7 % | 22.7 % |

- Point sampling was unbiased on average, but noisy in cloud. Clear days are insensitive to step.
- A raw sum of the same day's samples without Δt was 71,425 at 5 min and 35,708 at 10 min: exactly double, with identical light. Any threshold on such a sum is tied to the reporting rate.
- With 20 % random packet loss at 10 min, sum × nominal Δt fell by 16 %, while time-weighted trapezoid stayed near +4.5 % (sd 4.3 %), most of it that grid's phase error. So loss should widen uncertainty, not lower the total.
- Long gaps at midday cannot be recovered by interpolation. Mesonet's 99 % rule reflects this. A daylight-only coverage rule makes more sense than a 24 h rule, since night samples add nothing.
- Lux sensors are not pyranometers: under shade nets, plastic or supplemental lamps the sunlight factor no longer holds, and the table above shows a spread of about 0.012–0.0185. Saturation and cosine response of low-cost lux sensors were not researched.

### Gaps
- I found no published study quantifying the error of 5 or 10 min spot sampling in daily global radiation. The table is my own illustration.
- The S2120 light sensor's spectral response, range and whether its reading is spot or averaged were not researched.

## Rain: accumulation definition and day boundary

### Takeaway
Rain is a total over a stated period. It must come from an accumulating measurement, not from sampled intensity. No single worldwide day boundary exists: what is required is a fixed, declared one. Agromet and ET practice uses a midnight local standard time day; WMO warns that different 24 h windows are not equivalent, and that observations stay on fixed local time through daylight saving.

### Cited Findings
- Total precipitation is the depth reaching the ground in a stated period; common observation times are hourly, 3-hourly and daily — [WMO-8 Vol I ch 6](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_6_en_MR_clean.pdf) [read]
- Intensity is normally derived over 1 min. Because of its high minute-to-minute variability, a single 1 min intensity does not represent a longer period and should not be used in a temporal sampling scheme, such as one measurement every 1 or 3 h — [same](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_6_en_MR_clean.pdf) [read]
- Discrete sampling errors depend on bucket size and sampling interval; mechanical and sampling errors are typically 5–15 % for intensity — [same](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_6_en_MR_clean.pdf) [read]
- Summaries for 0800–0800 are not equivalent to those for 0000–2400. At an early morning reading, precipitation is credited to the previous calendar day. With daylight saving, observations should stay at fixed local time. A single daily observation should be taken between 0700 and 0900 local standard time — [WMO-100 (2011) ch 2](https://posmet.ufv.br/wp-content/uploads/2017/04/MET-480-WMO-100.pdf) [read]
- Monthly sums need all days, or an accumulated value at resumption covering the gap — [WMO-100 §4.8.4](https://posmet.ufv.br/wp-content/uploads/2017/04/MET-480-WMO-100.pdf) [read]
- Practice: FAO-56 24 h from midnight ([FAO-56 ch 3](http://www.fao.org/4/x0490e/x0490e07.htm)); Mesonet raw accumulator resets at 0000 UTC while daily summaries use CST ([instruments](https://www.mesonet.org/about/instruments), [summaries](https://m.mesonet.org/about/data-descriptions/monthly-summaries)); CIMIS midnight PST all year ([DWR service](https://gis.water.ca.gov/arcgis/rest/services/Climatology/i04_CIMIS_Weather_Stations/MapServer) [extract]); USCRN 24 h LST ([daily readme](https://www.ncei.noaa.gov/pub/data/uscrn/products/daily01/readme.txt)).
- Gauges in "all in one" units: KNMI work reported rainfall losses of 62 % — [WMO-8 Vol III ch 1](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_II_1_en_MR_clean.pdf) [read]

### Inferences
- A sampled rate field cannot be summed into a rain amount, by direct analogy with the WMO warning. Only differences of an accumulating counter give a valid amount.
- A counter difference across a gap is a valid total for the whole gap, in line with the WMO accumulated-reading rule, but it cannot be assigned to specific hours. It should be labelled as an accumulation span. Counter resets must be detected so that they do not create negative or huge values.
- For Crete, the option most consistent with these sources is a calendar day at fixed local standard time (UTC+2, boundary at 22:00 UTC all year), rather than switching with summer time. A civil-time day (changing with EEST) is simpler for farmers but makes 23 h and 25 h days and departs from the WMO fixed-time guidance. This is a design decision to record; it needs checking against what the system now does.
- Calendar-day and rolling-24 h totals answer different questions: bookkeeping versus current field state. Rolling totals are fine for decision logic if named as such, and should not be compared with daily statistics.
- Solar noon in Crete (about 25°E) falls near 10:20 UTC, about 12:20 at UTC+2 (my arithmetic, ignoring the equation of time), so a UTC day boundary would fall in the local night but a true solar day differs from either.

### Gaps
- I found no WMO text defining a rolling 24 h rain product, and no Greek (HNMS) day convention was researched.
- Manual on Codes and WMO-No. 49 definitions of the climatological day were not read.

## Sensor exposure: 2 m station vs canopy vs greenhouse

### Takeaway
A screened 1.25–2 m station over grass answers "what is the regional air doing" and is what ET equations assume. Canopy-level sensors answer "what does the crop experience" and suit disease and leaf-wetness models. Greenhouse sensors describe a different climate and must be used only for that. None substitutes for another without correction.

### Cited Findings
- Air temperature for general meteorology should represent free air over as wide an area as possible, at 1.25–2 m above ground over natural ground, preferably grass, level and open — [WMO-8 Vol I ch 2](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_2_en_MR_clean.pdf) [read]. Height should never be below 1.25 m; class 1 sites are references and class 5 unsuited for wide-area use — [Vol I ch 1 Annex 1.D](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_1_en_MR_clean.pdf) [read]
- Wind: FAO-56 requires 2 m and notes 10 m in meteorology and 2 or 3 m in agrometeorology, converting with a logarithmic profile (Eq. 47). Annex 5 says anemometers need a large upwind fetch free of trees and buildings — [FAO-56 ch 3](http://www.fao.org/4/x0490e/x0490e07.htm), [Annex 5](http://www.fao.org/4/x0490e/x0490e0m.htm) [read via fetch summary]
- ASCE prefers open, well-watered, vegetated settings, with low well-watered vegetation within about 50 m and similar cover for a few hundred metres — [ASCE-EWRI 2005](https://www.mesonet.org/images/site/ASCE_Evapotranspiration_Formula.pdf) [read]
- Non-reference sites: FAO-56 Annex 6 gives corrections when Tmin − Tdew is consistently about 2 °C higher than at reference, usually in months with P/ETo not above 0.5; Ko = 0 °C for humid and subhumid and 2 °C for arid and semiarid climates; correction may be needed when the aridity bias index is consistently above 0.05. At Boise, Tmin was up to 10 °C above Tdew. Corrections are approximate and not for rewriting historical data — [FAO-56 Annex 6](http://www.fao.org/4/x0490e/x0490e0n.htm) [read via fetch summary]
- "All in one" stations: WMO says compact designs compromise exposure; small screens raise daytime and lower night temperatures and produce spikes. Cited studies: hourly mean bias +0.7 °C in summer and +0.4 °C in winter (Aston), spikes of 1–2 °C (KNMI). Calibration may be manufacturer-only — [WMO-8 Vol III ch 1](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_II_1_en_MR_clean.pdf) [read]
- Hygrometers should sit inside a screen; radiant heating can warm the sensor above air temperature, lowering indicated RH, even in a screen warmed by the sun — [WMO-8 Vol I ch 4](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/CIMO-Guide/Prelim_2018_ed/8_I_4_en_MR_clean.pdf) [read]
- Mesonet moved to an aspirated shield in 2009 to reduce radiation errors — [Mesonet](https://www.mesonet.org/about/instruments) [read via fetch summary]
- Leaf wetness: sensors 30 cm above turfgrass tilted 15–45° gave the smallest errors against visual wetness; difference between 30 cm and 150 cm in Ames averaged 33 min — [Sentelhas et al.](https://ams.confex.com/ams/AFAPURBBIO/webprogram/Paper78945.html) [extract]
- In an apple orchard, wetness duration differed widely by canopy position, and a sensor at 0.7 m over turf was a fair stand-in for the wettest zone; warning timing varied by up to 30 days with sensor position — [Batzer et al. 2008](https://apsnet.org/publications/plantdisease/2008/January/Pages/92_1_164.aspx) [extract]
- In strawberry, canopy sensors at 30 cm were compared with a 2 m edge-of-field station, and the abstract says the station may miss canopy conditions — [Cosseboom et al., ISHS](https://ishs.org/ishs-article/1425_59/) [extract]
- NEWA adjusts airport and forecast RH as not representative of agricultural settings — [NEWA](https://newa.cornell.edu/how-newa-handles-weather-data) [read via fetch summary]
- Greenhouse: in Almería, lysimeter ETo inside plastic was best estimated by FAO56 PM with fixed aerodynamic resistance of 150 s/m, pan with Kp 0.79, a locally calibrated radiation method, and Hargreaves — [Fernández et al. 2010](https://typeset.io/papers/measurement-and-estimation-of-plastic-greenhouse-reference-1rgmj3m4e6) [extract]. In a ventilated polycarbonate house, ETo was 60 % of outdoor ETo, with solar radiation explaining over 90 % of variance — [Jaafar & Ahmad 2019](https://ascelibrary.com/doi/10.1061/%28ASCE%29IR.1943-4774.0001404) [extract]

### Inferences
| Use | Appropriate source | Why |
|---|---|---|
| ETo and irrigation demand, open field | Screened T and RH at 1.5–2.5 m, wind at 2 m or converted, over low cover | Equations assume it (ASCE, FAO-56) |
| Frost, regional weather, forecast comparison | Standard 1.25–2 m station | Comparability |
| Fungal infection, leaf wetness | Sensor in or at canopy, at the disease-relevant height | Canopy microclimate differs from 2 m |
| Insect degree-days | Standard air temperature is the usual base, but model-specific | Not researched here; check each model's source |
| Greenhouse crop water and disease | Inside sensors; radiation inside or outside × measured transmissivity | Wind, radiation and humidity differ inside |

- Mixing heights or exposures within one averaged indicator breaks comparability. Station metadata should carry height, screen type and environment, as WMO-8 asks for in metadata requirements.
- An all-in-one station's temperature bias of +0.4 to +0.7 °C is comparable to or larger than the averaging effects above, so exposure deserves attention before fine points of aggregation. Whether the fleet's station behaves like the units tested is unknown.
- Thresholds taken from papers (for example RH > 90 %) depend on the sensor location used in those papers; moving a threshold from canopy to 2 m, or from outdoors to a greenhouse, needs revalidation.

### Gaps
- WMO-No. 134 guidance on canopy-level or in-crop measurement could not be read, so I cannot state WMO's position on this. Rowlandson et al. 2015 was seen only through citations.
- I found no international standard for greenhouse climate sensor siting. Fernández and Jaafar were seen only as abstracts.
- Field-measured bias of the specific LoRaWAN stations used here was not researched.
