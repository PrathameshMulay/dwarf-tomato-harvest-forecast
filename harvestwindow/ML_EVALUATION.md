# HarvestWindow forecasting experiments

The existing logistic forecast stays in the main planner. None of the experimental models lowered final-harvest MAE versus logistic plus camera in the six-room replay. Use the offline Model comparison section to inspect experimental paths, measurements, split gain, and simulated harvest recommendations.

## Reproduce

From the repository's `harvestwindow` directory, with Python 3.12 and the official time-series ZIP:

```powershell
python -m pip install -r requirements-ml.txt
python evaluate_ml.py "C:/path/to/autonomous_greenhouse_challenge4_timeseries.zip"
python -m unittest discover -s tests -v
node tests/test_orders.cjs
```

Open `dashboard/index.html` locally. The comparison loads `dashboard/ml-data.js` offline. To run the optional browser regression, install Playwright and run `node tests/browser.cjs`; set `CHROME_PATH` if Chrome is installed elsewhere. The benchmark records input SHA-256 hashes and library versions. Reproducing a fold means refitting its models from source; the application ships prediction exports rather than binary weights. The original replay generator and decision workflows remain available.

## Data and feature definitions

The six 2024 compartments contribute 24 supervised labels, one room/date per measurement, with 20 labels per outer training fold. The target is the mean of valid plant-level red fresh weight / total fruit fresh weight ratios, multiplied by 100. The existing measurement loader interprets destructive-sheet blank red weights as zero and excludes plants without a positive total weight or usable final red weight. Plant counts and per-case feature values are in `ml_results/features.csv`.

Historical inputs end on the local calendar day of forecast origin. Final labels use the common November 5 origin and 6–16 day horizons. For each earlier destructive measurement, the forecast origin is seven days earlier. Trees learn from one record per measured date with that origin convention. They do not predict the unknown harvest date as a feature: for every requested horizon, the model computes a candidate ripeness using the same projection rule. Cutoff features are held fixed across the outlook; projected GDD alone changes. This assumes recent conditions persist and does not use weather forecast files.

| Feature | Definition |
|---|---|
| `gdd` | Cumulative daily mean temperature above 10°C, plus horizon × mean daily GDD over the last seven logged days |
| `dli7` | Mean valid daily light integral over seven calendar days including origin; sum PAR in µmol/m²/s × 300 seconds ÷ 1,000,000, in mol/m²/day |
| `temp7`, `rh7`, `co2_7` | Seven-calendar-day means of daily mean °C, % relative humidity, and ppm CO₂ |
| `red` | Most recent recorded noon red pixel percentage within origin and preceding two days |
| `onset_age` | Days since first date of the first three consecutive noon indices above 0.1%, known only after the third capture |

Daily PAR integration requires 90% numeric coverage of the local day, with daylight saving taken into account. Negative PAR, RH outside 0–100%, nonpositive CO₂, and lamp percentages outside 0–100% are treated as missing. Aggregations use available data. XGBoost handles missing feature values via learned split defaults. The only missing fitted input is onset age (18/24 cases); none is treated as evidence of a confirmed onset. The feature audit also exports cumulative available DLI with missing-day count, mean temperature over the last three available days within the week, weekly mean of within-day temperature standard deviations, mean lamp activation %, and days since the first log. These are descriptive only. Orange, green, depth, additional sensor streams, and economic inputs were excluded from fitting to limit dimensionality and avoid confusing control choices with predictors. No raw image download was needed.

The local 2023 archive was audited across ClimateTimeseries, CropMeasurements and DestructiveHarvest. The relevant sheets report red counts and total fruit-cluster fresh weight, with no color-specific red fresh weight located. Count fractions cannot establish weight fractions. No 2023 scores are reported.

## Models and validation

- **Existing logistic:** retain the exact replay models, including warmth-only, camera-onset adjustment, and the two sampling policies. Mean final ripeness is a separate endpoint baseline, computed from the other five rooms.
- **XGBoost:** depth-one trees with learning rate 0.08, L2 penalty 3, minimum child weight 2, and nondecreasing response to projected GDD. Compare GDD alone against sensor/camera fusion. Select 48 or 96 trees.
- **Hybrid:** add an XGBoost correction to camera-adjusted logistic ripeness. Generate each training residual by refitting logistic with that training row's entire room held out. Tune 24 or 48 trees. The reference forecast for the outer room uses only the outer training rooms.
- **Hierarchical logistic:** fit a shared slope and population midpoint with penalized room midpoint deviations by bounded nonlinear least squares. The new room uses the population curve, with no fitted held-out room effect. Tune penalty 0.05 or 0.5 on squared offsets scaled by 100 GDD. This tests partial pooling without the camera adjustment.

Tune each alternative with a second leave-one-room-out split wholly inside the outer training set. Tuning uses MAE over the four label dates of each inner held-out room. Preprocessing is room-local and cutoff-bounded. Existing curves and hierarchical models calibrate on the completed training rooms' measured-date GDD; the tree models use origin-based projections, including when constructing residuals. Each model scores the same endpoints and receives the same available held-out predictor history. Only the explicit sampling baselines use the held-out November 5 crop sample.

This is a transfer experiment among six compartments in a **single concurrent trial**. Training on the other rooms' completed records after November 5 reproduces the existing historical-cycle proxy. A strict November 5 chronological split has no prior final-harvest labels, so it would be a different and very limited extrapolation experiment. An independent season is required for a credible chronological comparison. Six room groups and 24 labels are insufficient to justify recurrent networks or Transformers.

The trial design and sensor definitions follow [Maree et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC12299141/). Grouped validation follows the dependency concerns in [Roberts et al.](https://doi.org/10.1111/ecog.02881). Tree capacity and regularization follow the [original XGBoost paper](https://arxiv.org/abs/1603.02754) and [parameter reference](https://xgboost.readthedocs.io/en/stable/parameter.html).

## Results

| Final-harvest method | MAE pp | RMSE pp | Bias pp |
|---|---:|---:|---:|
| Mean final ripeness | 7.010 | 7.970 | 0.000 |
| Warmth only | 10.517 | 11.265 | +0.683 |
| Logistic plus camera | 8.515 | 10.078 | +0.142 |
| Selective sampling | 7.957 | 9.192 | −0.417 |
| Sample every room | 7.595 | 8.646 | +0.395 |
| XGBoost heat only | 11.825 | 15.750 | −7.705 |
| XGBoost sensor and camera | 14.208 | 18.845 | −8.575 |
| Hybrid | 9.450 | 10.867 | −1.977 |
| Hierarchical | 10.627 | 11.317 | +0.757 |

Bias is predicted minus measured. The original 8.51 display uses the existing floating-point rounding convention. The legacy baseline metrics, including persistence at 84.37 pp, were reproduced. On the 18 earlier destructive endpoints, hierarchical, hybrid, and camera logistic scored 2.34, 2.87, and 3.29 pp respectively. Early observations can have very little red fruit, so this score does not establish better discrimination near harvest. The hybrid had lower error than camera logistic in four rooms, but higher aggregate error. Dropping one paired endpoint at a time gives hybrid-minus-logistic MAE differences from −0.008 to +1.548 pp. This is a descriptive sensitivity analysis, with no independence assumption or confidence claim. The CSVs retain each error, counts by horizon, and all paired comparisons. Split gain is specific to fitted trees and cannot establish causal or out-of-sample feature value.

Forecasts cover today through day 21. Tree estimates can form plateaus and jumps; bounded monotone paths use a running maximum so a downward residual step does not cause an artificial reversal. Raw downward-step counts are retained in `report.json`. Scenario bands combine training-room omissions at fixed fitted hyperparameters with the existing heat/cost/price settings. They represent sensitivity, rather than calibrated coverage. Milestones record the first forecast day reaching 50%, 70%, or 85%, or blank if beyond the outlook.

## Harvest decisions

The existing sellability and profit logic consumes each experimental forecast's log odds using the same plant variation, grading proxies, costs and prices. Fruit weight still comes from the other rooms' November 5 measurements. The resulting central dates shifted −6 to +5 days for fused XGBoost, 0 to +1 day for hybrid, and −5 to +5 days for hierarchical logistic. For MuGrow the hybrid retained November 5 but changed the action from Sample to Harvest, while both standalone boosted forecasts moved the central date to November 8. This sensitivity matters because the underlying trial measured each room's actual harvest only. Date shifts and modelled profit are counterfactual, and measured harvest dates are management decisions rather than optimal-date labels.

The experimental forecasts have no validated crop-sample update, so the interactive sampling, economic analysis, and order planning continue using the original logistic planner. A stronger next evaluation would collect labeled ripeness around each room's sellability threshold across independent cycles, lock the splits, and assess date or profit improvement against observed outcomes.

## Outputs

- `ml_results/features.csv` contains the 24 forecast-origin rows and a feature audit.
- `ml_results/metrics.csv` contains aggregate and horizon-specific MAE, RMSE and bias.
- `ml_results/scores.csv` contains actuals, predictions, and signed room-level errors.
- `ml_results/decisions.csv` contains actions, simulated selected dates and modelled profit in €/m²/day.
- `ml_results/paired.csv` contains paired effect sizes and drop-one-room sensitivity.
- `ml_results/report.json` includes the above evaluation outputs, selected hyperparameters, split gain, raw trajectory diagnostics, missingness, and provenance.
- The dashboard comparison visualizes daily predictions, actual harvest ripeness, uncertainty scenarios and room errors.
