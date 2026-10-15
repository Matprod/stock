# Page review grid

Used after each render, on the PNG capture of every page. Review the page as if someone else had written it. Check in this order, because an earlier failure makes the later ones pointless.

| # | Check | Fails when |
|---|---|---|
| 1 | Truth | A number has no `data-fact`, contradicts another page, or a headline claim is not supported by a number on the page |
| 2 | Legibility | Text overflows its box, crosses the footer or page edge, is cut, or is smaller than 10.5 px; two labels overlap; a label sits on a line or marker |
| 3 | Empty content | A chart, table or block has no data, or a section says nothing ("see below") |
| 4 | Hierarchy | No headline, or more than one; the headline names a topic instead of a finding; the eye does not land on the main evidence first |
| 5 | Theme | A color, font or size outside theme.css; orange or blue used for something other than risk or performance; decoration (shadow, gradient, emoji, icon) |
| 6 | Charts | More than three colored series; dual axis; numbers on every point; missing caption; unsorted bars; legend where a direct label would do |
| 7 | Density | Page less than 70 % full, or so dense that blocks touch; misaligned columns or edges between blocks |
| 8 | Language | Mixed languages, wrong number format, uppercase units, sentences without a number where one exists |
| 9 | Fit to the request | The page answers a reference page rather than this request: a block kept because the reference had it, a chart that does not show this page's finding, a section the request did not ask for and the data does not justify |

Output: for each page, either `OK` or at most five fixes, most severe first, each one line and actionable ("Move the 'Risque 70' label 12 px down: it overlaps the line at sam. 7"). No praise, no general advice.

Two rounds at most. After the second round, the report ships with the remaining items listed as warnings.
