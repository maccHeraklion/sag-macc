# Literature notes — leaf wetness, dry interruption, greenhouse warning rules, sensor QC, missing constants

Date: 2026-11-06. Research only; no project files changed.
Tag per value: **[FT]** = from full text I read, **[ABS]** = from abstract I read, **[SEC]** = secondary citation (another paper/guide quoting it).
Consensus URLs are copied exactly as returned.

---

## 1. Magarey, Sutton & Thayer 2005 — full text read

Source: Magarey R.D., Sutton T.B., Thayer C.L. 2005. A simple generic infection model for foliar fungal plant pathogens. Phytopathology 95:92-100. DOI 10.1094/PHYTO-95-0092.
Full text PDF actually read (the URL in the task returned 404; the same file lives at):
https://www.suddenoakdeath.org/wp-content/uploads/pdf/PHYTO-95-0092%20Magarey%20nappfast.pdf
(local text extraction: scratchpad\txt\magarey2005.txt, mag_raw.txt)

### 1.1 Model equations [FT]
- W(T) = Wmin / f(T), capped at Wmax (eq. 1). W(T) = wetness hours needed for the critical disease threshold (20 % incidence or 5 % severity) at temperature T.
- f(T) = ((Tmax − T)/(Tmax − Topt)) × ((T − Tmin)/(Topt − Tmin))^((Topt − Tmin)/(Tmax − Topt)) for Tmin ≤ T ≤ Tmax, else 0 (eq. 2; Yin et al. function). T = mean temperature during the wet period.
- If Wmax unknown: Wmax = 3.8 + 3.0 × Wmin (r = 0.71, RMS 6.0 h, n = 64).
- "For pathogens that require high relative humidity rather than free moisture, the wetness requirement may also be defined as the number of hours above a relative humidity threshold."
- Validation: 53 studies, mean r = 0.83 (median 0.94), RMS 4.8 h (abstract says 4.9), SRMS 0.6. ~90 % of pathogens Wmin < 20 h, average Wmin 9 h, average Wmax 30 h.

### 1.2 Dry interruption rule [FT]
- "Consider the case of two wet periods, W1 and W2, separated by a dry period D. The sum of the surface wetting periods (Wsum) is given as Wsum = W1 + W2 if D < D50 or Wsum = W1, W2 if D > D50."
- D50 = "duration of a dry period at relative humidities <95% that will result in a 50% reduction in disease compared with a continuous wetness period. The value of D50 is sensitive to the time when the dry period occurs."
- Only studies where the initial wet period was shorter than Wmin were used to estimate D50.

### 1.3 Table 3 — the three D50 groups [FT] (row alignment verified with a second extraction mode)
| Sensitivity | D50 | Species (ref no. in paper) |
|---|---|---|
| Sensitive | 1–2 h | Puccinia recondita (85), Puccinia striiformis (85), Pyrenophora tritici-repentis (66) |
| Moderate | 4–20 h | Alternaria brassicae (55), Alternaria linicola (88), Alternaria porri (80), Ascochyta rabiei (84), Bipolaris oryzae (59), Botryosphaeria obtusa (8), Botrytis squamosa (3), Cercospora kikuchii (68), Coccomyces hiemalis (28), Stagonospora nodorum (41), Uromyces phaseoli (9), Venturia pirina (86) |
| Insensitive | ≥24 h | Cercospora carotae (21), Mycosphaerella graminicola (73), Stemphylium botryosum (9), Venturia inaequalis (10, 86) |

**Important negative finding:** Table 3 contains NO oomycete/downy mildew (no Pseudoperonospora, Plasmopara, Bremia, Peronospora, Phytophthora infestans), NO Botrytis cinerea (only B. squamosa on onion, "moderate" 4–20 h), NO Colletotrichum, NO Alternaria solani. D50 is NOT a column of Table 2. So Magarey 2005 gives no D50 for the cucumber/tomato greenhouse pathogens; any D50 used for them must come from other papers (section 2).

Text around Table 3 [FT]:
- "even a 1- to 2-h interruption dramatically reduced the level of infection for many Puccinia spp."; for P. recondita / P. striiformis an interruption during the first 2–4 h of wetness cut disease from 70 to 10 %, interruptions after 4 h had much smaller influence.
- "Most plant pathogens were sensitive to wetness interruptions between 4 and 20 h, whereas a few, such as Cercospora carotae and V. inaequalis, were insensitive to wetness interruptions of <24 h."
- Humidity during the break matters: dry breaks at 50 % RH hurt Mycosphaerella graminicola more than at 75 %; Cercospora carotae and C. kikuchii infect when RH stays > 88 %; C. arachidicola germ tubes keep growing at 94–98 % RH, reduced at 53–85 %, minimal at 30–40 %; 10 h break at 85 % RH increased Cercosporidium personatum severity; RH during the dry period had little effect on V. inaequalis or Botryosphaeria obtusa. Caveat: "desiccation of spores is determined by evaporation rate rather than by humidity alone."
- "Without data on the critical dry-period interruption value, it is difficult to use an infection model with hourly weather data."

### 1.4 Table 2 values requested [FT] (°C, hours)
| Pathogen (host) | Tmin | Topt | Tmax | Wmin | Wmax | source study in paper |
|---|---|---|---|---|---|---|
| Botrytis cinerea (grape berries) | 10 | 20 | 35 | 4 | 10 | Nair & Allen 1993 (ref 56) |
| Botrytis cinerea (grape flowers) | 1 | 25 | 34 | 1 | 12 | Nair & Allen 1993 (ref 56) |
| Botrytis cinerea (strawberry flowers) | 5 | 25 | 35 | 8 | 18 | Bulger, Ellis & Madden 1987 (ref 15); poor fit r = 0.13 |
| Botrytis squamosa (onion) | 1 | 18 | 28 | 15 | 24 | ref 82 |
| Pseudoperonospora cubensis (cucumber) | 1 | 20 | 28 | 2 | 12 | Cohen 1977 (ref 23); r = 0.98 |
| Plasmopara viticola (grape) | 1 | 20 | 30 | 2 | 14 | Lalancette, Ellis & Madden 1988 (ref 43) |
| Phytophthora infestans (potato) | 1 | 15 | 28 | 6 | 12 | Rotem, Cohen & Putter 1970 (ref 62) |
| Bremia lactucae (lettuce) | 1 | 15 | 25 | 4 | 10 | Scherm & van Bruggen 1993 (ref 67) |
| Venturia inaequalis (apple) | 1 | 20 | 35 | 6 | 40.5 | compilation (ref 78) |
| Venturia pirina (pear) | 1 | 22 / 20 | 35 | 10 | 25 / 30 | refs 77 / 87 |
| Colletotrichum orbiculare (watermelon) | 7 | 24 | 30 | 2 | 16 | Monroe, Santini & Latin 1997 (ref 53); r = 0.69 |
| Colletotrichum acutatum (strawberry fruit) | 7 | 27.5 | 35 | 6 | 36 | Wilson, Madden & Ellis 1990 (ref 92) |
| Alternaria cucumerina (muskmelon) | 12 | 19 | 25 | 8 | 24 | ref 31 |
| Alternaria porri (onion) | 1 | 23 | 35 | 8 | 24 | Suheri & Price 2000 (ref 80) |
| Alternaria brassicae (oilseed rape) | 2.6 | 18 | 35 | 6 | 22 | ref 38 |
| Alternaria mali (apple) | 1 | 23 | 35 | 5 | 40 | ref 32 |
| Alternaria sp. (Minneola tangelo) | 9.4 | 25 | 35 | 8 | 16 | ref 18 |
| Cercospora arachidicola (peanut) | 13.3 | 24 | 35 | 24 | 48 | ref 93 |
| Cercospora carotae (carrot) | 11 | 24 | 32 | 28 | 96 | ref 20 |
| Cercosporidium personatum (peanut) | 8 | 20 | 35 | 16 | 33 | ref 17 |
| Septoria glycines (soybean) | 10 | 25 | 35 | 6 | 18 | ref 70 |
| Phytophthora cactorum (apple fruit / strawberry fruit) | 1 / 6 | 25 / 20.5 | 35 | 2 / 1 | 5 / 3 | refs 36 / 37 |
| Sclerotinia sclerotiorum (bean) | 1 | 25 | 30 | 48 | 144 | ref 91 |

NOT in the paper's tables: Alternaria solani, Peronospora destructor, Colletotrichum coccodes, C. gloeosporioides, Stemphylium spp. cardinal values (S. botryosum appears only in Table 3), any Septoria on tomato/celery, Cercospora beticola.
Genus-level remarks [FT]: three Cercospora spp. Wmin ≈ 24 h; six Alternaria spp. Wmin 6–8 h; five Puccinia spp. Wmin 5–7 h; larger spread within Venturia, Colletotrichum, Phytophthora (partly fruit vs leaf).

---

## 2. Dry interruption — downy mildews and Botrytis cinerea

### 2.1 Pseudoperonospora cubensis (cucumber)
- Cohen Y., Rotem J. 1971. Dispersal and viability of sporangia of Pseudoperonospora cubensis. Trans. Br. Mycol. Soc. [ABS, via SciSpace; DOI 10.1016/S0007-1536(71)80081-5; https://www.sciencedirect.com/science/article/pii/S0007153671800815]
  - Dispersal starts 06:00–07:00, peaks ~08:00, subsides by noon (hot dry climate).
  - Dry sporangia between dispersal and infection: with a 5 h or 22 h interval, infectivity fell to nil only at 35 and 40 °C (highest tested); it declined with high temperature and high RH.
  - **Key for dry breaks:** "Infectivity of dispersed sporangia was greatly reduced when sporangia were wetted for a period too short to ensure infection and were then allowed to dry out. Most of the sporangia thus treated failed to release zoospores." No hour values in the abstract.
- Cohen Y., Perl M., Rotem J., Eyal H., Cohen J. 1974. Ultrastructural and physiological changes in sporangia of P. cubensis and Phytophthora infestans exposed to water stress. Can. J. Bot. [ABS, via SciSpace; DOI 10.1139/B74-058; https://www.nrcresearchpress.com/doi/10.1139/b74-058]
  - Wet–dry ("WDR") treatment = wetted too short to germinate, then dried: viability "greatly reduced"; oxygen uptake totally inhibited, mitochondrial membrane damage, leakage; sugars/ATP did not restore viability, so the damage is irreversible.
- Cohen Y., Eyal H. 1980. Effects of light during infection on the incidence of downy mildew on cucumbers. Physiol. Plant Pathol. [ABS, via SciSpace; https://www.sciencedirect.com/science/article/abs/pii/0048405980900065]
  - ~90 % of zoospores settled on stomata within 2 h in light, ~75 % within 3 h in dark. Optimum T for infection in darkness: 25 °C with 2 h wetness, 15 °C with 4 h; in light 20 °C. A 2.5 h wet period suffices (plants most prone at midday).
- Sun et al. 2017 (already in hand): minimum wetness 12, 4, 2.5, 1, 1, 6 h at 5, 10, 15, 20, 25, 30 °C.
- **Operational reading (my inference, not a quoted rule):** for P. cubensis a wet spell shorter than the minimum wetness followed by drying does NOT carry over. The wetted sporangia are killed, so two short wet spells must not be summed for the same cohort. A new cohort of sporangia (next morning's dispersal) starts from zero. I found NO published D50 in hours for P. cubensis.

### 2.2 Plasmopara viticola (grape)
- Kennelly M.M., Gadoury D.M., Wilcox W.F., Magarey P.A., Seem R.C. 2007. Phytopathology 97:512-522. [ABS] https://consensus.app/papers/details/08a72320aa955ef297b18992b095ef0c/?utm_source=claude_code
  - "In fair weather, most sporangia died sometime during the daylight period immediately following their production. However, over 50% of sporangia still released zoospores after 12 to 24 h of exposure to overcast conditions."
  - Primary infection thresholds: rain > 2.5 mm, T > 11 °C, phenology > E&L 12. One day reaching 42.8 °C eradicated sporulation from existing lesions.
- Kast W.K. et al. 2015. Survival of sporangia from P. viticola. Vitis. [ABS] https://consensus.app/papers/details/6e2d5fd8c81d5391a75ed9aab5ef93bf/?utm_source=claude_code
  - Sporangia left on the lesion at 22 °C and 30 % or 60–80 % RH still released zoospores up to 7 d and infected leaves for at least 9 d. Fresh sporangia release zoospores after 30 min in water; 3–7 d old ones not before 180 min. (Differs from Kennelly's "die within the day": Kast kept plants indoors, without sunlight.)
- Caffi T. et al. 2016. Eur. J. Plant Pathol. 144:737-750. [ABS] https://consensus.app/papers/details/6d3af1f2429f5ebab579e897956eb9f8/?utm_source=claude_code
  - At 15–20 °C zoospores are released within 1 h and "most infections had already occurred by 3 h after inoculation"; copper applied 6 h after inoculation at 20 °C gives < 20 % efficacy.
- Rossi V. et al. 2008. Ecol. Modelling (primary infection model). [ABS] https://consensus.app/papers/details/dbcaa6fbeecb5d6586e68ba5245b64ae/?utm_source=claude_code
  - 86 % of oospore cohorts fail; 83.6 % of those because "zoospores released from sporangia did not survive until dispersal". Hourly time step. The exact survival rule is not in the abstract.
- Magarey 2005 Table 2: Wmin 2 h, Wmax 14 h, Topt 20 °C. No D50.
- NOT found: a measured D50 / dry-break experiment for P. viticola zoospores.

### 2.3 Bremia lactucae (lettuce)
- Wu B.M., Subbarao K.V., van Bruggen A.H.C. 2000. Phytopathology 90:827-833. [ABS] https://consensus.app/papers/details/4757e72bf3dd5abf96bd7fe65bffbb72/?utm_source=claude_code
  - Dry sporangia on leaves survive > 12 h at 23 °C but only 2–5 h at 31 °C, regardless of RH 33–76 %. 50 % and 100 % sunlight (UVB) sharply cut germination. "infections by sporangia that survived a day are probable only on cloudy days or on leaves that are highly shaded."
- Scherm H., van Bruggen A.H.C. 1995. Phytopathology. [ABS] https://consensus.app/papers/details/6fa323ad92705b338386381e0bc9899e/?utm_source=claude_code
  - Infection only on mornings when leaf wetness persisted at least 3 h after sunrise (spore release starts at sunrise; release and infection are concurrent).
- Wu B.M., van Bruggen A.H.C., Subbarao K.V., Scherm H. 2002. Phytopathology. [ABS] https://consensus.app/papers/details/9decf11aa7065ef288aa3ab1a154b09b/?utm_source=claude_code
  - Warning rule: morning leaf wetness ≥ 3 h counted from sunrise (sunrise = first hour with solar radiation > 8 W m-2); the earlier rule was ≥ 4 h from 06:00. No infection if mean T > 20 °C during the 3 h wet period or > 22 °C during the following 4 h post-penetration period. Lab design: 4 h wet period then 8 h dry; high T in either reduces disease.
- Magarey 2005 Table 2: Wmin 4 h, Wmax 10 h, Topt 15 °C, Tmax 25 °C (from Scherm & van Bruggen 1993). No D50.

### 2.4 Peronospora destructor (onion)
- Palti J. 1989. Phytoparasitica (review). [ABS] https://consensus.app/papers/details/d29b6e0860255d93a7a75e98d353f0b6/?utm_source=claude_code
  - "Germ tubes develop in liquid water, and a continuous period of wetness is required for infection to be completed." Germination rate highest at 10 °C; epidemic optimum 10–12 °C, up to ~22 °C. Spore survival depends on T, RH and especially absence of strong radiation. No hour values.
- Hildebrand P.D., Sutton J.C. 1984. Can. J. Plant Pathol. 6:119-126, the primary source for spore survival and infection hours. Consensus returns the record without an abstract: https://consensus.app/papers/details/093a1f87a2185354a6f3018c24161692/?utm_source=claude_code . Values NOT obtained.

### 2.5 Botrytis cinerea
- Eden M.A., Hill R.A., Beresford R., Stewart A. 1996. Plant Pathology 45. Greenhouse tomato. [ABS, via SciSpace; DOI 10.1046/J.1365-3059.1996.D01-163.X; https://bsppjournals.onlinelibrary.wiley.com/doi/abs/10.1046/j.1365-3059.1996.d01-163.x]
  - Flower infection rises with length of high RH (~100 % for 0–36 h) and with continuous RH (56–100 %); "A low level of infection was still evident under continuous 56% RH. **Interruption of periods of high RH with breaks of low RH did not reduce infection.**" Stem-wound infection depends little on RH. Raising 15 to 25 °C increases flower infection and reduces stem infection.
- Körner O., Holst N. 2005. Acta Hort. 691. [ABS] https://consensus.app/papers/details/8405432c4ddd550bab0b0f66c502d6b3/?utm_source=claude_code
  - "a certain leaf wetness duration seems necessary for spore germination. However, during germination before building of the inocolum durations of dryness (desiccation) can kill the spores." The control regime is built on LWD rules (wet-duration and dry-duration counters); the hour values are in the full text, not obtained.
- Coertze S., Holz G., Sadie A. 2001. Plant Disease 85:668. [ABS] https://consensus.app/papers/details/23578b785d8857a0861abb4baa6d1f0d/?utm_source=claude_code and Coertze & Holz, S. Afr. J. Enol. Vitic. [ABS] https://consensus.app/papers/details/cf692474e6ac56a0ad0bb12ad3a1e596/?utm_source=claude_code
  - Dry single conidia stay dormant on dry berries; germlings do not survive long on the surface: conidia deposited 4 days before wounding did not infect wounds. Free water (not high RH) was needed for wound infection.
- Davidson J.A., Krysinska-Kaczmarek M. 2007. Australas. Plant Pathol. Lentil. [ABS, via SciSpace; https://link.springer.com/article/10.1071/AP07039]
  - "Absence of leaf wetness for up to 4 weeks following inoculation did not reduce the disease severity" (sporulation came 3 days after wetness returned).
- Wetness needs for reference:
  - Broome J.C. et al. 1995. Phytopathology. [ABS] https://consensus.app/papers/details/3eb806b51d7a56a4ab11922f82cb182e/?utm_source=claude_code — grape berries infected after 4 h wetness at all temperatures tested (12–30 °C).
  - Sirjusingh C., Sutton J.C. 1996. Plant Disease. [ABS] https://consensus.app/papers/details/99325742b3e251eaaad5c0564f95a097/?utm_source=claude_code — geranium flowers: sporulation incidence rose sharply when wetness went from 8 to 24 h at 15 °C, 4 to 12 h at 21 and 25 °C, 4 to 6 h at 30 °C; none after 24 h at 5 or 10 °C. Young leaves: ≥ 6, ≥ 4, ≥ 6, ≥ 6 h at 15, 21, 25, 30 °C.
  - Ciliberti N. et al. 2015. Phytopathology. [ABS] https://consensus.app/papers/details/b6ec9f51d59a57cbbd8eada28867ee78/?utm_source=claude_code — no disease at 65 % RH; with 36 h wetness incidence ~75 % at 20–25 °C, 50 % at 15 °C, 20–30 % at 10 and 30 °C, none at 5 °C.
- Closest Botrytis in Magarey Table 3: B. squamosa (onion), "moderate", D50 4–20 h.
- **Reading:** unlike the downy mildews, the evidence for B. cinerea says that a dry or low-RH break of a few hours does not cancel infection (Eden 1996; Davidson 2007), while Körner & Holst state that desiccation during germination can kill spores. No D50 in hours found for B. cinerea; the two statements are not reconciled in what I could read.

### 2.6 Other interrupted-wetness numbers met on the way
- Xu J. et al. 2026. Plant Disease. Coniella vitis on grape berries. [ABS] https://consensus.app/papers/details/ad122c52b91f5f988e583ceb487e5b7f/?utm_source=claude_code — dryness of 2–12 h reduced severity by up to 31.7 %; a wetness-interruption equation was fitted (R2 ≥ 0.927).
- Dillard 1989 (C. coccodes, see 6d): conidial germination 73.4 % from moist lesions vs 35.7, 36.3, 24.6 % after 2, 8, 24 h drying at 27–30 °C, 55–57 % RH.

---

## 3. Greenhouse: leaf wetness estimation and warning rules

### 3.1 Estimating leaf wetness inside greenhouses
- **Wang H., Sanchez-Molina J.A., Li M., Rodríguez Díaz F. 2019. Improving the performance of vegetable leaf wetness duration models in greenhouses using decision tree learning. Water 11(1):158. [FT]** https://www.mdpi.com/2073-4441/11/1/158
  - Sites: plastic greenhouse, tomato, Almería, Spain (ES; Decagon dielectric sensors at bottom and top of canopy, 30° angle, 2016–2018) and solar greenhouse, cucumber, Beijing (CN; five Davis #6420 sensors around a mid-canopy leaf, T/RH every 15 min, 2014–2015).
  - Observed wetness rule: "The leaf was considered wet when 50% of the sampled data was over the LW sensor threshold for one hour" (citing Dalla Marta et al. 2005).
  - RH threshold model: literature default RH ≥ 90 %; **calibrated RH ≥ 84.53 % (ES tomato) and RH ≥ 80 % (CN cucumber)**. Calibration MAE fell from 7.12 to 5.31 h (ES) and from 6.12 to 2.73 h (CN); on independent data the RH model MAE was 3.29–5.46 h.
  - Dew point depression model (T − Tdew): literature default DPD < 2 °C; **calibrated DPD < 2.7 °C (ES) and < 5.42 °C (CN)**.
  - CART (Gleason 1994): hour dry if DPD ≥ 3.7 °C, or if RH < 87.8 % and wind ≥ 2.5 m/s; calibrated first split 2.7 °C (ES), 6.3 °C (CN). CART MAE on independent data 3.46 h (ES), 2.75 h (CN).
  - Neural network with RH, dew temperature, transpiration, radiation: MAE 1.85 h (ES), 1.30 h (CN). Rain and wind unimportant indoors; transpiration as important as radiation.
  - Cited greenhouse calibrations [SEC]: Mashonjowa et al. 2013 (roses, Zimbabwe) RH > 84 % and DPD < 2.5 °C; Gil et al. 2011 (roses, Colombia) RH > 94 %, DPD < 2 °C; Mackenzie & Peres 2012 (strawberry, Florida, open field) RH > 85 %.
  - States that RH ≥ 90 % "was used in an existing cucumber downy mildew warning system" (= Zhao et al. 2011) [SEC].
- Zhang C. et al. 2022. A CFD transient model of LWD on greenhouse cucumber leaves. Comput. Electron. Agric. [ABS] https://consensus.app/papers/details/daa7c46b9c245095bd5345dd3daeb631/?utm_source=claude_code — condensation appears first near the south roof; longest LWD at 1 m height (average 8 h); RH-threshold LWD RMSE 1.944 h (cloudy) and 0.5 h (clear).
- Liu J. et al. 2020. [ABS] https://consensus.app/papers/details/b1e872d6b1095c3a93d34a3caa011b5f/?utm_source=claude_code — solar greenhouse cucumber, hourly visual inspection at nine points: RH model accuracy 0.82–0.84, neural net 0.90–0.92 (MAE 1.61–1.81 h). LWD is strongly position-dependent: south 12.17 h/d vs middle 4.83 h/d; rainy days 17.15–17.41 h/d.
- Körner & Holst 2005 [ABS, URL in 2.5]: wetness onset is predicted when modelled leaf temperature at a canopy location reaches the dew point of the air; dry-out time from the latent-heat energy balance. No fixed RH/VPD number in the abstract.
- NOT found: a published VPD threshold (kPa) for leaf condensation in greenhouses. What the papers use is leaf temperature versus dew point (physical) or RH / dew point depression thresholds (empirical).

### 3.2 Cucumber downy mildew warning in (solar) greenhouses
- Zhao C.J., Li M., Yang X.T., Sun C.H., Qian J.P., Ji Z.T. 2011. Comput. Electron. Agric. 76:306-315 (model "EWMPICDW"). [ABS] https://consensus.app/papers/details/13093c25f5ca5b8a87d0a27a65294723/?utm_source=claude_code
  - Infection sub-model = threshold on the combination of LWD and mean temperature during the LWD. LWD from a leaf wetness sensor combined with an RH threshold model (RH ≥ 90 % according to Wang 2019 [SEC]). Incubation sub-model = nonlinear regression on temperature. Warnings more than 2 d before symptoms; a positive warning raises disease probability from 0.68 to 0.96. Evaluated on 4 years of data, two sites in Beijing.
  - **The actual LWD × temperature threshold table is NOT in the abstract and the full text is closed. Not obtained.**
- Wang H. et al. 2015. Chin. J. Appl. Ecol. [ABS] https://consensus.app/papers/details/bf903dfe5a185bf6a1bf207a778ce681/?utm_source=claude_code — energy and moisture balance models of leaf temperature and RH feeding the same primary-infection and latent-period models.
- Liu R. et al. 2022. Comput. Electron. Agric. [ABS] https://consensus.app/papers/details/b4c1b7b9dac65a3999cb87d67f8a59ac/?utm_source=claude_code — greenhouse climate model 72 h ahead plus disease model; several false positives before the first true one (24 April 2021).
- Usable infection numbers therefore remain those already in hand (Sun 2017; Neufeld 2012; Arauz 2010) plus Cohen & Eyal 1980 above.

### 3.3 Botrytis grey mould in greenhouses
- **Yunis H., Shtienberg D., Elad Y., Mahrer Y. 1994. Crop Protection 13:99-104. Non-heated cucumber greenhouses. [ABS]** https://consensus.app/papers/details/53ed63eb91de5ac58f1828aa0233f633/?utm_source=claude_code
  - Outbreak rule (weekly averages): **foliage wet > 7 h/day AND hours with temperature 9–21 °C during the night (18:00–08:00) > 9.5 h/day.**
  - Biological basis: with free moisture, spores germinate within 7 h; the phase exposed to the microclimate (germination and penetration) lasts 9–10 h. Recommendation: restrict the wetting period to < 7 h/day by ventilation and heating.
  - A quantitative statistical model failed; the qualitative threshold rule held on an independent data set.
- Shtienberg D., Elad Y. 1997. Phytopathology 87:332-340 (BOTMAN). [ABS] https://consensus.app/papers/details/cad977ab47e3586d9a655bf108433ea6/?utm_source=claude_code
  - Three-way decision from a 4-day weather forecast: slow/no progress expected, no spray; outbreak expected, chemical fungicide; otherwise Trichoderma harzianum T39. 11 experiments, tomato and cucumber, 3 years: disease reduction 63.9 ± 3.0 % vs 70.1 ± 3.6 % for weekly fungicide, with 4.2 vs 10.5 fungicide sprays (plus 5.9 T39 sprays). Forecast weather was more useful than past weather.
  - The numeric limits separating the three classes are NOT in the abstract (full text not accessible). The Yunis 1994 rule above is its published basis.
- Moyano C. et al. 2003. J. Phytopathol. [ABS] https://consensus.app/papers/details/22cdd8a3124d5b078986c80b33472ef8/?utm_source=claude_code — BOTMAN tested in unheated tomato greenhouses in SE Spain (the climate closest to Crete): in the second season it gave moderate risk every week and disease did not differ from untreated; the authors discuss reasons for the failure. Caution for transfer.
- Baptista F.J., Bailey B.J., Meneses J.F. 2012. Crop Protection. [ABS] https://consensus.app/papers/details/ada6a18c1b735fe08063873a3f77f95c/?utm_source=claude_code and 2011, Acta Hort. [ABS] https://consensus.app/papers/details/f147f34b610e53b5a93b31d204852539/?utm_source=claude_code
  - Unheated tomato greenhouses, Lisbon: nocturnal ventilation significantly reduced air humidity and B. cinerea; risk levels were defined "as a function of the duration of periods with RH > 90%". The hour classes are not in the abstracts. Not obtained.
- Körner O. et al. 2014. [ABS] https://consensus.app/papers/details/6bedb35bbf5952919ec2b025a113d32a/?utm_source=claude_code — full life-cycle Botrytis model driven by computed leaf wetness and leaf dryness durations (parameterised for gerbera).
- Eden 1996 (see 2.5): on tomato flowers, low-RH breaks do not reduce infection; some infection even at continuous 56 % RH.

---

## 4. Leaf wetness sensor reliability and quality control

### 4.1 Rowlandson et al. 2015
Rowlandson T., Gleason M., Sentelhas P., Gillespie T., Thomas C., Hornbuckle B. 2015. Plant Disease 99:310-319. https://consensus.app/papers/details/22aaa33e199c5096a2e3189f780e154d/?utm_source=claude_code
- [ABS only] Warning systems "are robust enough to permit some errors in the estimates or measurements of leaf wetness duration", but highly accurate LWD remains a priority.
- **Full text NOT obtained.** The article is open access at https://apsjournals.apsnet.org/doi/abs/10.1094/PDIS-05-14-0529-FE but the PDF could not be read with my tools (the in-app browser showed a save dialog for it). The points below come from the same author group's open review and from guides that cite Rowlandson 2015.

### 4.2 Gleason et al. 2008 (same group; read in full)
Gleason M.L., Duttweiler K.B., Batzer J.C., Taylor S.E., Sentelhas P.C., Monteiro J.E.B.A., Gillespie T.J. 2008. Obtaining weather data for input to crop disease-warning systems: leaf wetness duration as a case study. Scientia Agricola 65(spe):76-87. [FT] https://revistas.usp.br/sa/article/download/22393/24417/26025
- "There is no widely accepted standard for calibrating LWD sensors"; LWD is "the most spatially heterogeneous weather input"; micro-sites on a single leaf can differ by several hours per day.
- Painting: six unpainted flat-plate sensors side by side had an average CV of 67 %; six painted ones 9 % (Sentelhas et al. 2004a).
- Height and angle (painted plates over turf, 50 days, Piracicaba; Sentelhas 2004b): mean LWD 9.93 h at 30 cm, falling to about 8.8–9.2 h at 110–190 cm; by angle 9.93 h at 0°, 9.77 h at 30°, 8.80 h at 45°.
- Placement: a single sensor is best "just below the top of the canopy, but fully exposed to the night sky" (Magarey et al. 2005), giving worst-case (maximum) LWD. A sensor at 30 cm over turf approximates top-of-canopy LWD for apple, coffee, maize, grape and muskmelon.
- Within-canopy spread: apple, 12 positions; the date on which a cumulative-LWD action threshold was reached varied by up to one month with sensor position; cumulative LWD at the canopy base varied by up to 44 %. Coffee: about 1.5 h/day more at the bottom than at the top.
- RH as a steadier substitute: 192 cumulative hours of RH > 97 % predicted the sooty blotch threshold better than 175 h of measured LWD in dew-dominated climates (Duttweiler 2008), not in a rain-dominated one.
- Accuracy benchmarks: physical models "±1 h day–1" (Pedro & Gillespie 1982); corrected Penman–Monteith estimates "accurate to within 1 h day–1, which is well within the variability associated with in-canopy sensor measurements". Station-to-station correlation is highest for temperature, intermediate for RH and dew point, lowest for LWD.
- QC: networks need trained staff, scheduled maintenance and error-checking "to flag potential problem sensors or stations"; when a sensor fails abruptly, fill from the nearest stations (kriging). "Weather stations are only as valuable as their quality-control procedures".

### 4.3 Accepted error of LWD (hours/day)
- Sentelhas P.C. et al. 2008. Agric. For. Meteorol. (in hand) https://consensus.app/papers/details/e4c5f9f1093d53bc881ba31d3c4c8313/?utm_source=claude_code — locally calibrated RH threshold: MAE 1.23–1.89 h, "very similar to errors obtained with published physical models".
- Sentelhas P.C. et al. 2005 (cotton). [ABS] https://consensus.app/papers/details/c6b8e7438c325becbe8cc1bf4a52de7a/?utm_source=claude_code — four models, MAE 1.27–2 h; station (1.7 m) and crop-level LWD differ strongly for LWD below 15–17 h.
- Gama A.B., Dewdney M.M., Fraisse C., Peres N.A. 2020. Proc. Fla. State Hort. Soc. 133. [ABS] https://journals.flvc.org/fshs/article/view/133210 — Decagon dielectric vs painted Campbell 237-L at the same station, 15-min data: same-make pairs r > 0.90, MAE < 1.0 h; between makes r about 0.8, **MAE around 2.0 h, "within the acceptable range" for the disease alert systems.**
- Gillespie T.J., Sentelhas P.C. 2008. Scientia Agricola 65(spe):71-75. [FT] https://revistas.usp.br/sa/article/download/22392/24416/26024 — for TomCast, an error of 20 DSV is needed to trigger an unwarranted spray; radar-derived wetness differed by only 2 DSV over 18 rain days.
- Working figure from these sources: ±1–2 h/day is the usual accepted LWD error.

### 4.4 Network QC methods
- Dandrifosse S. et al. 2024. Automatic quality control of weather data for timely decisions in agriculture. Smart Agricultural Technology 8:100445. [ABS] https://consensus.app/papers/details/38fcef2113d759f8b10278043ab4f804/?utm_source=claude_code
  - Belgian network, 28 stations, minute and hourly data. Checks: missing data, range, temporal consistency, spatial consistency, internal consistency. Specific new checks include "saturation of relative humidity at a too low level and implausible leaf wetness duration". Detection 92.6–100 % of implausible values, false alarms 2.7–33.3 %, so flags need human review. Minute-step checks catch errors invisible at hourly step. **The exact leaf wetness rule is in the full text. Not obtained.**
- NEWA (Cornell), "How NEWA handles weather data" (page updated June 2020). [FT] https://newa.cornell.edu/how-newa-handles-weather-data
  - Stations without a leaf wetness sensor: an hour of leaf wetness is recorded "when the average relative humidity in that hour is greater than 90%".
  - Missing T or RH: (1) average of previous and next hour if both exist; (2) otherwise gridded analysis (RTMA/URMA) at the nearest grid point. Estimated values are shown flagged. "Currently, no other weather variables ... are estimated", i.e. NEWA does not gap-fill a failed leaf wetness sensor.
- Saia S. et al. 2023 (NC ECONet technical overview). [ABS] https://consensus.app/papers/details/eeebdda391ca5af58063c873d1cc63c0/?utm_source=claude_code — leaf wetness index measured every minute; all data pass QC; details not in the abstract.

### 4.5 Dielectric sensors (METER PHYTOS 31 / Decagon LWS; Dragino LMS01)
- METER PHYTOS 31 manual (10386). [FT] https://publications.metergroup.com/Manuals/10386_PHYTOS31_Pages.pdf
  - Dry output about 435 raw counts; fully wet (heavy rain) up to about 1,100 counts. The logger counts minutes wet against two thresholds, **450 and 460 counts** (dry + 15 and + 25 counts, about 2–4 % of the dry-to-wet span).
  - Other loggers: dry 260 mV / threshold 274 mV at 2.5 V excitation; 320 / 330 mV at 3 V; 530 / 547 mV at 5 V. "A wetness threshold should be chosen that is slightly above the dry output." Sampling every 15 min or less.
  - Failure mode 1: "extreme dust buildup or bird droppings can cause the dry output of the sensor to climb above the 450 raw count threshold", giving false wet. Remedy: use the 460 threshold, or re-derive the dry baseline from the time series until the sensor is cleaned (water and cloth only).
  - Failure mode 2: frost/ice gives a much lower signal than liquid water (dielectric constant 5 vs 80).
  - Mounting angle changes wetness duration (45° suggested); UV protectant every 45 days; coating is hydrophobic; no painting or individual calibration.
- Onofre T.B., Fraisse C.W., Peres N.A., McNair J. 2020. How to avoid common problems with leaf wetness sensor installation and maintenance. UF/IFAS EDIS AE538. [FT] https://edis.ifas.ufl.edu/publication/AE538/pdf
  - Install at 30 cm, 30–45° to the ground, facing north (Northern Hemisphere), over turf, away from sprinklers (citing Sentelhas 2007, Gleason 2008, Rowlandson 2015).
  - **Dielectric sensors: the surface coating deteriorates with weather and UV, "turns yellowish and becomes rougher, causing the sensor to underreport wetness time"; replace yearly.**
  - Dirt, dust, debris, bird droppings and pollen layers require cleaning (weekly check in the planting season, otherwise biweekly or monthly). "Check the sensors any time you notice your data are not coherent."
- Santillan V.N. et al. 2010. Proc. Fla. State Hort. Soc. 123:49-55. [FT] https://journals.flvc.org/fshs/article/download/85720/82663/107485 — Decagon LWS counted wet at ≥ 274 mV with 2.5 V excitation; scanned every 15 s, averaged every 15 min.
- Dragino LMS01: only manufacturer documentation exists (FDR dielectric; 0–100 %, resolution 0.1 %, accuracy ±3 % for 0–50 % and ±6 % above; measurand described as the proportion of the sensing surface covered by droplets) [SEC, web search summary of docs.dragino.com / dragino.com]. **No independent evaluation, no published wet/dry threshold and no failure-mode study found.**
- NOT found: any study of salt or pesticide-residue effects on dielectric leaf wetness sensors; any published automatic drift test specific to leaf wetness beyond the Dandrifosse abstract.

---

## 5. Hourly wet/dry from sub-hourly samples; missing data

| System / paper | Rule | Tag / URL |
|---|---|---|
| Wang et al. 2019 (greenhouse tomato and cucumber), after Dalla Marta et al. 2005 | hour is wet when 50 % of the samples in the hour are above the sensor threshold | [FT] https://www.mdpi.com/2073-4441/11/1/158 |
| NEWA (Cornell) disease tools | "a wet hour is logged when ≥ 1 minute of sensor leaf wetness is recorded"; without a sensor, hour wet if mean RH > 90 % | [FT] https://newa.cornell.edu/how-newa-handles-weather-data |
| Michigan Enviro-weather apple scab tool | wetting period continues until leaves have been "dry" (RH below 90 % and leaves wet less than 15 min each hour) for 8 consecutive hours | [SEC, search-engine summary of https://www.canr.msu.edu/news/how_to_use_enviro-weathers_apple_scab_tool ; the page itself could not be read] |
| Sentelhas, Gillespie, Gleason et al. 2006 (research practice) | no hourly binarisation: LWD = sum of wet 15-min intervals | [FT] https://ippc2.orst.edu/len/articles_canopy_conversion/sentelhas_etal_2006_PM_eval |
| METER loggers | minutes wet per logging interval (1-min scans against threshold) | [FT] manual, URL in 4.5 |
| Yunis 1994 / BOTMAN | daily hours of wetness, averaged over a week | [ABS] URL in 3.3 |

Dry-interruption rules used operationally:
- Apple scab (Mills-type): wet periods are joined unless separated by a long dry interval: 8 consecutive dry hours (Michigan); "not more than 8 hours of dry weather" (Australian guidance); 6 h after drying plus a 3–4 h margin if drying is slow (UC IPM) [SEC, from search summaries; MacHardy & Gadoury 1989 not read]. Consistent with Magarey Table 3 (V. inaequalis insensitive, D50 ≥ 24 h).
- Botryosphaeria (Kim 2016, in hand): a dry period of at least 1 h ends the infection period.
- Magarey 2005: W1 + W2 if D < D50.

TomCast (Gillespie, Srivastava & Pitblado 1993), table as reproduced in Gillespie & Sentelhas 2008 [FT] https://revistas.usp.br/sa/article/download/22392/24416/26024 — hours of leaf wetness per day giving DSV 0 / 1 / 2 / 3 / 4:
- 13–17 °C: 0–6 / 7–15 / 16–20 / 21+ / (none)
- 18–20 °C: 0–3 / 4–8 / 9–15 / 16–22 / 23+
- 21–25 °C: 0–2 / 3–5 / 6–12 / 13–20 / 21+
- 26–29 °C: 0–3 / 4–8 / 9–15 / 16–22 / 23+
First spray at 35 cumulative DSV, then at every further 20 DSV. How TomCast turns sub-hourly sensor data into wet hours is not stated there.

MELCAST: daily EFI from a table using hours of leaf wetness and mean temperature while leaves are wet; EFI summed over days [SEC, https://pnwpest.org/risk/melcast_musk_app ]. Spray thresholds reported by extension pages: 30 EFI, or 20 for cantaloupe and 35 for watermelon (sources differ) [SEC, search summary]. EFI table not obtained.
BLITECAST: severity values from the duration of RH ≥ 90 % periods and mean temperature during them; blight predicted at 18 severity values [SEC, search summary of Oregon State reports]. Table not obtained. It uses RH hours, not leaf wetness.
Bremia (Wu 2002): wetness counted from sunrise, ≥ 3 h.

Missing data: the only explicit published rule found is NEWA's (interpolate T/RH from neighbouring hours, else gridded analysis; estimated values flagged; leaf wetness not estimated when a sensor exists). Gleason 2008: fill from nearest stations. NOT found: any rule in TOMCAST / Mills / RIMpro / BLITECAST / MELCAST sources for gaps inside a wet period.

---

## 6. Missing constants

### 6a. Empoasca decipiens
- **Naseri B., Fathipour Y., Talebi A.A. 2008. J. Entomol. Res. Soc. 10(3):11-23. [FT]** https://entomol.org/journal/index.php/JERS/article/view/65/2148 (Consensus record: https://consensus.app/papers/details/ccdaa0ce94045184b5f2d62027aa6894/?utm_source=claude_code)
  - **They did NOT estimate a threshold for E. decipiens.** "Developmental zero related to this research (T0=11.39 °C) was obtained from the results of Kouskolekas & Decker (1996) study", which is a value for Empoasca fabae (52.5 °F). Degree-days as (Tmin + Tmax)/2 − T0, natural conditions, Tehran, 2004–2005.
  - Thermal constants above 11.39 °C, mean ± SE, on P. vulgaris / P. calcaratus / P. lunatus / V. sinensis:
    - Egg: 182.11 ± 7.61 / 184.79 ± 9.08 / 182.28 ± 10.20 / 186.61 ± 8.21 DD (10.75–11.00 days)
    - Overall nymph: 272.95 ± 15.72 / 288.95 ± 11.05 / 252.52 ± 11.36 / 197.43 ± 10.47 DD (15.42 / 16.24 / 14.41 / 11.59 days)
    - Egg to adult: 455.12 ± 16.80 / 473.75 ± 13.17 / 429.76 ± 11.10 / 384.05 ± 9.24 DD (26.17 / 27.17 / 25.17 / 22.58 days)
- Raupach K., Borgemeister C., Hommes M., Poehling H.-M., Sétamou M. 2002. Crop Protection 21:113-119. [ABS] https://consensus.app/papers/details/bf731e48c0075dffa151da42e581f92d/?utm_source=claude_code — broad bean: shortest egg duration at 35 °C, most larvae emerged at 24 °C; larval development three times longer at 15 °C than at ≥ 28 °C; shortest at 30 °C (10.2 days on broad bean, 12.5 days on aubergine). No threshold in the abstract.
- Habib A. et al., J. Appl. Entomol. [ABS] https://consensus.app/papers/details/d1b7732b8c0b5cbd80ebde8125e17063/?utm_source=claude_code — Egypt; at 19 °C eggs of A. decedens and E. lybica failed to hatch.
- Do not confuse: 8.39 °C and 263.2 DD belong to the egg parasitoid Anagrus atomus (Agboka 2004) https://consensus.app/papers/details/d30a180e8d9e5a33a44a19d15deb75a8/?utm_source=claude_code
- **NOT found: a lower developmental threshold measured on E. decipiens itself.**

### 6b. Asymmetrasca decedens
- **Torres J., Hermoso de Mendoza A., Jacas J. 2002. Bol. San. Veg. Plagas 28:263-272. [FT]** https://mapa.gob.es/ministerio/pags/Biblioteca/Revistas/pdf%5Fplagas%2FBSVP%2D28%2D02%2D263%2D272%2Epdf (Consensus record: https://consensus.app/papers/details/4d9a24ae20095c05a9ef08e0568a66d5/?utm_source=claude_code)
  - Nymphal development only (neonate to adult; eggs not studied), on almond leaves, constant temperatures 9–35 °C:
    - Photoperiod 16:8: T0 = **8.7 °C**, K = **194.8 ± 5.2 DD**; rate y = 0.5110x − 4.4245 (R² 0.8629); 56.4 days at 12 °C, 10.9 days at 27 °C. No adults at 9, 10 or 30 °C (at 35 °C none reached the 3rd instar).
    - Photoperiod 12:12: T0 = **9.9 °C**, K = **174.1 ± 6.7 DD**; y = 0.5603x − 5.5596 (R² 0.8876); 34.5 days at 15 °C, 11.0 days at 27 °C; no adults at 12 °C.
    - Photoperiod 8:16: T0 = **11.1 °C**, K = **138.9 ± 6.0 DD**; y = 0.7048x − 7.8381 (R² 0.8539); 30.7 days at 15 °C, 12.4 days at 25 °C.
  - No difference between constant and fluctuating temperatures (means 20 and 25 °C) or between sexes. The authors note that thresholds from linear regression are usually above the true value, and that degree-days differ by more than 25 % between the extreme photoperiods.
  - Egg threshold and egg thermal constant: NOT available.

### 6c. Colletotrichum orbiculare (cucurbit anthracnose)
- Monroe J.S., Santini J.B., Latin R. 1997. Plant Disease 81:739-742. [ABS, publisher page] https://apsjournals.apsnet.org/doi/abs/10.1094/PDIS.1997.81.7.739 (Consensus: https://consensus.app/papers/details/f3707b94b20a595f8f64fc061672e2e3/?utm_source=claude_code)
  - Tested 12, 15, 18, 21, 24, 27, 30 °C × 2, 4, 8, 12, 16, 24 h on watermelon seedlings. Optimum 21–24 °C. "At most temperatures, as little as 2 h of leaf wetness was required for infection." Incidence rises with wetness at every temperature.
- Magarey 2005 Table 2 parameters fitted to Monroe's data [FT]: Tmin 7, Topt 24, Tmax 30 °C, Wmin 2 h, Wmax 16 h (r = 0.69, RMS 5.6 h, one of the weaker fits).
- The per-temperature table in Monroe's full text was NOT obtained. Thompson & Jenkins: no record returned by the searches.

### 6d. Colletotrichum coccodes (tomato, pepper)
- **Dillard H.R. 1989. Phytopathology 79:1063-1066. Tomato fruit. [ABS, publisher page]** https://www.apsnet.org/publications/phytopathology/backissues/Documents/1989Abstracts/Phyto79_1063.htm (Consensus: https://consensus.app/papers/details/c61386cd472b5c0187b86fedb5df377b/?utm_source=claude_code)
  - No lesions at 7 °C after 8 days. Lesion diameter greatest at 25 or 31 °C; more lesions at 25 or 31 °C than at 16 °C. Conidia per lesion increase from 16 to 28 °C and decrease at 31 °C.
  - **Wetness: no lesions with 0, 3 or 5 h; incidence 35, 75, 92, 100, 100, 100, 100 % after 10, 20, 24, 29, 44, 48, 53 h of continuous wetness.** Severity peaks at 48 h and rises with inoculum from 10^1 to 10^6 conidia/ml.
- Sanogo S. et al. 2003. Plant Disease (in hand). [ABS] https://consensus.app/papers/details/601a8d66a33d52698dd0a63ff825727b/?utm_source=claude_code — appressoria within 6 h at 16, 22, 28 °C; at least 15 h at 34 °C and 18 h at 10 °C; fruit severity rises from 15 to 30 °C and is minimal at 35 °C; dew periods 8, 16, 24 h.
- Hong J.K., Hwang B.K. 1998. Plant Disease 82. Pepper plants. [ABS] https://consensus.app/papers/details/9099b72a7b865e949b4c3d93fcbea874/?utm_source=claude_code — severity rises with wetness from 0 to 60 h; 10^4 conidia/ml with 24–36 h continuous wetness is enough for leaf lesions; above 48 h with 10^6 conidia/ml causes defoliation and blight. No temperature series in the abstract.
- Byrne 1998: in hand, not re-searched.
- Summary of what these support: no infection at 7 °C, optimum about 25–30 °C, upper limit about 35 °C; minimum wetness on tomato fruit between 5 h (none) and 10 h (35 %); 6 h for appressoria at 16–28 °C. Not in Magarey's table.

---

## What could NOT be found / read
1. Magarey 2005 contains no D50 for any downy mildew, Phytophthora infestans, Botrytis cinerea, Colletotrichum or Alternaria solani; no cardinal values for A. solani, Peronospora destructor, C. coccodes, C. gloeosporioides.
2. A measured dry-break tolerance in hours for P. cubensis, P. viticola, B. lactucae, P. destructor or B. cinerea (only qualitative statements and sporangium survival times).
3. Hildebrand & Sutton 1984 values (no abstract available).
4. Zhao et al. 2011 LWD × temperature threshold table; BOTMAN numeric class limits; Baptista RH > 90 % duration classes; Körner & Holst wet/dry hour rules (closed full texts).
5. Rowlandson et al. 2015 full text (abstract only).
6. Dandrifosse 2024 leaf-wetness plausibility rule (full text behind a bot check, not bypassed).
7. A greenhouse VPD threshold for leaf condensation.
8. Any independent study of the Dragino LMS01; salt or pesticide residue effects on dielectric sensors.
9. TomCast / MELCAST / BLITECAST rule for binarising sub-hourly wetness and for gaps; MELCAST EFI table; BLITECAST table.
10. A lower developmental threshold measured on Empoasca decipiens; egg-stage constants for A. decedens; Monroe 1997 per-temperature table; Thompson & Jenkins.

Access notes: apsjournals PDFs, MDPI and CORE refuse scripted downloads; ScienceDirect showed a bot check. MDPI and APS abstract pages were read through the in-app browser. The WebFetch summariser refused the Magarey PDF, so open PDFs were downloaded into the scratchpad (dl_magarey, dl2) and read with pdftotext (text in scratchpad\txt).

---

## CONSENSUS MESSAGE

Create or connect a free Consensus account to return more than 3 results per search in Claude Code.: https://consensus.app/sign-up/?utm_source=claude_code&auth=claude_code
