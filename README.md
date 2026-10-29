# Bibescu-App
[![Docker Pulls](https://badgen.net/docker/pulls/sand14/bibescu-app?icon=docker&label=pulls)](https://hub.docker.com/r/sand14/bibescu-app)
![GitHub Release](https://img.shields.io/github/v/release/sand14/bibescu-app)

A Next.js application useful for flight trajectory, headings, and time calculation for the Romanian Aviation contest.

## Demo

Currently deployed here for testing: [https://bibescu.sand14.ro/](https://bibescu.sand14.ro/)

## Features

- **Interactive Flight Planning**: Google Maps integration with waypoint markers (SP/FP, Turn Points T1–T5).
- **Aviation Navigation Calculations**: Calculates distance (km), true & magnetic headings (with declination), and leg / cumulative times based on airspeed.
- **PDF Export & Archiving**:
  - **Standard Report (A4)**: Satellite thumbnails for every waypoint, leg data table, coordinates, and OSM overview map.
  - **A3 Map**: Full-page OpenStreetMap route map for navigation.
  - **CRS Route File**: Exports CRS waypoint files.
- **Self-Hosted Account & Storage System**:
  - Built-in user registration & login (stored safely in local SQLite database).
  - Automatically archives generated PDFs to the user's account upon export.
  - Built-in **"My Reports"** drawer to view, download, or delete past flight reports anytime.
  - 100% free, private, and self-hosted with zero external cloud dependencies.

## Deployment with Docker Compose

Deploy with persistent storage for accounts and PDF reports:

```yaml
services:
  bibescu-app:
    image: sand14/bibescu-app:latest
    container_name: bibescu-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
      - DATA_DIR=/app/data
    volumes:
      - ./data:/app/data
```

Start the container:
```bash
docker compose up -d
```

Your database and generated PDF reports will persist in the `./data` directory on the host.

## License

[MIT](https://choosealicense.com/licenses/mit/)
