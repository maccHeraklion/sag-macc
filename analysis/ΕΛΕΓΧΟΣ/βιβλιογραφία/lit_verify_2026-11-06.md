# Adversarial literature verification — disease DSS statements S1–S9 (2026-11-06)

Evidence tags: [FT] full text read this pass · [ABS] abstract only · [EXT] official extension/operational page read this pass · [SEC] secondary (search-result snippet, slide deck, vendor page, or a page that refused direct fetch) · [RECALL] number recalled from memory, NOT verified this pass — check before use.

Tool limits met this pass: several WebFetch calls were refused by the fetch model (MSU late-blight page, MSU asparagus TomCast PDF), several sites returned 403/404 (netreefruit.org, OMAFRA, ontario.ca, APS 1980 PDF, Wikipedia TOMCAST, URI Mills table). Where that happened the value is tagged [SEC] or listed under "NOT FOUND".

---------------------------------------------------------------------------------------------------
## S1 — Water stress must not multiply risk for biotrophs; is any multiplier justified?

VERDICT: PARTLY SUPPORTED (direction supported for biotrophs AND for the two necrotrophs most relevant here; one extension source contradicts for tomato powdery mildew; no published model with a x3.95-type multiplier was found).

Evidence FOR (stress lowers or does not raise infection):
- Tomato, Oidium neolycopersici + Botrytis cinerea: drought gave ~2x endogenous ABA, "50% reduction in B. cinerea infection" and significant suppression of O. neolycopersici (cv. Moneymaker). Achuo et al. 2006, Plant Pathology [ABS] https://consensus.app/papers/details/246d7d7b6c925b4bbd58233fcf38d869/?utm_source=claude_code
- Tomato powdery mildew: drought decreased fungal infection in susceptible Moneymaker, biomass tending lower as drought severity increased; no loss of resistance in ol-2 / Ol-4 lines. Sunarti et al. 2022, Front Plant Sci [ABS] https://consensus.app/papers/details/f2d4dd626c065bdb9dd192cf13166e31/?utm_source=claude_code
- Leveillula taurica on pepper: host water stress during sporulation AND low RH during germination both decreased conidial germination and germ-tube growth; offered as explanation of LOW incidence in the dry season in Ghana. Caesar & Clerk 1985, Botany [ABS] https://consensus.app/papers/details/f6e5ef1a7fb357e0bbae178c5fa86751/?utm_source=claude_code
- L. taurica on tomato, air humidity (not host stress): RH 20–40 % reduced germination and lesion growth; RH 50–70 % optimal; RH 80–90 % good for germination but limited lesion growth; >= 30 °C deleterious; 2–3 daily exposures of >= 2 h at 35 °C suppressed disease 70–92 %; lesion growth faster at 20 than 25 °C. Guzmán-Plazola et al. 2003, Crop Protection [ABS] https://consensus.app/papers/details/faa052fdbb3f556e927dea86e101aff4/?utm_source=claude_code
  -> the "favoured by dry conditions" reputation of L. taurica is about moderate AIR humidity, not about a water-stressed host.
- L. taurica pepper: optimal RH for germination 85 %, germination increases with RH; symptoms from 8 days, peak severity 15 days after inoculation. Kim et al. 2009 [ABS] https://consensus.app/papers/details/6ed46ecc709a5808ad3e8186bf0b2a15/?utm_source=claude_code
- UC IPM pepper powdery mildew guideline: infection 18–33 °C (64–91 °F); >95 °F temporarily slows; "high humidity favors germination of conidia", infection under high and low humidity; secondary infections every 7–10 days; older leaves just before/at fruit set; NO mention of plant stress. [EXT] https://ipm.ucanr.edu/agriculture/peppers/powdery-mildew/
- Grapevine downy mildew: drought and drought+heat lowered stomatal conductance, restricting P. viticola entry and lowering sporulation rate; stilbenes +36 % (drought), +57 % (heat), +113 % (both). Fanton et al. 2026, Tree Physiology [ABS] https://consensus.app/papers/details/e948309b148054d28bc08ba3ad869c66/?utm_source=claude_code
- Grapevine downy mildew: deficit irrigation (40 % of full) — resistance when inoculated in planta, but INCREASED susceptibility of leaves inoculated in vitro. Heyman et al. 2021, Plants [ABS] https://consensus.app/papers/details/44271a494b9753ad944e495d69f874bf/?utm_source=claude_code
- Grapevine powdery mildew + grey mould: lower vegetative growth = lower susceptibility to both; water stress at flowering is the key driver (source–sink). Guilpart et al. 2017 [ABS] https://consensus.app/papers/details/85cc8bec43a9580e93e359cb3f9a8cd9/?utm_source=claude_code
- Olive anthracnose (Colletotrichum acutatum s.l.), cv. Arbequina, 3 years: moderate water stress (no irrigation from pit hardening) gave on average 45 % lower incidence and 30 % lower severity (AUDPC), thicker cuticle, higher catalase/peroxidase. Conde-Innamorato et al. 2024, EJPP [ABS] https://consensus.app/papers/details/884d22d868fa5cb18eb8c0ea79fe110b/?utm_source=claude_code

Evidence AGAINST / qualifying:
- OMAFRA (Ontario) tomato guide, via search snippet (page itself returned 403): powdery mildew "favours warm, humid conditions and fields under water stress. Leaf wetness is not required." [SEC] https://www.omafra.gov.on.ca/IPM/english/tomatoes/diseases-and-disorders/powdery-mildew.html
- Review: drought is "a context-dependent damper and aggravator"; nature, intensity and timing decide the sign. Choudhary et al. 2024, PCE [ABS] https://consensus.app/papers/details/1e7ed148d30e599495e00fee526e42ec/?utm_source=claude_code
- Group where drought DOES predispose: canker/dieback and latent wood pathogens (Botryosphaeria, Sphaeropsis, Cytospora, Biscogniauxia) — "large majority" of ~100 studies. Desprez-Loustau et al. 2006, Ann For Sci [ABS] https://consensus.app/papers/details/ddcb439e90f953d0ac0a0c641ae1d753/?utm_source=claude_code
- Alternaria solani on tomato: susceptible at all stages, susceptibility increases as plants mature; 4 h wetness enough on a hybrid, 6 h on another cv.; severity rises up to 24 h wetness. Vloutoglou & Kalogerakis 2000 [ABS] https://consensus.app/papers/details/815a9b97dcba5ce5b2a5a835a277680d/?utm_source=claude_code  (this is an AGE effect; a water-stress or low-N multiplier for A. solani was NOT verified this pass)

Is a single multiplier up to x3.95 used by any published model? NOT FOUND. None of the operational systems reviewed (TOMCAST, Gubler–Thomas, BLITECAST/Simcast, Hutton, Mills/NEWA, 3-10, UCSC/vite.net, VitiMeteo, EWMPICDW, CDM ipmPIPE) contains a host-water-stress multiplier. vite.net lists "abiotic stress" as a separate module, not a multiplier on infection risk [SEC].
Spilocaea oleagina: no stress evidence found either way this pass.

RISK IF IMPLEMENTED AS PROPOSED: removing the multiplier cannot hide a wetness-driven infection, so missed-infection risk is low; it removes a source of false alarms. Two cautions: (a) do not go further and REDUCE risk under stress — evidence is context dependent (Heyman in vitro; OMAFRA tomato); keep stress neutral. (b) if a stress term is kept anywhere, restrict it to wood/canker/root pathogens and express it as plant condition, not as a multiplier on leaf-infection hours.

---------------------------------------------------------------------------------------------------
## S2 — Magarey W(T) lab minimum as the wetness requirement for an operational ALERT

VERDICT: NOT SUPPORTED as accepted practice when used alone (PARTLY: W(T) is an accepted "infection possible" screen; operational alerts add inoculum, sporulation, phenology, or severity classes).

What operational systems actually use:
- Cucurbit downy mildew, CDM ipmPIPE: risk = known source fields + trajectory (HYSPLIT / FLEXPART) + spore survival + deposition + infection conditions; 48 h horizon; guides the FIRST spray. [SEC] https://portal.nifa.usda.gov/web/crisprojectpages/0221747-enhancing-the-cucurbit-downy-mildew-forecasting-system.html ; https://extension.unh.edu/blog/2021/07/cucurbit-downy-mildew-forecast
- Greenhouse cucumber, EWMPICDW (Zhao, Li, Yang, Sun 2011): LWD from sensor + RH threshold combined; infection submodel = threshold on LWD x mean T during LWD; incubation submodel (nonlinear in T); 4 years, 2 sites, Beijing; warning > 2 d before symptoms; positive warning moves probability of disease 0.68 -> 0.96. Numeric LWD x T cut-offs are NOT in the abstract. [ABS] https://consensus.app/papers/details/13093c25f5ca5b8a87d0a27a65294723/?utm_source=claude_code
- Same family coupled to a climate model with 72 h forecast: "After several false-positive reports, one positive report ... fitted the first observation" (24 Apr 2021). Liu et al. 2022 [ABS] https://consensus.app/papers/details/b4c1b7b9dac65a3999cb87d67f8a59ac/?utm_source=claude_code
- Lab minima for comparison: P. cubensis minimum wetness 12, 4, 2.5, 1, 1, 6 h at 5, 10, 15, 20, 25, 30 °C; sporulation plentiful only when wet or RH = 100 %, few sporangia at RH 90 %; sporulation starts 4 h after wetting in darkness. Sun et al. 2017 [ABS] https://consensus.app/papers/details/cc4918b5141f504099c42b360bdf9512/?utm_source=claude_code ; risk charts on a severity criterion (15 % leaf area): cucumber 2 h at 20 °C, 3 h at 25 °C; squash 4 / 7 h; cantaloupe 8 / 15 h. Neufeld & Ojiambo 2012 [ABS] https://consensus.app/papers/details/363da66238035df0be021b4e1720e2ad/?utm_source=claude_code
- Ontario greenhouse cucumber page (snippet; page refused): ~12 h at 10–15 °C, 6 h at 15–19 °C, 2 h at 20 °C. [SEC] https://ontario.ca/page/downy-mildew-greenhouse-cucumber
- Grape downy mildew primary: "10:10:24" = T >= 10 °C and >= 10 mm rain in 24 h; zoospore release once T > 8 °C (optimum 18–22 °C); infection completes if foliage stays wet the last 8 h. Secondary: RH >= 98 %, T >= 13 °C (optimum 20–25 °C), >= 4 h darkness, leaves wet 2–3 h pre-dawn. Oilspots 4–21 d. AWRI Viti-note 2010 [EXT, FT] https://www.awri.com.au/wp-content/uploads/downy_mildew_characteristics.pdf
- European "3-10": shoots >= 10 cm, T > 10 °C, 10 mm rain in 24–48 h. [SEC] https://internationalwinechallenge.com/Canopy-Articles/downy-mildew-with-climate-change-is-the-3-10-model-still-valid.html
- UCSC mechanistic model (Rossi 2008): cohorts of oospores, hourly step; 12 years, 43 vineyards; 86 % of cohorts FAIL (5.6 % sporangia die, 83.6 % zoospores die before dispersal, 10.8 % no infection); false positives mostly early season / isolated weak rain. [ABS] https://consensus.app/papers/details/dbcaa6fbeecb5d6586e68ba5245b64ae/?utm_source=claude_code ; validation in 100 vineyards: TPP 0.99, TNP 0.87, FPP 0.13, FNP 0.005. Caffi et al. 2009 [ABS] https://consensus.app/papers/details/7e0761d3ee2e58c0841fea549347ced6/?utm_source=claude_code ; 3-10 and EPI "too simplistic", EPI needs local calibration, DMCast oospore step needs validation. Caffi et al. 2007 [ABS] https://consensus.app/papers/details/6f9834ede6fa52e788df8518648af47d/?utm_source=claude_code
- Mediterranean test (Spain, 8 plots, 2018–19): Milvit and VitiMeteo-Plasmopara both over- and under-predicted; Goidanich ONLY over-predicted; local model matched 56.25 % (75 % in humid 2018, 37.5 % in dry 2019). Puelles et al. 2023 [ABS] https://consensus.app/papers/details/0b8757a02af35b2fad1527cd13a508e5/?utm_source=claude_code
- P. viticola wet-period dynamics: optimum 15–20 °C, zoospores released within 1 h, most infections done by 3 h; copper post-inoculation efficacy < 20 % after 6 h at 20 °C. Caffi et al. 2016 [ABS] https://consensus.app/papers/details/6d3af1f2429f5ebab579e897956eb9f8/?utm_source=claude_code
- Late blight, Hutton Criteria (AHDB, 2017): two consecutive days, each with minimum T >= 10 °C and >= 6 h RH >= 90 %; replaced Smith Period (same, but >= 11 h); tested on > 2000 outbreak reports. [SEC — AHDB page listed, read via search summary] https://archive.ahdb.org.uk/development-and-implementation-of-a-new-national-warning-system-for-potato-late-blight-in-great-britain-hutton-criteria
- BLITECAST: accumulates severity values from hours RH >= 90 % x temperature band; first spray at 18 severity values. With RH >= 80 % from out-of-canopy stations it FAILED to forecast blight east of the Cascades; one in-canopy site missed blight that developed in neighbouring fields (site not representative). Shock et al. 1997 [FT] https://agsci.oregonstate.edu/sites/agsci.oregonstate.edu/files/malheur/attachments/ar/1997-21-BlitecastPredicting.pdf
  MSU variant uses RH >= 80 %, bands 45–53 / 54–59 / 60–80 °F, values 0–4, starts 1 May. [SEC] https://www.canr.msu.edu/psbp/resources/svalue
  [RECALL, unverified] Wallin table hours RH >= 90 %: 7.2–11.6 °C: <=15 h=0, 16–18=1, 19–21=2, 22–24=3, >=25=4; 11.7–15.0 °C: <=12=0, 13–15=1, 16–18=2, 19–21=3, >=22=4; 15.1–26.6 °C: <=9=0, 10–12=1, 13–15=2, 16–18=3, >=19=4; Hyre rain-favourable day: 5-day mean T < 25.5 °C and 10-day rain >= 30 mm; first spray after 10 consecutive rain-favourable days or 18 severity values.
- Simcast / BlightPro: blight units (weather x cultivar resistance) and fungicide units (weathering of last spray); trigger 30 blight units for a susceptible cultivar; 3-day forecast shown. [SEC] https://rvpadmin.cce.cornell.edu/pdf/veg_edge/pdf118_pdf.pdf ; original Simcast over-sprayed moderately/highly resistant cultivars and was adapted. Grünwald et al. 2002 [SEC] https://www.apsnet.org/publications/plantdisease/2002/October/Pages/86_10_1163.aspx
- NegFry: NOT FOUND this pass.
- Botrytis, grape: berries infected after 4 h wetness at all temperatures 12–30 °C; logit(infection) = f(wetness x temperature), R2 = 0.75; used as an index in Chile: 2–4 sprays (1991–92) and 0–5 (1992–93) vs 6–9 and 4–5 on the standard programme, same disease at harvest. Broome et al. 1995 [ABS] https://consensus.app/papers/details/3eb806b51d7a56a4ab11922f82cb182e/?utm_source=claude_code ; across 101 site-years, RH- and wetness-duration variables predicted bunch rot epidemics; Bacchus/Broome indices did not always beat their components. Hill et al. 2019 [ABS] https://consensus.app/papers/details/f126675f03b0575a91a5a3c7f86ce191/?utm_source=claude_code
- Botrytis, strawberry flowers: optimum 20 °C, 100 % flower infection at 24 h wetness; fruit infection 60 % at 32 h; much reduced > 25 and < 15 °C; latent flower infections. Bulger, Ellis & Madden 1987 [ABS/partial text] https://consensus.app/papers/details/2f9d61617bb55cb78628b0d00119d85d/?utm_source=claude_code
- BOTMAN, Yunis: not re-read (Yunis in previous pass).
- Apple scab, revised Mills (Penn State): hours of wetting 41 (34 °F), 35 (36), 30 (37), 28 (39), 21 (41), 18 (43), 15 (45), 13 (46), 12 (48), 11 (50), 9 (52), 8 (54–56), 7 (57–59), 6 (61–75), 8 (77), 11 (79); days to lesions 17 (43–48 °F), 16 (50), 15 (52), 14 (54–56), 12–13 (57–59), 9–10 (61–75). Single minimum, no light/moderate/severe classes on that page. [EXT] https://extension.psu.edu/tree-fruit-disease-an-apple-scab-review ; MacHardy & Gadoury 1989: ascospores need ~3 h less than Mills; conidia ~2.5 h MORE than ascospores; count night rain from 07:00. [SEC abstract] https://doi.org/10.1094/phyto-79-304

RISK IF IMPLEMENTED AS PROPOSED: Wmin (1–2 h at optimum for downy mildews) will be met on most dew nights in a plastic greenhouse -> daily alarms and alarm fatigue (Liu 2022 "several false-positive reports"; Goidanich only over-predicts in Mediterranean plots; 86 % of P. viticola cohorts fail). Safeguards used in practice: (1) inoculum gate (regional/own-farm report, or prior sporulation night: RH >= 98 %/wet, darkness >= 4 h, T >= 13 °C for P. viticola); (2) phenology gate; (3) severity classes or an accumulated index instead of a yes/no on the minimum; (4) treat W(T) as "infection possible", not as "spray".

---------------------------------------------------------------------------------------------------
## S3 — Polycyclic diseases tracked with multi-day accumulators

VERDICT: SUPPORTED.

TOMCAST / FAST DSV table (UC IPM "Modified DSV Table", citing Madden, Pennypacker & MacNab 1978, Phytopathology 68:1354–1358) [EXT] https://ipm.ucanr.edu/DISEASE/DATABASE/dsvtable.html
Mean T during wetness | hours of leaf wetness giving DSV 0 / 1 / 2 / 3 / 4
13–17 °C | 0–6 / 7–15 / 16–20 / 21+ / —
18–20 °C | 0–3 / 4–8 / 9–15 / 16–22 / 23+
21–25 °C | 0–2 / 3–5 / 6–12 / 13–20 / 21+
26–29 °C | 0–3 / 4–8 / 9–15 / 16–22 / 23+
Spray threshold: 15–20 DSV accumulated since last spray (15, 20, 25 tested by MSU; 20 used for carrot) [EXT] https://metos.global/en/disease-models-carrot/ ; NIBIO VIPS: lower T threshold 13.0 °C "as in the original TOMCAST", threshold DSV 20, green < 15, yellow 15–threshold, reset to 0 after spray [EXT] https://gitlab.nibio.no/VIPS/models/java/Model_ALTERNARIA/-/raw/main/README.md
Limits: in central-west Brazil TOMCAST was "not a useful tool" for Septoria leaf spot — DSV 15 demanded the most sprays [SEC] https://repositorio.bc.ufg.br/items/ab6c1823-75eb-4a7f-a09d-294e6ba062c1 ; no temperature band below 13 °C or above 29 °C; needs hours of wetness, so inherits every wetness-estimation error (S6).

Gubler–Thomas (UC IPM) [EXT] https://ipm.ucanr.edu/DISEASE/DATABASE/grapepowderymildew.html
- Ascospore stage: daily mean T + hours leaf wetness, 2/3 of Mills hours: 40 h at 42 °F; 30 h at 44; 20 h at 48–49; 19.3 h at 50; 16 h at 55; 12 h at 63–75; 12.7 h at 76; 14 h at 77; 17.3 h at 78.
- Conidial stage start: three consecutive days each with >= 6 consecutive hours at 70–85 °F (21–29.4 °C); each adds 20.
- Then +20 for each day with >= 6 continuous hours 70–85 °F; −10 for a day with fewer than 6 such hours (band broken if T leaves it for > 45 min); −10 if T >= 95 °F (35 °C) for >= 15 min (so +10 net when both occur); bounded 0–100; max change −10 / +20 per day; reset to 0 after treatment.
- Index bands and intervals: 0–30 -> sulfur dust 14 d, micronised sulfur 18 d, DMI 21 d (or label maximum); 40–50 -> 10 / 14 / 17 d; 60–100 -> 7 / 10 / 14 d.
- Older UC Davis wording gives the band as 21–30 °C; slide deck: reproduction every 5 days at index 60–100 [SEC].
Limits: developed and validated in California only; described as "somewhat conservative"; high-temperature rule revised after lab work on lethal exposure times (Peduto et al. 2013) [SEC] https://www.apsnet.org/publications/plantdisease/2013/November/Pages/97_11_1438.aspx ; a Chilean evaluation exists (findings not retrieved). It is a grape (E. necator) index driven by temperature only — no validation for cucurbit powdery mildew or for humid greenhouse conditions was found. For P. xanthii: optimum T germination 24.4, infection 25.7, sporulation 22.3 °C; germination ~0 at 35 °C (Trecate et al. 2019 [ABS] https://consensus.app/papers/details/ea67f937fcab5e719956793497e38a51/?utm_source=claude_code); germination falls as VPD rises above ~0.13 kPa but still occurs at 2.53 kPa (Sapak et al. 2023 [ABS] https://consensus.app/papers/details/30529d6b0064541fb02d3f4807621d7d/?utm_source=claude_code).

RISK IF IMPLEMENTED AS PROPOSED: transplanting the grape index to L. taurica / P. xanthii would be unvalidated (different thermal optima: L. taurica is hurt from 30 °C, favoured at 20 °C). Safeguard: accumulators need a reset on treatment and a declared start condition (biofix/first symptom or phenology); validate thresholds locally before issuing spray intervals.

---------------------------------------------------------------------------------------------------
## S4 — Telling the grower the incubation/latent period after an infection event

VERDICT: PARTLY SUPPORTED (standard for downy mildews and apple scab; not meaningful for Botrytis; wide ranges for powdery mildews).

- Plasmopara viticola: oilspots 4–21 days depending on temperature (AWRI [EXT, FT], URL above); ~4 d at 20/25 °C vs 9 d at 10/15 °C; below 15 °C infection without sporulation [SEC] https://publicatt.unicatt.it/handle/10807/49251 . Müller–Sleumer / Goidanich table values: NOT retrieved.
- Operational display: VitiMeteo-Plasmopara is built on Müller's incubation curve (Müller & Rabanus 1923; Müller & Sleumer 1934); since 2009 with a 7-day weather forecast it computes incubation curves, infection risk and leaf area 7 days ahead. Bleyer et al. 2022 [ABS] https://consensus.app/papers/details/d6ca9c0f2f775f50a7a88307cf435a85/?utm_source=claude_code . FieldClimate/Metos shows an incubation curve running to 100 % = oilspots visible [SEC] https://metos.global/en/?p=49542 . EWMPICDW has an incubation submodel (Zhao 2011). UCSC model includes "appearance of disease symptoms" (Rossi 2008). RIMpro: NOT verified.
- Pseudoperonospora cubensis: lesions able to sporulate after 5 days at ~20 °C; severity read at 5 and 7 days after inoculation (Sun 2017; Neufeld 2012) [ABS]. A full latent-period-vs-temperature table: NOT FOUND.
- Phytophthora infestans: shortest incubation / latent period at 22 °C: 69.3 h / 93.3 h (US-1 on tomato leaflets) and 44.0 h / 68 h (BR-1 on potato). Maziero et al. 2009 [ABS] https://consensus.app/papers/details/4748a4516491578da525a3f6525a9d44/?utm_source=claude_code ; incubation falls exponentially with T; lineage means 59.3–71.7 h. Mizubuti & Fry 1998 [ABS] https://consensus.app/papers/details/26ca2ee6f8e45e9da6287c995d7941c1/?utm_source=claude_code
- Leveillula taurica: latency 18–21 days (BC Ministry fact sheet) [SEC] https://www2.gov.bc.ca/assets/gov/farming-natural-resources-and-industry/agriculture-and-seafood/animal-and-crops/plant-health/af_powdery_mildew_of_greenhouse_peppers_june_2024.pdf ; shortens with plant age from ~14.3 d (mid-vegetative) to ~8.6 d (fruiting), young plants immune (Plant Pathology 2003, 52:613–619) [SEC]; symptoms from 8 days (Kim 2009 [ABS]); secondary infections every 7–10 days (UC IPM [EXT]).
- Apple scab: days to lesions 9–10 (61–75 °F) up to 17 (43–48 °F) (Penn State [EXT]).
- Botrytis cinerea: flower infections stay latent until fruit ripens (Bulger 1987) -> no usable symptom date. On dead strawberry leaf tissue latent period 6–7 d at 5 °C, < 3 d at 15–22 °C (Sosa-Alvarez et al. 1995 [ABS] https://consensus.app/papers/details/a1d3ea6c6b3752df8756d9079341c10e/?utm_source=claude_code).
- Alternaria solani and Podosphaera xanthii latent periods vs temperature: NOT FOUND this pass.

RISK IF IMPLEMENTED AS PROPOSED: a single date implies certainty; most predicted infections never produce symptoms (86 % cohort failure, FPP 0.13), so "symptoms expected on day X" followed by nothing erodes trust. Safeguard: give a window ("look between day a and day b"), phrase it as a scouting prompt, recompute with observed temperature, and do not give a date for Botrytis.

---------------------------------------------------------------------------------------------------
## S5 — Dry reading ends the attempt for downy mildews but not Botrytis/Alternaria; fractional wet hours

VERDICT: PARTLY SUPPORTED (pathogen-specific dry-interruption tolerance is accepted; fractional per-hour credit is NOT the operational norm; "not for Botrytis" is too strong).

- Apple scab merge rule: count from first wetting; stop when RH falls below 90 %; consecutive wet periods are ADDED if leaves are re-wetted within 8 h of RH dropping below 90 %. Penn State [EXT] https://extension.psu.edu/tree-fruit-disease-an-apple-scab-review
- Jones et al. 1980 microcomputer Mills: wetness measured with RH < 90 % as the break [SEC] https://apsnet.org/publications/plantdisease/backissues/Documents/1980Articles/PlantDisease64n01_69.PDF ; the same paper reports infection after "a short leaf wetness period, 4 hr of dryness, and then an extended period of wetness" that Mills did not predict [SEC].
- NSW modified Jones model: wetness continues through intermittent dry periods until 8 h continuous dryness [SEC] https://caws.org.nz/PPQ567/PPQ 07-1 pp012-16 Penrose.pdf ; UC IPM: after quick sunny drying, danger assumed over 6 h after trees dried [SEC] https://ipm.ucanr.edu/agriculture/apple/apple-scab/ ; Vermont working group lists "combine dew events within 24 h?" as an open question [SEC] https://www.northeastipm.org/neipm/assets/File/TFWG-Apple-Scab-Secondary-Infection-Periods.pdf
- NEWA: "NEWA stations will calculate one minute of leaf-wetting as one hour"; NEWA counts all wetting hours, other extension versions discount periods < 4 h; RH >= 90 % hours accumulate much faster than sensor hours (385 h RH vs 175 h LW thresholds for sooty blotch/flyspeck); some pathologists doubt instruments track very high RH. AppleTalk summary (IPM Institute) [SEC, page read] https://ipminstitute.org/july-13-appletalk/
- Fractional accounting exists in research practice: number of 20-min intervals with RH > 90 % divided by 3 = hours (Lulu et al. 2008 [FT], URL in S6).
- Botrytis: "during germination ... durations of dryness (desiccation) can kill the spores" (Körner & Holst 2005 [ABS] https://consensus.app/papers/details/8405432c4ddd550bab0b0f66c502d6b3/?utm_source=claude_code); interrupted wet/dry periods of 5, 12, 24 h directly affected sporulation (Sosa-Alvarez 1995 [ABS]).
- Downy mildew: most P. viticola infections are complete within 3 h at 15–20 °C (Caffi 2016) -> a dry reading after 3 h does not undo the infection.
- RIMpro and Enviroweather merge rules: NOT FOUND.

RISK IF IMPLEMENTED AS PROPOSED: (a) fractional credit lowers sensitivity relative to NEWA's "any wet minute = wet hour"; with a 1–2.5 h requirement, rounding down can miss a real infection — safeguard: for short-requirement pathogens count an hour wet if any sample is wet (or >= 1 of n), use fractions only for long-requirement pathogens. (b) ending the attempt on one dry sample: a single dielectric dry reading on one sensor is not the canopy — require >= 1 full dry hour (or RH < 90 %) before reset, and never reset an infection that already met its requirement. (c) for Botrytis/Alternaria allow dry breaks but cap them (apple-scab practice 8 h).

---------------------------------------------------------------------------------------------------
## S6 — Estimating leaf wetness; RH >= 90 % underestimates; greenhouse wet at RH 80–85 %; sensor vs estimate

VERDICT: PARTLY SUPPORTED (multi-method estimation and "RH >= 90 % underestimates" supported outdoors; the 80–85 % greenhouse threshold is single-source and contradicted by condensation physics and by pathogen sporulation requirements; "healthy sensor beats estimate" is reasonable but a single sensor is not the canopy).

CART/SLD/DP (Gleason et al. 1994) as reproduced in Lulu, Sentelhas et al. 2008, Sci. Agric. 65:10–17 [FT] https://revistas.usp.br/sa/article/download/22384/24408/26016
- DPD >= 3.7 °C -> dry.
- DPD < 3.7 °C and wind U < 2.5 m/s -> wet if 1.6064·T^0.5 + 0.0036·T² + 0.1531·RH − 0.4599·U·DPD − 0.0035·T·RH > 14.46  ([RECALL] original constant 14.4674)
- DPD < 3.7 °C and U >= 2.5 m/s: RH < 87.8 % -> dry; RH >= 87.8 % -> wet if 0.7921·T^0.5 + 0.0046·RH − 2.3889·U − 0.039·T·U + 1.0613·U·DPD > 37.00
- DPD method (Gillespie 1993 / Rao 1998): onset DPD < 2.0 °C, dry-off DPD > 3.8 °C.
- Errors over turf (115 days, Brazil): mean error / MAE: RH > 90 % −2.78 / 2.86 h; DPD −2.04 / 2.33 h; CART −1.09 / 1.68 h; Penman–Monteith +2.30 / 2.60 h. Against in-vineyard sensors RH > 90 % underestimated by 2.4 h, DPD 1.9 h, CART 1.6 h.
- Gleason 1994: correct for 83.5 % of potential dew hours vs 78.6 % for RH > 90 % [SEC] https://www.apsnet.org/publications/plantdisease/backissues/Documents/1994Abstracts/PD_78_1011.htm
- Kim et al. (CART/SLD wind correction; fuzzy/VPD variant): in Costa Rica dry season all models underestimated on wet days: SkyBit −5.9, CART/SLD −4.5, CART/SLD/VPD −2.1 h/day; on dry days they overestimated by 0.8–2.0 h. [FT, extended abstract] https://ams.confex.com/ams/pdfpapers/49538.pdf
- Cotton: RH > 90 % underestimated by 6 %, DPD/CART/RES overestimated 2–7 %; MAE 1.27–2 h; station vs canopy differ strongly when LWD < 15–17 h. Sentelhas et al. 2005 [ABS] https://consensus.app/papers/details/c6b8e7438c325becbe8cc1bf4a52de7a/?utm_source=claude_code
- Rowlandson et al. 2015: warning systems tolerate some LWD error but accurate LWD "remains a priority" [ABS] https://consensus.app/papers/details/22aaa33e199c5096a2e3189f780e154d/?utm_source=claude_code . Sensor-vs-model verdict of that paper and Montone 2016: NOT retrieved.

Greenhouse counter-evidence:
- Condensation is modelled from leaf temperature vs dew point and energy balance, not from an RH threshold (Körner & Holst 2005 [ABS], URL above).
- CFD of a solar greenhouse: condensation appears first on the roof, then on leaves nearest the roof; vs manual observation TNR 1.0, TPR 0.66, accuracy 0.89 (216 pairs). Liu et al. 2021 [ABS] https://consensus.app/papers/details/c13fdbca496351caa9f5481e22c98cd7/?utm_source=claude_code ; LWD longest at 1 m height (mean 8 h); RH-threshold method RMSE 1.944 h on cloudy and 0.5 h on clear nights. Zhang et al. 2022 [ABS] https://consensus.app/papers/details/daa7c46b9c245095bd5345dd3daeb631/?utm_source=claude_code
- P. cubensis sporulates plentifully only wet / RH 100 %, few sporangia at RH 90 % (Sun 2017) — so RH 80–85 % air is not a sporulation-competent state even if a sensor reads wet.
- A numeric greenhouse RH threshold other than Wang 2019, and VPD < 0.2 kPa rules: NOT FOUND this pass.

RISK IF IMPLEMENTED AS PROPOSED: calling leaves wet at RH 80–85 % in every plastic house converts most nights into wet nights -> with S2 minima this is a daily alarm. It also interacts with S7: an RH probe that tops out at 88–94 % would make the 90 % rule miss and the 80–85 % rule look "right" for the wrong reason. Safeguards: calibrate the threshold per house against the dielectric sensor; prefer DPD / leaf-minus-dew-point where leaf or canopy temperature exists; when sensor and estimate disagree report both and use the wetter for short-requirement pathogens; remember spatial spread (roof-side leaves wet first).

---------------------------------------------------------------------------------------------------
## S7 — Sensor QC families and replacement; capacitive RH behaviour at high humidity

VERDICT: SUPPORTED (QC families), PARTLY (the "never above 88–94 % = faulty" rule is consistent with documented drift but no source states that exact criterion).

- Oklahoma Mesonet automated QA: five tests — range, step, persistence, spatial, like-instrument — run per calendar day; flags combined into one final flag per datum that later tests can raise or lower; range = failure, step = warning, spatial and like-instrument = suspect–warning; QA meteorologist reviews flags. [SEC] https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/IOM-109_TECO-2012/Session3/O3_07_Fiebrich_Oklahoma_Mesonet.pdf ; https://ams.confex.com/ams/pdfpapers/41008.pdf
- WMO AWS QC proposal: basic QC at the station (gross error / plausible value check, time consistency checks, internal consistency checks) + extended QC of processed data; levels described in the Guide on the GOS, WMO-No. 488. [SEC] https://old.wmo.int/extranet/pages/prog/www/IMOP/meetings/Surface/ET-STMT1_Geneva2004/Doc6.1(2).pdf . Other networks add climatological and spatial consistency; human supervision needed so extreme-but-real values are not deleted [SEC].
- Replacement by flagged neighbour/gridded estimates: NEWA (previous pass); Dandrifosse 2024 and Enviroweather: NOT retrieved this pass.
- RH sensors: Vaisala HMP155 accuracy ±1 %RH (0–90 %), ±1.7 %RH (90–100 %) at +15…+25 °C; ±(1.0 + 0.008 × reading) %RH at −20…+40 °C [SEC datasheet listing] https://www.campbellsci.com/hmp155a
- DWD acceptance tests (WMO TECO-2012): continuous high humidity is "a great challenge" for capacitive sensors, causing increased errors and calibration drift; after long periods > 95 %RH sensors show decalibration and ageing; in long saturation some read well above 100 %RH. [SEC] https://old.wmo.int/extranet/pages/prog/www/IMOP/publications/IOM-109_TECO-2012/Session1/P1_09_Griesel_Acceptance_test_procedure_humidity_sensors.pdf
- Recalibration: Vaisala HMM30C manual — first check at 6 and 12 months, then yearly [SEC] https://manuals.online/vaisala/control-unit/hmm30c/user-manual/1rjag ; vendor guidance 6–12 months for high-humidity service [SEC].
- WMO-No. 8 wording on hygrometer calibration interval: NOT retrieved. [RECALL, unverified] FAO-56 Annex 5 advises checking that daily RHmax approaches ~100 % at well-watered sites as a data-integrity test.

RISK IF IMPLEMENTED AS PROPOSED: declaring a probe faulty because it never exceeds ~90 % is wrong where the air truly never saturates (heated/ventilated house, dry coastal summer) and would discard good data. Safeguard: make it a conditional test — require that on nights when the leaf sensor is wet, or outdoor/neighbour RH >= 97 %, or after rain, the probe reaches a defined ceiling; flag as "suspect" (not "failed"), keep the raw value, and say so on the card. Spatial/buddy tests are weak between greenhouses (each house is its own climate) — use like-instrument and internal-consistency tests there.

---------------------------------------------------------------------------------------------------
## S8 — Trap-catch biofix for Lepidoptera; pure degree-days for Bactrocera oleae

VERDICT: PARTLY SUPPORTED for Lepidoptera (biofix is classical, but two major programmes moved away from it); NOT SUPPORTED that a pure degree-day model is accepted practice for B. oleae.

- Codling moth, UC: thresholds 50 °F and 88 °F; biofix = first date moths are consistently found in traps (UC calculator adds sunset T consistently 62 °F) [SEC] https://www.ucanr.edu/media/241158
- Counter-evidence: WSU Decision Aid System uses a NO-BIOFIX model counting from 1 January because biofix was hard to establish in many orchards; first moths at ~175 DD on average [SEC] https://treefruit.wsu.edu/predictive-models/ ; Jones et al. 2013 version estimates the biofix DD from latitude and elevation, argued to beat trap biofix where populations are low or terrain varied [SEC] https://mint.ippc.orst.edu/wea/codling_moth_two_stage_doc.pdf ; MSU Enviroweather starts 1 March [SEC] https://www.canr.msu.edu/news/codling_moths_thinking_about_enviro_weather_model_and_hot_and_cold_temperat
- Lobesia botrana: N Greece, base 6.45 °C, from 1 March; generation times 275.6–339.3 DD (1st), 751.5–833.8 (2nd), 899.5–1197.0 (3rd); models explained 60–78 % (Thessaloniki) and 86–91 % (Naoussa) of year-to-year variation. Milonas, Savopoulou-Soultani & Stavridis 2001 [ABS] https://onlinelibrary.wiley.com/doi/full/10.1046/j.1439-0418.2001.00594.x ; Spain: DD from 1 January, base 10 °C (Touzeau) [ABS] https://dialnet.unirioja.es/servlet/articulo?codigo=3105737 ; SW Spain 12 years, first flight used only to seed later generations [ABS] https://onlinelibrary.wiley.com/doi/10.1111/j.1439-0418.2009.01417.x . So the published Mediterranean Lobesia models start from a calendar date, calibrated against trap curves.
- Prays oleae: cumulative male catch vs DD is sigmoid; DD alone "insufficient" for timing; use catch–DD together with olive phenology. Kumral et al. 2005 [ABS] https://consensus.app/papers/details/882fbafde89c54d680fb474f09e03d1a/?utm_source=claude_code
- Tuta absoluta: 502–566 DD per generation in a Syrian plastic house, 5 generations Feb–Jul (Faskha et al. 2022 [ABS] https://consensus.app/papers/details/1d3a2ead7f7b534b9767de46c47f6fbb/?utm_source=claude_code); ~460 DD per generation, continuous flight May–December with overlapping generations (Kőszegi et al. 2026 [ABS] https://consensus.app/papers/details/9d3c0320611951e9ae9efbeef99545e0/?utm_source=claude_code). Overlap limits what a biofix can deliver in protected crops.
- Bactrocera oleae: NE Portugal, base 8.99 °C from 1 January: start of 2nd flight 1837.20 ± 35.82 DD, peak 2045.87 ± 34.30 DD; authors state the models "could be hampered by high temperatures and low relative humidity prevailing during summer". Gonçalves & Torres 2011 [ABS] https://link.springer.com/article/10.1007%2Fs10340-010-0340-3 ; E Mediterranean: dynamics mainly density-dependent, temperature the main exogenous driver, fruit availability significant in places, reproductive quiescence proposed; authors call for monitoring programmes. Ordano et al. 2015 [ABS] https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0127798 ; Samos trap network: more factors needed (fruit availability, natural enemies) [ABS].

RISK IF IMPLEMENTED AS PROPOSED: a biofix needs someone to read traps weekly; a missing or late catch shifts every later date, and at low populations first catch is noisy. Safeguard: run calendar-start as default, let a trap biofix override when entered, show which one is in use; for B. oleae keep DD only as a background indicator and drive advice from trap counts, fruit receptivity (pit hardening) and summer heat arrest.

---------------------------------------------------------------------------------------------------
## S9 — Standard practice missing from the list

- Inoculum / presence gate: CDM ipmPIPE source reports; UCSC oospore cohorts; first-symptom or regional-report switches. (S2 sources)
- Sporulation step separate from infection (night, darkness, RH ~98–100 %): AWRI; Sun 2017.
- Cultivar resistance classes: Simcast blight-unit thresholds differ by resistance; unadjusted it over-sprays resistant cultivars (Grünwald 2002).
- Phenological / ontogenic windows: vite.net inputs include phenology; L. taurica latent period and susceptibility change with plant age; A. solani susceptibility rises with maturity; "3-10" needs shoots >= 10 cm.
- Fungicide residual tracking: Simcast fungicide units; vite.net "residual protection provided by the last fungicide application"; fuzzy controller reproduced expert decisions with accuracy 0.992 [SEC] https://wiki.pestinfo.org/wiki/European_Journal_of_Plant_Pathology_(2016)_144,_763-772 ; Gubler–Thomas and TOMCAST reset on treatment.
- Validation metrics: TPP/TNP/FPP/FNP (Caffi 2009: 0.99/0.87/0.13/0.005); ROC-based thresholds; a tool with sensitivity 100 % and specificity 0 % is a "cry wolf" failure [SEC] https://www.northeastipm.org/neipm/assets/File/TFWG-Philion.pdf ; warning systems rarely get sustained direct grower use unless output matches the decision at acceptable financial risk [SEC, PubMed record] https://www.pubmed.gov/23682914/
- Forecast horizon: CDM 48 h; EWMPICDW-with-climate-model 72 h; Simcast 3 days; VitiMeteo 7 days.
- Sensor siting: in-canopy vs out-of-canopy humidity decides whether BLITECAST works (Shock 1997 [FT]).
- Curative window information: copper post-infection efficacy < 20 % after 6 h at 20 °C (Caffi 2016).

---------------------------------------------------------------------------------------------------
## NOT FOUND / NOT VERIFIED THIS PASS
- Numeric LWD x T thresholds of Zhao et al. 2011 (EWMPICDW) and of Li Ming / Yang Xinting models.
- EPI, DMCast and VitiMeteo-Plasmopara rule constants; Müller–Sleumer / Goidanich incubation table.
- NegFry rules; full Simcast thresholds by resistance class; BLITECAST table from a primary source (given as RECALL).
- Mills light/moderate/severe hours; NEWA, RIMpro, Enviroweather wet-period merge rules from their own documentation.
- Rowlandson 2015 and Montone 2016 full-text conclusions on sensors vs models; Kim 2002 wind-correction constants.
- Latent period vs temperature for P. cubensis (table), A. solani, P. xanthii; whether RIMpro / vite.net display symptom dates.
- Any published model with a host water-stress multiplier (x3.95 or otherwise); stress effects on Spilocaea oleagina; low-nitrogen effect on A. solani.
- WMO-No. 8 text on RH calibration interval; Shafer et al. 2000 thresholds; Dandrifosse 2024.
- Gubler–Thomas failures outside California (searched, none retrieved); greenhouse RH/VPD wetness thresholds other than Wang 2019.

---------------------------------------------------------------------------------------------------
## CONSENSUS MESSAGE
Create or connect a free Consensus account to return more than 3 results per search in Claude Code.: https://consensus.app/sign-up/?utm_source=claude_code&auth=claude_code
