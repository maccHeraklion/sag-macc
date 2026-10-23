# Field calibration of in-situ soil EC sensors against laboratory salinity (ECe / EC1:5 / EC1:2)

Notes on method. Three of the key PDFs could not be read as web pages (Kargas et al. 2022 Water, Spiteri & Sacco 2024, Kim et al. 2020 IJABE), and neither could the METER application note. They were downloaded and converted with `pdftotext`, so the numbers below were read from the papers themselves. That conversion lost the plus and minus signs in a few equations. Where I restored a sign, I say so and say how it was checked. Findings marked "(search snippet)" come from search-engine abstracts and were not checked against the full text.

## 1. ECe vs EC1:5 vs EC1:2: lab procedures, cost, conversion equations, accuracy

### Takeaway
ECe (saturated-paste extract) is the reference that crop salt-tolerance thresholds use. EC1:5 and EC1:2 are cheaper and faster, but converting them to ECe depends on soil texture. In 148 Greek irrigated soils the factor ranged from 4.72 (clay) to 8.22 (sandy loam). Estimating the factor from texture through the saturation percentage (SP) lowered the error only modestly, from RMSE 1.48 to 1.39 dS/m. For calcareous Mediterranean-island soils (Malta), EC1:2 converted best (validation RMSE 0.87 dS/m), and none of the models worked for coarse sands.

### Cited Findings
**Lab procedures (as actually run in the Greek reference study)**
- Saturated paste (USDA method): 350 g of air-dried soil, with distilled water added gradually while stirring until the paste glistens and flows slightly when the container is tipped. The paste equilibrates for 24 h, is extracted on a Büchner funnel with filter paper under vacuum, and EC is read at 25 °C. — [Kargas, Londra & Sotirakoglou 2022, Water 14:642](https://www.mdpi.com/2073-4441/14/4/642)
- EC1:5: 20 g of air-dried soil plus 100 mL of distilled water, shaken mechanically for 15 min, left to stand 1 h, shaken again for 5 min, then vacuum-filtered and EC read. — [Kargas et al. 2022](https://www.mdpi.com/2073-4441/14/4/642)
- Kargas et al. call the saturated paste "laborious and time-consuming", especially in clay soils. They say the 1:1 and 1:5 extracts need less preparation and extraction time and cost less than ECe. — [Kargas et al. 2022](https://www.mdpi.com/2073-4441/14/4/642)
- Published conversion factors (CF = ECe/EC1:5) range from 5.05 to 11.7 between studies. — [Kargas et al. 2022](https://www.mdpi.com/2073-4441/14/4/642)

**Greek dataset (Kargas et al. 2022): 148 samples from Dystos, Iria and Skala, 0–30 cm, irrigated coastal soils, about 500 mm/yr rainfall**
- Sampling at Iria was done twice: at the end of the irrigation period (August) and at the end of the rainy period (March). 77.7% of samples had ECe below 4 dS/m. Mean ECe was about 6.6 × mean EC1:5. — [Kargas et al. 2022](https://www.mdpi.com/2073-4441/14/4/642)
- Single linear factor: ECe = 6.6927·EC1:5, R² = 0.9627, RMSE = 1.48 dS/m. — [Kargas et al. 2022](https://www.mdpi.com/2073-4441/14/4/642)
- Measured mean CF by texture class:

  | Class | n | CF |
  |---|---|---|
  | Clay | 24 | 4.72 |
  | Clay loam | 66 | 6.04 |
  | Loam | 20 | 6.64 |
  | Sandy clay loam | 14 | 6.66 |
  | Sandy loam | 9 | 8.22 |

  Coarser soils have a higher CF. — [Kargas et al. 2022, Table 2](https://www.mdpi.com/2073-4441/14/4/642)
- Texture-based CF:
  - CF = m + k/SP%, with m = 1.054 and k = 283.4 (Jordan coefficients, Gharaibeh et al.).
  - SP% = 49.699 + 0.524·Clay% − 0.339·Sand%, with R² = 0.749 and MAE 3.703%.
  - Predicted CF per class: 5.45, 6.14, 6.96, 7.07 and 8.17. Mean relative error was 15% for clay and ≤6.2% for the other classes.
  - Combined model: R² = 0.9887, RMSE = 1.39 dS/m.
  - With the Australian coefficients (Slavich & Petterson: m = 2.46, k = 3.03, SP in g/g) the fit was worse: R² 0.96, RMSE 1.81 dS/m. The authors say the model is valid for medium- to fine-textured soils only.
  - Sign check: the extracted PDF dropped the + and − operators. I restored them from the paper's statement that SP rises with clay and falls with sand, and confirmed them because the restored equations reproduce Table 2 (for example, clay loam with 32% clay and 34% sand gives SP ≈ 55 and CF ≈ 6.2). — [Kargas et al. 2022](https://www.mdpi.com/2073-4441/14/4/642)
- Jordan SP equation, for comparison: SP% = 43.83 + 0.313·Clay% − 0.303·Sand% (Gharaibeh et al., 177 samples; signs restored the same way). — cited in [Kargas et al. 2022](https://www.mdpi.com/2073-4441/14/4/642)

**Calcareous Mediterranean-island soils (Malta and Gozo, Spiteri & Sacco 2024): 114 calibration samples and 22 validation samples**
- Mostly highly calcareous, low-OM soils. Clay loam 33%, loam 16%, clay 14%. Mean ECe was 1.9 × EC1:1, 3.4 × EC1:2 and 7.1 × EC1:5. — [Spiteri & Sacco 2024, Commun. Soil Sci. Plant Anal., doi:10.1080/00103624.2024.2304636](https://um.edu.mt/library/oar/bitstream/123456789/117868/1/Estimating_the_electrical_conductivity_of_a_saturated_soil_paste_extract_ECe_from_11_EC11_12_EC12_and_15_EC15_soilwater_suspension_ratios_in_calcareous_soils_from_the_Mediterranean_Islands_2024.pdf)
- General log-log models (EC in dS/m):

  | Extract | Model | Power form | r² | Validation RMSE | NSE |
  |---|---|---|---|---|---|
  | EC1:1 | log ECe = 0.945·log EC1:1 + 0.292 | ECe ≈ 1.96·EC1:1^0.945 | 0.93 | 0.97 dS/m | 0.96 |
  | EC1:2 | log ECe = 0.972·log EC1:2 + 0.515 | ECe ≈ 3.27·EC1:2^0.972 | 0.93 | 0.87 dS/m | 0.97 |
  | EC1:5 | log ECe = 1.023·log EC1:5 + 0.838 | ECe ≈ 6.89·EC1:5^1.023 | 0.91 | 0.93 dS/m | 0.96 |

  — [Spiteri & Sacco 2024](https://um.edu.mt/library/oar/bitstream/123456789/117868/1/Estimating_the_electrical_conductivity_of_a_saturated_soil_paste_extract_ECe_from_11_EC11_12_EC12_and_15_EC15_soilwater_suspension_ratios_in_calcareous_soils_from_the_Mediterranean_Islands_2024.pdf)
- The general models work for fine and medium textures. The coarse-texture model (sand and loamy sand, n = 7) differed significantly and failed validation (RMSE 15.29 dS/m, NSE −3.23 for 1:5). The authors attribute the texture effect mainly to clay, which retains ions and raises SP. — [Spiteri & Sacco 2024](https://um.edu.mt/library/oar/bitstream/123456789/117868/1/Estimating_the_electrical_conductivity_of_a_saturated_soil_paste_extract_ECe_from_11_EC11_12_EC12_and_15_EC15_soilwater_suspension_ratios_in_calcareous_soils_from_the_Mediterranean_Islands_2024.pdf)
- Published EC1:5 → ECe equations, as tabulated in Spiteri & Sacco 2024:

  | Source | Equation | r² |
  |---|---|---|
  | Aboukila & Norton 2017 | 5.04·EC1:5 + 0.37 | 0.93 |
  | Aboukila & Abdelaty 2017 | 7.46·EC1:5 + 0.43 | 0.97 |
  | Chi & Wang 2010 | 11.74·EC1:5 − 6.15 | 0.94 |
  | Kargas et al. 2018 | 11.68·EC1:5 − 5.77 | 0.931 |
  | Khorsandi & Yazdi 2011 | 6.53·EC1:5 − 0.108 | — |
  | Ozcan et al. 2006 | 5.60·EC1:5 − 4.37 | 0.90 |
  | Park et al. 2019 | 5.97·EC1:5 − 1.17 | 0.98 |
  | Sonmez et al. 2008 | 8.70·EC1:5 | 0.99 |
  | Visconti & De Paz 2012 | 7.58·EC1:5 + 0.06; 7.36·EC1:5 − 0.24; 5.70·EC1:5 − 0.2 | — |

  — [Spiteri & Sacco 2024, Table 1](https://um.edu.mt/library/oar/bitstream/123456789/117868/1/Estimating_the_electrical_conductivity_of_a_saturated_soil_paste_extract_ECe_from_11_EC11_12_EC12_and_15_EC15_soilwater_suspension_ratios_in_calcareous_soils_from_the_Mediterranean_Islands_2024.pdf)
- Another study found the opposite texture trend: fine 8×, medium 10×, coarse 6–8× (search snippet, Egyptian journal). This conflicts with Kargas et al., where coarse soils had the highest CF. — [asejaiqjsae.journals.ekb.eg](https://asejaiqjsae.journals.ekb.eg/article_4181_6adeec9189f7d44e2875c8273b7d0625.pdf); contradicted by [Kargas et al. 2022](https://www.mdpi.com/2073-4441/14/4/642)

### Inferences
- **Best lab choice for a Crete calibration programme.** Order EC1:5 (or EC1:2) on every calibration sample, plus a full saturated paste (ECe and SP) on a subset of about 1 in 4 to 5 samples per field. Use the subset to fit a field- or farm-specific CF. Until local pairs exist, use the Greek texture model CF = 1.054 + 283.4/SP% (SP from measured SP, or from clay and sand). Avoid a universal factor: across 5.05–11.7, a fixed CF of 6.7 can be off by about 40% in clay or sandy loam.
- Measuring SP directly (it comes free with the paste) removes the texture-regression error, which had an MAE of 3.7 SP-percentage points. That SP is also needed for the sensor conversion in section 3.
- A theoretical cross-check is that pure dilution gives CF ≈ 500/SP% (1:5 = 500 g water per 100 g soil). The fitted k of 283.4 is well below 500, because extra salts (especially gypsum and carbonates in calcareous soils) dissolve at higher dilution. Pure dilution would therefore overestimate CF. This is reasoning, not a sourced result.
- In coarse, sandy, or very stony Cretan soils, all EC1:x conversions are unreliable. Use ECe directly there.

### Gaps
- I found no published per-sample price split between ECe and EC1:5 for Greek labs (see section 5). The relative cost ("cheaper and faster") is qualitative in the sources.
- I found no Crete-specific EC1:5 → ECe calibration. The nearest analogues are Kargas (mainland Greece, mostly clay loam) and Malta (calcareous).
- The Egyptian-journal factors (8/10/6–8) come from a snippet only and were not verified.

## 2. Published protocols for calibrating capacitance/FDR/TDR EC sensors to lab values (samples, moisture states, regression, error reduction)

### Takeaway
No vendor publishes a "calibrate bulk EC to ECe" field protocol. The published approaches are:
- (a) a Hilhorst pore-water model with a soil-specific offset ε₀, and/or
- (b) empirical regressions of ECe on bulk EC (ECb) plus water content, fitted on paired sensor and lab samples.

Field studies used about 100 paired points per region (Segura, Spain: 104). Multivariate models beat manufacturer calibrations. All sources agree that accuracy collapses at low water content and at low ECb (below about 1 dS/m in fine soils).

### Cited Findings
- **Sensors measure bulk EC, not pore water EC.** The only way to get pore-water EC is to extract water. ECe is the value used in "almost all salinity recommendations". — [METER Group application note "Soil Electrical Conductivity"](https://library.metergroup.com/Retired%20and%20Discontinued/Application%20Notes/18190%20Soil%20Electrical%20Conductivity_Web.pdf)
- **Hilhorst method accuracy.** METER reports "fair accuracy (±20%)" for pore EC from the Hilhorst method at high water content (above 25%). As θ falls, the denominator (εb − ε₀) becomes small, "leading to large potential errors". METER recommends computing ECe from data taken when water content is highest. — [METER app note](https://library.metergroup.com/Retired%20and%20Discontinued/Application%20Notes/18190%20Soil%20Electrical%20Conductivity_Web.pdf)
- **Visconti et al. 2014, Soil Research 52(5):419–430** (WET and 5TE sensors, clay loam). For both sensors, the empirical "SDM model" and the Rhoades equation gave the most accurate pore-water EC with the fewest parameters, beating the Hilhorst equation and a 3rd-order polynomial. The reference pore-water EC was modelled rather than taken from the wetting water. — [AGRIS record](https://agris.fao.org/search/en/records/65de50936eef00c2cea06607); [CSIRO](https://www.publish.csiro.au/SR/SR13331)
- **De-Paz, Visconti & Rubio, Segura river lowland, SE Spain** (WET sensor, field salinity mapping). 104 sampling points; pore EC from the sensor versus saturation-extract EC gave r = 0.818 (p < 0.001), and depth-specific regressions predicted ECse (search snippet). — [ReDivia record](https://buscador.una.edu.ni/Record/ReDivia4323?lng=en)
- **Kargas & Londra 2022, Soil Research** (WET-2, Greece). Strong positive correlation between ECb and ECe (P < 0.001), and site-specific multiple-regression models estimated ECe. In finer-textured soils with ECb < 1 dS/m, additional soil parameters were needed (search snippet). — [CSIRO SR22163](https://publish.csiro.au/SR/SR22163)
- **Land 2024** (WET, multivariate calibration). WET overestimates permittivity as EC rises, and its performance degrades above about 3 dS/m ECb. A multivariate (ε + ECb) calibration gave water-content RMSE ≤ 0.022 m³/m³, against ≤ 0.027 for univariate and ≤ 0.042 for the manufacturer calibration (search snippet). — [Land 13(9):1490](https://www.mdpi.com/2073-445X/13/9/1490)
- **TEROS 12 lab study** (Sensors 2024): six porous media, EC about 0.28–10 dS/m. The best results (RMSE) came from multipoint calibration. — [PMC11014125](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11014125/)
- **Kim et al. 2020, IJABE 13(1):206–210** (METER 5TE, reclaimed tidal land in Korea, initial EC1:5 20–22 dS/m). Raw bulk EC "showed no specific correlation" with EC1:5. The authors instead fitted EC1:5 = a·(θsensor/θgravimetric) + b, with R² = 0.98. This exploits the salinity-induced overestimate of sensor θ, and it needs an independent θ (they recommend a tensiometer). The 5TE spec they quote is bulk EC ±10% from 0–7 dS/m, with user calibration required above 7 dS/m. — [IJABE](https://ijabe.org/index.php/ijabe/article/view/3905)
- **Soil-specific ε₀ (Hilhorst offset).** Default ε₀ ≈ 4.1 for mineral soil. In coir, the measured ε₀ was 1.64, and the adjusted Hilhorst model gave ECe RMSE 0.929 dS/m and R² 0.62 (search snippet). — [AGRIS 2024 coir FDR](https://agris.fao.org/search/en/providers/122436/records/67597e2bc7a957febdf8f2ee)
- **Lab calibration practice.** Batch-mixed soil packed to field dry density is the common lab calibration approach for electromagnetic sensors (search snippet). — [drought.gov Soil Moisture Data Quality Guidance, Ch. 6 (2024)](https://www.drought.gov/sites/default/files/2025-10/Soil-Moisture-Data-Quality-Guidance-Chapter-6.pdf)

### Inferences — proposed low-cost per-field protocol (synthesis, not a published standard)

**1. Install and wait.** Install per vendor guidance (section 4). Wait at least 2–4 weeks for the soil to re-settle around the probe before the first calibration pair.

**2. Calibration campaigns.** Run 3 campaigns per field in the first year:
- end of the rainy season (March), when soils are low-salinity and wet;
- mid-irrigation season (June/July);
- end of the irrigation season (late August or September), at peak salinity.

This mirrors the Kargas sampling design and gives a wide salinity range, which the regression needs.

**3. Sample timing.** In each campaign, sample 24–48 h after an irrigation, when θ is high. Accuracy is best at high θ, and METER flags θ below 0.25 as unreliable. Do not sample within a few hours of fertigation, because pore water is then transiently enriched.

**4. Sample location.** At each sensor, take 2–3 cores within about 10–20 cm of the probe, at the probe depth (±5 cm), and bulk them into one composite. Never disturb the soil directly over the probe. Also take one undisturbed ring sample at the same depth for bulk density and θ (gravimetric).

**5. Record the sensor reading.** Use the sensor reading closest in time, as a median of the readings within ±1 h. Record raw ECb, raw ε (if available) and T.

**6. Lab analysis.**
- Every composite: EC1:5 (or EC1:2).
- At least 1 composite per field per campaign: full saturated paste, giving ECe and SP.
- Once per field: texture.

**7. Fit order.**
- (a) Convert lab results to ECe using the field CF (section 1).
- (b) Compute the "model ECe" from the sensor via Hilhorst and θ/θs (section 3), first with ε₀ = 4.1.
- (c) If at least 6 pairs exist, fit a single multiplicative factor (ECe_lab = f·ECe_model) or the soil-specific ε₀ by least squares.
- (d) Fit a 2-parameter linear model only when the pairs span at least a 2× range in ECe.

**8. Sample size.**
- 2-parameter linear model: about 6–10 pairs per field and depth over the 3 campaigns.
- 1-parameter factor: 3–5 pairs.

Regional studies used about 100–150 samples, but those fitted region-wide models.

**9. Acceptance criterion.** Use leave-one-out error. Expect about ±20% at best (METER) and about 1 dS/m RMSE in ECe (Malta, Segura and coir all lie roughly at 0.9–1.4 dS/m).

**10. Low-salinity fields.** In fine soils with ECb below about 1 dS/m, report salinity as "below threshold / low" rather than a number, since the WET-2 study says such soils need extra parameters.

### Gaps
- I found no vendor-published field protocol giving a sample count or a pre/post-calibration ECe error for METER, Delta-T, Sentek or Dragino. The METER ±20% figure is for the Hilhorst model, not for a field-calibrated sensor.
- I did not obtain full texts of Visconti et al. 2014, De-Paz et al. or Kargas & Londra 2022 (WET-2), so their exact coefficients and RMSE are not reported here.
- Sentek-specific salinity calibration material (TriSCAN "VIC") was not found in this pass.
- The "one-point" (or few-point) 5TE calibration claim surfaced in a search summary but could not be traced to a verifiable URL, so it is excluded.

## 3. Determining θs (saturation water content) to convert pore EC → ECe; error of texture defaults

### Takeaway
The standard chain (METER/Hilhorst) has three steps:
1. Pore EC: σp = εp·σb / (εb − ε₀), with ε₀ ≈ 4.1 and εp ≈ 80, adjusted for temperature.
2. ECe = σp·θ/θs.
3. θs = 1 − ρb/2.65.

θs is best measured from an undisturbed ring sample (bulk density). Lab SP is a gravimetric water content of a remoulded paste and is not the same as field θs. The ECe error scales one-to-one with the relative θs error, so a ±0.05 error on θs ≈ 0.45 gives about ±11% in ECe.

### Cited Findings
- **Pore EC (Hilhorst 2000, SSSAJ 64:1922–1925).** σw = εw·σb / (εb − εσb=0). εw (pore water permittivity) is "around 80", and a more accurate value comes from soil temperature measured next to the EC electrodes. εσb=0 is the offset, 4.1 for most mineral soils. — [METER app note](https://library.metergroup.com/Retired%20and%20Discontinued/Application%20Notes/18190%20Soil%20Electrical%20Conductivity_Web.pdf)
- **Pore EC → ECe.** METER's Eq. 3/5 assumes salt stays in the soil as water is removed: σe = σw·θ/θs. θs is computed from bulk density as θs = 1 − ρb/ρs, with ρs = 2.65 Mg/m³ for mineral soil. Worked example: ρb = 1.33 gives θs = 0.50; with σb = 0.3 dS/m, θ = 0.345 and εb = 20, ECe is then computed. METER calls the combined equation "likely to be the most useful equation for assessing salinity in the field", to be used "when water contents are highest". — [METER app note](https://library.metergroup.com/Retired%20and%20Discontinued/Application%20Notes/18190%20Soil%20Electrical%20Conductivity_Web.pdf)
- **Coir offset.** The medium-specific ε₀ differed strongly from 4.1 (1.64 in coir), so ε₀ is a soil-specific calibration parameter. — [AGRIS 2024](https://agris.fao.org/search/en/providers/122436/records/67597e2bc7a957febdf8f2ee)
- **Salinity biases θ.** Topp-equation θ is generally within about 3% of measured θ when ECe < 10 dS/m in mineral soil. Water EC above 10 dS/m inflated 5TE θ readings (search snippet). — [ICBA 5TE evaluation](https://dev.biosaline.org/sites/default/files/publicationsfile/evaluation_of_the_decagon_5te.pdf). Consistent with this, Kim et al. found sensor θ above true θ when EC1:5 > 6 dS/m. — [IJABE](https://ijabe.org/index.php/ijabe/article/view/3905)
- **SP from texture.** For Greek soils, SP% = 49.699 + 0.524·Clay% − 0.339·Sand%, with MAE 3.7 SP points (R² 0.749). — [Kargas et al. 2022](https://www.mdpi.com/2073-4441/14/4/642)

### Inferences
- **θs options, best to worst:**
  1. A measured ρb from a ring core at sensor depth gives θs = 1 − ρb/2.65. In Cretan calcareous soils, ρs is about 2.65–2.70; using 2.70 changes θs by only about 0.01.
  2. Lab SP × ρb/ρw. A paste is usually wetter than field saturation, so this overestimates θs and underestimates ECe.
  3. Texture-class default ρb (for example 1.3–1.5).
- **Error of a texture default.** A ρb error of ±0.1 Mg/m³ gives a θs error of about ±0.04, roughly ±8–10% relative, which passes one-to-one into ECe. This is smaller than the ±20% Hilhorst model error but not negligible. Tilled topsoil ρb also changes seasonally.
- **Amplification of sensor error into ECe.** For θ ≈ 0.30 (εb ≈ 16 by Topp), εp = 80, ε₀ = 4.1 and θs = 0.45, ECe ≈ 4.5 × σb. Every error in bulk EC is therefore multiplied by about 4–5 in ECe, and by more at lower θ.
- A field-fitted factor f, or a fitted ε₀, absorbs θs, ρs and sensor-gain errors together. This is why an empirical per-field correction (section 2) is cheaper than measuring each term separately.

### Gaps
- I found no study that quantified the ECe error from using texture-class default θs versus measured θs. The ±8–10% figure above is my own propagation.
- The exact εw(T) formula in the METER note was not legible in the extracted PDF. Hilhorst (2000) should be consulted for the exact temperature expression.

## 4. Sensor error sources and documented accuracy of Dragino SE01/SE0x and similar low-cost probes

### Takeaway
Dragino's only stated EC accuracy is "2% FS" on a 0–20,000 µS/cm range, which is ±400 µS/cm (±0.4 dS/m) of bulk EC. That is large against typical irrigated-soil bulk EC of a few tenths to about 1.5 dS/m. It is factory-calibrated "for mineral soil" (the FAQ also says saline-alkali and loamy), and I found no independent peer-reviewed validation. The SE01 can output raw dielectric and raw conductivity (MOD=1), which makes a platform-side Hilhorst and field calibration feasible. The other main error sources are air gaps and disturbed soil, low θ, temperature, and high-EC bias in θ.

### Cited Findings
- **Dragino SE01-LB EC spec.**
  - Range 0–20,000 µS/cm at 25 °C, resolution 1 µS/cm, accuracy 2% FS, "Conductivity, with temperature compensate".
  - Moisture by FDR "with the compensation from soil temperature and conductivity", accuracy ±3% (0–53% v/v) and ±5% (>53%).
  - "Calibrated in factory for Mineral soil type". The FAQ instead says calibrated for saline-alkali and loamy soils, and says other soils can be recalibrated on the IoT platform from user-measured values via an external formula PDF.
  - Neither the wiki nor the datasheet says whether reported EC is bulk EC.

  — [Dragino SE01-LB wiki](https://wiki.dragino.com/docs/LoRaWAN-End-Node/soil-agriculture-sensors/se01-lb/); [SE01-LB datasheet](https://cdn.robotshop.com/media/D/Drt/RB-Drt-173/pdf/se01-lb-lorawan-soil-moisture-ec-sensor-datasheet.pdf); [Dragino product page](https://www.dragino.com/products/agriculture-weather-station/item/277-se01-lb.html)
- **Raw output mode.** `AT+MOD=1` or downlink `0A 01` makes the SE01 report raw conductivity (temperature-drift compensated), raw soil moisture and a raw dielectric constant. Return to normal mode with `AT+MOD=0` or `0A 00`. There is no on-device soil-type calibration command. — [Dragino SE01-LB wiki](https://wiki.dragino.com/docs/LoRaWAN-End-Node/soil-agriculture-sensors/se01-lb/)
- **Dragino installation guidance.**
  - Choose a representative spot and avoid stones or hard objects contacting the probe.
  - Keep the soil at its original density.
  - Insert the probe vertically without shaking.
  - For long-term monitoring, dig a hole wider than 20 cm, insert the probe horizontally in the side wall, and backfill.

  — [Dragino SE01-LB wiki](https://wiki.dragino.com/docs/LoRaWAN-End-Node/soil-agriculture-sensors/se01-lb/)
- **LSE01** (older model) carries the same factory-calibration-for-mineral-soil statement. — [Dragino LSE01](https://www.dragino.com/products/lora-lorawan-end-node/item/159-lse01.html)
- **Low θ.** Pore EC errors grow at low θ; Hilhorst is only "fair (±20%)" above 25% θ. — [METER app note](https://library.metergroup.com/Retired%20and%20Discontinued/Application%20Notes/18190%20Soil%20Electrical%20Conductivity_Web.pdf)
- **High EC.** It biases θ and permittivity upwards:
  - WET degrades above about 3 dS/m ECb — [Land 2024](https://www.mdpi.com/2073-445X/13/9/1490)
  - 5TE bulk EC is ±10% only up to 7 dS/m — [IJABE](https://ijabe.org/index.php/ijabe/article/view/3905)
  - 5TE θ is inflated above 10 dS/m — [ICBA](https://dev.biosaline.org/sites/default/files/publicationsfile/evaluation_of_the_decagon_5te.pdf)
- **Temperature.** εw depends on temperature, so METER sensors co-locate a thermistor. Dragino reports EC referenced to 25 °C. — [METER app note](https://library.metergroup.com/Retired%20and%20Discontinued/Application%20Notes/18190%20Soil%20Electrical%20Conductivity_Web.pdf); [Dragino wiki](https://wiki.dragino.com/docs/LoRaWAN-End-Node/soil-agriculture-sensors/se01-lb/)
- **Offset varies with depth.** In a TDR column study, the modified-Hilhorst offset varied with depth even in homogeneous soil, possibly because of temperature gradients (search snippet). — [J-STAGE JSIDRE 83(2)](https://www.jstage.jst.go.jp/browse/jsidre/83/2/_contents/-char/en)
- **Unit-to-unit variation.** A reduced-cost dual-frequency sensor showed little unit-to-unit deviation for θ except near saturation (search snippet). — [Noborio & Kubo, AGRIS](https://agris.fao.org/search/en/records/65df9c090f3e94b9e5da76d7)
- **Third-party advice for Dragino probes.** A codec site notes the probes are "calibration-sensitive" and advises correlating against handheld readings on site. — [MeteoScientific LSE01 codec](https://support.meteoscientific.com/codecs/dragino/lse01/)

### Inferences
- **Spec-only error.** With ±0.4 dS/m on bulk EC and the about 4–5× amplification in section 3, the spec-only uncertainty in ECe is roughly ±1.5–2 dS/m at θ ≈ 0.30. That is the same size as the "no yield loss" thresholds of sensitive crops (bean, 2 dS/m per METER). Without field calibration, Dragino EC can therefore only support coarse categories (low / moderate / high). It does not support crop-specific yield-loss estimates.
- A per-probe factor fitted against lab ECe absorbs the probe's gain error, the soil ε₀ and the θs error together. It is the most cost-effective correction. Use MOD=1 raw ε and EC so that the platform, not the device firmware, owns the model.
- **Sensor-to-sensor variation.** Before installation, put each probe in 2–3 KCl or NaCl reference solutions or a saturated sand bucket (for example 1.41 dS/m, which is the KCl 0.01 M standard). This flags outlier units cheaply. It is not in the Dragino docs; it is standard practice.
- **Air gaps.** A probe that reads low ECb and low θ relative to its neighbours after installation, and never recovers after irrigation, is probably in an air gap or near a stone. Reinstall it rather than calibrate it.

### Gaps
- I found no peer-reviewed validation of Dragino SE01/SE0x/SE02 EC against lab ECe or EC1:5, and no published drift rate.
- The "external formula PDF" mentioned in the Dragino FAQ for platform-side recalibration was not retrieved.
- I found no published long-term drift figures (%/year) for low-cost stainless-electrode EC probes.

## 5. Greek context: availability and cost of soil salinity lab tests (ELGO-DIMITRA, university, private labs in Heraklion/Crete)

### Takeaway
Public options exist:
- Regional agricultural labs under ΥΠΑΑΤ. A 2022 ministry speech gives a full soil analysis at €20.82 per sample with professional-farmer certification, or €69.40 without.
- An accredited ELGO-DIMITRA soil lab (joint sampling and analysis scheme with ΓΕΩΤΕΕ, 2023).
- The Benaki Phytopathological Institute, at about €4.96 incl. VAT per EC determination, but for soil improvers and substrates (EN 13038).

I found no published price list for a Heraklion private lab, and no separate price for the saturated paste (ECe) versus EC1:5.

### Cited Findings
- **ΥΠΑΑΤ speech of 26-05-2022.** Full analysis of one soil sample at €20.82 with farmer certification and €69.40 without. The speech also mentions sampling depths of 0–30, 30–60 and 60–90 cm (0–30 cm for existing crops). The numbers were confirmed in the PDF. The Greek text could not be extracted cleanly, so the context comes from a search summary, and whether "full analysis" includes ECe is unconfirmed. — [minagric.gr speech PDF](https://www.minagric.gr/images/stories/ekdhlwseis/2020/omilia_koutsonakos_260522.pdf)
- **ELGO-DIMITRA.** Agronomists and farmers are trained in soil sampling, and samples are analysed at the Institute's "specialised and accredited laboratory", covering texture, physicochemical properties and nutrients (ΓΕΩΤΕΕ document, 2023). The lab's city is not stated. — [geotee.gr 2023](https://geotee.gr/lnkFiles/20231024132433_4.pdf)
- **Benaki Phytopathological Institute (ΕΜΠΑ).** EC (mS/cm) and total salts at about €4.96 incl. VAT per sample, method EN 13038:2012. This is for soil improvers and growing media, not necessarily mineral soils (search summary). — [bpi.gr request form](https://www.bpi.gr/files/anakoinvseis-theseis/27032025/ΑΙΤΗΣΗ%20ΔΙΕΝΕΡΓΕΙΑΣ%20ΔΟΚΙΜΩΝ%20ΣΕ%20ΕΔΑΦΟΒΕΛΤΙΩΤΙΚΑ%20ΚΑΙ%20ΥΠΟΣΤΡΩΜΑΤΑ%20ΕΜΠΑ%20V1.0.pdf); [bpi.gr soils information sheet](https://bpi.gr/files/anakoinvseis-theseis/Pliroforiaka%20Deltia/Ε.701-3_Αιτηση-Δοκιμης-%20Πληροφοριακο-Δελτιο-Εδάφη.pdf)
- **ELGO-DIMITRA Heraklion institute.** The Institute of Olive Tree, Subtropical Plants and Viticulture (Heraklion) has a Water Resources, Irrigation and Environmental Geoinformatics lab that appears in the Crete irrigation bulletins. — [Crete Region irrigation bulletin 2026](https://www.crete.gov.gr/wp-content/uploads/2026/08/Αρδευτ.-Δελτίο-Π.Ε.-Λασιθίου_682026.pdf)

### Inferences
- **Budget per field-year** (3 campaigns, 2 depths, EC1:5 on all 6 composites plus 2 full pastes plus 1 texture). At public-lab rates of about €5–25 per determination, that is roughly 9 lab determinations, so roughly €50–200 per field-year. This is my own estimate and should be confirmed with quotes. A company-owned €100–300 benchtop conductivity meter plus a vacuum funnel would let MACC run EC1:5 and EC1:2 in-house, sending only the paste subset to an accredited lab.
- The Heraklion ELGO-DIMITRA institute and the regional ΔΑΟΚ are the most likely local providers. Contact them directly for an ECe-versus-EC1:5 quote.

### Gaps
- I found no web-published price for saturated-paste ECe in any Cretan lab (public or private), and no list of private soil labs in Heraklion.
- I could not confirm whether the €20.82/€69.40 "full analysis" includes salinity (EC), or which ratio it uses.
- I did not verify the 2022 prices against 2026 rates.
