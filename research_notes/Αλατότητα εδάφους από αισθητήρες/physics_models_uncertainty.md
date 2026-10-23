# Physics, models and uncertainty: bulk EC → pore-water EC → ECe from capacitance/FDR soil sensors

Notes on the conversion chain. Primary texts read in full for this session: Hilhorst (2000) SSSAJ paper (Stevens-hosted PDF), Delta-T WET Sensor User Manual v1.6 (technical reference and specifications), METER application note 18190 "Soil Electrical Conductivity" (2018), and FAO Irrigation & Drainage Paper 57 (Rhoades, Chanduvi & Lesch 1999, "Soil salinity assessment"). Everything else comes from abstracts, publisher pages or secondary summaries, and is labelled that way where relevant.

---

## 1. Hilhorst (2000) pore-water EC model: equation, offset, soil specificity, valid range, temperature

### Takeaway
Hilhorst's model, σp = εp·σb / (εb − εσb=0), is physically based. Its single soil parameter, the offset εσb=0, ranged from 1.9 to 7.6 across the seven materials in the original paper. The default value 4.1 is only an average. The model was validated only for θ from 0.10 to saturation and σp ≤ 0.3 S/m (3 dS/m) at 20 °C. As θ falls, the denominator (εb − ε0) shrinks, so a fixed offset error turns into a large relative error in σp.

### Cited Findings
- **Exact equation (Hilhorst Eq. 14):** σp = εp·σb / (εb − εσb=0). Here σp is pore-water conductivity, εp is the real permittivity of pore water, σb is bulk conductivity, εb is the real bulk permittivity, and εσb=0 is "the extrapolated intercept with the y axis from the linear part of the εb vs. σb plot". It is derived from εb = εσb=0 + εp·g(θ) and σb = σp·g(θ). The shared geometry/water-content function g(θ) cancels in the ratio. — [Hilhorst 2000, SSSAJ 64:1922–1925 (PDF)](https://stevenswater.com/resources/documentation/1922HilHorst.pdf)
- **Physics of the cancellation:** εb and σb respond equally to electrode shape, probe–soil contact and soil composition, so g(θ) drops out. "Contact problems have only minor effect on σp measurements." — [Hilhorst 2000](https://stevenswater.com/resources/documentation/1922HilHorst.pdf)
- **εp and its temperature dependence:** εp = 80.3 at 20 °C, with a temperature coefficient of about −0.37 /°C (Kaatze & Uhlendorf 1981). Vendors implement this as εp = 80.3 − 0.37·(T − 20). — [Hilhorst 2000](https://stevenswater.com/resources/documentation/1922HilHorst.pdf); [METER app note 18190](https://library.metergroup.com/Retired%20and%20Discontinued/Application%20Notes/18190%20Soil%20Electrical%20Conductivity_Web.pdf); [Edaphic Scientific](https://edaphic.com.au/monitoring/soil-salinity-explained/)
- **Temperature dependence of σp:** ionic conduction in NaCl–water rises about 2.25 %/°C. Hilhorst notes that the correction "depends on the composition of the solution" and did not apply one. — [Hilhorst 2000](https://stevenswater.com/resources/documentation/1922HilHorst.pdf)
- **Delta-T per-ion coefficients (approx., at 25 °C):** Na⁺ 2.1, K⁺ 1.9, Ca²⁺ 2.1, H⁺ 1.5, NH₄⁺ 1.9, Cl⁻ 1.9, NO₃⁻ 1.8, OH⁻ 1.5 %/°C. WET readings are uncompensated by default, and both 20 °C and 25 °C are in use as reference temperatures. — [Delta-T WET Sensor User Manual v1.6, pp. 18–19](https://delta-t.co.uk/wp-content/uploads/2022/07/WET150_kit_Quick_Start_Guide_v2.0.pdf) (the URL is the WET150 quick start; the v1.6 manual text was read from the Delta-T PDF)
- **Offset values in the original validation (Table 1):** five soils, 0.2 mm glass beads and rockwool, each dried in 10 steps from saturation to θ = 0.10 at 20 °C. Reported εσb=0 values were 7.6, 4.1, 2.7, 1.9, 4.4, 5.8 and 3.1. The soils were Groesbeek (10 % clay / 70 % silt / 20 % sand / 0.95 % OM), Wichmond (14/31/55, 4.3 % OM), Ferralsol-A (63 % clay), Munnikenland (40 % clay, 5 % OM) and Attapulgite (100 % clay). Calculated σp tracked extract σp with standard deviations of 0.005–0.02 S/m over the 10 water contents. The row-to-material alignment of the extracted table is garbled, so assign individual offsets to materials with care. — [Hilhorst 2000](https://stevenswater.com/resources/documentation/1922HilHorst.pdf)
- **Generic value:** "To facilitate calibration εσb=0 = 4.1 can be used as an average. In this case, calibration of the sensor for σp is not required if θ > 0.1." — [Hilhorst 2000](https://stevenswater.com/resources/documentation/1922HilHorst.pdf)
- **Valid range (abstract):** "valid for water contents between 0.10 and saturation and for the conductivity of the pore water up to 0.3 S m⁻¹." The prototype sensor ran at 30 MHz and had a bulk-conductivity measurement limit of 3 mS/cm. — [Hilhorst 2000](https://stevenswater.com/resources/documentation/1922HilHorst.pdf)
- **Bound water / clay:** the model holds only for free water. Hilhorst writes that for sand "the free water content corresponds with θ ≈ 0.01, but for clay it can be θ ≈ 0.12 (Dirksen and Dasberg, 1993)". As a rule of thumb the model applies to most normal soils and to rockwool if θ > 0.10. — [Hilhorst 2000](https://stevenswater.com/resources/documentation/1922HilHorst.pdf)
- **Low-θ sensitivity and an unexplained offset:** "at low water contents, thus at low εb values, the method becomes sensitive to the term εb − εσb=0." For glass beads the offset was 7.4 at σp = 0.4 S/m and 7.6 at σp = 0.1 S/m, yet dry glass beads read εb = 3.7. A bend in the curve near the axis must therefore exist but was not observed. Hilhorst called for "further research on εσb=0 as a function of temperature and σp for different materials". — [Hilhorst 2000](https://stevenswater.com/resources/documentation/1922HilHorst.pdf)
- **High salinity:** "For high salt concentrations or for bound water εp may deviate from that of free water." — [Hilhorst 2000](https://stevenswater.com/resources/documentation/1922HilHorst.pdf)
- **Delta-T WET implementation:**
  - The default soil parameter is 4.1, with an allowed range of 1.0–9.0.
  - Warning: "the soil parameter should be left at the default value of 4.1 unless you have measured it for your soil. Changing it will significantly affect the ECp readings, especially in dry soils."
  - The default is "suitable for a range of both organic and mineral agricultural soils", but heavy clay, sand or unusual media may need a specific value.
  - Field procedure: saturate about 300 mL of soil with about 600 mL of water, shake for 10 min and settle for 1 h. Measure εw and ECw of the free water and εb and ECb of the soil below, then compute ε0 = εb − εw·ECb/ECw.
  - The error table says the sensor "requires custom soil parameter if reading at low water contents (< 30%)". Listed problem cases are very fine clays, magnetic soils, Ferralsols, very saline soils and dry soils.
  - Operating frequency is 20 MHz. Permittivity accuracy is ±2.5 (range 1–80); ECb accuracy is ±10 mS/m over 0–300 mS/m. ECp accuracy is given only as a graph of the measurable range versus moisture.
  - Source: [Delta-T WET Sensor User Manual v1.6](https://delta-t.co.uk/wp-content/uploads/2022/07/WET150_kit_Quick_Start_Guide_v2.0.pdf)
- **METER (TEROS 12 / 5TE / GS3) implementation:**
  - Same equation, with εp from the 80.3 − 0.37(T − 20) relation and εσb=0 = 4.1 as the generic offset. The note adds that field calibration per soil improves accuracy.
  - "Our testing indicates that the above method for calculating σw results in fair accuracy (±20%) in soils and other growth media at high water content (above 25%). As water content decreases, the denominator … becomes small, leading to large potential errors."
  - METER recommends using Hilhorst only when the soil is wet. Below 25 % VWC, back-calculate from the wet-state value by assuming conservation of salt. — [METER app note 18190 (2018)](https://library.metergroup.com/Retired%20and%20Discontinued/Application%20Notes/18190%20Soil%20Electrical%20Conductivity_Web.pdf)
- **Reseller (Edaphic) claims:** the vendor reports "± 20%" accuracy in moist soils and advises not computing σp at VWC < 0.10. Its own testing found εσb=0 = 6 more accurate than 4.1 across growing media. Treat this as vendor material. — [Edaphic Scientific](https://edaphic.com.au/monitoring/soil-salinity-explained/)
- **5TE manufacturer offset:** a 5TE manufacturer value of 6 is reported, while Rodriguez found 6 gave a poor εb–σb fit (secondary citation). — [Aljoumani et al. 2018, Sensors 18:4403](https://pmc.ncbi.nlm.nih.gov/articles/PMC6308429/)
- **Coir (non-soil):** fitted εσb=0 was 1.64 versus 4.1 for mineral soil. With a modified offset plus a linear ECp→ECe step, the ECe estimate reached RMSE = 0.929 and R² = 0.62. — [Lee & Kim 2024, Agric. Water Manage. 297](https://www.sciencedirect.com/science/article/pii/S0378377424001719); [IDEAS record](https://ideas.repec.org/a/eee/agiwat/v297y2024ics0378377424001719.html)

### Inferences
- Size of the denominator, from the standard Topp polynomial (background knowledge, not fetched this session; my arithmetic): θ ≈ 0.10, 0.20, 0.30 and 0.40 correspond to εb ≈ 6, 10.6, 16.5 and 25. With ε0 = 4.1 the denominator εb − ε0 is therefore about 2, 6.5, 12.4 and 21.
- Effect of offset uncertainty: a ±1.5 uncertainty in ε0, well inside the 1.9–7.6 range, gives σp errors of roughly ±75 % (θ = 0.10), ±23 % (0.20), ±12 % (0.30) and ±7 % (0.40).
- Effect of permittivity accuracy: the WET's ±2.5 permittivity spec alone gives about ±38 % at θ = 0.20 and ±12 % at θ = 0.40.
- This explains why vendors only claim ±20 % "at high water content (above 25 %)".
- The model was validated at 20 °C in repacked samples whose salinity was fixed while θ changed. Field conditions add temperature variation, salinity change between irrigations and structural heterogeneity, none of which the original validation tested.
- Ferralsol-type, very fine clay and magnetic soils are explicitly flagged by Delta-T. Calcareous or red Mediterranean soils (terra rossa) on Crete should not be assumed to fit the 4.1 default. This is an inference; no Crete-specific ε0 data were found.

### Gaps
- No published ε0 values for Cretan or Greek field soils were found.
- No primary source was found for how ε0 behaves with temperature. Hilhorst himself lists this as open.
- The exact material-to-offset mapping in Hilhorst Table 1 could not be recovered cleanly from the PDF text layer.
- TEROS 12 permittivity accuracy was not retrieved, so the error propagation above uses the WET spec only.

---

## 2. Validation studies of Hilhorst and alternative models (Kargas & Kerkides, Persson, Bouksila, Visconti and others)

### Takeaway
Independent validations agree that the default offset (4.1) works acceptably only in moist, low-salinity, non-clay soils. Reported errors:
- Pore-water RMSE in saline, gypsiferous or clayey soils: about 1–4 dS/m.
- Sand only: about 0.1 dS/m.
- Overestimation that grows with salinity.

The offset itself is soil-, salinity- and even depth-dependent. Soil-specific (or σb-dependent) calibration of ε0 is the main fix that works. The Malicki–Walczak and Rhoades models perform about the same as Hilhorst, not better.

### Cited Findings
- **Kargas & Kerkides (2012), Geoderma 189–190:563–573/576 (Agricultural University of Athens):**
  - Compared the Rhoades et al. (1976) and Hilhorst (2000) models using WET and 5TE data for six soils at various salinities. They also compared Amente et al. (2000) for sands.
  - The slope of the ε–σb lines depends mainly on salinity and decreases as salinity increases. 5TE slopes were much smaller than WET slopes at the same salinity.
  - There was "considerable scatter" in predicted σp, with overestimation at larger σp.
  - The full abstract and RMSE numbers were not retrieved. — [ScienceDirect abstract page](https://www.sciencedirect.com/science/article/abs/pii/S0016706112002595); [Kargas CV](https://w1.aua.gr/afp/wp-content/uploads/sites/3/2024/07/CV-Kargas_en.pdf)
- **Kargas & Kerkides (2010), J. Irrig. Drain. Eng. (WET sensor):** Malicki & Walczak predicted σp about as well as Hilhorst in sand and slightly better in sandy loam. This is from a search-result summary; the paper was not opened. — [ASCE Library](https://ascelibrary.com/doi/10.1061/%28ASCE%29IR.1943-4774.0000218)
- **Kargas et al. (cited in Aljoumani 2018):** "the offset depends on soil type and σp, becoming larger at higher σp". — [Aljoumani et al. 2018, Sensors 18:4403](https://pmc.ncbi.nlm.nih.gov/articles/PMC6308429/)
- **Kargas, Kerkides & Seyfried (2014), Vadose Zone J., doi:10.2136/vzj2013.09.0169:** response of three soil water sensors to varying solution EC in different soils. Only metadata could be retrieved (publisher page returned 403). — [CZO record](https://czo-archive.criticalzone.org/reynolds/publications/pub/kargas-et-al-2014-response-of-three-soil-water-sensors-to-variable-solution/)
- **Fragkos, Loukatos, Kargas & Arvanitis (2024), Sensors 24:2206 (Agricultural University of Athens), TEROS 12:**
  - Six soils (sand to clay). ECw of 0.28, 3, 6 and 10 dS/m (KCl).
  - Fitted ε0 was about 3.1 for sand, sandy loam and clay, and about 4 for loam, silty clay loam and sandy clay loam.
  - Predicted σp was well above the applied ECw. Examples: sand at 0.28 dS/m → 5.67 dS/m; sand at 10 dS/m → 17.17 dS/m; loam at 3 dS/m → 6.21 dS/m.
  - The authors attribute part of this to the soils' initial salt (ECe 1.4–2.8 dS/m) and conclude that Hilhorst plus TEROS 12 "satisfactorily approximates" salinity.
  - TEROS 12 apparent permittivity drops anomalously at σb < 2.5 dS/m. In liquids it fell from about 78–80 to about 60, then returned to about 80 by 10 dS/m. In coarse soils it read up to about 10–12 permittivity units below Topp at 0.28 dS/m.
  - VWC RMSE was 0.027–0.098 m³/m³ with the factory calibration and 0.013–0.046 with soil-specific calibration.
  - Source: [PMC11014125](https://pmc.ncbi.nlm.nih.gov/articles/PMC11014125/)
- **Persson (2002), Hydrol. Sci. J. (TDR; coarse sand, medium sand, loamy sand):** the measured εb–σb slope was lower than Hilhorst predicts. Persson suggests bound water lowers effective εp. Hilhorst performed about as well as other common pore-water models. — [Lund University record](https://www.lu.se/lup/publication/5a96756c-1d73-454f-8228-f66c0b8a9047)
- **Offsets used across soils:** 3.67 to 6.38 (attributed to Persson in Aljoumani's reference list; secondary). — [Aljoumani et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC6308429/)
- **Bouksila, Persson, Berndtsson & Bahri (2008), Hydrol. Sci. J. 53:253 (saline gypsiferous soil, Tunisia):**
  - Hilhorst σp RMSE was 1.16 dS/m with TDR and 4.15 dS/m with the WET sensor.
  - The WET reached TDR-like accuracy only with a calibrated soil parameter.
  - Aljoumani summarises the WET with offset 4.1 as "very poor" in this soil. — [Lund record](https://www.lu.se/lup/publication/77ac5624-1a2c-4c2e-a8c0-c0f552d3fbe1); [T&F PDF](https://www.tandfonline.com/doi/pdf/10.1623/hysj.53.1.253)
- **Berndtsson, Zemni, Bouksila, Slama, Persson & Bouhlila (2022), Arab. J. Geosci. (WET vs TDR, sandy oasis soil, NaCl 0.02–8.2 dS/m):**
  - Default Hilhorst RMSE was above 0.5 dS/m.
  - A modified model in which ε0 (K0) depends on bulk EC reduced mean RMSE to 0.1 dS/m.
  - "Low-cost sensors often use the default Hilhorst model … in salty soils, this use is not correct." — [Lund CMES summary](https://www.cmes.lu.se/article/estimating-pore-electrical-conductivity-tunisian-soil); [ResearchGate](https://www.researchgate.net/publication/361016731_Evaluation_of_modified_Hilhorst_models_for_pore_electrical_conductivity_estimation_using_a_low-cost_dielectric_sensor)
- **Related 5TE study (Bouksila group):** correcting the permittivity reading for ECa failed above ECp of 3 dS/m. Making K0 depend on ECa worked, in both lab and field. — [search excerpt; readkong copy of 5TE lab/field paper](https://www.readkong.com/page/laboratory-calibration-and-field-validation-of-soil-water-5222062)
- **Visconti et al. (2014), Soil Research SR13331 (clayey Mediterranean soils, Valencia; WET and 5TE):**
  - Proposed a "combined equation" for pore-water EC.
  - Root mean square deviations were 3.1 dS/m (WET) and 4.1 dS/m (5TE), falling to 1.5 and 2.6 dS/m for θ > 0.22 m³/m³.
  - Numbers are from the abstract via search excerpt. — [CSIRO Publishing](https://www.publish.csiro.au/SR/SR13331)
- **Aljoumani et al. (2018), Sensors 18:4403 (TDR, sandy soil columns):**
  - The OLS Hilhorst fit gave offset = 9.41 and an implausibly high σp.
  - Residuals were strongly autocorrelated (lag-1 = 0.852; Durbin–Watson = 0.278).
  - The offset varied across depths and irrigation events. A time-varying dynamic linear model (Kalman filter) agreed with an EC meter at R² = 72 %. — [PMC6308429](https://pmc.ncbi.nlm.nih.gov/articles/PMC6308429/)
- **Goodchild et al. (2023), SSSAJ:** studied the impact of soil particle conductivity and percolation threshold on the Hilhorst model. Title only; not read. — [Wiley](https://acsess.onlinelibrary.wiley.com/doi/abs/10.1002/saj2.20561)
- **Horticultural substrates (ISHS Acta Hort. 691):** Hilhorst-type pore-water EC errors of up to ±40 %, limited to ±15 % for permittivity > 20. An empirical correction is proposed. Search excerpt only; authors not verified. — [ISHS 691_97](https://ishs.org/ishs-article/691_97/)
- **Soilless substrate study (2024):** the Hilhorst equation "confirmed its unsuitability for ECw prediction in soilless systems". — [Univ. Udine repository PDF](https://air.uniud.it/retrieve/764ac392-0635-459f-a3aa-784be27781d3/1-s2.0-S0168169924001376-main.pdf)
- **Hilhorst on the alternatives:** Rhoades et al. (1990) and Mualem & Friedman (1991) are bulk-to-pore conversions whose "weakness … is that they are empirical relationships". Malicki et al. (1994) found the linear εb–σb correlation, but "Malicki's method is still an empirical one". — [Hilhorst 2000](https://stevenswater.com/resources/documentation/1922HilHorst.pdf)

### Inferences
- In non-saline, moist, loamy soils, the reported envelope for an uncalibrated sensor using the default offset is roughly ±20 % (vendors) to a few tenths of a dS/m. In clayey, saline or gypsiferous soils it is about 1–4 dS/m RMSE (Bouksila, Visconti), which is the same order as the salinity thresholds of most crops (ECe 1–4 dS/m).
- The 5TE/TEROS family shows a non-monotonic permittivity artefact at low-to-moderate σb (Kargas group). It biases both θ and the Hilhorst denominator, and so feeds directly into the pore-water EC error.
- Systematic overestimation at higher σp (Kargas & Kerkides 2012, Fragkos 2024) means an uncalibrated chain tends to exaggerate salinity in salty conditions. That is the direction that would trigger false alarms.

### Gaps
- Full-text RMSE numbers for Kargas & Kerkides 2010 and 2012 were not retrieved (paywalled).
- The Kargas, Kerkides & Seyfried 2014 abstract was blocked (403).
- No paper evaluating Mualem & Friedman (1991) quantitatively against field data was retrieved.
- No "Kargas et al. 2018/2020" paper on pore-water EC could be identified. Searches returned the 2012/2014/2024 papers instead, so that citation needs verification.

---

## 3. Topp (1980) permittivity–moisture relation: accuracy and soil-type limits

### Takeaway
Topp's universal curve is accurate to about ±0.013–0.03 m³/m³ in ordinary mineral soils. It underestimates water content in clays (especially smectitic or iron-rich ones), organic soils and some volcanic soils, by up to 0.06–0.12 m³/m³. Capacitance/FDR sensors at 20–70 MHz deviate further from Topp because of salinity and frequency effects.

### Cited Findings
- **Topp's own claim:** a standard error below 1.3 % (≈0.013 m³/m³) for sandy loam to clay at bulk density 1.04–1.44 Mg/m³. This comes from a search-result summary; the original Topp, Davis & Annan (1980) WRR 16:574 was not fetched. — [search excerpt; e.g. Embrapa PDF](https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/668348/1/ID260026976.pdf)
- **Clays:** deviations from Topp in clay soils are attributed to bound water, which depends on clay mineralogy and content. A Vertosol would be underestimated by at least 0.06 m³/m³, and a Ferrosol showed up to 0.12 m³/m³ at θ = 0.4. — [Dielectric behaviour of clay soils, Soil Research SR9960825](https://www.publish.csiro.au/SR/SR9960825)
- **Organic and fine-textured soils:** Topp is reported as unsuitable for organic and fine-textured soils, and errors grow with organic matter and clay. — [JIRCAS JARQ 40-3](https://www.jircas.go.jp/sites/default/files/publication/jarq/40-03-05_0.pdf); [IWRJ article 10803](https://iwrj.sku.ac.ir/article_10803_en.html)
- **Delta-T WET water content:** errors in mineral and sandy soils are "usually < 3 or 4%, but can be 5 to 10% in clay and organic soils without a soil-specific calibration". Specs are ±0.05 m³/m³ with the supplied calibrations and ±0.03 after soil-specific calibration. — [Delta-T WET manual v1.6](https://delta-t.co.uk/wp-content/uploads/2022/07/WET150_kit_Quick_Start_Guide_v2.0.pdf)
- **METER TEROS 12:** generic VWC accuracy ±0.03 m³/m³ in mineral soils with solution EC < 8 dS/m, and ±0.01–0.02 with medium-specific calibration. Bulk EC range is 0–20 dS/m; bulk EC accuracy is ±5 % (Campbell brochure), or ±10 % for 0–10 dS/m with user calibration needed above 10 dS/m (Edaphic). — [METER TEROS 12 specs](https://metergroup.com/products/teros-12/teros-12-tech-specs/); [Campbell brochure](https://s.campbellsci.com/documents/ca/product-brochures/teros12-br.pdf); [Edaphic](https://edaphic.com.au/monitoring/soil-salinity-explained/)
- **TEROS 12 in practice:** factory-calibration VWC RMSE was 0.027–0.098 m³/m³ across six soils and four salinities, reduced to 0.013–0.046 with soil-specific calibration. — [Fragkos et al. 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11014125/)

### Inferences
- In the chain, θ enters twice:
  1. Implicitly, through εb in the Hilhorst denominator.
  2. Explicitly, in the θ/θs dilution step to ECe.
- A θ error of 0.03 at θ = 0.25 is a 12 % error in the dilution factor alone. In clays with a 0.06–0.10 Topp bias it is 25–40 %.

### Gaps
- No Topp-equation validation was found for Cretan or Mediterranean calcareous soils.
- The primary Topp 1980 text was not fetched in this session.

---

## 4. Pore-water EC → ECe: θ/θs dilution, FAO-29 "ECsw ≈ 2·ECe", USDA Handbook 60 / Rhoades, why the ratio is not constant

### Takeaway
The standard conversion assumes salt is conserved while water changes:

ECe ≈ ECw·θ / (ρb·SP/100), or ECe ≈ ECw·θ/θs in METER's form.

USDA Handbook 60 adds the approximation SP·ρb/100 ≈ 2·θfc. This gives the rule of thumb that soil water at field capacity is about twice ECe ("ECsw ≈ 2·ECe", the factor attributed to FAO-29 by UC ANR).

FAO-57 states that the conservation assumption is "not sufficiently valid" for accurate work. Mineral dissolution and precipitation (calcite, gypsum), cation exchange, ion pairing and negative adsorption (anion exclusion) all change the ratio. Errors are worst in gypsiferous and sodic soils. The SP/θfc ratio also varies with texture.

### Cited Findings
- **FAO-57 Eq. 8:** (ECwc·θwc + ECws·θws) = ECw·θw ≈ ECe·ρb·SP/100, where SP is the gravimetric saturation percentage and ρb is bulk density (Rhoades et al. 1989a). FAO-57 adds that "The latter derived relation is strictly valid only for chloride-salt systems." — [FAO I&D Paper 57, Rhoades, Chanduvi & Lesch 1999](https://www.fao.org/4/x2002e/x2002e.pdf)
- **FAO-57 Eq. 10 (Handbook 60 approximation):** "the familiar approximation (U.S. Salinity Handbook 60, 1954), SP·ρb/100 = 2·θfc". Together with θwc/θw ≈ 0.36, "found to be typical of California arid-land soils", this gives ECa as a function of 0.72·θfc·ECe. — [FAO-57](https://www.fao.org/4/x2002e/x2002e.pdf)
- **Why the ratio is not constant (FAO-57):** "Because of the numerous interacting effects of … mineral dissolution/precipitation, cation exchange, ion-pair formation, negative adsorption, time of equilibration, amount of grinding and drying, presence … of suspended minerals and organic matter …, microbial production of CO₂ …", a chemical model is needed to compute EC accurately as the water/soil ratio changes. "The assumption of conservation of mass with change of water content … is not sufficiently valid to permit the EC at a second water content to be accurately calculated as the product of the EC at the second water content and the ratio of the two water contents." "very substantial errors may occur with soils containing gypsum, especially if they are also sodic." — [FAO-57](https://www.fao.org/4/x2002e/x2002e.pdf)
- **Precipitation as soil dries (FAO-57):** as θw falls, ECa changes partly from "the precipitation of some salt as the solubilities of calcite and gypsum are exceeded". Back-estimating ECw at lower θ from ECw at field capacity "ignores the precipitation of salt that occurs with the reduction in water content". — [FAO-57](https://www.fao.org/4/x2002e/x2002e.pdf)
- **Low-moisture threshold (FAO-57):** "at very low values of θw, it is not possible to determine ECw (or ECe) from ECa at all. The value of the 'threshold' water content is approximately 0.10." ECa measurements should be limited to moisture "not less than about one-half of field-capacity water content". — [FAO-57](https://www.fao.org/4/x2002e/x2002e.pdf)
- **ECw vs ECe as an index (FAO-57):** ECw is theoretically the better index, but it "is not single-valued; it varies over the irrigation cycle as the soil water content changes", so it must be referenced to a water content such as field capacity. — [FAO-57](https://www.fao.org/4/x2002e/x2002e.pdf)
- **ECe itself is imperfect (FAO-57):** ECe predicted from ECa may be "more appropriate estimations of soil salinity than conventionally measured values of ECe", because lab extracts carry their own errors and include salts held in immobile water. Higher-dilution extracts (1:1, 1:5) suffer more from "peptization, hydrolysis, cation exchange, and mineral dissolution". — [FAO-57](https://www.fao.org/4/x2002e/x2002e.pdf)
- **METER conversion chain:**
  - σw = εp·σb/(εb − 4.1) (Hilhorst).
  - ECe = σw·θ/θs, assuming "the salt stays in the soil while the water is being removed".
  - θs = 1 − ρb/2.65.
  - Worked example: ρb = 1.33 → θs = 0.5; σb = 0.3 dS/m, θ = 0.345, εb = 20. My arithmetic: σw ≈ 80·0.3/15.9 ≈ 1.5 dS/m, so ECe ≈ 1.5·0.345/0.5 ≈ 1.04 dS/m.
  - METER says the combined equation "is likely to be the most useful equation for assessing salinity in the field … use it when water contents are highest to maximize accuracy". — [METER app note 18190](https://library.metergroup.com/Retired%20and%20Discontinued/Application%20Notes/18190%20Soil%20Electrical%20Conductivity_Web.pdf)
- **Edaphic caveat:** solution EC calculated this way "may not agree well" with a lab saturated-paste test, "because wetting soil to a saturated paste is very imprecise". — [Edaphic Scientific](https://edaphic.com.au/monitoring/soil-salinity-explained/)
- **FAO-29 2:1 factor:** UC ANR gives ECe = ECsw/2, i.e. ECsw ≈ 2·ECe, "Adapted from FAO irrigation and drainage paper 29, 1985". The FAO-29 text itself was not located. Its chapter 1 assumptions state that "average salinity of the soil-water is three times that of the applied water" at a 15–20 % leaching fraction, for sandy-loam to clay-loam soils with good drainage. — [UC ANR salinity unit conversions](https://ucanr.edu/sites/Salinity/Salinity_Management/Salinity_Basics/Salinity_measurement_and_unit_conversions); [FAO-29 rev.1, ch. 1](https://www.fao.org/4/t0234e/T0234E01.htm)
- **Texture dependence:** a study comparing field-capacity extracts with saturation-paste extracts found different slopes for sandy and finer soils. The gap between saturation and field-capacity moisture grew with sand content. — [AGRIS record](https://agris.fao.org/search/ar/records/647252812c1d629bc97a0475)
- **Reference water content:** the salinity at maximum field water content (≈ field capacity) is the value used for leaching-fraction estimates. — [Queensland Salinity Management Handbook ch. 5](https://www.publications.qld.gov.au/dataset/5f866f8d-d47a-430e-aa9f-c97f7c4147d7/resource/265de065-02d3-4dad-8360-7033b3f40a94/download/salinity-management-handbook-ch05.pdf)
- **Rhoades bulk-EC models:**
  - The 1976 model is a limiting case of the later dual-pathway parallel conductance model (Rhoades et al. 1989). In the 1989 model ECa depends on ECw (mobile and immobile), θ, θws, surface conductance ECs (tied to clay and CEC), ρb and T.
  - The ECs regressions differ between papers (e.g. ECs = 0.147·SP − 0.227, r² = 0.37). — [FAO-57](https://www.fao.org/4/x2002e/x2002e.pdf); [USDA-ARS P1917](https://www.ars.usda.gov/arsuserfiles/20360500/pdf_pubs/P1917.pdf)

### Inferences
- **Two ways of reading "ECsw ≈ 2·ECe":**
  - Arithmetically it is just θsat-paste ≈ 2·θfc.
  - In medium-textured Mediterranean soils it is a reasonable first-order rule.
  - In sands, SP/θfc is larger (field capacity is very low), so the factor exceeds 2.
  - In swelling clays, the disturbed-paste water content differs from field θs.
- **METER's θs choice:** θs = 1 − ρb/2.65 uses field porosity, not saturation-paste water content. The two differ, which is a systematic and soil-specific bias.
- **Calcareous and gypsiferous soils** (common in Crete: marls, calcareous soils, some gypsum): when the soil dries, gypsum and calcite precipitate. When it is wetted to a paste, gypsum dissolves (up to about 2–2.5 dS/m from gypsum saturation alone; background knowledge, not sourced here). So ECe ≥ θ-scaled ECw. The sensor-based estimate tends to underestimate lab ECe in gypsiferous soils and overstate apparent salinity change with drying.
- **Anion exclusion (negative adsorption):** in clays, part of the water is anion-free. Pore water near the probe is then not the same as bulk extract water, which biases ECw/ECe beyond the dilution factor. FAO-57 names "negative adsorption" but does not quantify it.

### Gaps
- The exact FAO-29 passage stating ECsw = 2·ECe was not retrieved, so the attribution rests on UC ANR.
- No quantified anion-exclusion magnitude for typical agricultural soils was retrieved.
- USDA Handbook 60 itself was not fetched; its approximation is cited via FAO-57.

---

## 5. Overall uncertainty of a sensor-derived ECe; dominant inputs; trends vs absolutes

### Takeaway
For an uncalibrated capacitance/FDR sensor using the default offset (4.1), the default permittivity→θ calibration and θ/θs or ×½ conversion to ECe, a realistic uncertainty in absolute ECe is:
- **Moist loam, non-saline:** at best about ±20–30 %.
- **θ below about 0.20, clays, saline or gypsiferous soils:** routinely ±50 % to more than 100 %, or 1–4 dS/m.

The dominant inputs, in order:
1. The offset relative to (εb − ε0) at low θ.
2. Sensor permittivity error, including salinity artefacts in 5TE/TEROS-type sensors.
3. θ calibration error, entering twice.
4. The ECw→ECe ratio (SP/θfc, gypsum/calcite chemistry).
5. Temperature compensation, about 2 %/°C if neglected.

Relative changes over time, read at a fixed sensor and comparable water content (e.g. the daily post-irrigation maximum), are considerably more trustworthy than absolute values, because most of these errors are static per installation.

### Cited Findings
- Vendor accuracy for the pore-water step is ±20 % only "at high water content (above 25%)", with "large potential errors" as θ drops. — [METER app note 18190](https://library.metergroup.com/Retired%20and%20Discontinued/Application%20Notes/18190%20Soil%20Electrical%20Conductivity_Web.pdf)
- Field and lab RMSEs for ECp with default or simple calibration: 1.16 dS/m (TDR) and 4.15 dS/m (WET) in gypsiferous saline soil; 3.1 dS/m (WET) and 4.1 dS/m (5TE) in clayey soils, 1.5/2.6 for θ > 0.22; above 0.5 dS/m default versus 0.1 dS/m modified in sand. — [Bouksila et al. 2008](https://www.lu.se/lup/publication/77ac5624-1a2c-4c2e-a8c0-c0f552d3fbe1); [Visconti et al. 2014](https://www.publish.csiro.au/SR/SR13331); [Berndtsson et al. 2022](https://www.cmes.lu.se/article/estimating-pore-electrical-conductivity-tunisian-soil)
- The offset is not a constant even in one soil. It varies with depth and irrigation event (Aljoumani 2018) and with σp (Kargas; Hilhorst's own glass-bead data). — [Aljoumani et al. 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC6308429/); [Hilhorst 2000](https://stevenswater.com/resources/documentation/1922HilHorst.pdf)
- Uncertainty grows as θ falls, and conversion is impossible below about θ = 0.10. Keep ECa readings above about ½·θfc. — [FAO-57](https://www.fao.org/4/x2002e/x2002e.pdf)
- FAO-57 on fixed-ratio extracts: "For purposes of monitoring, when relative changes are of more concern than the absolute solute concentration(s), these quicker, simpler methods … may be used to advantage." The same rationale supports relative tracking with sensors. Under typical conditions "the error in ECa caused by θw is not large with reasonable deviation in θw from field capacity". — [FAO-57](https://www.fao.org/4/x2002e/x2002e.pdf)
- Rhoades (FAO-57) found TDR-type point sensors "less useful for salinity appraisal than the four-electrode and EM-38 sensors" because of small measurement volume, limited salinity range and robustness. — [FAO-57](https://www.fao.org/4/x2002e/x2002e.pdf)
- Ion-specific temperature coefficients of 1.5–2.1 %/°C mean a 10 °C diurnal swing moves uncompensated EC by about 15–21 %. — [Delta-T WET manual](https://delta-t.co.uk/wp-content/uploads/2022/07/WET150_kit_Quick_Start_Guide_v2.0.pdf)
- Bulk EC accuracy: TEROS 12 ±5 % (Campbell) or ±10 % for 0–10 dS/m (Edaphic); WET ±10 mS/m over 0–300 mS/m. — [Campbell](https://s.campbellsci.com/documents/ca/product-brochures/teros12-br.pdf); [Edaphic](https://edaphic.com.au/monitoring/soil-salinity-explained/); [Delta-T](https://delta-t.co.uk/wp-content/uploads/2022/07/WET150_kit_Quick_Start_Guide_v2.0.pdf)

### Inferences
- **First-order error budget for ECe = [εp·σb/(εb − ε0)]·θ/θs** (my propagation, relative errors combined in quadrature, using numbers sourced above):

  | Error term | θ ≈ 0.30 (εb ≈ 16.5) | θ ≈ 0.15 (εb ≈ 8) |
  |---|---|---|
  | σb (5–10 %) | 5–10 % | 5–10 % |
  | ε0 ±1.5 | 12 % | 38 % (denominator ≈ 3.9) |
  | εb ±1–2.5 | 8–20 % | 25–65 % |
  | θ ±0.03 | 10 % | 20 % |
  | θs / SP ratio (soil-specific, ±15–25 % plausible; not directly sourced) | 15–25 % | 15–25 % |
  | Temperature, if uncompensated (±5 °C) | about 10 % | about 10 % |
  | **Combined** | **about ±25–40 %** | **about ±55–85 %** |

  At θ ≈ 0.30 this is consistent with the vendor ±20 % for the ECp step alone. At θ ≈ 0.15 it is consistent with the dS/m-scale RMSEs in the validation studies. Gypsum and calcite chemistry adds a further one-sided bias.
- **Why trends are better:** within one installation, ε0, the geometry and contact factor, θs/SP and the calibration bias are roughly constant. They largely cancel in a time series compared at similar θ and temperature, so a rising ECp trend between consecutive post-irrigation maxima is informative. However:
  - Trends computed across very different θ are contaminated by the 1/(εb − ε0) nonlinearity, which creates spurious "salinity rises" as the soil dries even at constant salt mass.
  - Precipitation of calcite and gypsum makes the drying limb non-conservative.
  - The 5TE/TEROS permittivity artefact near σb ≈ 1–3 dS/m can produce step-like changes.
- **Recommended interpretation (inference):**
  - Report sensor salinity as an indicative class (low / moderate / high) or a relative trend, not as a precise ECe.
  - Compute it only at θ above about 0.20–0.25 (or above ½·θfc) and at a consistent time after irrigation.
  - Anchor the series with at least one lab saturated-paste ECe per site/depth (one-point calibration of the overall factor) and, ideally, a site-specific ε0 using the Delta-T saturation procedure.

### Gaps
- No published end-to-end validation was found that compares uncalibrated capacitance-sensor ECe with lab ECe for Cretan or Greek field soils.
- No formal Monte-Carlo uncertainty study of the full σb→σp→ECe chain was found. The budget above is a first-order estimate built from component specs.
- The ±15–25 % range for the θs/SP term is a judgement, not a sourced figure.
