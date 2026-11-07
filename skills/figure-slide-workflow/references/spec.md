# Default values (decided 2026-11)

## Page
- 960 x 540 pt = 33.87 x 19.05 cm. Blank layout. Shapes carry role names (heading, section label, page number, subheading, note, figure, comment box right, comment box bottom, ...). Shapes are editable (text boxes and rectangles, not pictures of text).
- Left and right margin 1.69 cm.

## Text roles
| Role | Size | Weight | Color (light) | Position |
|---|---|---|---|---|
| Heading | 27 pt | bold | #1F2933 | left 1.69, top 0.76 cm, width 30.48, centered |
| Subheading | 19 pt | bold | #1F2933 | top 2.12 cm, left aligned (columns at left 2.43 and 17.43, width 14) |
| Body, labels inside figures | 15 pt | regular | #1F2933 | |
| Section label | 15 pt | regular | #6B7280 | left 1.69, top 0.17 cm |
| Notes, sources, page number | 12.5 pt | regular | #6B7280 | notes below or above a figure, justified; page number bottom right (left 30.77, top 18.13 cm, right aligned) |
Dark slides: background #16181D, text #E5E7EB, secondary #9AA3AF, same sizes and positions.
Title slide: title 38 pt bold, name 27 pt, affiliation 19 pt, meeting line 15 pt.

## Colors
Shared 12 colors, in order: 1 #0072B2 blue, 2 #D55E00 vermillion, 3 #009E73 bluish green, 4 #E69F00 orange, 5 #56B4E9 sky blue, 6 #CC79A7 reddish purple, 7 #F0E442 yellow, 8 #332288 indigo, 9 #882255 wine, 10 #44AA99 teal, 11 #AA4499 purple, 12 #999999 gray.
Use them for lines, fills, bars, and points. Do not use them for slide text (yellow on white and indigo on dark cannot be read).
Accent (text, or one thing to emphasize): A blue (#0072B2 light, #60A5FA dark). Reserves: B vermillion (#D55E00 light), C bluish green (#009E73 light); dark-background versions are approximate and need a contrast check before use.
Contrast ratios (white / dark #16181D): body #1F2933 14.76, gray #6B7280 4.83, #E5E7EB 14.34, #9AA3AF 6.96.

## Heatmaps
- Sequential (>= 0): white, #56B4E9, #0072B2, #332288 (luminance falls monotonically).
- Diverging (centered at 0): #0072B2, white, #D55E00 (the vermillion end is a little lighter; the center white separates the sides; on a gray print the sign cannot be read).
- Spares: white to blue; white, orange #E69F00, vermillion, wine.
- Color bar and tick labels are 15 pt like the rest of the figure.

## Progress slides (white background only)
- Comment box: rectangle #0072B2, 30 % opacity (PowerPoint shows 70 % transparency), no line. Text 15 pt #1F2933 inside, 0.4 cm from the edge. Results with a dot, interpretation with an arrow.
- Layouts: figure left (left 2.43, top 3.20 cm, 16 x 9) with a tall box at right (13.06 x 10.38 cm, left 19.11, top 3.12); two figures or a wide figure with a wide box below (30.48 x 4.19 cm); table (5 rows x 5 columns example, header row bold, thin #6B7280 lines, no fill, 15 pt) with a wide box below; Why (left) and How (right: a 14 x 8.5 cm principle diagram, then Data / Method / Control bullets); To discuss (left, numbered) and Next steps (right, with owner and date).
- Stack elements from the top. The box starts 0.3 cm below the element above it. Its height follows the amount of text (it must end above the page number). If text overflows, shorten it first; 12.5 pt is the smallest allowed.

## Figures
- Size the frame in cm first; draw at that size. Inside text 15 pt for slides (12.5 pt at the smallest), 10 pt for papers (panel letters 18 pt bold). Font Arial for text inside figures. No panel letters on slides. Transparent background.
- Export: png 600 dpi (transparent) and pdf (transparent, fonts embedded). Analysis previews may be png 150 dpi.
- Check the pdf by reading every text run (size, font, position) and confirm nothing is off size, outside the page, or overlapping.

## Language
English by default for slides, including notes and dummy text. Japanese as an exception.
