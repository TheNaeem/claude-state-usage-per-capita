# Which states use Claude.ai more than their population would predict?

A one-page map of the **Claude.ai usage per capita index** for the 50 states and
the District of Columbia, May 2026.

An index of **1.0** means a state's share of all US Claude.ai conversations is
exactly equal to its share of US working-age people (ages 15 to 64). Above 1.0 a
state is using Claude.ai more than its population alone would predict; below 1.0,
less.

States are shaded into four groups by rank — Leading (top 25%), Upper middle,
Lower middle, Emerging (bottom 25%). Hover or tap any state for its name, index
and rank.

## What's in here

| Path | What it is |
|---|---|
| `index.html` | The page. |
| `style.css` | Styles, including dark mode and the phone layout. |
| `app.js` | Draws the map, legend, top 10 and table from the JSON. |
| `data/states.json` | The only data the page loads: code, name, index, share, rank, group, and the SVG path for each state. |
| `tools/build-data.py` | Regenerates `data/states.json`. |

## The data file

The source release is a ~209 MB CSV, far too big for a repository, so **it is not
checked in** (`.gitignore` excludes `*.csv`). Only the 51 numbers the page needs
are published, in `data/states.json`.

To rebuild it you need two inputs:

1. The state rows of the Anthropic Economic Index — `geo_level` of `subregion`,
   `category_name` of `overall`, `date_start` of `2026-05-01`, with the
   `usage_per_capita_index` and `usage_pct` metrics — as a CSV with the columns
   `state_code,state_name,usage_per_capita_index,usage_pct`.
2. `states-albers-10m.json` from [us-atlas](https://github.com/topojson/us-atlas),
   which supplies the map outlines, already in the Albers USA projection.

```bash
curl -L -o states-albers-10m.json https://cdn.jsdelivr.net/npm/us-atlas@3/states-albers-10m.json
python tools/build-data.py states-albers-10m.json state-usage-2026-05.csv data
```

The script decodes the TopoJSON into SVG paths, rounds the coordinates to one
decimal, joins them to the index values, and assigns each place a rank and one of
the four groups. Places with an identical index always land in the same group, so
two states showing the same number are never shaded differently.

## Running it locally

Any static server works; the page fetches `data/states.json`, so opening
`index.html` straight off the filesystem will not work.

```bash
python -m http.server 8000
```

## Source and credit

Data: [Anthropic Economic Index](https://www.anthropic.com/research/economic-index-june-2026-report),
Claude.ai conversations on the Free, Pro and Max plans, May 2026, released
26 June 2026. Released under CC BY and credited on the page itself.

```
@online{anthropic2026aeiv6,
        author = {Maxim Massenkoff and Eva Lyubich and Szymon Sacher and Zoe Hitzig and Shaoyi Zhang and Ryan Heller and Peter McCrory},
        title = {Anthropic Economic Index report: Cadences},
        date = {2026-06-26},
        year = {2026},
        url = {https://www.anthropic.com/research/economic-index-june-2026-report},
}
```

Map outlines from [us-atlas](https://github.com/topojson/us-atlas) (ISC), derived
from the US Census Bureau.

Built for JRNL 3700 at Northeastern University.
