/* Published aggregate statistics, transcribed from the linked source tables. Null is missing, never zero. */
(function(root){
  const data = {
  "types": {
    "period": "2021",
    "scope": "United States, all races and ethnicities, from two Top 10 lists. All groups except sex-specific rates (per 100,000 of the female or male population shown).",
    "definitions": {
      "incidence": "New cancer diagnoses per 100,000 people",
      "mortality": "Cancer deaths per 100,000 people",
      "null": "Not listed in that source's Top 10 chart, not zero. Ties at reported precision: mortality 18.7 and 5.7."
    },
    "source": "https://openscied-uploads-production.s3.amazonaws.com/G9_UBI/hires/B.3%20Student%20Edition.pdf",
    "sourcePrintedPage": 65,
    "credit": "U.S. Cancer Statistics, Centers for Disease Control and Prevention and National Cancer Institute as reproduced in OpenSciEd B.3 Student Edition, figures 1–2.",
    "rows": [
      {
        "id": "breast",
        "name": "Female Breast",
        "incidence": 133.8,
        "mortality": 18.7,
        "group": "female"
      },
      {
        "id": "prostate",
        "name": "Prostate",
        "incidence": 114.7,
        "mortality": 18.7,
        "group": "male"
      },
      {
        "id": "lung",
        "name": "Lung and Bronchus",
        "incidence": 49.1,
        "mortality": 29.9,
        "group": "all"
      },
      {
        "id": "colorectal",
        "name": "Colon and Rectum",
        "incidence": 36,
        "mortality": 12.6,
        "group": "all"
      },
      {
        "id": "uterus",
        "name": "Corpus and Uterus, NOS",
        "incidence": 28.3,
        "mortality": 5.4,
        "group": "female"
      },
      {
        "id": "melanoma",
        "name": "Melanomas of the Skin",
        "incidence": 23,
        "mortality": null,
        "group": "all"
      },
      {
        "id": "bladder",
        "name": "Urinary Bladder",
        "incidence": 18.1,
        "mortality": null,
        "group": "all"
      },
      {
        "id": "lymphoma",
        "name": "Non-Hodgkin Lymphoma",
        "incidence": 17.8,
        "mortality": 4.7,
        "group": "all"
      },
      {
        "id": "kidney",
        "name": "Kidney and Renal Pelvis",
        "incidence": 17,
        "mortality": null,
        "group": "all"
      },
      {
        "id": "leukemia",
        "name": "Leukemias",
        "incidence": 13.6,
        "mortality": 5.7,
        "group": "all"
      },
      {
        "id": "pancreas",
        "name": "Pancreas",
        "incidence": null,
        "mortality": 11.1,
        "group": "all"
      },
      {
        "id": "liver",
        "name": "Liver and Intrahepatic Bile Duct",
        "incidence": null,
        "mortality": 6.5,
        "group": "all"
      },
      {
        "id": "ovary",
        "name": "Ovary",
        "incidence": null,
        "mortality": 5.7,
        "group": "female"
      }
    ]
  },
  "states": {
    "period": "2019–2023",
    "scope": "50 U.S. states and the District of Columbia; all cancer sites and stages, all ages, all races including Hispanic, both sexes",
    "definitions": {
      "incidence": "Age-adjusted rate of new diagnoses per 100,000 people per year, to the 2000 U.S. standard population",
      "count": "Average number of new diagnoses per year in this five-year period"
    },
    "source": "https://statecancerprofiles.cancer.gov/incidencerates/index.php?areatype=state&cancer=001&race=00&stateFIPS=00&type=incd&year=0",
    "national": {
      "incidence": 453.4,
      "count": 1872272
    },
    "rows": [
      {
        "id": "AL",
        "name": "Alabama",
        "incidence": 435.7,
        "count": 28080
      },
      {
        "id": "AK",
        "name": "Alaska",
        "incidence": 438.5,
        "count": 3389
      },
      {
        "id": "AZ",
        "name": "Arizona",
        "incidence": 389.6,
        "count": 36667
      },
      {
        "id": "AR",
        "name": "Arkansas",
        "incidence": 476,
        "count": 18165
      },
      {
        "id": "CA",
        "name": "California",
        "incidence": 413,
        "count": 187921
      },
      {
        "id": "CO",
        "name": "Colorado",
        "incidence": 398.3,
        "count": 26520
      },
      {
        "id": "CT",
        "name": "Connecticut",
        "incidence": 477.3,
        "count": 22859
      },
      {
        "id": "DE",
        "name": "Delaware",
        "incidence": 479.7,
        "count": 6754
      },
      {
        "id": "DC",
        "name": "District of Columbia",
        "incidence": 440.5,
        "count": 2999
      },
      {
        "id": "FL",
        "name": "Florida",
        "incidence": 470,
        "count": 149440
      },
      {
        "id": "GA",
        "name": "Georgia",
        "incidence": 473.1,
        "count": 58637
      },
      {
        "id": "HI",
        "name": "Hawaii",
        "incidence": 415.9,
        "count": 8123
      },
      {
        "id": "ID",
        "name": "Idaho",
        "incidence": 446.6,
        "count": 10117
      },
      {
        "id": "IL",
        "name": "Illinois",
        "incidence": 468.7,
        "count": 73561
      },
      {
        "id": "IN",
        "name": "Indiana",
        "incidence": 468.2,
        "count": 38862
      },
      {
        "id": "IA",
        "name": "Iowa",
        "incidence": 504.1,
        "count": 20505
      },
      {
        "id": "KS",
        "name": "Kansas",
        "incidence": 464.7,
        "count": 16514
      },
      {
        "id": "KY",
        "name": "Kentucky",
        "incidence": 524.7,
        "count": 29715
      },
      {
        "id": "LA",
        "name": "Louisiana",
        "incidence": 493.3,
        "count": 27756
      },
      {
        "id": "ME",
        "name": "Maine",
        "incidence": 489.4,
        "count": 10155
      },
      {
        "id": "MD",
        "name": "Maryland",
        "incidence": 458.9,
        "count": 35118
      },
      {
        "id": "MA",
        "name": "Massachusetts",
        "incidence": 452.3,
        "count": 40893
      },
      {
        "id": "MI",
        "name": "Michigan",
        "incidence": 457.4,
        "count": 60488
      },
      {
        "id": "MN",
        "name": "Minnesota",
        "incidence": 492.2,
        "count": 34827
      },
      {
        "id": "MS",
        "name": "Mississippi",
        "incidence": 471.3,
        "count": 17317
      },
      {
        "id": "MO",
        "name": "Missouri",
        "incidence": 472.9,
        "count": 37243
      },
      {
        "id": "MT",
        "name": "Montana",
        "incidence": 451.8,
        "count": 6755
      },
      {
        "id": "NE",
        "name": "Nebraska",
        "incidence": 446.5,
        "count": 10453
      },
      {
        "id": "NV",
        "name": "Nevada",
        "incidence": 395.6,
        "count": 15197
      },
      {
        "id": "NH",
        "name": "New Hampshire",
        "incidence": 480.1,
        "count": 9425
      },
      {
        "id": "NJ",
        "name": "New Jersey",
        "incidence": 483.3,
        "count": 56801
      },
      {
        "id": "NM",
        "name": "New Mexico",
        "incidence": 378.6,
        "count": 10406
      },
      {
        "id": "NY",
        "name": "New York",
        "incidence": 472.2,
        "count": 120068
      },
      {
        "id": "NC",
        "name": "North Carolina",
        "incidence": 484.1,
        "count": 64064
      },
      {
        "id": "ND",
        "name": "North Dakota",
        "incidence": 460.9,
        "count": 4194
      },
      {
        "id": "OH",
        "name": "Ohio",
        "incidence": 479,
        "count": 73130
      },
      {
        "id": "OK",
        "name": "Oklahoma",
        "incidence": 465.2,
        "count": 22070
      },
      {
        "id": "OR",
        "name": "Oregon",
        "incidence": 414.8,
        "count": 23043
      },
      {
        "id": "PA",
        "name": "Pennsylvania",
        "incidence": 458.3,
        "count": 80804
      },
      {
        "id": "RI",
        "name": "Rhode Island",
        "incidence": 457.1,
        "count": 6662
      },
      {
        "id": "SC",
        "name": "South Carolina",
        "incidence": 448,
        "count": 30868
      },
      {
        "id": "SD",
        "name": "South Dakota",
        "incidence": 472.7,
        "count": 5274
      },
      {
        "id": "TN",
        "name": "Tennessee",
        "incidence": 460.3,
        "count": 40106
      },
      {
        "id": "TX",
        "name": "Texas",
        "incidence": 434.2,
        "count": 134736
      },
      {
        "id": "UT",
        "name": "Utah",
        "incidence": 428.7,
        "count": 13133
      },
      {
        "id": "VT",
        "name": "Vermont",
        "incidence": 459.1,
        "count": 4267
      },
      {
        "id": "VA",
        "name": "Virginia",
        "incidence": 417.1,
        "count": 44303
      },
      {
        "id": "WA",
        "name": "Washington",
        "incidence": 441.2,
        "count": 40948
      },
      {
        "id": "WV",
        "name": "West Virginia",
        "incidence": 503.8,
        "count": 12794
      },
      {
        "id": "WI",
        "name": "Wisconsin",
        "incidence": 480.5,
        "count": 37121
      },
      {
        "id": "WY",
        "name": "Wyoming",
        "incidence": 407.5,
        "count": 3027
      }
    ]
  },
  "poverty": {
    "period": "2023",
    "method": "U.S. Census Bureau, American Community Survey 2023 1-year estimate",
    "measure": "Percent of people for whom poverty status is determined with family or individual income below the federal poverty threshold in the past 12 months",
    "marginOfError": "Percentage points, 90% confidence level",
    "source": "https://www2.census.gov/library/publications/2024/demo/acsbr-022.pdf",
    "reference": "Poverty in States and Metropolitan Areas: 2023, Appendix Table 1, ‘Below poverty in 2023’ percent and margin-of-error columns",
    "national": {
      "id": "US",
      "name": "United States",
      "poverty": 12.5,
      "povertyMarginOfError": 0.1
    },
    "rows": [
      {
        "id": "AL",
        "name": "Alabama",
        "incidence": 435.7,
        "count": 28080,
        "poverty": 15.6,
        "povertyMarginOfError": 0.5,
        "income": 62212,
        "incomeMarginOfError": 711
      },
      {
        "id": "AK",
        "name": "Alaska",
        "incidence": 438.5,
        "count": 3389,
        "poverty": 10.4,
        "povertyMarginOfError": 0.8,
        "income": 86631,
        "incomeMarginOfError": 2575
      },
      {
        "id": "AZ",
        "name": "Arizona",
        "incidence": 389.6,
        "count": 36667,
        "poverty": 12.4,
        "povertyMarginOfError": 0.4,
        "income": 77315,
        "incomeMarginOfError": 931
      },
      {
        "id": "AR",
        "name": "Arkansas",
        "incidence": 476,
        "count": 18165,
        "poverty": 15.7,
        "povertyMarginOfError": 0.6,
        "income": 58700,
        "incomeMarginOfError": 1155
      },
      {
        "id": "CA",
        "name": "California",
        "incidence": 413,
        "count": 187921,
        "poverty": 12,
        "povertyMarginOfError": 0.2,
        "income": 95521,
        "incomeMarginOfError": 611
      },
      {
        "id": "CO",
        "name": "Colorado",
        "incidence": 398.3,
        "count": 26520,
        "poverty": 9.3,
        "povertyMarginOfError": 0.4,
        "income": 92911,
        "incomeMarginOfError": 1057
      },
      {
        "id": "CT",
        "name": "Connecticut",
        "incidence": 477.3,
        "count": 22859,
        "poverty": 10.3,
        "povertyMarginOfError": 0.5,
        "income": 91665,
        "incomeMarginOfError": 1473
      },
      {
        "id": "DE",
        "name": "Delaware",
        "incidence": 479.7,
        "count": 6754,
        "poverty": 10.5,
        "povertyMarginOfError": 1,
        "income": 81361,
        "incomeMarginOfError": 1668
      },
      {
        "id": "DC",
        "name": "District of Columbia",
        "incidence": 440.5,
        "count": 2999,
        "poverty": 14,
        "povertyMarginOfError": 1.6,
        "income": 108210,
        "incomeMarginOfError": 6847
      },
      {
        "id": "FL",
        "name": "Florida",
        "incidence": 470,
        "count": 149440,
        "poverty": 12.3,
        "povertyMarginOfError": 0.3,
        "income": 73311,
        "incomeMarginOfError": 577
      },
      {
        "id": "GA",
        "name": "Georgia",
        "incidence": 473.1,
        "count": 58637,
        "poverty": 13.6,
        "povertyMarginOfError": 0.4,
        "income": 74632,
        "incomeMarginOfError": 833
      },
      {
        "id": "HI",
        "name": "Hawaii",
        "incidence": 415.9,
        "count": 8123,
        "poverty": 10.1,
        "povertyMarginOfError": 0.7,
        "income": 95322,
        "incomeMarginOfError": 2478
      },
      {
        "id": "ID",
        "name": "Idaho",
        "incidence": 446.6,
        "count": 10117,
        "poverty": 10.1,
        "povertyMarginOfError": 0.7,
        "income": 74942,
        "incomeMarginOfError": 1126
      },
      {
        "id": "IL",
        "name": "Illinois",
        "incidence": 468.7,
        "count": 73561,
        "poverty": 11.6,
        "povertyMarginOfError": 0.2,
        "income": 80306,
        "incomeMarginOfError": 635
      },
      {
        "id": "IN",
        "name": "Indiana",
        "incidence": 468.2,
        "count": 38862,
        "poverty": 12.3,
        "povertyMarginOfError": 0.4,
        "income": 69477,
        "incomeMarginOfError": 808
      },
      {
        "id": "IA",
        "name": "Iowa",
        "incidence": 504.1,
        "count": 20505,
        "poverty": 11.3,
        "povertyMarginOfError": 0.5,
        "income": 71433,
        "incomeMarginOfError": 1135
      },
      {
        "id": "KS",
        "name": "Kansas",
        "incidence": 464.7,
        "count": 16514,
        "poverty": 11.2,
        "povertyMarginOfError": 0.5,
        "income": 70333,
        "incomeMarginOfError": 1182
      },
      {
        "id": "KY",
        "name": "Kentucky",
        "incidence": 524.7,
        "count": 29715,
        "poverty": 16.4,
        "povertyMarginOfError": 0.5,
        "income": 61118,
        "incomeMarginOfError": 653
      },
      {
        "id": "LA",
        "name": "Louisiana",
        "incidence": 493.3,
        "count": 27756,
        "poverty": 18.9,
        "povertyMarginOfError": 0.6,
        "income": 58229,
        "incomeMarginOfError": 1143
      },
      {
        "id": "ME",
        "name": "Maine",
        "incidence": 489.4,
        "count": 10155,
        "poverty": 10.4,
        "povertyMarginOfError": 0.6,
        "income": 73733,
        "incomeMarginOfError": 1699
      },
      {
        "id": "MD",
        "name": "Maryland",
        "incidence": 458.9,
        "count": 35118,
        "poverty": 9.5,
        "povertyMarginOfError": 0.3,
        "income": 98678,
        "incomeMarginOfError": 1292
      },
      {
        "id": "MA",
        "name": "Massachusetts",
        "incidence": 452.3,
        "count": 40893,
        "poverty": 10.4,
        "povertyMarginOfError": 0.4,
        "income": 99858,
        "incomeMarginOfError": 1355
      },
      {
        "id": "MI",
        "name": "Michigan",
        "incidence": 457.4,
        "count": 60488,
        "poverty": 13.5,
        "povertyMarginOfError": 0.3,
        "income": 69183,
        "incomeMarginOfError": 694
      },
      {
        "id": "MN",
        "name": "Minnesota",
        "incidence": 492.2,
        "count": 34827,
        "poverty": 9.3,
        "povertyMarginOfError": 0.3,
        "income": 85086,
        "incomeMarginOfError": 768
      },
      {
        "id": "MS",
        "name": "Mississippi",
        "incidence": 471.3,
        "count": 17317,
        "poverty": 18,
        "povertyMarginOfError": 0.8,
        "income": 54203,
        "incomeMarginOfError": 1260
      },
      {
        "id": "MO",
        "name": "Missouri",
        "incidence": 472.9,
        "count": 37243,
        "poverty": 12,
        "povertyMarginOfError": 0.4,
        "income": 68545,
        "incomeMarginOfError": 900
      },
      {
        "id": "MT",
        "name": "Montana",
        "incidence": 451.8,
        "count": 6755,
        "poverty": 11.7,
        "povertyMarginOfError": 0.7,
        "income": 70804,
        "incomeMarginOfError": 1475
      },
      {
        "id": "NE",
        "name": "Nebraska",
        "incidence": 446.5,
        "count": 10453,
        "poverty": 10.5,
        "povertyMarginOfError": 0.7,
        "income": 74590,
        "incomeMarginOfError": 1340
      },
      {
        "id": "NV",
        "name": "Nevada",
        "incidence": 395.6,
        "count": 15197,
        "poverty": 12,
        "povertyMarginOfError": 0.7,
        "income": 76364,
        "incomeMarginOfError": 1451
      },
      {
        "id": "NH",
        "name": "New Hampshire",
        "incidence": 480.1,
        "count": 9425,
        "poverty": 7.2,
        "povertyMarginOfError": 0.6,
        "income": 96838,
        "incomeMarginOfError": 2243
      },
      {
        "id": "NJ",
        "name": "New Jersey",
        "incidence": 483.3,
        "count": 56801,
        "poverty": 9.7,
        "povertyMarginOfError": 0.3,
        "income": 99781,
        "incomeMarginOfError": 1061
      },
      {
        "id": "NM",
        "name": "New Mexico",
        "incidence": 378.6,
        "count": 10406,
        "poverty": 17.8,
        "povertyMarginOfError": 0.9,
        "income": 62268,
        "incomeMarginOfError": 1281
      },
      {
        "id": "NY",
        "name": "New York",
        "incidence": 472.2,
        "count": 120068,
        "poverty": 14.2,
        "povertyMarginOfError": 0.3,
        "income": 82095,
        "incomeMarginOfError": 500
      },
      {
        "id": "NC",
        "name": "North Carolina",
        "incidence": 484.1,
        "count": 64064,
        "poverty": 12.8,
        "povertyMarginOfError": 0.4,
        "income": 70804,
        "incomeMarginOfError": 547
      },
      {
        "id": "ND",
        "name": "North Dakota",
        "incidence": 460.9,
        "count": 4194,
        "poverty": 9.8,
        "povertyMarginOfError": 0.7,
        "income": 76525,
        "incomeMarginOfError": 1844
      },
      {
        "id": "OH",
        "name": "Ohio",
        "incidence": 479,
        "count": 73130,
        "poverty": 13.3,
        "povertyMarginOfError": 0.3,
        "income": 67769,
        "incomeMarginOfError": 731
      },
      {
        "id": "OK",
        "name": "Oklahoma",
        "incidence": 465.2,
        "count": 22070,
        "poverty": 15.9,
        "povertyMarginOfError": 0.4,
        "income": 62138,
        "incomeMarginOfError": 480
      },
      {
        "id": "OR",
        "name": "Oregon",
        "incidence": 414.8,
        "count": 23043,
        "poverty": 12.2,
        "povertyMarginOfError": 0.4,
        "income": 80160,
        "incomeMarginOfError": 1045
      },
      {
        "id": "PA",
        "name": "Pennsylvania",
        "incidence": 458.3,
        "count": 80804,
        "poverty": 12,
        "povertyMarginOfError": 0.3,
        "income": 73824,
        "incomeMarginOfError": 511
      },
      {
        "id": "RI",
        "name": "Rhode Island",
        "incidence": 457.1,
        "count": 6662,
        "poverty": 10.8,
        "povertyMarginOfError": 1,
        "income": 84972,
        "incomeMarginOfError": 2566
      },
      {
        "id": "SC",
        "name": "South Carolina",
        "incidence": 448,
        "count": 30868,
        "poverty": 13.9,
        "povertyMarginOfError": 0.5,
        "income": 67804,
        "incomeMarginOfError": 1049
      },
      {
        "id": "SD",
        "name": "South Dakota",
        "incidence": 472.7,
        "count": 5274,
        "poverty": 11.8,
        "povertyMarginOfError": 1,
        "income": 71810,
        "incomeMarginOfError": 2132
      },
      {
        "id": "TN",
        "name": "Tennessee",
        "incidence": 460.3,
        "count": 40106,
        "poverty": 14,
        "povertyMarginOfError": 0.4,
        "income": 67631,
        "incomeMarginOfError": 865
      },
      {
        "id": "TX",
        "name": "Texas",
        "incidence": 434.2,
        "count": 134736,
        "poverty": 13.7,
        "povertyMarginOfError": 0.3,
        "income": 75780,
        "incomeMarginOfError": 472
      },
      {
        "id": "UT",
        "name": "Utah",
        "incidence": 428.7,
        "count": 13133,
        "poverty": 9,
        "povertyMarginOfError": 0.5,
        "income": 93421,
        "incomeMarginOfError": 1383
      },
      {
        "id": "VT",
        "name": "Vermont",
        "incidence": 459.1,
        "count": 4267,
        "poverty": 9.7,
        "povertyMarginOfError": 0.8,
        "income": 81211,
        "incomeMarginOfError": 2608
      },
      {
        "id": "VA",
        "name": "Virginia",
        "incidence": 417.1,
        "count": 44303,
        "poverty": 10.2,
        "povertyMarginOfError": 0.3,
        "income": 89931,
        "incomeMarginOfError": 970
      },
      {
        "id": "WA",
        "name": "Washington",
        "incidence": 441.2,
        "count": 40948,
        "poverty": 10.3,
        "povertyMarginOfError": 0.3,
        "income": 94605,
        "incomeMarginOfError": 1221
      },
      {
        "id": "WV",
        "name": "West Virginia",
        "incidence": 503.8,
        "count": 12794,
        "poverty": 16.7,
        "povertyMarginOfError": 0.7,
        "income": 55948,
        "incomeMarginOfError": 1052
      },
      {
        "id": "WI",
        "name": "Wisconsin",
        "incidence": 480.5,
        "count": 37121,
        "poverty": 10.7,
        "povertyMarginOfError": 0.3,
        "income": 74631,
        "incomeMarginOfError": 774
      },
      {
        "id": "WY",
        "name": "Wyoming",
        "incidence": 407.5,
        "count": 3027,
        "poverty": 11.3,
        "povertyMarginOfError": 1.1,
        "income": 72415,
        "incomeMarginOfError": 2357
      }
    ],
    "incomeSource": {
      "period": "2023",
      "method": "U.S. Census Bureau, American Community Survey 2023 1-year estimate",
      "measure": "Median household income in the past 12 months, in 2023 inflation-adjusted U.S. dollars",
      "marginOfError": "Dollars, 90% confidence level",
      "source": "https://www2.census.gov/library/publications/2024/demo/acsbr-023.pdf",
      "reference": "Household Income in States and Metropolitan Areas: 2023, Table 1, 2023 median household income and margin-of-error columns",
      "national": {
        "id": "US",
        "name": "United States",
        "income": 77719,
        "incomeMarginOfError": 186
      }
    }
  },
  "race": {
    "period": "2018–2022",
    "scope": "United States, all cancer sites and both sexes. American Indian / Alaska Native incidence covers designated counties only.",
    "unit": "Age-adjusted annual rate per 100,000 people",
    "standard": "2000 U.S. standard population",
    "benchmark": {
      "name": "All races and ethnicities",
      "incidence": 460.6,
      "mortality": 146
    },
    "incidence": {
      "label": "American Cancer Society, Cancer Facts & Figures 2026, Table 9 (All sites)",
      "url": "https://www.cancer.org/content/dam/cancer-org/research/cancer-facts-and-statistics/annual-cancer-facts-and-figures/2026/2026-cancer-facts-and-figures.pdf",
      "underlying": "North American Association of Central Cancer Registries, 2025",
      "notes": "Rates are adjusted for delays in case reporting. The American Indian/Alaska Native rate is for people in Purchased/Referred Care Delivery Area counties only, to reduce misclassification."
    },
    "mortality": {
      "label": "American Cancer Society, Cancer Facts & Figures 2025, Table 9 (All sites)",
      "url": "https://www.cancer.org/content/dam/cancer-org/research/cancer-facts-and-statistics/annual-cancer-facts-and-figures/2025/2025-cancer-facts-and-figures-acs.pdf",
      "underlying": "National Center for Health Statistics, Centers for Disease Control and Prevention, 2024",
      "notes": "The American Indian/Alaska Native rate covers the entire U.S. and adjusts for race misclassification."
    },
    "notes": "These are the five groups shown in the source, not a complete list of U.S. race and ethnicity identities. All named race groups exclude people of Hispanic ethnicity; Hispanic/Latino includes people of any race. A combined Asian American / Pacific Islander rate can mask differing rates within those communities. The groups are population reporting categories, not genetic categories. Population rates are not causes or individual risk. Do not divide death rates by diagnosis rates to estimate survival; deaths and diagnoses do not track the same individuals.",
    "rows": [
      {
        "id": "ai-an",
        "name": "American Indian / Alaska Native (non-Hispanic)",
        "incidence": 497.8,
        "mortality": 178.1
      },
      {
        "id": "asian-pi",
        "name": "Asian American / Pacific Islander (non-Hispanic)",
        "incidence": 311.2,
        "mortality": 93
      },
      {
        "id": "black",
        "name": "Black (non-Hispanic)",
        "incidence": 467.7,
        "mortality": 168.6
      },
      {
        "id": "hispanic",
        "name": "Hispanic / Latino (any race)",
        "incidence": 369.8,
        "mortality": 106.8
      },
      {
        "id": "white",
        "name": "White (non-Hispanic)",
        "incidence": 482.2,
        "mortality": 151.3
      }
    ]
  },
  "michigan": {
    "period": "Michigan registry data: 2019–2023; modeled mammography use: 2021–2023. Median household income: 2023.",
    "sources": {
      "All-stage diagnoses (NCI/CDC)": "https://statecancerprofiles.cancer.gov/incidencerates/index.php?age=001&areatype=county&cancer=055&race=00&ruralurban=0&sex=2&statefips=26&type=incd",
      "Late-stage diagnoses (NCI/CDC)": "https://statecancerprofiles.cancer.gov/incidencerates/index.php?age=001&areatype=county&cancer=055&race=00&ruralurban=0&sex=2&stage=211&statefips=26&type=incd",
      "Mammography estimates (NCI)": "https://statecancerprofiles.cancer.gov/risk/index.php?datatype=1&race=00&risk=v05&sex=2&sortOrder=desc&sortVariableName=percent&statefips=26&topic=women&type=risk",
      "Urban/rural classification (USDA)": "https://www.ers.usda.gov/data-products/rural-urban-continuum-codes",
      "Median household income (Census)": "https://www2.census.gov/programs-surveys/saipe/datasets/2023/2023-state-and-county/est23-mi.txt"
    },
    "rows": [
      {
        "id": "26001",
        "name": "Alcona County",
        "region": "Rural",
        "incidence": 129.1,
        "allCI": [
          90.1,
          181.9
        ],
        "annualAllCount": 12,
        "late-rate": null,
        "late-share": null,
        "lateCI": [
          null,
          null
        ],
        "annualLateCount": null,
        "screening": 84.9,
        "screeningCI": [
          70.3,
          96.2
        ],
        "income": 53033,
        "incomeCI": [
          48071,
          57995
        ]
      },
      {
        "id": "26003",
        "name": "Alger County",
        "region": "Rural",
        "incidence": 136.3,
        "allCI": [
          90.8,
          198.4
        ],
        "annualAllCount": 7,
        "late-rate": null,
        "late-share": null,
        "lateCI": [
          null,
          null
        ],
        "annualLateCount": null,
        "screening": 82.5,
        "screeningCI": [
          66.9,
          95
        ],
        "income": 62543,
        "incomeCI": [
          58223,
          66863
        ]
      },
      {
        "id": "26005",
        "name": "Allegan County",
        "region": "Rural",
        "incidence": 123.2,
        "allCI": [
          112.1,
          135.3
        ],
        "annualAllCount": 99,
        "late-rate": 35.5,
        "late-share": 27.8,
        "lateCI": [
          29.5,
          42.4
        ],
        "annualLateCount": 27,
        "screening": 84.5,
        "screeningCI": [
          71.9,
          95
        ],
        "income": 78772,
        "incomeCI": [
          75383,
          82161
        ]
      },
      {
        "id": "26007",
        "name": "Alpena County",
        "region": "Rural",
        "incidence": 147.2,
        "allCI": [
          122.6,
          175.7
        ],
        "annualAllCount": 31,
        "late-rate": 41.7,
        "late-share": 26.8,
        "lateCI": [
          28.8,
          58.7
        ],
        "annualLateCount": 8,
        "screening": 84.5,
        "screeningCI": [
          71.5,
          94.8
        ],
        "income": 53480,
        "incomeCI": [
          48778,
          58182
        ]
      },
      {
        "id": "26009",
        "name": "Antrim County",
        "region": "Rural",
        "incidence": 139.7,
        "allCI": [
          114.1,
          170.2
        ],
        "annualAllCount": 28,
        "late-rate": 52,
        "late-share": 33.3,
        "lateCI": [
          35.7,
          73.8
        ],
        "annualLateCount": 9,
        "screening": 81.1,
        "screeningCI": [
          65.4,
          93.9
        ],
        "income": 72369,
        "incomeCI": [
          66174,
          78564
        ]
      },
      {
        "id": "26011",
        "name": "Arenac County",
        "region": "Rural",
        "incidence": 121.6,
        "allCI": [
          91.9,
          159
        ],
        "annualAllCount": 15,
        "late-rate": 30.7,
        "late-share": 24.7,
        "lateCI": [
          16.8,
          52.9
        ],
        "annualLateCount": 4,
        "screening": 79.6,
        "screeningCI": [
          62.6,
          93.5
        ],
        "income": 56213,
        "incomeCI": [
          52460,
          59966
        ]
      },
      {
        "id": "26013",
        "name": "Baraga County",
        "region": "Rural",
        "incidence": 60,
        "allCI": [
          34,
          101.7
        ],
        "annualAllCount": 4,
        "late-rate": null,
        "late-share": null,
        "lateCI": [
          null,
          null
        ],
        "annualLateCount": null,
        "screening": 71.6,
        "screeningCI": [
          52.3,
          88.3
        ],
        "income": 55856,
        "incomeCI": [
          48914,
          62798
        ]
      },
      {
        "id": "26015",
        "name": "Barry County",
        "region": "Urban",
        "incidence": 121.4,
        "allCI": [
          105.7,
          138.9
        ],
        "annualAllCount": 49,
        "late-rate": 37.1,
        "late-share": 27.9,
        "lateCI": [
          28.3,
          47.9
        ],
        "annualLateCount": 14,
        "screening": 76.1,
        "screeningCI": [
          63.5,
          87.3
        ],
        "income": 75377,
        "incomeCI": [
          69218,
          81536
        ]
      },
      {
        "id": "26017",
        "name": "Bay County",
        "region": "Urban",
        "incidence": 137.6,
        "allCI": [
          125.3,
          151
        ],
        "annualAllCount": 106,
        "late-rate": 35.8,
        "late-share": 24.6,
        "lateCI": [
          29.4,
          43.2
        ],
        "annualLateCount": 26,
        "screening": 80.4,
        "screeningCI": [
          66.5,
          92.4
        ],
        "income": 59523,
        "incomeCI": [
          54958,
          64088
        ]
      },
      {
        "id": "26019",
        "name": "Benzie County",
        "region": "Urban",
        "incidence": 140.4,
        "allCI": [
          110.9,
          176.3
        ],
        "annualAllCount": 20,
        "late-rate": 46,
        "late-share": 26.7,
        "lateCI": [
          28.2,
          71.2
        ],
        "annualLateCount": 5,
        "screening": 79.7,
        "screeningCI": [
          63.9,
          92.9
        ],
        "income": 65594,
        "incomeCI": [
          60165,
          71023
        ]
      },
      {
        "id": "26021",
        "name": "Berrien County",
        "region": "Urban",
        "incidence": 126.3,
        "allCI": [
          116.4,
          136.9
        ],
        "annualAllCount": 138,
        "late-rate": 42.2,
        "late-share": 31.6,
        "lateCI": [
          36.3,
          48.7
        ],
        "annualLateCount": 44,
        "screening": 76.7,
        "screeningCI": [
          61.8,
          90.1
        ],
        "income": 62758,
        "incomeCI": [
          59980,
          65536
        ]
      },
      {
        "id": "26023",
        "name": "Branch County",
        "region": "Rural",
        "incidence": 119.3,
        "allCI": [
          101.2,
          140
        ],
        "annualAllCount": 35,
        "late-rate": 44.2,
        "late-share": 33.5,
        "lateCI": [
          32.9,
          58.1
        ],
        "annualLateCount": 12,
        "screening": 78.4,
        "screeningCI": [
          63.1,
          91.7
        ],
        "income": 57641,
        "incomeCI": [
          52913,
          62369
        ]
      },
      {
        "id": "26025",
        "name": "Calhoun County",
        "region": "Urban",
        "incidence": 115,
        "allCI": [
          104.7,
          126.1
        ],
        "annualAllCount": 102,
        "late-rate": 35.4,
        "late-share": 29.9,
        "lateCI": [
          29.7,
          41.9
        ],
        "annualLateCount": 30,
        "screening": 74.8,
        "screeningCI": [
          58.8,
          89.1
        ],
        "income": 58617,
        "incomeCI": [
          54512,
          62722
        ]
      },
      {
        "id": "26027",
        "name": "Cass County",
        "region": "Urban",
        "incidence": 102.7,
        "allCI": [
          87.6,
          119.9
        ],
        "annualAllCount": 39,
        "late-rate": 37.6,
        "late-share": 35.6,
        "lateCI": [
          28.6,
          49
        ],
        "annualLateCount": 14,
        "screening": 86.5,
        "screeningCI": [
          73.8,
          96.5
        ],
        "income": 68720,
        "incomeCI": [
          62107,
          75333
        ]
      },
      {
        "id": "26029",
        "name": "Charlevoix County",
        "region": "Rural",
        "incidence": 113.7,
        "allCI": [
          92.2,
          139.4
        ],
        "annualAllCount": 25,
        "late-rate": 34.4,
        "late-share": 28,
        "lateCI": [
          22.7,
          50.8
        ],
        "annualLateCount": 7,
        "screening": 81.9,
        "screeningCI": [
          65.3,
          94.9
        ],
        "income": 78405,
        "incomeCI": [
          75658,
          81152
        ]
      },
      {
        "id": "26031",
        "name": "Cheboygan County",
        "region": "Rural",
        "incidence": 119.7,
        "allCI": [
          97.6,
          146.1
        ],
        "annualAllCount": 27,
        "late-rate": 41.6,
        "late-share": 29.9,
        "lateCI": [
          28,
          60.2
        ],
        "annualLateCount": 8,
        "screening": 78.2,
        "screeningCI": [
          62.6,
          91.5
        ],
        "income": 61488,
        "incomeCI": [
          57927,
          65049
        ]
      },
      {
        "id": "26033",
        "name": "Chippewa County",
        "region": "Rural",
        "incidence": 135.5,
        "allCI": [
          112.2,
          162.3
        ],
        "annualAllCount": 29,
        "late-rate": 45,
        "late-share": 32.9,
        "lateCI": [
          32,
          61.7
        ],
        "annualLateCount": 9,
        "screening": 80,
        "screeningCI": [
          63.5,
          93.3
        ],
        "income": 59852,
        "incomeCI": [
          56517,
          63187
        ]
      },
      {
        "id": "26035",
        "name": "Clare County",
        "region": "Rural",
        "incidence": 128.1,
        "allCI": [
          106.6,
          153
        ],
        "annualAllCount": 32,
        "late-rate": 39.1,
        "late-share": 28.1,
        "lateCI": [
          27,
          55
        ],
        "annualLateCount": 9,
        "screening": 78.3,
        "screeningCI": [
          61.2,
          92.4
        ],
        "income": 47793,
        "incomeCI": [
          44029,
          51557
        ]
      },
      {
        "id": "26037",
        "name": "Clinton County",
        "region": "Urban",
        "incidence": 137.7,
        "allCI": [
          123.1,
          153.7
        ],
        "annualAllCount": 70,
        "late-rate": 43.7,
        "late-share": 29.3,
        "lateCI": [
          35.3,
          53.5
        ],
        "annualLateCount": 21,
        "screening": 82.3,
        "screeningCI": [
          67.4,
          94.5
        ],
        "income": 91911,
        "incomeCI": [
          86151,
          97671
        ]
      },
      {
        "id": "26039",
        "name": "Crawford County",
        "region": "Rural",
        "incidence": 136.5,
        "allCI": [
          102.9,
          179
        ],
        "annualAllCount": 14,
        "late-rate": 41.3,
        "late-share": 30,
        "lateCI": [
          24,
          68
        ],
        "annualLateCount": 4,
        "screening": 83.5,
        "screeningCI": [
          66.6,
          96.1
        ],
        "income": 59220,
        "incomeCI": [
          54786,
          63654
        ]
      },
      {
        "id": "26041",
        "name": "Delta County",
        "region": "Rural",
        "incidence": 131.5,
        "allCI": [
          111.1,
          154.9
        ],
        "annualAllCount": 37,
        "late-rate": 32.9,
        "late-share": 21.6,
        "lateCI": [
          22.5,
          46.7
        ],
        "annualLateCount": 8,
        "screening": 83.9,
        "screeningCI": [
          69.8,
          95.3
        ],
        "income": 58072,
        "incomeCI": [
          52104,
          64040
        ]
      },
      {
        "id": "26043",
        "name": "Dickinson County",
        "region": "Rural",
        "incidence": 65.4,
        "allCI": [
          48.4,
          87
        ],
        "annualAllCount": 12,
        "late-rate": null,
        "late-share": null,
        "lateCI": [
          null,
          null
        ],
        "annualLateCount": null,
        "screening": 85.8,
        "screeningCI": [
          72.1,
          96.4
        ],
        "income": 61704,
        "incomeCI": [
          54590,
          68818
        ]
      },
      {
        "id": "26045",
        "name": "Eaton County",
        "region": "Urban",
        "incidence": 153.5,
        "allCI": [
          140.6,
          167.4
        ],
        "annualAllCount": 117,
        "late-rate": 41.5,
        "late-share": 25.6,
        "lateCI": [
          34.8,
          49.3
        ],
        "annualLateCount": 30,
        "screening": 77.1,
        "screeningCI": [
          62.1,
          90.1
        ],
        "income": 73130,
        "incomeCI": [
          68140,
          78120
        ]
      },
      {
        "id": "26047",
        "name": "Emmet County",
        "region": "Rural",
        "incidence": 163.5,
        "allCI": [
          139.5,
          190.7
        ],
        "annualAllCount": 41,
        "late-rate": 45,
        "late-share": 25.5,
        "lateCI": [
          32.5,
          61
        ],
        "annualLateCount": 10,
        "screening": 92.2,
        "screeningCI": [
          82.3,
          98.9
        ],
        "income": 77292,
        "incomeCI": [
          70971,
          83613
        ]
      },
      {
        "id": "26049",
        "name": "Genesee County",
        "region": "Urban",
        "incidence": 121.7,
        "allCI": [
          115.6,
          128
        ],
        "annualAllCount": 333,
        "late-rate": 35.3,
        "late-share": 27.1,
        "lateCI": [
          32,
          39
        ],
        "annualLateCount": 90,
        "screening": 83.3,
        "screeningCI": [
          71.3,
          93.8
        ],
        "income": 60192,
        "incomeCI": [
          57680,
          62704
        ]
      },
      {
        "id": "26051",
        "name": "Gladwin County",
        "region": "Rural",
        "incidence": 127.8,
        "allCI": [
          104.4,
          155.6
        ],
        "annualAllCount": 27,
        "late-rate": 26.9,
        "late-share": 23.7,
        "lateCI": [
          17.6,
          40.6
        ],
        "annualLateCount": 6,
        "screening": 86.8,
        "screeningCI": [
          75.3,
          96
        ],
        "income": 51395,
        "incomeCI": [
          47991,
          54799
        ]
      },
      {
        "id": "26053",
        "name": "Gogebic County",
        "region": "Rural",
        "incidence": 88.3,
        "allCI": [
          62.7,
          122.3
        ],
        "annualAllCount": 11,
        "late-rate": null,
        "late-share": null,
        "lateCI": [
          null,
          null
        ],
        "annualLateCount": null,
        "screening": 76.7,
        "screeningCI": [
          58.6,
          91.4
        ],
        "income": 48043,
        "incomeCI": [
          43689,
          52397
        ]
      },
      {
        "id": "26055",
        "name": "Grand Traverse County",
        "region": "Urban",
        "incidence": 125.4,
        "allCI": [
          112.7,
          139.2
        ],
        "annualAllCount": 84,
        "late-rate": 40.6,
        "late-share": 29.3,
        "lateCI": [
          33.2,
          49.2
        ],
        "annualLateCount": 25,
        "screening": 78.3,
        "screeningCI": [
          62.2,
          91.9
        ],
        "income": 82824,
        "incomeCI": [
          79095,
          86553
        ]
      },
      {
        "id": "26057",
        "name": "Gratiot County",
        "region": "Rural",
        "incidence": 121.5,
        "allCI": [
          101.6,
          144.4
        ],
        "annualAllCount": 30,
        "late-rate": 28,
        "late-share": 22.7,
        "lateCI": [
          18.8,
          40.3
        ],
        "annualLateCount": 7,
        "screening": 75,
        "screeningCI": [
          57.4,
          89.8
        ],
        "income": 60251,
        "incomeCI": [
          54752,
          65750
        ]
      },
      {
        "id": "26059",
        "name": "Hillsdale County",
        "region": "Rural",
        "incidence": 110.9,
        "allCI": [
          94.3,
          129.9
        ],
        "annualAllCount": 37,
        "late-rate": 36,
        "late-share": 27.9,
        "lateCI": [
          26.2,
          48.4
        ],
        "annualLateCount": 10,
        "screening": 79.9,
        "screeningCI": [
          64.3,
          92.5
        ],
        "income": 58676,
        "incomeCI": [
          53079,
          64273
        ]
      },
      {
        "id": "26061",
        "name": "Houghton County",
        "region": "Rural",
        "incidence": 70.5,
        "allCI": [
          54.4,
          90.2
        ],
        "annualAllCount": 15,
        "late-rate": 23.8,
        "late-share": 29.3,
        "lateCI": [
          14.3,
          37.2
        ],
        "annualLateCount": 4,
        "screening": 75.2,
        "screeningCI": [
          56.9,
          90.5
        ],
        "income": 56074,
        "incomeCI": [
          53518,
          58630
        ]
      },
      {
        "id": "26063",
        "name": "Huron County",
        "region": "Rural",
        "incidence": 124.5,
        "allCI": [
          102,
          150.7
        ],
        "annualAllCount": 29,
        "late-rate": 39.5,
        "late-share": 30.1,
        "lateCI": [
          27.1,
          56
        ],
        "annualLateCount": 9,
        "screening": 76.5,
        "screeningCI": [
          58.9,
          91.3
        ],
        "income": 59319,
        "incomeCI": [
          54028,
          64610
        ]
      },
      {
        "id": "26065",
        "name": "Ingham County",
        "region": "Urban",
        "incidence": 150.1,
        "allCI": [
          141.2,
          159.3
        ],
        "annualAllCount": 232,
        "late-rate": 44.1,
        "late-share": 28.4,
        "lateCI": [
          39.3,
          49.3
        ],
        "annualLateCount": 66,
        "screening": 87.9,
        "screeningCI": [
          76.9,
          96.7
        ],
        "income": 63483,
        "incomeCI": [
          60295,
          66671
        ]
      },
      {
        "id": "26067",
        "name": "Ionia County",
        "region": "Urban",
        "incidence": 127.6,
        "allCI": [
          111.4,
          145.6
        ],
        "annualAllCount": 48,
        "late-rate": 41.5,
        "late-share": 30.8,
        "lateCI": [
          32.2,
          52.8
        ],
        "annualLateCount": 15,
        "screening": 75.5,
        "screeningCI": [
          58.4,
          90.3
        ],
        "income": 70177,
        "incomeCI": [
          64811,
          75543
        ]
      },
      {
        "id": "26069",
        "name": "Iosco County",
        "region": "Rural",
        "incidence": 113.6,
        "allCI": [
          91.9,
          139.8
        ],
        "annualAllCount": 27,
        "late-rate": 43.9,
        "late-share": 35.1,
        "lateCI": [
          29.9,
          63
        ],
        "annualLateCount": 9,
        "screening": 85.4,
        "screeningCI": [
          72.1,
          95.9
        ],
        "income": 52734,
        "incomeCI": [
          48276,
          57192
        ]
      },
      {
        "id": "26071",
        "name": "Iron County",
        "region": "Rural",
        "incidence": 87.2,
        "allCI": [
          58.2,
          127.2
        ],
        "annualAllCount": 8,
        "late-rate": null,
        "late-share": null,
        "lateCI": [
          null,
          null
        ],
        "annualLateCount": null,
        "screening": 84.6,
        "screeningCI": [
          68.2,
          96.6
        ],
        "income": 49137,
        "incomeCI": [
          43044,
          55230
        ]
      },
      {
        "id": "26073",
        "name": "Isabella County",
        "region": "Rural",
        "incidence": 150.1,
        "allCI": [
          130.5,
          171.9
        ],
        "annualAllCount": 46,
        "late-rate": 46.9,
        "late-share": 30.2,
        "lateCI": [
          36.1,
          59.9
        ],
        "annualLateCount": 14,
        "screening": 81.8,
        "screeningCI": [
          68.5,
          92.8
        ],
        "income": 53213,
        "incomeCI": [
          48382,
          58044
        ]
      },
      {
        "id": "26075",
        "name": "Jackson County",
        "region": "Urban",
        "incidence": 131.9,
        "allCI": [
          121.7,
          142.9
        ],
        "annualAllCount": 139,
        "late-rate": 39.9,
        "late-share": 27.7,
        "lateCI": [
          34.1,
          46.5
        ],
        "annualLateCount": 38,
        "screening": 78.8,
        "screeningCI": [
          63.9,
          91.7
        ],
        "income": 64070,
        "incomeCI": [
          60443,
          67697
        ]
      },
      {
        "id": "26077",
        "name": "Kalamazoo County",
        "region": "Urban",
        "incidence": 139.6,
        "allCI": [
          130.9,
          148.7
        ],
        "annualAllCount": 208,
        "late-rate": 41.8,
        "late-share": 28.9,
        "lateCI": [
          37,
          47
        ],
        "annualLateCount": 60,
        "screening": 78.6,
        "screeningCI": [
          65,
          90.5
        ],
        "income": 67671,
        "incomeCI": [
          64896,
          70446
        ]
      },
      {
        "id": "26079",
        "name": "Kalkaska County",
        "region": "Urban",
        "incidence": 94.4,
        "allCI": [
          71.3,
          123.5
        ],
        "annualAllCount": 13,
        "late-rate": 32.1,
        "late-share": 33.8,
        "lateCI": [
          19.5,
          51.1
        ],
        "annualLateCount": 4,
        "screening": 78.4,
        "screeningCI": [
          61,
          92.3
        ],
        "income": 60410,
        "incomeCI": [
          54453,
          66367
        ]
      },
      {
        "id": "26081",
        "name": "Kent County",
        "region": "Urban",
        "incidence": 137.6,
        "allCI": [
          132.2,
          143.2
        ],
        "annualAllCount": 513,
        "late-rate": 36.3,
        "late-share": 25.5,
        "lateCI": [
          33.5,
          39.3
        ],
        "annualLateCount": 131,
        "screening": 72.8,
        "screeningCI": [
          64.5,
          80.8
        ],
        "income": 79715,
        "incomeCI": [
          76954,
          82476
        ]
      },
      {
        "id": "26083",
        "name": "Keweenaw County",
        "region": "Rural",
        "incidence": null,
        "allCI": [
          null,
          null
        ],
        "annualAllCount": null,
        "late-rate": null,
        "late-share": null,
        "lateCI": [
          null,
          null
        ],
        "annualLateCount": null,
        "screening": 85.1,
        "screeningCI": [
          68.3,
          97.2
        ],
        "income": 54912,
        "incomeCI": [
          47976,
          61848
        ]
      },
      {
        "id": "26085",
        "name": "Lake County",
        "region": "Rural",
        "incidence": 148.6,
        "allCI": [
          112.6,
          194.9
        ],
        "annualAllCount": 15,
        "late-rate": 59,
        "late-share": 33.8,
        "lateCI": [
          35.8,
          93.7
        ],
        "annualLateCount": 5,
        "screening": 73.8,
        "screeningCI": [
          54.7,
          90
        ],
        "income": 50660,
        "incomeCI": [
          48133,
          53187
        ]
      },
      {
        "id": "26087",
        "name": "Lapeer County",
        "region": "Urban",
        "incidence": 129.4,
        "allCI": [
          115.9,
          144.1
        ],
        "annualAllCount": 78,
        "late-rate": 48.4,
        "late-share": 36,
        "lateCI": [
          40.1,
          58
        ],
        "annualLateCount": 28,
        "screening": 84.5,
        "screeningCI": [
          71.7,
          95
        ],
        "income": 71515,
        "incomeCI": [
          65604,
          77426
        ]
      },
      {
        "id": "26089",
        "name": "Leelanau County",
        "region": "Urban",
        "incidence": 139.5,
        "allCI": [
          112.9,
          171.5
        ],
        "annualAllCount": 29,
        "late-rate": 28.1,
        "late-share": 20.1,
        "lateCI": [
          17.4,
          44.5
        ],
        "annualLateCount": 6,
        "screening": 83.1,
        "screeningCI": [
          68,
          95.1
        ],
        "income": 91727,
        "incomeCI": [
          84140,
          99314
        ]
      },
      {
        "id": "26091",
        "name": "Lenawee County",
        "region": "Rural",
        "incidence": 110,
        "allCI": [
          98.7,
          122.3
        ],
        "annualAllCount": 78,
        "late-rate": 27.5,
        "late-share": 23,
        "lateCI": [
          21.7,
          34.3
        ],
        "annualLateCount": 18,
        "screening": 89.2,
        "screeningCI": [
          79.1,
          97.2
        ],
        "income": 65707,
        "incomeCI": [
          60804,
          70610
        ]
      },
      {
        "id": "26093",
        "name": "Livingston County",
        "region": "Urban",
        "incidence": 137.6,
        "allCI": [
          128.3,
          147.4
        ],
        "annualAllCount": 183,
        "late-rate": 43.2,
        "late-share": 28.6,
        "lateCI": [
          37.8,
          49.2
        ],
        "annualLateCount": 52,
        "screening": 83.2,
        "screeningCI": [
          69.7,
          94.4
        ],
        "income": 103737,
        "incomeCI": [
          97941,
          109533
        ]
      },
      {
        "id": "26095",
        "name": "Luce County",
        "region": "Rural",
        "incidence": 153,
        "allCI": [
          99.8,
          228.5
        ],
        "annualAllCount": 7,
        "late-rate": null,
        "late-share": null,
        "lateCI": [
          null,
          null
        ],
        "annualLateCount": null,
        "screening": 86.3,
        "screeningCI": [
          70.6,
          97.3
        ],
        "income": 51664,
        "incomeCI": [
          45314,
          58014
        ]
      },
      {
        "id": "26097",
        "name": "Mackinac County",
        "region": "Rural",
        "incidence": 151.1,
        "allCI": [
          109.2,
          205.1
        ],
        "annualAllCount": 11,
        "late-rate": 62.8,
        "late-share": 29.8,
        "lateCI": [
          34,
          105.9
        ],
        "annualLateCount": 3,
        "screening": 80.9,
        "screeningCI": [
          66,
          93.2
        ],
        "income": 51353,
        "incomeCI": [
          46947,
          55759
        ]
      },
      {
        "id": "26099",
        "name": "Macomb County",
        "region": "Urban",
        "incidence": 141.7,
        "allCI": [
          137.3,
          146.3
        ],
        "annualAllCount": 842,
        "late-rate": 46.6,
        "late-share": 31.1,
        "lateCI": [
          44,
          49.4
        ],
        "annualLateCount": 262,
        "screening": 75.4,
        "screeningCI": [
          64.7,
          85.5
        ],
        "income": 73929,
        "incomeCI": [
          72005,
          75853
        ]
      },
      {
        "id": "26101",
        "name": "Manistee County",
        "region": "Rural",
        "incidence": 107.8,
        "allCI": [
          85.3,
          135.2
        ],
        "annualAllCount": 22,
        "late-rate": 43.9,
        "late-share": 35.2,
        "lateCI": [
          29.1,
          64
        ],
        "annualLateCount": 8,
        "screening": 81.1,
        "screeningCI": [
          64.5,
          94.4
        ],
        "income": 57434,
        "incomeCI": [
          52594,
          62274
        ]
      },
      {
        "id": "26103",
        "name": "Marquette County",
        "region": "Rural",
        "incidence": 121.9,
        "allCI": [
          106.2,
          139.5
        ],
        "annualAllCount": 50,
        "late-rate": 29.3,
        "late-share": 23.9,
        "lateCI": [
          21.9,
          38.7
        ],
        "annualLateCount": 12,
        "screening": 82.3,
        "screeningCI": [
          68.1,
          94.1
        ],
        "income": 62319,
        "incomeCI": [
          59340,
          65298
        ]
      },
      {
        "id": "26105",
        "name": "Mason County",
        "region": "Rural",
        "incidence": 147.6,
        "allCI": [
          123,
          176.1
        ],
        "annualAllCount": 32,
        "late-rate": 46.6,
        "late-share": 26.7,
        "lateCI": [
          32.3,
          65.2
        ],
        "annualLateCount": 9,
        "screening": 81.3,
        "screeningCI": [
          66.5,
          93.7
        ],
        "income": 59543,
        "incomeCI": [
          55325,
          63761
        ]
      },
      {
        "id": "26107",
        "name": "Mecosta County",
        "region": "Rural",
        "incidence": 149.9,
        "allCI": [
          128,
          174.7
        ],
        "annualAllCount": 40,
        "late-rate": 40.2,
        "late-share": 23.2,
        "lateCI": [
          28.6,
          54.9
        ],
        "annualLateCount": 9,
        "screening": 76.8,
        "screeningCI": [
          61.8,
          89.7
        ],
        "income": 59260,
        "incomeCI": [
          55737,
          62783
        ]
      },
      {
        "id": "26109",
        "name": "Menominee County",
        "region": "Rural",
        "incidence": 71.2,
        "allCI": [
          52.6,
          95
        ],
        "annualAllCount": 12,
        "late-rate": 24.7,
        "late-share": 30.6,
        "lateCI": [
          13.9,
          41.2
        ],
        "annualLateCount": 4,
        "screening": 87.6,
        "screeningCI": [
          73.9,
          97.6
        ],
        "income": 55853,
        "incomeCI": [
          51509,
          60197
        ]
      },
      {
        "id": "26111",
        "name": "Midland County",
        "region": "Urban",
        "incidence": 146.8,
        "allCI": [
          132.3,
          162.6
        ],
        "annualAllCount": 84,
        "late-rate": 45,
        "late-share": 27.9,
        "lateCI": [
          36.7,
          54.6
        ],
        "annualLateCount": 23,
        "screening": 89,
        "screeningCI": [
          80.3,
          96.1
        ],
        "income": 73722,
        "incomeCI": [
          69428,
          78016
        ]
      },
      {
        "id": "26113",
        "name": "Missaukee County",
        "region": "Rural",
        "incidence": 124.7,
        "allCI": [
          94.2,
          162.6
        ],
        "annualAllCount": 13,
        "late-rate": 43.9,
        "late-share": 31.8,
        "lateCI": [
          26,
          70
        ],
        "annualLateCount": 4,
        "screening": 77.9,
        "screeningCI": [
          60.1,
          92.5
        ],
        "income": 66397,
        "incomeCI": [
          62550,
          70244
        ]
      },
      {
        "id": "26115",
        "name": "Monroe County",
        "region": "Urban",
        "incidence": 107.9,
        "allCI": [
          98.7,
          117.9
        ],
        "annualAllCount": 112,
        "late-rate": 40.9,
        "late-share": 34.7,
        "lateCI": [
          35,
          47.5
        ],
        "annualLateCount": 39,
        "screening": 76.5,
        "screeningCI": [
          61.9,
          89.6
        ],
        "income": 73617,
        "incomeCI": [
          68499,
          78735
        ]
      },
      {
        "id": "26117",
        "name": "Montcalm County",
        "region": "Urban",
        "incidence": 125.8,
        "allCI": [
          110.1,
          143.2
        ],
        "annualAllCount": 52,
        "late-rate": 36.9,
        "late-share": 26.8,
        "lateCI": [
          28.2,
          47.4
        ],
        "annualLateCount": 14,
        "screening": 81.2,
        "screeningCI": [
          66.7,
          93.4
        ],
        "income": 64912,
        "incomeCI": [
          61460,
          68364
        ]
      },
      {
        "id": "26119",
        "name": "Montmorency County",
        "region": "Rural",
        "incidence": 144.2,
        "allCI": [
          101.5,
          201.2
        ],
        "annualAllCount": 12,
        "late-rate": 60.9,
        "late-share": 37.3,
        "lateCI": [
          32.4,
          105.8
        ],
        "annualLateCount": 4,
        "screening": 82,
        "screeningCI": [
          64.1,
          95.5
        ],
        "income": 47374,
        "incomeCI": [
          43746,
          51002
        ]
      },
      {
        "id": "26121",
        "name": "Muskegon County",
        "region": "Urban",
        "incidence": 107.8,
        "allCI": [
          99.1,
          117.1
        ],
        "annualAllCount": 126,
        "late-rate": 32.5,
        "late-share": 29.2,
        "lateCI": [
          27.7,
          38
        ],
        "annualLateCount": 37,
        "screening": 74.1,
        "screeningCI": [
          61.2,
          85.8
        ],
        "income": 61223,
        "incomeCI": [
          58752,
          63694
        ]
      },
      {
        "id": "26123",
        "name": "Newaygo County",
        "region": "Rural",
        "incidence": 117.8,
        "allCI": [
          101.2,
          136.6
        ],
        "annualAllCount": 41,
        "late-rate": 29.7,
        "late-share": 24.9,
        "lateCI": [
          21.7,
          40
        ],
        "annualLateCount": 10,
        "screening": 77.6,
        "screeningCI": [
          62.1,
          91
        ],
        "income": 61951,
        "incomeCI": [
          57304,
          66598
        ]
      },
      {
        "id": "26125",
        "name": "Oakland County",
        "region": "Urban",
        "incidence": 143.7,
        "allCI": [
          139.9,
          147.5
        ],
        "annualAllCount": 1224,
        "late-rate": 45.5,
        "late-share": 30.4,
        "lateCI": [
          43.3,
          47.7
        ],
        "annualLateCount": 373,
        "screening": 91.1,
        "screeningCI": [
          83.6,
          97.1
        ],
        "income": 92230,
        "incomeCI": [
          90066,
          94394
        ]
      },
      {
        "id": "26127",
        "name": "Oceana County",
        "region": "Rural",
        "incidence": 112.6,
        "allCI": [
          90.2,
          139.2
        ],
        "annualAllCount": 21,
        "late-rate": 33.3,
        "late-share": 25.5,
        "lateCI": [
          20.9,
          50.5
        ],
        "annualLateCount": 5,
        "screening": 75.9,
        "screeningCI": [
          58.1,
          90.8
        ],
        "income": 61907,
        "incomeCI": [
          55750,
          68064
        ]
      },
      {
        "id": "26129",
        "name": "Ogemaw County",
        "region": "Rural",
        "incidence": 147.2,
        "allCI": [
          117.6,
          182.6
        ],
        "annualAllCount": 23,
        "late-rate": 44.5,
        "late-share": 26.7,
        "lateCI": [
          28.1,
          67.2
        ],
        "annualLateCount": 6,
        "screening": 84.6,
        "screeningCI": [
          71,
          95.4
        ],
        "income": 51390,
        "incomeCI": [
          46408,
          56372
        ]
      },
      {
        "id": "26131",
        "name": "Ontonagon County",
        "region": "Rural",
        "incidence": 104.4,
        "allCI": [
          62.4,
          173.3
        ],
        "annualAllCount": 6,
        "late-rate": null,
        "late-share": null,
        "lateCI": [
          null,
          null
        ],
        "annualLateCount": null,
        "screening": 76.7,
        "screeningCI": [
          58,
          91.8
        ],
        "income": 51306,
        "incomeCI": [
          46329,
          56283
        ]
      },
      {
        "id": "26133",
        "name": "Osceola County",
        "region": "Rural",
        "incidence": 138.9,
        "allCI": [
          112.6,
          169.9
        ],
        "annualAllCount": 23,
        "late-rate": 48.1,
        "late-share": 29.6,
        "lateCI": [
          31.9,
          69.7
        ],
        "annualLateCount": 7,
        "screening": 86.5,
        "screeningCI": [
          71.6,
          97.1
        ],
        "income": 55388,
        "incomeCI": [
          51674,
          59102
        ]
      },
      {
        "id": "26135",
        "name": "Oscoda County",
        "region": "Rural",
        "incidence": 91.7,
        "allCI": [
          59.5,
          138.3
        ],
        "annualAllCount": 7,
        "late-rate": null,
        "late-share": null,
        "lateCI": [
          null,
          null
        ],
        "annualLateCount": null,
        "screening": 79.7,
        "screeningCI": [
          63.1,
          93.2
        ],
        "income": 49622,
        "incomeCI": [
          43893,
          55351
        ]
      },
      {
        "id": "26137",
        "name": "Otsego County",
        "region": "Rural",
        "incidence": 109.3,
        "allCI": [
          86.3,
          136.8
        ],
        "annualAllCount": 18,
        "late-rate": 34.8,
        "late-share": 27.2,
        "lateCI": [
          21.6,
          53
        ],
        "annualLateCount": 5,
        "screening": 81.6,
        "screeningCI": [
          65.7,
          94.4
        ],
        "income": 69029,
        "incomeCI": [
          62566,
          75492
        ]
      },
      {
        "id": "26139",
        "name": "Ottawa County",
        "region": "Urban",
        "incidence": 127.1,
        "allCI": [
          119.4,
          135.2
        ],
        "annualAllCount": 218,
        "late-rate": 37.6,
        "late-share": 27,
        "lateCI": [
          33.2,
          42.3
        ],
        "annualLateCount": 59,
        "screening": 84.1,
        "screeningCI": [
          72.7,
          93.8
        ],
        "income": 81772,
        "incomeCI": [
          79722,
          83822
        ]
      },
      {
        "id": "26141",
        "name": "Presque Isle County",
        "region": "Rural",
        "incidence": 148.9,
        "allCI": [
          111.4,
          196.2
        ],
        "annualAllCount": 16,
        "late-rate": 47.8,
        "late-share": 31.3,
        "lateCI": [
          27.5,
          78.8
        ],
        "annualLateCount": 5,
        "screening": 78.3,
        "screeningCI": [
          60.2,
          93
        ],
        "income": 54675,
        "incomeCI": [
          49997,
          59353
        ]
      },
      {
        "id": "26143",
        "name": "Roscommon County",
        "region": "Rural",
        "incidence": 115.1,
        "allCI": [
          94,
          141.1
        ],
        "annualAllCount": 28,
        "late-rate": 33.9,
        "late-share": 22.5,
        "lateCI": [
          20.8,
          53.2
        ],
        "annualLateCount": 6,
        "screening": 79.9,
        "screeningCI": [
          63,
          93.7
        ],
        "income": 54305,
        "incomeCI": [
          49536,
          59074
        ]
      },
      {
        "id": "26145",
        "name": "Saginaw County",
        "region": "Urban",
        "incidence": 136.7,
        "allCI": [
          127.2,
          146.7
        ],
        "annualAllCount": 179,
        "late-rate": 41.3,
        "late-share": 27,
        "lateCI": [
          35.9,
          47.4
        ],
        "annualLateCount": 48,
        "screening": 80.4,
        "screeningCI": [
          66.5,
          92.3
        ],
        "income": 59188,
        "incomeCI": [
          56258,
          62118
        ]
      },
      {
        "id": "26151",
        "name": "Sanilac County",
        "region": "Rural",
        "incidence": 110.9,
        "allCI": [
          92.8,
          131.7
        ],
        "annualAllCount": 32,
        "late-rate": 36.5,
        "late-share": 30.4,
        "lateCI": [
          25.9,
          50.1
        ],
        "annualLateCount": 10,
        "screening": 84.6,
        "screeningCI": [
          70.9,
          95.5
        ],
        "income": 57382,
        "incomeCI": [
          54390,
          60374
        ]
      },
      {
        "id": "26153",
        "name": "Schoolcraft County",
        "region": "Rural",
        "incidence": 95.1,
        "allCI": [
          58.8,
          147.7
        ],
        "annualAllCount": 6,
        "late-rate": null,
        "late-share": null,
        "lateCI": [
          null,
          null
        ],
        "annualLateCount": null,
        "screening": 82.2,
        "screeningCI": [
          67.1,
          94.5
        ],
        "income": 56019,
        "incomeCI": [
          49620,
          62418
        ]
      },
      {
        "id": "26155",
        "name": "Shiawassee County",
        "region": "Rural",
        "incidence": 142,
        "allCI": [
          126.1,
          159.6
        ],
        "annualAllCount": 66,
        "late-rate": 43,
        "late-share": 28.8,
        "lateCI": [
          34.2,
          53.5
        ],
        "annualLateCount": 19,
        "screening": 79.5,
        "screeningCI": [
          63.8,
          92.6
        ],
        "income": 63988,
        "incomeCI": [
          58259,
          69717
        ]
      },
      {
        "id": "26147",
        "name": "St. Clair County",
        "region": "Urban",
        "incidence": 128.5,
        "allCI": [
          118.7,
          138.8
        ],
        "annualAllCount": 147,
        "late-rate": 41.5,
        "late-share": 30.7,
        "lateCI": [
          36,
          47.8
        ],
        "annualLateCount": 45,
        "screening": 68.9,
        "screeningCI": [
          58.3,
          79.1
        ],
        "income": 68831,
        "incomeCI": [
          65820,
          71842
        ]
      },
      {
        "id": "26149",
        "name": "St. Joseph County",
        "region": "Rural",
        "incidence": 109.4,
        "allCI": [
          94.7,
          126
        ],
        "annualAllCount": 44,
        "late-rate": 38.8,
        "late-share": 32,
        "lateCI": [
          29.6,
          49.8
        ],
        "annualLateCount": 14,
        "screening": 71.9,
        "screeningCI": [
          54.4,
          87.5
        ],
        "income": 65540,
        "incomeCI": [
          60374,
          70706
        ]
      },
      {
        "id": "26157",
        "name": "Tuscola County",
        "region": "Rural",
        "incidence": 123,
        "allCI": [
          106.3,
          141.8
        ],
        "annualAllCount": 46,
        "late-rate": 37.8,
        "late-share": 29.6,
        "lateCI": [
          28.5,
          49.3
        ],
        "annualLateCount": 14,
        "screening": 82.3,
        "screeningCI": [
          68.3,
          94
        ],
        "income": 64273,
        "incomeCI": [
          60986,
          67560
        ]
      },
      {
        "id": "26159",
        "name": "Van Buren County",
        "region": "Rural",
        "incidence": 137.5,
        "allCI": [
          122.5,
          153.9
        ],
        "annualAllCount": 69,
        "late-rate": 36.3,
        "late-share": 24.2,
        "lateCI": [
          28.5,
          45.7
        ],
        "annualLateCount": 17,
        "screening": 76.2,
        "screeningCI": [
          62.9,
          88.1
        ],
        "income": 66174,
        "incomeCI": [
          60080,
          72268
        ]
      },
      {
        "id": "26161",
        "name": "Washtenaw County",
        "region": "Urban",
        "incidence": 148.8,
        "allCI": [
          141.1,
          156.7
        ],
        "annualAllCount": 307,
        "late-rate": 44.3,
        "late-share": 28.5,
        "lateCI": [
          40.1,
          48.8
        ],
        "annualLateCount": 87,
        "screening": 78.6,
        "screeningCI": [
          66.9,
          89.1
        ],
        "income": 84704,
        "incomeCI": [
          80307,
          89101
        ]
      },
      {
        "id": "26163",
        "name": "Wayne County",
        "region": "Urban",
        "incidence": 133.3,
        "allCI": [
          130.2,
          136.5
        ],
        "annualAllCount": 1496,
        "late-rate": 46,
        "late-share": 33.3,
        "lateCI": [
          44.2,
          47.9
        ],
        "annualLateCount": 498,
        "screening": 81.5,
        "screeningCI": [
          73,
          89
        ],
        "income": 57418,
        "incomeCI": [
          55490,
          59346
        ]
      },
      {
        "id": "26165",
        "name": "Wexford County",
        "region": "Rural",
        "incidence": 107.4,
        "allCI": [
          88.4,
          129.7
        ],
        "annualAllCount": 25,
        "late-rate": 32.6,
        "late-share": 27.8,
        "lateCI": [
          22.1,
          46.6
        ],
        "annualLateCount": 7,
        "screening": 74.7,
        "screeningCI": [
          56.7,
          89.8
        ],
        "income": 59697,
        "incomeCI": [
          54329,
          65065
        ]
      }
    ]
  }
};
  if(typeof module==="object"&&module.exports)module.exports=data;else root.CancerRatesData=data;
})(typeof globalThis==="object"?globalThis:this);
