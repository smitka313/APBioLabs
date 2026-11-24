/* Evidence values read from the cited publication and curriculum figures. */
(function () {
  "use strict";
  const data = {
  "field": {
    "source": "Atwell et al. (2012), Figure 1",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3431113/#fig1",
    "unit": "m",
    "note": "Approximate means read from the published graph; the incubating group uses that figure’s separate right-hand scale. The publication shows mean ± standard error; its numerical standard errors are not reproduced here. Shorter distance means a bird let the observer get closer.",
    "rows": [
      {
        "site": "mountain",
        "group": "foraging",
        "mean": 13.5,
        "se": null,
        "n": 24
      },
      {
        "site": "urban",
        "group": "foraging",
        "mean": 4.2,
        "se": null,
        "n": 30
      },
      {
        "site": "mountain",
        "group": "incubating",
        "mean": 0.99,
        "se": null,
        "n": 17
      },
      {
        "site": "urban",
        "group": "incubating",
        "mean": 0.36,
        "se": null,
        "n": 11
      }
    ]
  },
  "aviary": {
    "source": "Atwell et al. (2012), Figure 3",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3431113/#fig3",
    "unit": "score (PC1)",
    "note": "Approximate means read from the published graph. The publication shows mean ± standard error; its numerical standard errors are not reproduced here. A higher score means faster and more extensive exploration; early-life and parental effects were not ruled out.",
    "rows": [
      {
        "site": "mountain",
        "group": "female",
        "mean": -0.65,
        "se": null,
        "n": 10
      },
      {
        "site": "urban",
        "group": "female",
        "mean": -0.08,
        "se": null,
        "n": 16
      },
      {
        "site": "mountain",
        "group": "male",
        "mean": -0.32,
        "se": null,
        "n": 13
      },
      {
        "site": "urban",
        "group": "male",
        "mean": 0.8,
        "se": null,
        "n": 15
      }
    ]
  },
  "stress": {
    "source": "OpenSciEd B.4 Lesson 4, Stress and Boldness reading, Figures 1–2 (adapted from Atwell et al., 2012, Figure 2)",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3431113/#fig2",
    "unit": "ng/mL",
    "note": "Classroom curves are approximate summaries read from the handout. It does not display standard errors or break out aviary birds by sex. The original field sample shows no clear difference in baseline CORT, but the city birds had a smaller response to handling.",
    "rows": [
      {
        "study": "field",
        "site": "mountain",
        "minute": 0,
        "mean": 10,
        "se": null
      },
      {
        "study": "field",
        "site": "mountain",
        "minute": 15,
        "mean": 28,
        "se": null
      },
      {
        "study": "field",
        "site": "mountain",
        "minute": 30,
        "mean": 29,
        "se": null
      },
      {
        "study": "field",
        "site": "urban",
        "minute": 0,
        "mean": 8,
        "se": null
      },
      {
        "study": "field",
        "site": "urban",
        "minute": 15,
        "mean": 19,
        "se": null
      },
      {
        "study": "field",
        "site": "urban",
        "minute": 30,
        "mean": 21,
        "se": null
      },
      {
        "study": "aviary",
        "site": "mountain",
        "minute": 0,
        "mean": 5,
        "se": null
      },
      {
        "study": "aviary",
        "site": "mountain",
        "minute": 15,
        "mean": 22,
        "se": null
      },
      {
        "study": "aviary",
        "site": "mountain",
        "minute": 30,
        "mean": 24,
        "se": null
      },
      {
        "study": "aviary",
        "site": "urban",
        "minute": 0,
        "mean": 3,
        "se": null
      },
      {
        "study": "aviary",
        "site": "urban",
        "minute": 15,
        "mean": 16,
        "se": null
      },
      {
        "study": "aviary",
        "site": "urban",
        "minute": 30,
        "mean": 19,
        "se": null
      }
    ]
  },
  "cort": {
    "source": "OpenSciEd B.4 Lesson 4, slide W (adapted from Atwell et al., 2012)",
    "url": "https://openscied.org/simulation/junco-data-excursion/",
    "xLabel": "Maximum CORT (ng/mL)",
    "yLabel": "Exploratory behavior score",
    "note": "Each point represents a bird. Coordinates were estimated from OpenSciEd’s published classroom scatterplot, so they are approximate. The slide does not label points by population of origin. Its estimated fit is descriptive; it does not show that CORT caused the behavior.",
    "rows": [
      {
        "site": null,
        "x": 9.2,
        "y": 0.63
      },
      {
        "site": null,
        "x": 9.4,
        "y": 0.47
      },
      {
        "site": null,
        "x": 9.6,
        "y": 1.94
      },
      {
        "site": null,
        "x": 9.7,
        "y": 2.02
      },
      {
        "site": null,
        "x": 9.7,
        "y": 2.14
      },
      {
        "site": null,
        "x": 10.2,
        "y": 0.12
      },
      {
        "site": null,
        "x": 10.6,
        "y": 1.75
      },
      {
        "site": null,
        "x": 10.9,
        "y": 0.0
      },
      {
        "site": null,
        "x": 11.7,
        "y": -0.42
      },
      {
        "site": null,
        "x": 12.4,
        "y": -0.28
      },
      {
        "site": null,
        "x": 14.0,
        "y": -1.44
      },
      {
        "site": null,
        "x": 15.1,
        "y": -0.98
      },
      {
        "site": null,
        "x": 15.7,
        "y": 1.42
      },
      {
        "site": null,
        "x": 16.1,
        "y": 0.43
      },
      {
        "site": null,
        "x": 16.3,
        "y": -1.29
      },
      {
        "site": null,
        "x": 16.5,
        "y": 2.38
      },
      {
        "site": null,
        "x": 17.5,
        "y": 0.34
      },
      {
        "site": null,
        "x": 18.8,
        "y": 0.01
      },
      {
        "site": null,
        "x": 18.9,
        "y": 1.11
      },
      {
        "site": null,
        "x": 19.5,
        "y": -1.12
      },
      {
        "site": null,
        "x": 20.3,
        "y": 1.2
      },
      {
        "site": null,
        "x": 21.0,
        "y": -0.48
      },
      {
        "site": null,
        "x": 21.6,
        "y": -0.88
      },
      {
        "site": null,
        "x": 22.1,
        "y": 0.52
      },
      {
        "site": null,
        "x": 22.5,
        "y": -0.1
      },
      {
        "site": null,
        "x": 22.8,
        "y": -0.41
      },
      {
        "site": null,
        "x": 23.0,
        "y": -0.83
      },
      {
        "site": null,
        "x": 23.4,
        "y": -0.06
      },
      {
        "site": null,
        "x": 23.6,
        "y": 0.57
      },
      {
        "site": null,
        "x": 25.3,
        "y": -1.15
      },
      {
        "site": null,
        "x": 28.3,
        "y": -0.69
      },
      {
        "site": null,
        "x": 28.8,
        "y": 1.05
      },
      {
        "site": null,
        "x": 28.9,
        "y": -0.78
      },
      {
        "site": null,
        "x": 29.4,
        "y": -1.12
      },
      {
        "site": null,
        "x": 30.7,
        "y": -1.2
      },
      {
        "site": null,
        "x": 31.2,
        "y": -1.07
      },
      {
        "site": null,
        "x": 31.8,
        "y": -1.11
      },
      {
        "site": null,
        "x": 32.8,
        "y": -0.34
      },
      {
        "site": null,
        "x": 34.0,
        "y": -1.14
      },
      {
        "site": null,
        "x": 38.4,
        "y": -0.84
      }
    ],
    "published": {
      "source": "Atwell et al. (2012), Figure 4",
      "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC3431113/#fig4",
      "n": 40,
      "rSquared": 0.21,
      "p": 0.021,
      "note": "The original study reported a negative maximum-CORT association after accounting for population, sex and body mass. The published Figure 4 R² and its model P-value are distinct from the fit to the classroom points."
    }
  }
};
  if (typeof module === "object" && module.exports) module.exports = data;
  if (typeof window !== "undefined") window.JUNCO_DATA = data;
}());
