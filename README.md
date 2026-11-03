# Social Graph Explorer

A Flask app for exploring social connections with an interactive Cytoscape.js graph.

## Run locally

Install the Python dependencies:

```powershell
python -m pip install Flask networkx pandas
```

Start the app from this folder:

```powershell
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000).

## Data

The app loads connections from `data/people.csv` (`username`, optional `display_name`, and `connections` columns). It also supports `data/connections.csv` and per-person CSV files in `data/users/`. The included `data/people.csv` provides a small example graph.

## Features

- Select people and explore their direct connections.
- Search for users and view friend suggestions.
- Compare two people to highlight and list their mutual friends.
- Find and highlight shortest paths.
- Pan, zoom, fit, and reset the graph view.
