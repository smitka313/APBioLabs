# AP Bio Lab Bench

Interactive online versions of the 13 investigations in *AP Biology Investigative Labs: An Inquiry-Based Approach* (Teacher Manual, updated Fall 2019). Every lab runs in the browser with no install or login.

Each lab page includes:

- **Overview and background** written for students, with diagrams and equations.
- **Pre-lab check**: auto-graded questions with explanations.
- **Structured investigation**: a simulation that follows the real bench procedure and produces realistic, variable data.
- **Design your own investigation**: students choose a variable, levels and replicates.
- **Analysis tools**: data tables, graphs with error bars, standard error, chi-square and linear regression.
- **Written responses (CER)**: answers save in the student's browser, and **Copy all my responses** puts everything on the clipboard to paste into a document or LMS.

Each lab also has a teacher notes page (`teacher-labNN.html`) with timing, how the simulation maps to the wet lab, misconceptions, and suggested answers.

| # | Investigation | Page |
|---|---|---|
| 1 | Artificial Selection | `lab01.html` |
| 2 | Mathematical Modeling: Hardy-Weinberg | `lab02.html` |
| 3 | Comparing DNA Sequences with BLAST | `lab03.html` |
| 4 | Diffusion and Osmosis | `lab04.html` |
| 5 | Photosynthesis | `lab05.html` |
| 6 | Cellular Respiration | `lab06.html` |
| 7 | Cell Division: Mitosis and Meiosis | `lab07.html` |
| 8 | Biotechnology: Bacterial Transformation | `lab08.html` |
| 9 | Biotechnology: Restriction Enzyme Analysis of DNA | `lab09.html` |
| 10 | Energy Dynamics | `lab10.html` |
| 11 | Transpiration | `lab11.html` |
| 12 | Fruit Fly Behavior | `lab12.html` |
| 13 | Enzyme Activity | `lab13.html` |

## Hosting

This is a static site with no build step. To host it on GitHub Pages, go to **Settings → Pages**, choose **Deploy from a branch**, and pick `main` / `(root)`. To view it locally, open `index.html` in a browser.

## Files

- `index.html`: home page listing all labs
- `labNN.html` / `teacher-labNN.html`: student lab and teacher notes for each investigation
- `style.css`: shared styles (light and dark themes)
- `lab.js`: shared toolkit (charts, tables, quizzes, statistics, autosave)
- `KIT.md` and `_template.html`: guide and starting template for adding or editing labs

## Notes

Simulated data are modeled on typical classroom results. They support wet-lab work and do not replace it. Student work is stored only in each student's own browser (localStorage). To switch computers, students use **Move your work to another computer** in the Submit section (a progress file or a resume code). Each lab's Submit section also downloads a Word (.docx) lab report or opens a print view to save a PDF for Schoology, and **Print worksheet** prints a paper version of the lab. Students enter their name and class period once; each student's simulated data is unique and shows a Dataset ID on the report.

AP® is a trademark registered by the College Board, which is not affiliated with and does not endorse this site. The lab content is adapted and paraphrased from the College Board manual; the manual itself is not included in this repository.
