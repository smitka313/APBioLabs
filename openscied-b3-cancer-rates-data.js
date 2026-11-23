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
  }
};
  if(typeof module==="object"&&module.exports)module.exports=data;else root.CancerRatesData=data;
})(typeof globalThis==="object"?globalThis:this);
