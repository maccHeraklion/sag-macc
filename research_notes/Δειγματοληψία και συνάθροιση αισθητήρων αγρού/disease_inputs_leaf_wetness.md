# How plant disease warning systems define and compute leaf wetness and humidity inputs

Compiled 2026-11-07. Context: leaf sensors every 20 min (3 samples per hour), stations every 5 min, many fields without a leaf sensor, hour-counter models for downy mildews, Botrytis, olive peacock spot, anthracnose, powdery mildew.

Evidence tags used on every finding:
- **[CONSENSUS]** several independent sources agree. **[SINGLE]** one study. **[SYSTEM]** the documented rule of one operational system. **[VENDOR]** manufacturer statement, not independently tested.
- Access: **FT** full text read today. **ABS** abstract only. **SEC** search summary or a secondary citation, original not read. **PRIOR** taken from the project's literature notes of 2026-11-06 (scratchpad `lit_leafwet_2026-11-06.md`), original not re-read today.
- Rowlandson et al. 2015 and Huber & Gillespie 1992 could NOT be read in full (403 and paywall). Nothing below attributes a specific rule to them beyond their abstracts.

## Definition of a wet hour: any wet sample, a fraction of the hour, or a mean of readings

### Takeaway
There is no accepted standard. Published practice falls into three families: (a) keep wet minutes and do not binarise (research practice and sensor loggers), (b) an hour is wet when about half of it is wet (≥30 min or ≥50 % of samples: Iowa State, Università Cattolica, Dalla Marta/Wang), and (c) any wetness in the hour (NEWA, ≥1 min). Among the rules I could verify, the half-hour rule is the most frequent in peer-reviewed disease modelling (a small sample: three groups); NEWA's ≥1 min is the notable conservative exception. Averaging a wetness reading across the hour is not a documented rule anywhere I found.

### Cited Findings
- **≥30 min, Iowa/Midwest.** An hour was scored wet when sensors detected wetness for ≥30 min, dry for <30 min (15 stations, painted Campbell 237, 45°, 0.3 m over turf, field-calibrated to within 1 h/day). [SINGLE, FT] — [Wegulo, Gleason, Kim & Taylor, AMS P1.1](https://ams.confex.com/ams/pdfpapers/49548.pdf)
- **>30 min, northern Italy, grape downy mildew.** A moist hour for sporulation is RH ≥80 %, or rain >0 mm, or leaf wetness >30 min (iMetos station in the vineyard, Piacenza). [SINGLE, FT] — [Brischetto et al. 2021, Front. Plant Sci.](https://www.frontiersin.org/articles/10.3389/fpls.2021.636607/full)
- **≥30 min, Italy and France, Botrytis on grape.** A moist hour for the moisture factor is rain ≥0.2 mm, or wetness ≥30 min, or RH ≥90 % (the paper calls this RH a daily average, which sits oddly in an hourly count; unresolved). Mf = moist hours / 24. [SINGLE, FT] — [González-Domínguez et al. 2015, PLoS ONE](https://pmc.ncbi.nlm.nih.gov/articles/PMC4601735/)
- **≥50 % of samples.** The leaf was considered wet when 50 % of samples in the hour exceeded the sensor threshold, a rule attributed to Dalla Marta et al. 2005. [SINGLE, PRIOR FT] — [Wang et al. 2019, Water 11:158](https://www.mdpi.com/2073-4441/11/1/158)
- **≥1 min, NEWA.** In tools using leaf wetness hours, a wet hour is logged at ≥1 min of sensor wetness. Without a sensor, an hour is wet when mean RH in that hour is >90 %. [SYSTEM, FT] — [NEWA, How NEWA handles weather data](https://newa.cornell.edu/how-newa-handles-weather-data)
- **Any positive sample at a time point.** Wet when an ICAFE resistance sensor (0–15 scale) reads ≥1 at a time point; hourly models aggregated from that. [SINGLE, FT] — [Solís et al. 2021, Biomimetics](https://pmc.ncbi.nlm.nih.gov/articles/PMC8161455/)
- **Dry-hour definition, Michigan.** For apple scab, leaves count as dry when RH <90 % and wet <15 min in the hour, for 8 consecutive hours, which implies wet at ≥15 min. [SYSTEM, PRIOR SEC, page not readable] — [MSU Enviro-weather](https://www.canr.msu.edu/news/how_to_use_enviro-weathers_apple_scab_tool)
- **No binarisation, wet minutes.** Research practice sums wet 15-min intervals [SINGLE, PRIOR FT] — [Sentelhas et al. 2006](https://ippc2.orst.edu/len/articles_canopy_conversion/sentelhas_etal_2006_PM_eval); a Brazilian vineyard study used 20-min data and took LWD as the number of wet 20-min intervals divided by three [SINGLE, FT] — [Lulu et al. 2008, Sci. Agric.](https://revistas.usp.br/sa/article/download/22384/24408/26016).
- **Sensor logger practice.** Campbell totals minutes wet, dry and wet-or-contaminated per storage interval, with minutes = scan interval/60 per scan [VENDOR, FT] — [Campbell LWS manual](https://s.campbellsci.com/documents/au/manuals/lws.pdf); METER loggers read every minute and report minutes above threshold per interval [VENDOR, FT] — [PHYTOS 31 manual](https://publications.metergroup.com/Manuals/10386_PHYTOS31_Pages.pdf).
- **Minutes per hour as data type.** The Norwegian VIPS platform stores leaf wetness as minutes per hour (variable BT) [SYSTEM, FT of commit diff] — [VIPSCommon commit](https://gitlab.nibio.no/VIPS/VIPSCommon/-/commit/3c623d41b7f3bc2ec1be7666095e5e51dbebe82b); UC IPM's tomato powdery mildew tool takes leaf wetness on a 1–60 scale per hour [SYSTEM, FT] — [UC IPM](https://ipm.ucanr.edu/MODELS/TOMPM/weathertomatopm.html).
- **Gillespie.** TomCast counts hours of wetness per day into DSV classes, first spray at 35 DSV, then every 20 [FT], but the source does not say how sub-hourly data become wet hours. — [Gillespie & Sentelhas 2008](https://revistas.usp.br/sa/article/download/22392/24416/26024)
- **Metos/Pessl.** Published model descriptions work in hours of wetness (for example >4 h, 8–12 h), with no minutes-per-hour rule stated. [VENDOR, SEC] — [Metos grapevine models](https://metos.global/en/disease-models-grapevine), [Metos potato models](https://metos.global/disease-models-potato/)
- **There is no standard.** No standard has been accepted for measuring leaf wetness [CONSENSUS, ABS] — [Dalla Marta et al. 2005](https://consensus.app/papers/details/8365fa8bf6555d1fb3b27a81ccf819a3/?utm_source=claude_code), [Zito et al. 2020](https://consensus.app/papers/details/528eb4067d905c8684c9653da982fa0b/?utm_source=claude_code); no accepted calibration standard for LWD sensors [FT] — [Gleason et al. 2008](https://revistas.usp.br/sa/article/download/22393/24417/26025).

### Inferences
- With 3 samples per hour, "≥30 min" and "≥50 % of samples" both become **≥2 of 3 samples**. "Any wet sample" becomes **≥1 of 3**. NEWA's ≥1 min cannot actually be reproduced at a 20-min step because it assumes minute-level logging.
- My idealised simulation (one wet spell, random phase, perfect sensor, samples on the clock grid; own calculation, not literature): at a 20-min step, "any sample" overstates each wet spell by about +41 min on average; ≥2 of 3 has about zero bias for spells ≥1 h but loses a 20-min spell completely (−20 min) and mean absolute error is 20–30 min for 20–45 min spells; summing samples × 20 min is unbiased, with error under 20 min. At a 5-min step, "any sample" adds about +55 min per spell and ≥6 of 12 adds about +5 min.
- So the "any wet sample" rule does not simply add caution. It adds about 40 min for every separate wet event, so its inflation grows with the number of short wet events (dew onset, flickering sensors, misting), not with real wet time.
- The most defensible design from this evidence: store wet minutes per hour as the primary quantity (samples × step), and derive a wet-hour flag at ≥30 min only where a model's published parameters were built on hours. This matches VIPS, METER and Campbell storage and the Iowa and Italian rules.

### Gaps
- Not found: wet-hour rules of RIMpro, Adcon, DACOM (Plant-Plus), or Metos FieldClimate internals. Searches returned no primary documents; vendor support would have to confirm.
- The full text of Rowlandson et al. 2015 may discuss this; I could not read it. Dalla Marta 2005 was not read directly either; the 50 % rule is via Wang 2019.
- No study was found that tests which wet-hour rule gives the best disease prediction.

## Effect of sampling interval on measured leaf wetness duration

### Takeaway
Manufacturers converge on sampling at 15 min or faster (or 10 min for one vendor). The 20-min default of the Dragino LMS01 is slightly outside that guidance, but a Brazilian vineyard study used 20-min data successfully, and the error is bounded and small against the 1–2 h/day that systems tolerate. I found no controlled sub-sampling experiment, so the size of the effect is not established empirically.

### Cited Findings
- A sample frequency of 15 min or less is usually necessary to capture LWD accurately [VENDOR, FT] — [Campbell LWS-L manual](https://s.campbellsci.com/documents/us/miscellaneous/old-manuals/LWS%20Dielectric%20Leaf%20Wetness%20Sensor.pdf); same advice, 15 min or less often necessary [VENDOR, FT] — [PHYTOS 31 manual](https://publications.metergroup.com/Manuals/10386_PHYTOS31_Pages.pdf).
- Phyto-sensor advises sampling every 10 min or less [VENDOR, SEC] — [LWS-02z manual](https://phyto-sensor.com/manuals/Wireless-Phytomonitoring-System/Sensors/LWS-02z-Leaf-Wetness-Sensor-Manual.pdf).
- Dragino LMS01 default uplink is 20 min, configurable by AT+TDC or downlink 0x01 [VENDOR, FT] — [Dragino LMS01-LB wiki](https://wiki.dragino.com/docs/LoRaWAN-End-Node/soil-agriculture-sensors/lms01-lb/).
- Costa Rica coffee, ML estimation: regions logged at 15 min had daily MAE 53–65 min for the hourly and best models; regions logged at 30 min had 81–102 min. The interval is confounded with region, and the authors only hypothesise the cause. [SINGLE, FT] — [Solís et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8161455/)
- A 30-min transmit interval gave ±30 min time resolution, reduced to ±4 min by a deep-learning reconstruction, with LWD RMSE 0.55 → 0.20. [SINGLE, ABS] — [Kumar et al. 2022, IEEE Sensors J.](https://consensus.app/papers/details/a408de33966956b39b4eee57a8ee064e/?utm_source=claude_code)
- 20-min data were used directly with RH, DPD and CART models in a Jundiaí vineyard; CART over turf R² 0.82, against vineyard R² 0.87. [SINGLE, FT] — [Lulu et al. 2008](https://revistas.usp.br/sa/article/download/22384/24408/26016)
- Daily aggregation is clearly worse than hourly: daily-model MAE 80–126 min against hourly 54–102 min. [SINGLE, FT] — [Solís et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8161455/)
- Generating hourly inputs from daily data degrades LW models but stays acceptable, over 12 sites in the US and Italy. [SINGLE, ABS] — [Bregaglio et al. 2011](https://consensus.app/papers/details/e38efa3b66f457fca83f6336f4bef2e4/?utm_source=claude_code)
- Warning systems tolerate some error [ABS] — [Rowlandson et al. 2015](https://consensus.app/papers/details/22aaa33e199c5096a2e3189f780e154d/?utm_source=claude_code). The working benchmark is ±1–2 h/day: physical models about ±1 h/day (Gleason 2008, PRIOR FT); calibrated RH MAE 1.23–1.89 h (Sentelhas 2008); two sensor makes side by side MAE about 2.0 h [PRIOR ABS] — [Gama et al. 2020](https://journals.flvc.org/fshs/article/view/133210).

### Inferences
- A 20-min step gives a bounded timing error of up to 20 min per wet spell if samples are summed. In my simulation a 10-min wet spell was seen half the time, a 20-min spell always. A 15-min step misses a 10-min spell a third of the time, a 30-min step misses a 20-min spell a third of the time. Spells that short rarely matter for pathogens with minimum wetness of hours.
- Moving from 20 to 15 min would be a small gain in LWD. Reliability (lost LoRa packets) probably matters more than the nominal step, because one lost sample at 3 per hour removes a third of the hour.
- Station 5-min data are much finer than the leaf sensor. RH-based wetness and sensor wetness therefore have different time resolution, and that needs to be stated when comparing them.

### Gaps
- No controlled experiment found that resamples 1-min wetness to 5/10/15/20/30 min and reports LWD or disease-model error. The vendor "15 min" appears to be engineering judgement, not a published result.
- The Solís comparison is not a clean test of interval.

## Interruption rules: how long a dry gap splits a wet period, and interaction with hourly counters

### Takeaway
The concept is well accepted: Magarey 2005 joins two wet periods when the dry gap is shorter than a pathogen-specific D50. Values differ by more than an order of magnitude between pathogens, and for the target pathogens D50 is mostly **unmeasured**. Magarey's Table 3 has no D50 for any downy mildew, Botrytis cinerea or Colletotrichum. Operational systems use fixed values: 1 h for grape downy mildew (Rossi group), 8 h for apple scab.

### Cited Findings
- Wsum = W1 + W2 if D < D50, otherwise counted separately. D50 is the dry duration at RH <95 % giving a 50 % reduction in disease against continuous wetness, and it depends on when the dry period occurs. Only studies with an initial wet period below Wmin were used. [SINGLE foundational, FT] — [Magarey, Sutton & Thayer 2005](https://www.suddenoakdeath.org/wp-content/uploads/pdf/PHYTO-95-0092%20Magarey%20nappfast.pdf)
- Classes: sensitive 1–2 h (Puccinia spp.), moderate 4–20 h (includes *Botrytis squamosa*, *Venturia pirina*, *Botryosphaeria obtusa*), insensitive ≥24 h (includes *Venturia inaequalis*). [FT] — [Magarey 2005](https://www.suddenoakdeath.org/wp-content/uploads/pdf/PHYTO-95-0092%20Magarey%20nappfast.pdf)
- Without D50 it is hard to use an infection model with hourly data; humidity during the break matters, and caution is needed because desiccation depends on evaporation rate, not humidity alone. [FT] — same source.
- Grape downy mildew secondary infection: wet period = uninterrupted wetness or wetness interrupted by at most 1 h; infection is judged from mean temperature in that period. [SYSTEM, FT] — [Brischetto et al. 2021](https://www.frontiersin.org/articles/10.3389/fpls.2021.636607/full)
- Apple scab: intermittent wet periods are added unless about 8 h of continuous dryness occurs; a safety margin of a few hours is suggested when near infection. [CONSENSUS of extension guidance, SEC] — [NSW DPI](https://www.dpi.nsw.gov.au/agriculture/horticulture/pomes/pests-etc/apple-and-pear-scab). Note this 8 h convention sits below Magarey's ≥24 h class for *V. inaequalis*, so an operational rule and experimental D50 are not the same thing.
- Olive peacock spot: wetness interrupted by 0–24 h drying at 70 % and 100 % RH; drying length had a significant effect that depended on RH, and severity was greater at 100 % than at 70 %. [SINGLE, ABS; no D50 stated in the abstract] — [Obanor et al. 2011](https://consensus.app/papers/details/81aaf371545a5adb966d692a5e3e3a24/?utm_source=claude_code)
- *Pseudoperonospora cubensis*: sporangia wetted too briefly and then dried mostly failed to release zoospores. [PRIOR ABS, Cohen & Rotem 1971] So short wet spells should not be summed for one cohort; this is an inference in the prior notes, no hour value exists.
- *Plasmopara viticola*: no measured D50; in fair weather most sporangia die in the daylight after production, but over 50 % still released zoospores after 12–24 h under overcast conditions. [PRIOR ABS, Kennelly et al. 2007]
- *Botrytis cinerea*: on greenhouse tomato flowers, breaks of low RH did not reduce infection (Eden et al. 1996) [PRIOR ABS], while Körner & Holst 2005 state desiccation during germination can kill spores [PRIOR ABS]. Not reconciled.
- Botryosphaeria (Kim 2016): a dry period of at least 1 h ends the infection period. [PRIOR] 
- Stensvand's NIBIO ascospore maturation model resets accumulated risk after 8 h without wetness, according to a search summary. [SEC, page not read directly] RIMpro's rule was not found.

### Inferences
- D50 was defined in hours, from laboratory dry breaks. Applying it on a 20-min sample series is an extension, but it avoids a real artefact: if wet hours are flagged first, a single dry sample inside an hour vanishes under ≥2 of 3, and a gap of 40–50 min that straddles an hour boundary can leave both hours flagged wet, while the same gap inside one clock hour makes that hour dry.
- A plain "consecutive wet hours" counter implicitly uses D50 = 0, the strictest rule of all, and is inconsistent with the 1 h rule used in the Rossi model and with any 4–20 h class pathogen.
- Evaluating gaps on the raw series (minutes dry, with RH during the gap) and then applying the pathogen's gap limit gives one rule for all counters. The gap limit for each target pathogen must be labelled as an assumption until measured.
- Whether dry hours in a bridged gap count as wet is a separate choice. Magarey's formula adds W1 + W2 only, so dry hours do not count. The Rossi wet period definition, read plainly, includes the gap in the period but this was not checked at equation level.

### Gaps
- No measured D50 in hours found for *P. viticola*, *P. cubensis*, *Bremia*, *Peronospora destructor*, *B. cinerea*, olive *Colletotrichum*; for *Venturia oleaginea* Obanor's data exist but no D50 figure was seen in the abstract, and the full text was not available.
- Powdery mildew models in use do not need interruption rules for wetness (see the temperature section), except for "continuous hours" of temperature.

## Leaf wetness sensor thresholds, placement, calibration, and sensor types, including dielectric sensors

### Takeaway
Dielectric sensors are read by setting a threshold just above each sensor's own dry output, identified from the time series. There is no absolute percent threshold. Placement matters as much as the sensor: 45° tilt is typical, and a single sensor should be just below the canopy top, exposed to the night sky. Differences of about 2 h/day between makes have been reported (one Florida study). The Dragino LMS01 has manufacturer documentation only: no published wet/dry threshold and no independent evaluation were found.

### Cited Findings
- **PHYTOS 31**: dry about 435 raw counts, up to about 1,100 in heavy rain; METER loggers read every minute against 450 and 460 counts. Non-METER loggers: dry 260 / threshold 274 mV at 2.5 V; 320/330 at 3 V; 530/547 at 5 V. Threshold slightly above dry output; output is proportional to water amount; ice gives a much lower signal than water; dust or droppings can lift the dry output above 450, in which case derive a new threshold from the series until cleaned; 45° typical. [VENDOR, FT] — [PHYTOS 31 manual](https://publications.metergroup.com/Manuals/10386_PHYTOS31_Pages.pdf)
- **Campbell LWS**: <274 mV dry and ≥284 mV wet at 2.5 V excitation, with a middle class "wet or contaminated". Older manual at 5 V: about 445 mV dry, about 475 mV frost, well above when wet, Boolean threshold 500 mV, determined from a few days of series. Sensing zone about 1 cm from the surface. Keep raw mV because debris changes the threshold. [VENDOR, FT] — [LWS manual](https://s.campbellsci.com/documents/au/manuals/lws.pdf), [LWS-L manual](https://s.campbellsci.com/documents/us/miscellaneous/old-manuals/LWS%20Dielectric%20Leaf%20Wetness%20Sensor.pdf)
- The Campbell/METER plate imitates a leaf's heat capacity and radiation balance, with a hydrophobic coating; it may not match pubescent or less waxy leaves. [VENDOR, FT] — [LWS-L manual](https://s.campbellsci.com/documents/us/miscellaneous/old-manuals/LWS%20Dielectric%20Leaf%20Wetness%20Sensor.pdf)
- **Dragino LMS01**: FDR dielectric on a leaf-shaped probe (about 15 vein lines/cm), output defined as percentage of water drop over total leaf surface, 0–100 %, resolution 0.1 %, accuracy ±3 % (0–50 %) and ±6 % (>50 %); leaf temperature ±0.5 °C; sensing side is the unprinted side; no wet/dry threshold and no calibration procedure given. [VENDOR, FT] — [Dragino wiki](https://wiki.dragino.com/docs/LoRaWAN-End-Node/soil-agriculture-sensors/lms01-lb/). One retailer quotes ±5 % and a 0–15 scale, which conflicts with the manuals [SEC].
- Painting: resistance grid plates, CV between sensors 67 % bare against 9 % painted. [CONSENSUS within group, FT] — [Gillespie & Sentelhas 2008](https://revistas.usp.br/sa/article/download/22392/24416/26024). Dielectric makers state no painting or individual calibration is needed [VENDOR, FT] — [Campbell LWS manual](https://s.campbellsci.com/documents/au/manuals/lws.pdf). METER's argument against painting could not be read (403) — [METER article](https://metergroup.com/measurement-insights/why-painting-and-calibrating-your-leaf-wetness-sensor-wont-work/).
- Angle: horizontal plates stayed wet 38 min (Elora) and 56 min (Piracicaba) longer than plates tipped 30–45°. [FT] — [Gillespie & Sentelhas 2008](https://revistas.usp.br/sa/article/download/22392/24416/26024)
- Height: a sensor 30 cm over turf at 30–45° approximates LWD at the top of apple, coffee, maize and grape canopies, poorer for wetness inside; hedgerow grape showed no difference between top and inside; apple bottom differed from turf by a mean 2.56 h (MAD 2.93 h). [SINGLE, FT] — [Sentelhas et al. 2005](https://ippc2.orst.edu/len/articles_canopy_conversion/sentelhas_etal_2005_full.pdf)
- A single sensor is best just below the top of the canopy, fully exposed to the night sky, giving worst-case LWD. In apple, the date of reaching a cumulative LWD threshold varied by up to a month with position, and cumulative LWD varied up to 44 % at the canopy base. Differences are smaller in rain than dew. [FT] — [Gleason et al. 2008](https://revistas.usp.br/sa/article/download/22393/24417/26025)
- Installation guide: 30 cm, 30–45°, north-facing; dielectric coatings degrade with weather and UV and cause under-reporting, replace yearly; clean regularly. [PRIOR FT] — [UF/IFAS AE538](https://edis.ifas.ufl.edu/publication/AE538/pdf)
- Different makes at one station: same-make pairs r >0.90, MAE <1 h; Decagon against painted 237-L r about 0.8, MAE about 2.0 h. [SINGLE, PRIOR ABS] — [Gama et al. 2020](https://journals.flvc.org/fshs/article/view/133210)
- In Germany several common sensors did not reflect the apple scab infections that occurred during the study (Ehlert et al. 2019). [SEC via thesis, original not read] — [Zandelin 2021](https://stud.epsilon.slu.se/16458/1/Zandelin_P_210216.pdf)
- PHYTOS 31 droplet response needs a size-dependent calibration: linear for about 1 µL (R² 0.985), linear plus power for >10 µL. The surface is more hydrophobic than paper and drops contract. [SINGLE, ABS] — [Longworth et al. 2020](https://consensus.app/papers/details/547c65ccd67d53a585c82d1aa6297d46/?utm_source=claude_code)
- A flexible sensor against PHYTOS 31 differed by 30 min in LWD in one field test (not a validation of PHYTOS itself). [SINGLE, ABS] — [Patle et al. 2021](https://consensus.app/papers/details/e2edbfa7c9875c729943ce226f8d6314/?utm_source=claude_code)
- Deployment differs in practice: the Costa Rican network used resistance sensors at 45°, 1.5 m, facing west [FT] — [Solís et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8161455/), against the 30 cm, north-facing advice above.

### Inferences
- On PHYTOS, thresholds are 15–25 counts above dry, about 2–4 % of the dry-to-wet span. If LMS01 output behaved similarly, a fixed threshold would sit near the ±3 % accuracy band, so a fleet-wide percent threshold is not safe. This is an analogy, not a measurement.
- The transferable practice: derive a dry baseline per sensor from its own series (for example the sunny-afternoon floor), set the threshold a small margin above it, recompute periodically, and keep raw values so history can be reprocessed. Campbell's three-way class (dry, wet, wet or contaminated) is a good pattern for sensors with a rising baseline.
- Olive leaves are hairy (peltate trichomes) on the underside. Campbell warns of poor match for pubescent leaves, so measured LWD from a plate is an index for olive rather than leaf truth. That botanical link is my inference.
- At a Dragino LMS01, the leaf temperature channel could support a condensation check (leaf T vs dew point). I found no study of this for that sensor.

### Gaps
- No independent evaluation of the Dragino LMS01 was found in any search, and no published wet threshold for it.
- No study on the effect of salt, copper or pesticide residues on dielectric leaf wetness sensors (relevant to sprayed crops and coastal Crete). [PRIOR, also not found today]
- Exact Metos sensor wet threshold, and Adcon/DACOM practice: not found.

## Estimating leaf wetness without a sensor: RH thresholds, dew point depression, CART, Penman-Monteith, accuracy, labelling

### Takeaway
RH ≥90 % is the common default, but it is climate-dependent and it was found to **overestimate** in the Mediterranean case tested (Florence, best local threshold 92 %), and underestimate in the other three sites. Calibrated locally it reaches MAE 1.2–1.9 h. CART is the most robust across sites and across lower-grade sensors; Penman-Monteith is best with good sensors and net radiation and degrades sharply otherwise. Estimated wetness agreed less with grower observations than orchard sensors did (RIMpro: 73 % against 81 %), with false wets as the main fault. NEWA flags estimates and VIPS fixes a source priority order. No source states a rule on mixing; the evidence supports mixing only with a per-hour source flag.

### Cited Findings
- **Sentelhas et al. 2008** (Ames, Elora, Florence, Piracicaba, hourly): RH ≥90 % and DPD underestimated LWD in Ames, Elora, Piracicaba and overestimated in Florence, especially for short wet periods. RH ≥90 % was best overall, FC 0.87–0.92, FAR 0.02–0.31. Extended RH overestimated everywhere and was unsuitable. Site-specific thresholds gave MAE 1.23–1.89 h on independent data. [SINGLE multi-site, ABS] — [Sentelhas et al. 2008](https://consensus.app/papers/details/e4c5f9f1093d53bc881ba31d3c4c8313/?utm_source=claude_code)
- Local thresholds: 83 % Ames, 85 % Elora, 92 % Florence, 90 % Piracicaba. [FT] — [Gillespie & Sentelhas 2008](https://revistas.usp.br/sa/article/download/22392/24416/26024)
- Rule definitions in that work: RH ≥90 %; DPD ≤1.8 °C for onset, ≥2.2 °C for dry-off; extended RH: ≤70 % dry, ≥87 % wet, between them wet on a rise over 6 %, dry on a fall over 4 %. [FT, slides] — [Orlandini, methods for leaf wetness estimation](https://cimh.edu.bb/cami/files/Pest&DiseaseMod/PresK11/PDF/06%20orlandini%20methods%20for%20leaf%20wetness%20estimation.pdf)
- **Conflict on DPD limits.** Lulu et al. give DPD limits of 2.0 °C onset and 3.8 °C dry-off, from Gillespie et al. 1993 via Rao et al. 1998 [FT] — [Lulu et al. 2008](https://revistas.usp.br/sa/article/download/22384/24408/26016). This differs from the 1.8/2.2 °C above. The 3.7 °C figure belongs to the CART first split (Gleason 1994), not to Gillespie, according to Wang 2019 [PRIOR FT]: hour dry if DPD ≥3.7 °C, or if RH <87.8 % and wind ≥2.5 m/s.
- **CART (Iowa).** Gleason et al. 1994: hourly RH, T and wind, CART then stepwise discriminant analysis [SEC] — [Gleason 1994](https://apsnet.org/publications/plantdisease/backissues/Documents/1994Abstracts/PD_78_1011.htm); Kim et al. 2002 added a wind correction to 0.3 m [SEC] — [Plant Dis. 86:179](https://apsnet.org/publications/plantdisease/2002/February/Pages/86_2_179.aspx).
- **Portability.** Over 28 sites in Brazil, Canada, Costa Rica, Italy and USA: fuzzy logic FC 0.87 against 0.85–0.86 for RH threshold and decision tree; κ 0.71 against 0.64–0.66. Against unpainted sensors the fuzzy model's MAE was 2.5 h/day (the abstract text I received is cut off at that point). [SINGLE, ABS] — [Kim et al. 2010](https://consensus.app/papers/details/0f596753e94e5705a5797f3c1a35b055/?utm_source=claude_code)
- **Italy and US**: six models, 12 sites 2002–2008; some empirical models beat physical ones; CART best in most conditions. [SINGLE, ABS] — [Bregaglio et al. 2011](https://consensus.app/papers/details/e38efa3b66f457fca83f6336f4bef2e4/?utm_source=claude_code)
- **Sensor grade matters.** Strawberry system, four US states: Penman-Monteith MAE <2 h with high-precision sensors but 3.7 h, the worst, with low-precision RH and estimated net radiation; CART most robust, recommended for expansion. [SINGLE, ABS] — [Montone et al. 2016](https://consensus.app/papers/details/fa3068f916305c6a8ff65815e1c7dee2/?utm_source=claude_code)
- **Florida**: PM tends to overestimate and NHRH90 to underestimate; CART and DPD gave satisfactory spray advice; 3–4 model ensembles viable. [SINGLE, ABS] — [Gama et al. 2022](https://consensus.app/papers/details/ba5a9a24635a5d33b536c0227213a39c/?utm_source=claude_code)
- **Subtropical vineyard, 20-min data**: over turf NHRH>90 MAE 2.9 h, DPD 2.3 h, PM 2.6 h, CART 1.7 h. [SINGLE, FT] — [Lulu et al. 2008](https://revistas.usp.br/sa/article/download/22384/24408/26016)
- **Energy balance, Tuscany**: model applied to Sangiovese and compared with sensors 1995–2003 and visual checks in 2003, then fed into a downy mildew model. Numbers not in abstract. [SINGLE, ABS] — [Dalla Marta et al. 2005](https://consensus.app/papers/details/8365fa8bf6555d1fb3b27a81ccf819a3/?utm_source=claude_code)
- **Penman-Monteith approach** gave good results in maize, grape, coffee, soybean, tomato; the difficulty is radiation data. [FT] — [Gillespie & Sentelhas 2008](https://revistas.usp.br/sa/article/download/22392/24416/26024)
- **Greenhouses need different thresholds.** Tomato, Almería: RH ≥84.53 %, DPD <2.7 °C; cucumber, Beijing: RH ≥80 %, DPD <5.42 °C; MAE on independent data 3.29–5.46 h for RH; neural net 1.30–1.85 h; rain and wind unimportant indoors. [SINGLE, PRIOR FT] — [Wang et al. 2019](https://www.mdpi.com/2073-4441/11/1/158)
- Metos says representative leaf wetness measurement is a problem in greenhouses, so air temperature and dew point are used as indicators of free water. [VENDOR, FT] — [Metos lettuce models](https://metos.global/en/disease-models-lettuce/)
- **RIMpro**: wetting and drying model after Leca et al. 2015 for Meteoblue virtual stations. 2016 validation: grower observation agreed with the in-orchard station in 81 % of cases, with virtual wetness in 73 %, the main error being false wets. Of 417 potential infections at 35 locations, 88 % were found by both, 9 % only by the orchard station, 3 % only by virtual data; severity class agreed in 65 %. [SEC via thesis, citing Trapman 2017] — [Zandelin 2021](https://stud.epsilon.slu.se/16458/1/Zandelin_P_210216.pdf)
- RIMpro's simple interface for Swedish grid data assumed trees wet when rain >0.0 mm or VPD <2.5 hPa; wetness differences then caused only one prediction difference. [SINGLE, FT] — same source.
- **VIPS priority order**: provided wetness data, then Nærstad's physical algorithm (needs T, rain, radiation, wind, RH), then Trapman's simple algorithm (T, rain, RH); otherwise an error is raised. [SYSTEM, FT of diff] — [VIPSCommon commit](https://gitlab.nibio.no/VIPS/VIPSCommon/-/commit/3c623d41b7f3bc2ec1be7666095e5e51dbebe82b)
- **meteoblue**: wetness starts with precipitation and lasts until no precipitation in the last hour, RH <85 % and a saturation deficit condition. [VENDOR, SEC] — [meteoblue leaf wetness](https://content-no-cdn-1j.meteoblue.com/assets/pdfs/meteoblue_leaf-wetness-prediction_EN_v1.2.pdf)
- **NEWA labelling**: estimated values shown in brown italics. [SYSTEM, FT] — [NEWA](https://newa.cornell.edu/how-newa-handles-weather-data)
- **Error propagation** from site-specific estimates: SkyBit underestimated RH >90 % hours by 4.2 h/day and gave 11 severity values against 85 for on-site data, delaying BLITECAST spray thresholds up to 68 days; LWD error of 1.3 h/day gave 3.7 against 4.7 TOM-CAST sprays, corrected to 5 by CART/SLD/Wind. [SINGLE, FT] — [Wegulo et al.](https://ams.confex.com/ams/pdfpapers/49548.pdf)
- Better-model alternative to wetness: cumulative hours of RH >97 % predicted a sooty blotch threshold better than LWD in dew-dominated sites, not in a rain-dominated one, because RH is more spatially conserved. [SINGLE, FT] — [Gleason et al. 2008](https://revistas.usp.br/sa/article/download/22393/24417/26025)

### Inferences
- My conversions: at 15 °C, DPD 2.0 °C is RH ≈88 % and DPD 3.7 °C is RH ≈79 %. RIMpro's VPD <2.5 hPa equals RH >80 % at 10 °C, >85 % at 15 °C, >89 % at 20 °C, >92 % at 25 °C. Default rules are therefore quite different in practice: a fixed RH rule is not equal to DPD or VPD rules across temperature.
- For Crete, the only Mediterranean open-field threshold evidence is Florence, and it points to 92 % rather than 90 %, overestimation being worst for short wet periods. That is one site, in Tuscany, not Crete. A regional threshold must be fitted against the fields that have leaf sensors, using them as the local reference, then kept as "calibrated estimate".
- Rain is missing from pure RH and DPD rules. Rain-free daytime hours with humid air and rain hours that dry fast are treated poorly. All operational examples above (Brischetto, González-Domínguez, RIMpro, meteoblue, Trapman via VIPS inputs) add rain as an OR condition.
- Mixing: it is not supported to add measured and estimated hours into one unlabelled count. Given RIMpro's 73 % vs 81 % and Sentelhas's site bias, a sensible system stores source per hour (measured, calibrated estimate, default estimate, missing), shows it to the reader, and compares measured fields only with measured fields. Risk thresholds may need separate tuning per source. No published standard states this as a rule; it follows from NEWA's flagging and VIPS's priority order.
- Estimates give wet-sensor-like data at station height (1.5–2 m). Comparisons should expect a bias against canopy-top sensors.

### Gaps
- Per-site FC, CSI and bias for Florence were not obtained (paper closed, abstract only).
- No validation of any leaf wetness estimate found for Crete, Greece or olive orchards. Thomidis 2021 (Greece) could not be read (MDPI 403).
- Trapman's exact thresholds and Leca's model: not obtained.
- Whether RH-based and sensor-based counts need different disease thresholds: no study found.

## Temperature to use during a wet period: mean during wetness or hourly mean

### Takeaway
For wetness-duration infection models the accepted input is the **mean temperature during the wet period**, not the daily mean and not the temperature of one hour. This is consensus across Magarey, the Rossi group and the classic rule-based systems. An hourly-step alternative is a rate model that accumulates a fraction per hour; that is a different model form and was not verified here as equal.

### Cited Findings
- T in the generic model is mean temperature during the wetness period; W(T) = Wmin/f(T), capped at Wmax. [FT] — [Magarey 2005](https://www.suddenoakdeath.org/wp-content/uploads/pdf/PHYTO-95-0092%20Magarey%20nappfast.pdf)
- Parameter examples: Plasmopara viticola Tmin 1, Topt 20, Tmax 30, Wmin 2, Wmax 14; Botrytis cinerea grape 10/20/35 with 4–10 h, grape flower 1/25/34 with 1–12 h. [FT and PRIOR] — same source. Brischetto uses 4.0/21.0/30.2 °C with 2 h at optimum.
- Infection in the Rossi model uses average temperature during the wet period (TWP) against the required duration at that temperature; sporulation uses mean temperature in the moist night period, 10–30 °C, with ≥3 h. [FT] — [Brischetto et al. 2021](https://www.frontiersin.org/articles/10.3389/fpls.2021.636607/full)
- Rate parameters of infection models are often linked to temperature during the wet periods. [ABS] — [Rowlandson et al. 2015](https://consensus.app/papers/details/22aaa33e199c5096a2e3189f780e154d/?utm_source=claude_code)
- WISDOM/BLITECAST uses hours of RH >90 % and max and min temperature during those periods. [FT] — [Wegulo et al.](https://ams.confex.com/ams/pdfpapers/49548.pdf)
- Bremia warning: no infection when mean T exceeds 20 °C during the 3 h wet period or 22 °C in the following 4 h. [PRIOR ABS, Wu et al. 2002]. MELCAST uses mean temperature while leaves are wet [PRIOR SEC].
- Counterexample: the Botrytis model of González-Domínguez runs on a 1-day step with daily means in key equations; temperature restricted to wet periods was not stated. [FT] — [González-Domínguez et al. 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4601735/)
- UC IPM Botrytis index: ln(Y/(1−Y)) = −2.647866 − 0.374927W + 0.061601WT − 0.001511WT², W wetness hours, T temperature; >16 h is severe regardless of temperature. The definition of T was not visible. [SEC] — [UC IPM grape Botrytis](https://ipm.ucanr.edu/DISEASE/DATABASE/grapebotrytis.html)
- Estimated weather overstated mean hourly temperature by up to 1.4 °C exactly when wetness or RH >90 % was measured, showing temperature during wet periods behaves differently from general means. [SINGLE, FT] — [Wegulo et al.](https://ams.confex.com/ams/pdfpapers/49548.pdf)
- Olive: minimum wetness for peacock spot 18, 12, 12, 12, 24 h at 5, 10, 15, 20, 25 °C; lesions maximal at 15 °C [SINGLE, ABS] — [Obanor et al. 2011](https://consensus.app/papers/details/81aaf371545a5adb966d692a5e3e3a24/?utm_source=claude_code). Greek isolates: germination 5–25 °C, optimum 20 °C, at least 12 h wetness at optimum [SINGLE, ABS] — [Thomidis et al. 2021](https://consensus.app/papers/details/de058aa13a88574f851c6080bab8af2e/?utm_source=claude_code). Olive anthracnose: infection 10–25 °C, best 17–20 °C, 1.0 h and 12.2 h wetness at optimum for 5 % and 20 % fruit incidence [SINGLE, SEC] — [Moral et al. 2012](https://apsnet.org/publications/phytopathology/2012/October/Pages/102_10_974.aspx).
- Powdery mildew is a temperature model: Gubler-Thomas index needs ≥6 continuous hours at 70–85 °F (about 21–30 °C), +20 per qualifying day, resets to 0 before reaching 60 on a day without it; older UC Davis versions need 3 consecutive days. It models conidia, not ascospores, and has no leaf wetness input. [SYSTEM, SEC] — [UC IPM grape powdery mildew](https://ipm.ucanr.edu/agriculture/grape/powdery-mildew/), [Oregon State app](https://hopper.science.oregonstate.edu/risk/grape_powdery_app)

### Inferences
- Computation: temperature should be averaged only over the samples flagged wet in the wet period, using sensor or station samples at their own step. If a leaf temperature exists, Magarey's use of air or leaf temperature is not specified in what I read; the published parameters were mainly from controlled air temperature, so air temperature is the safer default.
- For hour counters that increment one unit per wet hour regardless of temperature, W(T) cannot be applied in the published sense. The published form is duration compared with W(T̄ of the wet period).
- Because mean T changes as a wet period extends, compare at each step: Wsum(t) ≥ W(T̄(t)). This is standard usage in spirit; I did not find it written out.

### Gaps
- No direct study comparing mean-during-wetness with hourly-mean accumulation for the same pathogen.
- TomCast source does not state whether T is mean during wetness; widely assumed. Not verified.
- Whether leaf temperature should replace air temperature: no source found.

## RH thresholds: hourly mean vs instantaneous; humidity sensor saturation and inaccuracy near 100 % in greenhouses

### Takeaway
Both forms exist. NEWA uses the hourly mean above 90 %; research work with sub-hourly data counts intervals above a threshold. No comparison of the two was found. Near saturation, capacitive sensors are outside their recommended range, can read high after long exposure, lose responsiveness under condensed water, and most clip at 100 %. An RH reading of 95–100 % therefore cannot be treated as equal to measured wetness, and small offsets matter because thresholds sit in the 80–92 % band.

### Cited Findings
- Hourly mean: NEWA records wet when hourly mean RH >90 %. [SYSTEM, FT] — [NEWA](https://newa.cornell.edu/how-newa-handles-weather-data)
- Interval counting: number of 20-min intervals with RH >90 %, divided by 3. [SINGLE, FT] — [Lulu et al. 2008](https://revistas.usp.br/sa/article/download/22384/24408/26016)
- BLITECAST input is hours per day with RH >90 %. [FT] — [Wegulo et al.](https://ams.confex.com/ams/pdfpapers/49548.pdf)
- UC IPM tomato tool stores hourly max, min and mean RH and T; sub-hourly data must be summarised to hourly. Sensors inside foliage near the top, wetness sensors on top of the canopy. [SYSTEM, FT] — [UC IPM](https://ipm.ucanr.edu/MODELS/TOMPM/weathertomatopm.html)
- Thresholds in use by disease: RH ≥80 % moist hour for grape downy mildew sporulation [FT] — [Brischetto 2021](https://www.frontiersin.org/articles/10.3389/fpls.2021.636607/full); >85 % in darkness for lettuce downy mildew [VENDOR, FT] — [Metos lettuce](https://metos.global/en/disease-models-lettuce/); RH >85 % duration after rain for olive peacock spot in southern France, 134 infected and 191 non-infected rain events, sensitivity and specificity >0.97 [SINGLE, ABS] — [Roubal et al. 2013](https://consensus.app/papers/details/ce5ff1ca5d645a4e82560d3917583fb5/?utm_source=claude_code); RH >90 % for potato late blight (BLITECAST); RH >97 % as a sooty blotch substitute [FT] — [Gleason 2008](https://revistas.usp.br/sa/article/download/22393/24417/26025).
- Some pathogens need high humidity, not wetness: Cercospora carotae and C. kikuchii above 88 %; the wetness requirement may be defined as hours above an RH threshold. [FT and PRIOR] — [Magarey 2005](https://www.suddenoakdeath.org/wp-content/uploads/pdf/PHYTO-95-0092%20Magarey%20nappfast.pdf)
- NEWA adjusts airport RH and NWS forecast RH: adjRH = RH/(0.0047·RH + 0.53), because airport RH does not represent agricultural sites. [SYSTEM, FT] — [NEWA](https://newa.cornell.edu/how-newa-handles-weather-data)
- Capacitive sensors in continuous high humidity: increased error and calibration drift; in a DWD saturation test some read up to 130 %RH, and most could not show condensation because output is limited to 100 %, which hides a critical internal state; some shut down. [SINGLE, FT] — [Griesel, WMO TECO-2012](https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/IOM-109_TECO-2012/Session1/P1_09_Griesel_Acceptance_test_procedure_humidity_sensors.pdf)
- Sensirion SHT4x: typical RH accuracy ±1.8 %RH, hysteresis 1 %RH, drift <0.25 %RH/y; recommended normal range is 20–80 %RH and 5–60 °C; long exposure outside it can temporarily offset the signal, for example +3 %RH after 60 h at >80 %RH, recovering by itself; condensed water makes the sensor non-responsive until removed; the heater is for creep-free high-humidity operation. [VENDOR, FT, version 1 Oct 2020] — [SHT4x datasheet](https://cdn.sparkfun.com/assets/d/5/f/d/6/SHT40_Datasheet.pdf)
- Milesight EM320-TH: ±2 %RH, 0.5 %RH resolution according to retailers, one listing naming SHT41. Accuracy tables of the official datasheet were not readable. [SEC, not confirmed] — [Milesight](https://www.milesight.com/lorawan/sensor/em320-th/)
- Maximum accuracy bands of some Sensirion parts stop at 90 %RH. [SEC] — [Sensirion brochure](https://sensirion.com/media/documents/0800F291/66753C4A/Sensirion_Humidity_Brochure_Web.pdf)
- A greenhouse leaf can be wet while a head-height sensor reads a safe humidity; condensation is set by leaf temperature against dew point. [SEC, grower sources] — [UC ANR](https://ucanr.edu/node/100836), [Greenhouse Grower](https://www.greenhousegrower.com/?p=180920). Model form: wetness onset when modelled leaf temperature reaches dew point, drying from latent heat [PRIOR ABS] — [ISHS 691_15](https://www.ishs.org/ishs-article/691_15).
- LWD inside a solar greenhouse varies strongly with position: south 12.17 h/day against middle 4.83 h/day. [SINGLE, PRIOR ABS, Liu et al. 2020]
- Automatic QC exists for RH saturating below 100 % and for implausible leaf wetness duration: detection 92.6–100 %, false alarms 2.7–33.3 %, so flags need review. [SINGLE, PRIOR ABS] — [Dandrifosse et al. 2024](https://consensus.app/papers/details/38fcef2113d759f8b10278043ab4f804/?utm_source=claude_code)

### Inferences
- A mean of 3–12 samples and a count above threshold differ mainly around dawn and dusk. A mean >90 % can hide several samples below 90 %, and a count can flag short peaks. With 5-min station data, "fraction of hour above threshold" is directly comparable to wet minutes, so it fits the same ≥30 min logic as leaf sensors. No paper tests this; it is a design consequence.
- ±2 %RH at 90 % covers the whole gap between the Florence threshold (92 %) and a local threshold near 88 %. Thresholds calibrated with one sensor type should not be moved to another type without re-fitting.
- A sensor that tops out below the threshold (saturates low) will never trigger an RH-gated rule. This is exactly the failure Dandrifosse's QC addresses. A per-sensor "maximum reached in the last N nights" check would reveal it. A long humid night should reach near 100 % on a healthy sensor unless the air is truly drier, so this is suggestive, not proof.
- NEWA's correction at RH 80 gives 88.3, at 85 gives 91.4, at 90 gives 94.4 (my calculation). The formula was made for airports in the US Northeast; there is no evidence it transfers to Crete, and it should not be applied to field sensors.
- In greenhouses, RH ≥ threshold is a weak proxy. The physical test (leaf temperature at or below dew point) is better supported, and needs a real leaf or plate temperature. The LMS01 provides one, though not validated for this purpose.

### Gaps
- No study found that directly compares hourly-mean RH with sub-hourly counts on disease outcome.
- No quantified evidence of how RH sensor error above 90 % propagates to disease-model error in greenhouses.
- Accuracy of S2120 RH channel not found; datasheet tolerance of EM320-TH above 90 % not confirmed.

## Missing and stale data handling in operational disease models

### Takeaway
Explicit public rules are few. NEWA is the best documented: short gaps in T and RH filled from adjacent hours, then gridded analysis, with the estimate flagged; leaf wetness itself is not substituted when a sensor exists and soil data are never estimated. Other systems simply demand complete series (VIPS, UC IPM) or fill from neighbouring stations (Gleason). No source defines what to do with a gap inside a wet period. Treating a missing hour as dry is not endorsed anywhere I found, yet that is the implicit default of any plain counter.

### Cited Findings
- NEWA: missing T or RH: average of previous and next hour if both exist, otherwise nearest RTMA/URMA grid value; missing precipitation and wind direction from RTMA/URMA; solar radiation from sky cover; soil temperature and moisture never substituted; estimates in brown italics; no other variables estimated in listings; outage alerts at 24 h, 7 days, 21 days, station removed after 21 inactive days. [SYSTEM, FT] — [NEWA](https://newa.cornell.edu/how-newa-handles-weather-data)
- UC IPM: every hour needs a value; fill from a similar day or similar station; otherwise start a new file after the gap. [SYSTEM, FT] — [UC IPM](https://ipm.ucanr.edu/MODELS/TOMPM/weathertomatopm.html)
- VIPS: leaf wetness computation requires T, rain and RH complete and sorted, otherwise raises a missing data error; the first hour is a startup; if no prior value exists a dry (0) hour is assumed. Validation still marked as TODO in the code at that commit. [SYSTEM, FT of diff] — [VIPSCommon commit](https://gitlab.nibio.no/VIPS/VIPSCommon/-/commit/3c623d41b7f3bc2ec1be7666095e5e51dbebe82b)
- Networks need trained staff, scheduled maintenance and error checks; when sensors fail, kriging or nearest stations can fill temporarily. Station-to-station correlation is lowest for LWD. [FT, PRIOR for the correlation] — [Gleason et al. 2008](https://revistas.usp.br/sa/article/download/22393/24417/26025)
- Filling from neighbours has distance limits. In the US Midwest, gridded SkyBit daily mean temperature beat a ground station at the shortest compared distance (71 km); a ground station beat SkyBit for RH >90 % duration up to 585 km and for raw SkyBit wetness at all distances, until wetness was corrected by CART/SLD/Wind. These distances come from flat terrain and should not be applied to Crete. [SINGLE, FT] — [Wegulo et al.](https://ams.confex.com/ams/pdfpapers/49548.pdf)
- QC categories used by a Belgian network: missing, range, temporal, spatial, internal consistency; minute-step checks catch errors invisible at hourly step. [SINGLE, PRIOR ABS] — [Dandrifosse et al. 2024](https://consensus.app/papers/details/38fcef2113d759f8b10278043ab4f804/?utm_source=claude_code)
- WMO-style practice on minimum data completeness for hourly values belongs to another note in this folder and was not reviewed here.

### Inferences
- With 3 samples per hour, a practical rule is: 3 of 3 = full; 2 of 3 = usable, compute wet minutes from present samples and scale, flag "partial"; 0–1 of 3 = unknown. This is my proposal, not a standard. Scaling a 1-of-3 hour would make a single sample decide the whole hour, which is exactly the failure in a "last sample" scheme.
- A wet-period counter needs three states (wet, dry, unknown). An unknown hour between wet hours should not break the period and should not add to it; a run of unknown hours longer than the pathogen's gap limit should close the period with a "data gap" flag. Neither NEWA nor others state this, but it is the only treatment that neither fabricates infection nor erases it.
- Fallback order consistent with VIPS and NEWA: own sensor, then calibrated estimate from own station data, then neighbouring or gridded data, each flagged. Leaf wetness should not be interpolated from a neighbouring field's sensor, given its low spatial correlation.
- Staleness: a reading older than a set limit must not be held as current. NEWA's alerts (24 h, 7 d, 21 d) are maintenance levels, not model limits. A reasonable model limit is the same as the gap limit, an assumption for this system.
- A displayed risk should expose the fraction of hours in the window that were measured, estimated or unknown, because an apparent "no risk" from gaps cannot be separated from a true "no risk" otherwise.

### Gaps
- No published rule found in TomCast, Mills-type tools, RIMpro, BLITECAST, MELCAST, or Metos for gaps inside a wet period.
- No published sensitivity study of disease models to data loss rate. Not found in these searches.

## Validation: how systems are evaluated against field observations

### Takeaway
Two levels are used, and they should be separate: (1) weather-input validation with contingency scores per hour (FC, CSI, FAR, bias) and MAE h/day against a reference; (2) disease-level validation using observed infections or epidemics in unsprayed plots, reporting sensitivity, specificity, posterior probabilities, or spray counts and final disease against a calendar programme. The best-documented Italian example scores about 0.8 sensitivity and specificity for infection days, with its main value in negative prognosis (Brischetto, one vineyard). Field trials on grape downy mildew show spray reductions of about half or more without loss of control (Caffi, Madden). EPPO offers no specific standard for validating forecasting models that I could find.

### Cited Findings
- Input scores: FC, CSI, FAR, bias [FT slides] — [Orlandini](https://cimh.edu.bb/cami/files/Pest&DiseaseMod/PresK11/PDF/06%20orlandini%20methods%20for%20leaf%20wetness%20estimation.pdf); ME, MAE and CSI [FT] — [Wegulo et al.](https://ams.confex.com/ams/pdfpapers/49548.pdf); Willmott d, confidence index c [FT] — [Lulu et al. 2008](https://revistas.usp.br/sa/article/download/22384/24408/26016). To avoid splitting dew periods, Wegulo's day runs noon to noon.
- Brischetto (northern Italy, 3 years): infection days sensitivity 0.80, specificity 0.81, accuracy 0.81, AUROC 0.814, optimum severity cut-off 0.065; false positives 12 of 62 non-infection days; 9 of 108 infections missed, these accounting for 4.4 % of lesions; P(no infection | none predicted) 0.87. Sporangia presence: TPP 0.78, TNP 0.41. [SINGLE, FT] — [Brischetto et al. 2021](https://www.frontiersin.org/articles/10.3389/fpls.2021.636607/full)
- Rossi primary infection model: 12 years (1995–2006), 43 vineyards in Emilia-Romagna, independent data; probabilities 0.994 and 0.999; errors mostly early season or weak rains. [SINGLE, ABS] — [Rossi et al. 2008](https://consensus.app/papers/details/dbcaa6fbeecb5d6586e68ba5245b64ae/?utm_source=claude_code)
- Caffi 2010 (northern Italy, 2006–2008): model plus forecast and SMS; sprays reduced from 6.8 by about half or two-thirds; bunch efficacy WA 96 % against grower 89 %; saving 174–224 €/ha. [SINGLE, ABS] — [Caffi et al. 2010](https://consensus.app/papers/details/d18a5afbfbe85573b78e2166cb9d4d1b/?utm_source=claude_code)
- Madden 2000 (Ohio, 7 years): 1–4 sprays against 4–10; median 3 fewer; same incidence. [SINGLE, ABS] — [Madden et al. 2000](https://consensus.app/papers/details/e40c63bfd4ce5b8581cc3ed801f22989/?utm_source=claude_code)
- González-Domínguez: 21 epidemics, Italy and France, 2009–2014; 17 of 21 classified correctly, 15 of 21 on cross-validation; severe epidemics hardest (4 of 7, 3 of 7). [SINGLE, FT] — [PLoS ONE 2015](https://pmc.ncbi.nlm.nih.gov/articles/PMC4601735/)
- Roubal: sensitivity and specificity >0.97 on fitted data, 2 years in commercial orchards in southern France. High fit figures come from an evaluated event set. [SINGLE, ABS] — [Roubal et al. 2013](https://consensus.app/papers/details/ce5ff1ca5d645a4e82560d3917583fb5/?utm_source=claude_code)
- Thomidis (Chalkidiki, 2016–2018): both generic and polynomial olive leaf spot models predicted infection periods, but the polynomial model overstated severity. [SINGLE, ABS] — [Thomidis et al. 2021](https://consensus.app/papers/details/de058aa13a88574f851c6080bab8af2e/?utm_source=claude_code)
- Magarey generic model: 53 lab studies, mean r 0.83, RMS 4.9 h. Lab fit only. [FT] — [Magarey 2005](https://www.suddenoakdeath.org/wp-content/uploads/pdf/PHYTO-95-0092%20Magarey%20nappfast.pdf)
- BOTMAN transferred poorly: in SE Spain unheated tomato greenhouses it gave moderate risk every week in the second season. [SINGLE, PRIOR ABS, Moyano 2003]. Yunis 1994 (Israel): foliage wet >7 h/day and 9.5 h at 9–21 °C at night predicts outbreak, on an independent set [PRIOR ABS].
- Decision framing: a lower decision threshold raises sensitivity, at a cost in specificity; Bayesian evaluation looks at probability of disease before and after using the predictor. [SEC] — [Yuen & Mila, Frontis](https://library.wur.nl/ojs/index.php/frontis/article/download/861/427). ROC curves are used to set thresholds, with predictive values a needed complement. [SEC] — [Hughes et al. 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7516835)
- TomCast tolerance: an error of 20 DSV is needed for one unwarranted spray; radar-derived wetness differed by 2 DSV over 18 rain days. [FT] — [Gillespie & Sentelhas 2008](https://revistas.usp.br/sa/article/download/22392/24416/26024)
- Users as a reference: RIMpro asked growers whether trees were wet at that moment, for 74 locations. [SEC via thesis] — [Zandelin 2021](https://stud.epsilon.slu.se/16458/1/Zandelin_P_210216.pdf)
- EPPO PP 1/333(1) concerns digital technologies in efficacy trials and leaves validation to developers; no EPPO standard specific to pest forecasting or DSS validation was found. [SEC] — [EPPO PP 1/333](https://pp1.eppo.int/standards/PP1-333-1-en.pdf)

### Inferences
- False-alarm rate must be reported with base rate. With few real infections, specificity 0.81 can still give many false alarms per true event. Brischetto's data show sporangia absence prediction was poor (TNP 0.41) while infection prediction was good, so different stages need separate scores.
- For this fleet, an input-level test is available now: fields with leaf sensors give hourly measured wet flags to score RH, DPD and CART estimates (FC, FAR, bias, MAE h/day). This can run without disease data. Disease-level validation needs dated symptom records, and unsprayed control plots are the published norm. The farm calendar records alone are likely too thin, as noted in earlier project audits.
- Comparisons between wet-hour rules should be scored on downstream model output (alert days changed), the same logic as Wegulo's simulated system tests, not only on hours.
- A shadow run comparing old and new rule outputs is compatible with this literature but does not by itself validate either rule, because neither is compared with observed disease.

### Gaps
- No published validation of a hour-counter system at 20-min sampling. No Cretan validation of any of these models found.
- Standard acceptable false-alarm rate: no consensus value found. It is treated as a cost trade-off.
- Rossi 2018 on eligibility criteria for IPM models was located but not read — [Rossi 2018](https://iris.unibs.it/bitstream/11379/513035/1/Rossi%20%282018%29%20-%20AIAM%20-%20Are%20there%20eligibility%20criteria%20for%20usability%20of%20plant%20protection%20models%20in%20IPM.pdf).

Create or connect a free Consensus account to return more than 3 results per search in Claude Code.: https://consensus.app/sign-up/?utm_source=claude_code&auth=claude_code
