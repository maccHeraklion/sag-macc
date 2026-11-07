# Degree-days and thermal time from automatic sensor data (insects and crops)

Compiled 2026-11-07. Evidence tags used below:
- **[CONSENSUS]** = stated by several independent authorities.
- **[SINGLE]** = one study or one institution.
- **[ABSTRACT]** = read only as an abstract, index record or secondary citation, not the full text.
- **[VENDOR]** = commercial source.
- **[UNCONFIRMED]** = could not be verified.

The UC IPM, OSU and NEWA pages were read through a fetch tool that summarises, so wording is paraphrased. Check the original before quoting.

## Hourly vs daily methods, thresholds and cutoffs, and the expected error between methods

### Takeaway
Summing or integrating hourly (or finer) temperature is treated as the reference, and the daily sine and triangle methods are approximations of it. The methods differ only on days when temperature crosses a threshold. Cutoff choice matters more than sine vs triangle: vertical cutoff removes a large share of hot-day heat units, while single vs double makes almost no difference. Simple averaging is the worst daily method. No accessible source gave Roltsch's numeric error values.

### Cited Findings
**What degree-days are approximating**
- [CONSENSUS] A degree-day model approximates a time integral of a temperature rate function. With continuous data you would integrate directly, and the sine and triangle methods exist because most stations give only Tmax and Tmin — [OSU Calculation Methods](https://hopper.science.oregonstate.edu/CalcMethods.html).
- [CONSENSUS] UC IPM describes hourly calculation as the more accurate method, with daily estimation procedures used in its place — [UC IPM evaluation page](https://ipm.ucanr.edu/WEATHER/ddeval.html). Best predictive performance has been reported for degree-days computed from hourly data — [Felber et al. 2017](https://consensus.app/papers/details/6f318a993b825706992677b6cb9d86fb/?utm_source=claude_code).
- OSU notes that precise degree-days from hourly or one-minute data exist but are seldom used in practice. Daily Tmax/Tmin remains the operational norm — [OSU FAQ](https://hopper.science.oregonstate.edu/wea/weafaq.html).

**Method definitions (UC IPM)**
- Methods listed: single triangle, double triangle, single sine, double sine, and Huber's. Huber's is single sine with horizontal cutoff, minus 0.3 °F-days when both Tmin and Tmax lie between the thresholds — [UC IPM concepts](https://ipm.ucanr.edu/WEATHER/ddconcepts.html).
- Cutoffs: horizontal means development continues at a constant rate above the upper threshold (area above it subtracted once). Intermediate means development slows (area subtracted twice). Vertical means no development above the threshold — [UC IPM concepts](https://ipm.ucanr.edu/WEATHER/ddconcepts.html).
- Unit conversion: 9 °F-days equal 5 °C-days — [UC IPM concepts](https://ipm.ucanr.edu/WEATHER/ddconcepts.html).

**Which method is the default**
- [CONSENSUS, US extension] When the model's method is unknown, UC IPM recommends single sine with horizontal cutoff — [UC IPM concepts](https://ipm.ucanr.edu/WEATHER/ddconcepts.html).
- OSU: triangle and sine methods are used by most of its insect models and nearly half of its crop models. Almost all of those use single sine, and all use horizontal cutoff. The exception is the single sine with intermediate cutoff used for spotted wing drosophila. No percentages are given — [OSU Calculation Methods](https://hopper.science.oregonstate.edu/CalcMethods.html).
- NEWA (Cornell) offers simple average and Baskerville-Emin (sine) — [NEWA search result](https://newa.cornell.edu/about-degree-days).

**Roltsch et al. 1999** (Int. J. Biometeorol. 42:169-176, [DOI](https://link.springer.com/doi/10.1007/s004840050101); Zalom is a co-author). All points below come from the [UC IPM summary](https://ipm.ucanr.edu/WEATHER/ddeval.html). The Springer full text was not accessible.
- Seven methods were compared with hourly summation, using 9 CIMIS stations over 2 years, a 10 °C lower threshold, and cutoffs at 26.7 °C and 32 °C.
- Double and corrected variants were nearly identical to the single versions, so single sine and single triangle are preferred.
- Averaging was the worst of the three primary methods, with larger error in cool periods.
- April-October: single triangle and single sine were similar. November-February: single sine showed more error, sometimes also in March.
- Interior California showed little difference among methods from mid-spring to fall.
- At Salinas (coastal), no method gave suitable estimates for most of the year.
- Cutoff method did not change error for the sine method. With the triangle method, horizontal did not significantly add error, but intermediate and vertical did.

**Numeric gaps between methods in the literature**
- McMaster & Wilhelm 1997: the two common interpretations of (Tmax+Tmin)/2 − Tbase differ by up to 83% with a 0 °C base in wheat, and the gap is larger with an upper threshold. The difference is whether the mean is clamped or Tmax and Tmin are clamped before averaging. Authors are urged to state their method exactly — [Agric. For. Meteorol. 87:291-300](https://scilit.com/publications/72a344f05171f4556a41da5f30cb833c). [ABSTRACT]
- Purcell 2003: daily and hourly thermal units agreed closely except when mean temperature was above 34 °C or close to the base. For warm-season crops with similar cardinal temperatures there was no advantage in hourly calculation — [Crop Sci. 43:1874-1879](https://zendy.io/title/10.2135/cropsci2003.1874). [SINGLE, ABSTRACT]
- Gu (grapevine, growing degree hours): Tmax/Tmin-mean GDD has the most error, chiefly because it misses heat on days when the mean is at or below base but part of the day is above it — [ASHS 2014](https://ashs.confex.com/ashs/2014/webprogram/Paper18544.html); [protocol paper record](https://agris.fao.org/search/en/records/65de3d94b766d82b18fcd50a). [ABSTRACT]
- Felber et al. 2017: for accumulations up to 800 °C d (base 10 °C), phenological dates from hourly temperatures reconstructed from Tmax/Tmin were within ±3 days of dates from observed hourly temperatures — [Int. J. Biometeorol.](https://consensus.app/papers/details/6f318a993b825706992677b6cb9d86fb/?utm_source=claude_code). [SINGLE, ABSTRACT]
- European corn borer, Piemonte: the hourly non-linear model beat the daily linear model on all accuracy indicators. The daily linear model predicted development too early, because of the linear form and the ignored daily fluctuation — [Maiorano 2012](https://consensus.app/papers/details/ce90f3216f285519a3a1971a7ad73e30/?utm_source=claude_code). [SINGLE, ABSTRACT]
- Under climate scenarios, the daily linear approach with a cutoff gave fewer degree-days than the hourly non-linear approach in Southern Europe, because the cutoff pulls down the daily mean — [Maiorano et al. 2012](https://consensus.app/papers/details/28ecd448d9bf51d7b225045c6f0387a3/?utm_source=claude_code). [SINGLE, ABSTRACT]

**Snyder**
- Snyder et al. 1999 compared ways of estimating thresholds from field phenology. Iterating cumulative degree-days with a single triangle calculation gave the lowest RMSE. A threshold of zero was nearly as good. Verification used 7 years of kiwifruit and 10 years of cherry data — [Int. J. Biometeorol. 42:177-182](https://link.springer.com/doi/10.1007/s004840050102). [ABSTRACT]
- Snyder's hand-calculation paper is [here](https://biomet.ucdavis.edu/doc/HandCalculatingDegreeDays.pdf). It was found but not read.

**Zalom**
- Zalom appears here through Roltsch et al. 1999 and Burrack & Zalom 2005. His 1983 UC leaflet "Degree-days: the calculation and use of heat units in pest management" was not retrieved. See Gaps.

### Inferences
**Own illustrative calculation** (not from a source; pure sine day, base 9 °C, upper 30 °C, degree-days per day):

| Tmin-Tmax (°C) | Plain average | Clamp then average | Sine or hourly, horizontal | Sine, intermediate | Sine, vertical |
|---|---|---|---|---|---|
| 6-15 | 1.50 | 3.00 | 2.26 | 2.26 | 2.26 |
| 10-20 | 6.00 | 6.00 | 6.00 | 6.00 | 6.00 |
| 14-26 | 11.00 | 11.00 | 11.00 | 11.00 | 11.00 |
| 22-32 | 18.00 | 17.00 | 17.61 | 17.22 | 11.40 |
| 24-38 | 22.00 | 18.00 | 19.25 | 16.50 | 7.79 |
| 28-42 | 26.00 | 20.00 | 20.67 | 15.35 | 4.87 |

- Over a synthetic Crete-like year (mean 18.5 °C, seasonal amplitude 7.5 °C, daily range 8-10 °C), the horizontal integral gave 3509 DD. Plain average gave 3476 (−0.9%), clamp-then-average 3540 (+0.9%), vertical 3315 (−5.5%). This is synthetic, so use it for orders of magnitude only.
- Between thresholds, all methods give the same answer. Method choice therefore matters only in two situations:
  - Cool days that cross the base. These fall in the January-March part of any 1 January accumulation, which is also where Roltsch found sine weakest.
  - Hot days that cross the upper threshold.
- An hourly sum with a horizontal cutoff is mathematically the same target that single sine with horizontal cutoff approximates. It is therefore the natural pair for models published with that method. It is not the pair for models published with plain averaging.
- Plain averaging ignores partial-day heat on cool days and ignores the cutoff on hot days, so its errors have opposite signs by season and partly cancel in annual totals. Annual agreement therefore does not show agreement at a mid-season target.

### Gaps
- Roltsch's numeric error by method and month was not obtained. The UC page has none and the Springer full text was blocked.
- The Nebraska corn comparison of daily methods vs hourly ([Research Square preprint](https://www.researchsquare.com/article/rs-284619/v1)) returned no content, so no RMSE values are available.
- The Zalom et al. 1983 leaflet and Baskerville & Emin 1969 were not read directly.
- No study was found that measures the method effect in Crete or a similar Mediterranean island climate.

## Which temperature is valid: hourly mean vs instantaneous sample; standard station vs canopy or greenhouse air

### Takeaway
Spot vs averaged sampling appears to be a small effect at hourly intervals. The only direct study is abstract-level and its figures are ambiguous. Sensor location is a much larger effect: orchard vs nearest station gaps reach hundreds of GDD and days to weeks in crop timing. Most published models were derived from standard air temperature or laboratory chambers, so a canopy or greenhouse sensor is a valid measure of the environment but is not automatically the input those models were calibrated on.

### Cited Findings
**Sampling and averaging**
- Watson & Beattie 1995 is the most direct study. They compared logging intervals against a 12-minute reference for spot and averaged data, and spot-based estimates were largely insensitive to interval. Averaged data were more sensitive, with a seasonal effect. Annual totals from 6-hour intervals differed by under about 8 days, and by about 1 day up to 3 hours — [Aust. J. Exp. Agric. 35:795-805](https://publish.csiro.au/EA/EA9950795). [SINGLE, ABSTRACT]. **Caution:** two index summaries were not fully consistent, the page itself returned 404 on fetch, and it is unclear whether "days" means calendar days or degree-days.
- Canadian station study: the departure from the hourly daily-mean estimate ranged from 0.1 °C for bi-hourly sampling to about 1 °C for twice-daily sampling. This concerns mean temperature, not degree-days — [AMS paper reached by search, attribution not verified](https://ams.confex.com/ams/pdfpapers/84069.pdf). [UNCONFIRMED source mapping]
- NEWA warns that stations can miss the true daily max or min when it falls between logging times, which adds variability to degree-days computed from max/min — [NEWA](https://newa.cornell.edu/about-degree-days).
- The Central Valley orchard network below computed thermal time from 10-minute records into daily or hourly means — [PMC9119484](https://pmc.ncbi.nlm.nih.gov/articles/PMC9119484).

**Station vs orchard**
- California Central Valley, 731 in-orchard stations above the canopy vs 37 CIMIS stations (3 dropped for over 7% missing data), January 2020 to March 2021 — [PMC9119484](https://pmc.ncbi.nlm.nih.gov/articles/PMC9119484). [SINGLE, large n]
  - Orchards averaged 0.4 °C cooler over 14 months. Individual stations differed by up to about 3.3 °C by period.
  - Quarterly thermal-time discrepancies exceeded 300 GDD (base 0 °C).
  - Up to 175 GDD discrepancy for almond hull split, about 19.5% of the 900 GDD requirement, or about a 10-day shift.
  - Model date differences, orchard minus nearest CIMIS, mean / RMSE / range in days:
    - Chardonnay flowering: 1.97 / 2.93 / −4 to 10.
    - Almond flowering: 2.73 / 8.30 / −13 to 30.
    - Hull split: −3.84 / 6.29 / −19 to 7.
  - Mean distance to the nearest station was about 18.6 km. The authors state that the nearest regional station is not viable for precise pesticide or water decisions. Sensor height was not given.
  - The table also lists navel orangeworm at mean 0.23, RMSE 0.48. The summary labelled this in days, but it may be a count of generations. [UNCONFIRMED unit]
- Sensor height inside an apple planting (0.5, 2, 3 m), sums above 5 °C on hourly means: differences within ±1 day for almost the whole season. Other sums (daily degrees, base 10) gave 2-3 days — [Vávra & Litschmann, Acta Hort. 1412](https://ishs.org/ishs-article/1412_52/). [SINGLE, ABSTRACT]
- Semios reports regional and modelled weather running 6.25 and 8.50 days ahead of in-orchard stations for navel orangeworm in almonds — [Semios](https://www.semios.com/resources/blog/tracking-degree-days-for-now-prediction/). A separate page reports gaps of 7-10 calendar days by August against a public station 1.7 miles away — [Semios](https://www.semios.com/resources/blog/the-benefits-in-canopy-weather-stations-wa/). [VENDOR]

**Cover and greenhouse**
- Tuta absoluta degree-day requirements differed slightly between field-cage and open-field conditions in 2015-2016 — [Ghaderi et al. 2020 (JCP)](https://jcp.modares.ac.ir/article_1503_0c8ce55163055c4da50a81e0a273468c.pdf). [SINGLE, ABSTRACT]
- A physiological-age forecasting model was validated in an experimental greenhouse with artificial infestation — [Rossini et al.](https://www.math.fau.edu/cmpd5/rossini_paper_8.pdf). [SINGLE, not read in full]

### Inferences
- **Own simulation** (synthetic sine days, base 9 °C, upper 30 °C). "Latest sample times elapsed hours" against the exact integral differed by under 0.02% at 10, 60 and 180 minute sampling. With randomly lost packets of 30-60% and 0.5 °C noise, the difference was at most 0.2%. The simulation has no real short-term variability and no non-random gaps, so it supports only the statement that rectangle-rule sample-and-hold is not inherently biased on regular or randomly thinned data.
- **Where sample-and-hold can go wrong** is a non-random gap. A 12-hour gap closed by a sample at the daily peak of a 14-26 °C day credits 12/24 × (26 − 9) = 8.5 DD, while the true rising half-day holds about 5.5 DD. Gaps of several hours should therefore not be weighted by the closing sample alone. Linear interpolation (the trapezoid rule) or a cap on elapsed time would avoid this.
- A sensor reading once per hour is close to a spot-sampled hourly sum. The hourly mean of all samples is preferable because it uses all data and damps noise near thresholds, but the expected change in accumulated totals is small next to location effects.
- Scale comparison, using daily DD in summer at base 9 of about 18:
  - A 0.4 °C bias over 180 days is about 72 DD, or about 4 summer days.
  - A 1% method gap at 1837 DD is about 18 DD, or about 1 day.
  - Sensor siting and representativeness therefore outweigh sampling and sine-vs-hourly choices.
- Greenhouse air is the correct driver for insects living there, because outdoor temperature does not describe that environment. But outdoor-calibrated calendar targets, such as DD from 1 January with outdoor overwintering, do not transfer. Published thresholds from constant-temperature laboratory work are the more defensible basis under cover.

### Gaps
- No source directly compares hourly-mean vs instantaneous hourly sampling for degree-days at 5-15 minute resolution.
- No source quantifies leaf or fruit temperature vs air temperature for B. oleae, Lobesia or Tuta degree-day models. The search for Tuta leaf vs air returned nothing direct.
- No study was found of radiation-shield quality on low-cost LoRaWAN sensors in relation to degree-days.
- WMO siting standards were not retrieved in this pass. Vávra & Litschmann mention 2 m as the usual station height.

## Handling gaps and silent sensors; climate normals and forecasts; labelling estimates

### Takeaway
All three operational systems examined fill gaps and record that they did so. The common fill order is nearby real data first (adjacent hours, backup stations, gridded analyses) and long-term averages last. Filled and forecast values carry an explicit visible tag per value. Normals as gap fill exist in practice (UC IPM, OSU) but are a last resort, not a default.

### Cited Findings
- **UC IPM** — [About the calculator](https://ipm.ucanr.edu/WEATHER/abtddcalc.html):
  - Gaps are filled from backup station 1, then backup station 2, then the long-term average for the date, if a station is recommended.
  - "None recommended" means no station is similar enough. The user can choose not to fill.
  - If gaps remain, accumulation starts over after each gap.
  - Every report has a retrieval report counting values by source, and the formatted report codes each temperature 1, 2 or A.
  - Future dates can use long-term averages, which UC labels a climatological "forecast" in quotation marks.
  - The comma-delimited export has no source column.
- **NEWA** — [How NEWA handles weather data](https://newa.cornell.edu/how-newa-handles-weather-data):
  - A missing hourly temperature is the mean of the previous and next hour if both exist. Otherwise it comes from NCEP RTMA/URMA for the nearest grid location.
  - No maximum gap length is stated.
  - Estimated values display in brown italics.
  - The degree-day tool displays dates with missing data — [NEWA](https://newa.cornell.edu/about-degree-days).
- **OSU/USPEST** — [model app](https://hopper.science.oregonstate.edu/dd/model_app):
  - It tries several fill methods, states that estimates are less accurate than measurements, and notes that station failures are common and not always repaired promptly.
  - Each value has a QA tag, and a blank tag means measured. Tags identify methods such as PRISM interpolation.
  - Future dates use a 5-7 day forecast, then a user choice of 10-year average, 30-year normals, last year, two years ago, or seasonal forecasts (NMME, CFSv2).
  - Documented fill methods also include PRISM interpolation and time-average interpolation — [OSU weather page](https://hopper.science.oregonstate.edu/wea/weaexp.html).
  - Mapping combines PRISM with real-time stations and interpolates the station corrections. Forecast mapping uses 7-day NDFD, 7-month NMME and recent averages — [OSU FAQ](https://hopper.science.oregonstate.edu/wea/weafaq.html).
- In the Central Valley study, CIMIS stations with over 7% missing data were excluded from analysis — [PMC9119484](https://pmc.ncbi.nlm.nih.gov/articles/PMC9119484). That is one study's choice, not a standard.

### Inferences
- Reasonable practice from these systems, in order:
  1. Interpolate short hourly gaps.
  2. Use a neighbouring similar sensor or a gridded or model analysis.
  3. Use climatology only as a last resort, with a flag.
- Normals carry no weather anomaly, so they bias a gap during a heat wave or cold spell. A 7-day gap in a 3 °C anomaly is 21 DD, or about 1 summer day. It is not a major error for short gaps but compounds for silent sensors. A silent sensor filled from normals for weeks produces a plausible curve with no information in it, which is why the share of estimated values should be visible.
- Per-value provenance plus an accumulated "percentage measured" figure on any DD-based status is what the three systems imply. Totals from different sources should not be presented as equally reliable.
- For a sensor that stays silent, a target-date prediction should be marked as an estimate, and a stated limit on estimated share should stop it presenting as a measured status. No source gives a numeric limit, so any figure chosen would be a local decision.
- Forecast-based projection forward from today is standard practice, but it should be shown as a projection, not merged into the accumulated observed total.

### Gaps
- No accepted numeric rule was found for the maximum gap length or the share of estimated data allowed in a degree-day total.
- No validation study was found comparing fill methods (normals vs neighbour vs reanalysis) for degree-day error.
- The accuracy of gridded or model temperature for Crete's coastal and mountain terrain was not checked here.

## Biofix: calendar start vs trap catch; how operational systems treat this

### Takeaway
A biofix is whatever start event the model was calibrated from. Both types are in accepted use. Trap-based biofix is the classic form in US extension, and calendar starts are legitimate when the DD targets were fitted from that date. Calendar-start models tend to be regional, and a target from one region or start date must not be applied with another. For olive fly, accepted management is monitoring-led, and no authority treats DD alone as sufficient.

### Cited Findings
**General**
- [CONSENSUS] The biofix is the start date of accumulation, usually a biological event such as planting or first trap catch — [UC IPM concepts](https://ipm.ucanr.edu/WEATHER/ddconcepts.html). OSU gives first pheromone trap catch for codling moth as an example, and degree-days reset to zero at the biofix — [OSU FAQ](https://hopper.science.oregonstate.edu/wea/weafaq.html).
- USPEST library entries include fixed dates (1 May) and a mixed scheme: trap setting at 150 DD after 1 January, then first consistent catch as biofix — [USPEST model library](https://uspest.org/wea/bak/wealib.html).

**Lobesia botrana**
- UC IPM gives lower 10 °C and upper 30 °C, noting that some authors report 7 °C — [UC IPM EGVM](https://ipm.ucanr.edu/Invasive-and-Exotic-Pests/European-grapevine-moth/European-grapevine-moth/).
- USDA APHIS accumulated from 1 January with the same thresholds — [APHIS](https://www.aphis.usda.gov/sites/default/files/DDfor1stgenerationEGVM.pdf).
- The California programme listed determining a biofix as a development need at the time — [UC paper](https://ucanr.edu/sites/default/files/2011-03/81888.pdf). [ABSTRACT, exact document not verified]
- Greece (Milonas et al. 2001): lower threshold 6.45 °C from 1 March. Day-degrees between flight starts: first generation 339.3 (Naoussa) and 275.6 (Thessaloniki); third 899.5 and 1197.0. Models explained 60-78% (Thessaloniki) and 86-91% (Naoussa) of flight variation — [J. Appl. Entomol. 125:515-518](https://wiki.pestinfo.org/wiki/Journal_of_Applied_Entomology_-_Zeitschrift_f%C3%BCr_angewandte_Entomologie_(2001)_125,_515-518). [SINGLE, ABSTRACT]
- A Croatian study supports 7 °C for moth appearance — [Hrčak](https://hrcak.srce.hr/file/225283). An Austrian study reports temperature-sum models mismatching first occurrence of L. botrana and E. ambiguella — [OENO One](https://oeno-one.eu/article/view/8269). [ABSTRACT]
- The spread across thresholds (6.45, 7, 10 °C) and start dates means targets are not interchangeable.

**Bactrocera oleae**
- Monti Pisani and Castagneto, Tuscany: Marchini et al. 2017 tested a model starting 15 October (autumn oviposition) to predict 50% of cumulative spring catches, using 379.01 ± 41.264 DD at base 8.99 °C from Crovetti et al. 1982. Errors were 12 and 22 days in 2008, and 2 and 14 days in 2009 (the sign of the 14 was lost in text extraction, likely −14) — [Bull. Insectol. 70:121-128](https://archive.bulletinofinsectology.org/pdfarticles/vol70-2017-121-128marchini.pdf). [SINGLE]
- A 2021 review cites 10-15% model error and says starting date must be calibrated, with winter and spring flight monitoring needed — [PMC8472548](https://pmc.ncbi.nlm.nih.gov/articles/PMC8472548).
- Gonçalves & Torres 2011 (NE Portugal, 2005-2008) built a °DD model for the second generation. It predicted infestation in 2006 and 2008 but performed poorly in 2007, an abnormally cool summer averaging 20.7 °C — [J. Pest Sci. 84:187-197](https://wiki.pestinfo.org/wiki/Journal_of_Pest_Science_(2011)_84,_187-197); [review](https://pmc.ncbi.nlm.nih.gov/articles/PMC8472548). 1 January as the start is attributed to this work by a later paper — [SciELO](https://www.scielo.br/j/rbf/a/cpS8GFcjzLmHHwyyMWXHJsh/). [ABSTRACT]
- A Turkish study reportedly used lower 9.5 °C and upper 30 °C, starting at 10% adult capture of the first flight, with 3 flights a year — [DergiPark](https://dergipark.org.tr/tr/download/article-file/154065). [ABSTRACT, search snippet only; PDF text could not be extracted]
- UC IPM: no treatment thresholds exist for olive fly, and trap numbers do not relate to fruit damage. McPhail traps are placed by 1 March, and fruit checks are used. One UC source advises starting at pit hardening where damage has occurred before — [UC IPM](https://ipm.ucanr.edu/PMG/r583301311.html); [Pest Note](https://ipm.ucanr.edu/PMG/PESTNOTES/pn74112.html). A 2010 UC-affiliated report listed DD models as a research need. Current status was not confirmed — [UC search result](https://www.ccfruitandnuts.ucanr.edu/sites/default/files/2014-12/203835.pdf). [UNCONFIRMED document mapping]
- Burrack & Zalom 2005 used hourly data from 27 sites in 15 counties (2002-2005) to estimate thresholds and a generation model with independent validation. The abstract gives no numbers — [ESA 2005](https://studio.m-anage.com/esa/2005/techprogram/paper_21827.htm). [ABSTRACT]

**Leafhoppers**
- Quebec vineyards (Bostanian et al. 2006): base 8 °C from 1 March. Start monitoring at 630 DD (5%), peak 850-860 DD (50%), end 1140 DD (95%) — [Environ. Entomol. 35:1477](https://bioone.org/journals/environmental-entomology/volume-35/issue-6/0046-225X(2006)35[1477:MLNITV]2.0.CO;2/Modeling-Leafhopper-Nymphs-in-Temperate-Vineyards-for-Optimal-Sampling/10.1603/0046-225X(2006)35[1477:MLNITV]2.0.CO;2.full). [ABSTRACT]
- Western grape leafhopper: lower 10.3 °C, generation 544.4 °C-days — [UC IPM](https://ipm.ucanr.edu/weather/phenology-models-description/western-grape-leafhopper/).
- Erasmoneura vulnerata: prior work used 10 °C, and a 2026 model uses non-linear development — [De Francesco et al. 2026](https://iris.unibs.it/retrieve/365b514f-734c-4352-87d9-29ac1e45eda3/2026%20-%20DeFrancesco%20-%20PMS%20-%20Modelling%20the%20phenology%20of%20the%20grapevine%20leafhopper%20Erasmoneura%20vulnerata.pdf). [ABSTRACT]

**Tuta absoluta**
- Egg-to-adult about 416.7 DD at 8.0 °C ([Krechemer & Foerster 2015](https://doaj.org/article/ba1355acc957464b935a6d214c837371)).
- About 442 DD at 7.78 °C ([Barker & Coop white paper](https://instar.biossys.oregonstate.edu/wea/Tuta_absoluta_white_paper.pdf)).
- 460 DD per generation at 8.0 °C in CLIMEX ([PLoS ONE table](https://pmc.ncbi.nlm.nih.gov/articles/PMC4529269/table/pone.0135283.t001)).
- All [ABSTRACT]. The OSU model PDF was fetched but its text could not be extracted, so the cutoff and biofix in the model are unconfirmed.

### Inferences
- Calendar start from 1 January is defensible only with a target fitted from that date, and only in a similar climate. NE Portugal's continental climate differs from coastal Crete. Overwintering adults and winter activity in mild climates also weaken the premise of a single reset.
- The Tuscan results (errors of 2-22 days with a biological start date) show that a DD window for olive fly should be treated as a broad window rather than a date.
- A trap catch or field observation should be able to override or re-anchor a calendar start when available, as in the USPEST mixed scheme. This follows the practice in the cited sources but is not a published olive fly protocol.
- Multi-generation pests with overlapping flights (olive fly 3-5 generations in California, per Burrack & Zalom) make later "generation" targets progressively less tied to any single cohort.

### Gaps
- The full text of Gonçalves & Torres 2011 was not read, so several items are unconfirmed:
  - The 1837 ± 36 and 2046 ± 34 °DD targets that the code attributes to it.
  - Its base temperature.
  - Its daily calculation method.
  - Its temperature source.
- The code comment citing "Nehmeh et al. 2025, Syria" for a generation constant of about 850-950 °DD could not be located in one targeted search. [UNCONFIRMED]
- Greek national olive fly (δακοκτονία) trap and spray protocol documentation was not retrieved.
- No lower threshold or biofix was found for Empoasca vitis or Jacobiasca lybica.
- No Crete-specific field validation of any of these pest models was found. Neuenschwander & Michelakis 1979 (field thresholds and day-degree requirements for eggs and larvae in Crete) was seen as a citation only, and its values were not obtained.

## Heat suppression and upper thresholds for Bactrocera oleae and similar

### Takeaway
Well-supported values: normal adult activity about 20-30 °C, activity ceasing near 35 °C, and sustained daily peaks at 35 °C or above lethal to eggs and first instars. Short pulses up to 38 °C are survivable. The effect depends on exposure duration, water and food, and acclimation, so a simple instantaneous upper threshold on degree-days does not represent it. Heat suppression is mainly a survival and reproduction effect, which a developmental cutoff cannot capture.

### Cited Findings
**Thresholds used in models**
- Lower 8.99 °C and upper 30 °C were estimated in the laboratory by Crovetti et al. 1982, cited in a later olive moth paper. The cutoff type is not stated — [SciELO](https://www.scielo.br/j/rbf/a/cpS8GFcjzLmHHwyyMWXHJsh/). [ABSTRACT, secondary]
- Genç & Nation: lower thresholds of 9.19 (eggs), 13.94 (larvae) and 12.36 °C (pupae), with optimum 27 °C for immature development — [cited in review, core.ac.uk](https://core.ac.uk/download/478323155.pdf). [ABSTRACT, secondary; direct fetch returned 403, stage labels inconsistent across summaries]
- Iran (Ikemoto linear model): total immature 348.51, 396.94 and 338.40 DD at thresholds of 9.31, 8.41 and 9.39 °C across three regions — [JESI](https://jesi.areeo.ac.ir/article_126501.html). [SINGLE, ABSTRACT]

**Effects of heat**
- Laboratory cycles (Wang et al. 2009, Environ. Entomol. 38:1496):
  - Low 18.3 °C with high 35.0 °C: about 50% of eggs died, and the rest died as first instars after hatching.
  - High 37.8 °C: no egg hatch.
  - Egg maturation was delayed and reduced but still possible with water and food.
  - Egg-laying occurred in the cold phase of the cycle.
  - Field cages in the Central Valley: adults survived 1-2 weeks, no offspring developed in midsummer 2007, and under 2% reached adults in summer 2008.
  - The study area has maximum temperatures consistently above 35 °C — [Wang et al. 2009](https://academic.oup.com/ee/article/38/5/1496/410338). [SINGLE, ABSTRACT]
- Adults die after several days at about 35 °C without both water and honey, but survive with resources. Normal adult activity is 20-30 °C, frantic movement above that inhibits oviposition, and activity ceases at 35 °C — [Wang et al. 2009, AESA 102:727](https://academic.oup.com/aesa/article-pdf/102/4/727/19334499/aesa102-0727.pdf). [ABSTRACT]
- Two-hour pulses at 34-42 °C: larvae and adults kept high survival up to 38 °C, and pupae up to 40 °C. Female longevity and egg production fell substantially after stress. Acclimation at 33 °C for 1-3 days raised adult survival — [J. Appl. Entomol. 135:359-366](https://wiki.pestinfo.org/wiki/Journal_of_Applied_Entomology_(2011)_135,_359-366). [SINGLE, ABSTRACT]
- A Greek organic orchard study attributed high mortality of adults, eggs and larvae to sustained heat, with mean maxima generally 34-35 °C from July to September — [journal record, DOI 10.1080/10440046.2012.672377](https://informahealthcare.com/doi/abs/10.1080/10440046.2012.672377). [SINGLE, ABSTRACT]
- High summer temperature and low humidity can hamper degree-day models for the second generation (Portugal) — [Gonçalves & Torres via index](https://peeref.com/zh/works/12343980). [ABSTRACT]
- In Tuscany in 2014, temperatures rarely exceeded 35 °C, adult activity was unaffected, and losses were significant — [review](https://pmc.ncbi.nlm.nih.gov/articles/PMC8472548).
- Gutierrez et al. 2009 (physiologically based model, Italy): +2 and +3 °C become unfavourable, especially in the south — [review](https://pmc.ncbi.nlm.nih.gov/articles/PMC8472548).
- Temperatures above 12 °C are cited as favourable for autumn oviposition — [review](https://pmc.ncbi.nlm.nih.gov/articles/PMC8472548).

**Similar pests**
- Lobesia upper threshold 30 °C — [UC IPM](https://ipm.ucanr.edu/Invasive-and-Exotic-Pests/European-grapevine-moth/European-grapevine-moth/).
- Olive moth (Prays oleae) study: the "sine wave with vertical shift" with upper 30 °C used daily averages and did not correct for slowdown near the upper threshold, which likely inflated totals, as the authors note — [SciELO](https://www.scielo.br/j/rbf/a/cpS8GFcjzLmHHwyyMWXHJsh/).
- Non-linear rate functions capture decline above the optimum, which linear degree-days do not — [Maiorano et al. 2012](https://consensus.app/papers/details/28ecd448d9bf51d7b225045c6f0387a3/?utm_source=claude_code).

### Inferences
- Development (degree-day clock) and survival/reproduction (population) are separate questions. Summer heat mainly affects the second. A horizontal cutoff at 30 °C keeps the clock running through weeks where eggs may be dying, so a DD window can indicate a generation that largely does not exist. A separate suppression layer is the better structure than switching to vertical cutoff, and vertical cutoff would also break compatibility with the published targets.
- Suppression should reflect duration, not a single reading. Evidence separates 2-hour pulses up to 38 °C (survivable) from daily peaks of 35 °C sustained over days (lethal to immatures). A rule based on several consecutive days of Tmax at or above about 35 °C fits this. The exact day count is not given by any source and would be a local judgment.
- Central Valley results are the extreme case, with maxima consistently above 35 °C and low humidity. They may overstate suppression in humid coastal Crete, where sea-moderated peaks and irrigated orchards with water and food sources may support survival. This is a hypothesis.
- Canopy shade and fruit interior may be cooler than station air on hot days, or the fruit may be warmer in sun. No olive-specific data were obtained.

### Gaps
- No Crete-specific summer mortality function or threshold was found.
- Exact upper development threshold from Crovetti 1982 and its cutoff type are known only through secondary citation.
- No published olive fly operational model was found that states its cutoff method. Author names for the 2011 J. Appl. Entomol. study were not retrieved.
- The role of relative humidity has no quantified threshold in the sources read. The 2021 review gives none for B. oleae.

## Must models published for a method be run with that same method for their published thresholds to hold?

### Takeaway
Yes as the default rule, and it is a clear consensus: use the method the model was derived or validated with. Justified exceptions are single vs double substitution and cases where you have shown equivalence on your own data. Lower thresholds from laboratory physiology are method-independent as biology, but DD targets fitted in the field are tied to threshold, cutoff, method, start date and temperature source together. Running hourly data against a daily-derived target is acceptable only as an approximation, with an expected offset that can be measured.

### Cited Findings
- [CONSENSUS] UC IPM: use the same method used in developing the organism's growth relationships, because mismatched methods can produce different results — [UC IPM concepts](https://ipm.ucanr.edu/WEATHER/ddconcepts.html).
- [CONSENSUS] OSU: most models should use the method they were derived or validated with, but substituting single for double methods is generally fine — [OSU FAQ](https://hopper.science.oregonstate.edu/wea/weafaq.html). A model is generally valid only with degree-days from the developer's method — [OSU Calculation Methods](https://hopper.science.oregonstate.edu/CalcMethods.html).
- UC IPM: the lower threshold is a physiological property that does not depend on the calculation method, while the meaning of the upper threshold depends on the cutoff used — [UC IPM concepts](https://ipm.ucanr.edu/WEATHER/ddconcepts.html).
- McMaster & Wilhelm: two interpretations of one equation give different totals, so authors must state the method exactly — [Agric. For. Meteorol. 87:291-300](https://scilit.com/publications/72a344f05171f4556a41da5f30cb833c). [ABSTRACT]
- Snyder et al. 1999: field-derived thresholds depend on the calculation procedure used to fit them, and a threshold of zero predicted almost as well. Fitted thresholds are thus partly statistical, not pure biology — [Int. J. Biometeorol.](https://link.springer.com/doi/10.1007/s004840050102). [ABSTRACT]
- Roltsch et al.: in summer, method differences are small at interior California sites. This supports approximate transfer in warm seasons, not in cool ones or on coasts — [UC IPM](https://ipm.ucanr.edu/WEATHER/ddeval.html).
- Worner 1992: acceleration at low and retardation at high temperatures follow from non-linearity. Models should not be selected solely on constant-temperature fit — [Environ. Entomol. 21:689](https://academic.oup.com/ee/article/21/4/689/417091). [ABSTRACT]
- There is disagreement on how much fluctuation matters:
  - One review concludes average-based indices cannot give quantitative predictions when fluctuation matters — [J. Appl. Entomol. review, reached by search](https://link.springer.com/article/10.1007/s10340-024-01758-1). [UNCONFIRMED source mapping]
  - A 2021 Ecology Letters synthesis finds rates generally unaffected once direct temperature effects are discounted — [PubMed 34036719](https://www.pubmed.gov/34036719/). [ABSTRACT]
  - A PLoS ONE 2015 study found that Jensen's inequality alone does not fully explain constant vs alternating differences — [DOAJ](https://doaj.org/article/c3aa1f1c06f748cfb8da7ee4bbfacd21). [ABSTRACT]

### Inferences
- A published DD target is a package: base, upper threshold, cutoff, daily method, start date, temperature source, and the region it was fitted in. Changing any one of these can move the target.
- For the system described (hourly accumulation, horizontal cutoff), the closest published equivalent is single sine horizontal. Targets fitted with plain daily averaging differ in two ways: more on cool days near the base, and hot days are not cut off. For olive fly with base about 9 °C and a 1 January start, both effects occur before the target is reached.
- The accumulated difference can be measured instead of debated. The same sensors can compute a parallel daily series using the published method (from sensor Tmax/Tmin or daily mean), so the system can report the offset between the hourly sum and the published method per field and season. If the offset is small relative to the model's stated error (for example ±36 DD, about ±2 days in summer, if the code's Gonçalves figures are right), hourly accumulation can stay with documented justification. If not, run the published method for that target, or recalibrate.
- Sensor Tmax/Tmin from sparse uplinks will understate daily range compared with a standard station's true extremes (see NEWA above), so a parallel daily calculation needs enough samples per day. This matters most on days with packet loss.
- Models with no stated method (common for the olive fly literature as read here) cannot be matched exactly. In that case UC IPM's default applies, and the model should be labelled as of uncertain compatibility.

### Gaps
- Daily calculation method for the Crovetti 1982 and Gonçalves & Torres 2011 values was not confirmed. This is the most decision-relevant gap, since the system's olive fly targets depend on them.
- No source was found that quantifies the shift in published targets when moving from Tmax/Tmin sine to true hourly summation for any of the target pests.
- Crop stage models were covered only generally (McMaster & Wilhelm, Purcell, Felber, Snyder). No specific olive or vine stage model parameters were checked.
- Model parameters for Lobesia, Tuta and leafhoppers in `analysis/runPerTich.js` were not cross-checked in this research. Only the olive fly entry was read.
