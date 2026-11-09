# Feedback API

Lightweight Node.js/Express service that collects “Was this page helpful?” feedback from the Docusaurus docs site and stores it in SQLite. Exports CSVs on a schedule.

## Features

- `POST /feedback` — records a Yes/No rating and returns an ID
- `PATCH /feedback/:id` — updates the same record with an optional comment
- API key authentication
- Rate limiting
- SQLite storage (WAL mode)
- Scheduled CSV exports (biweekly, monthly, quarterly, yearly)
- Dockerized with health check and persistent volume

## CSV columns

`created_at`, `page`, `helpful` (1 = Yes, 0 = No), `comment`, `url`

## Requirements

- Docker and Docker Compose

## Quick start

```bash
docker compose up --build
```

The API will be available at `http://localhost:3001`.

## Configuration

Set these environment variables (already defined in `docker-compose.yml`):

| Variable   | Description                                   | Default                   |
| ---------- | --------------------------------------------- | ------------------------- |
| `API_KEY`  | Secret key required in the `x-api-key` header | `change-me-in-production` |
| `DATA_DIR` | Directory for the SQLite DB and CSVs          | `/data`                   |
| `PORT`     | Port the server listens on                    | `3001`                    |

## Endpoints

### Create feedback

```http
POST /feedback
x-api-key: your-api-key
Content-Type: application/json

{
  "page": "docs/getting-started",
  "url": "https://docs.example.com/getting-started",
  "helpful": 1,
  "comment": ""
}
```

Response:

```json
{ "id": 1 }
```

### Update comment

```http
PATCH /feedback/1
x-api-key: your-api-key
Content-Type: application/json

{
  "comment": "Clear example, thanks"
}
```

### Health check

```http
GET /health
```

## Connecting the Docusaurus site

In `docusaurus.config.ts`:

```js
customFields: {
  feedbackApi: 'http://localhost:3001/feedback',
  feedbackApiKey: 'change-me-in-production',
},
```

## Data

- SQLite database and CSV exports are stored in the Docker volume `feedback-data`
- To access the files locally:
  ```bash
  docker compose exec feedback-api ls /data
  ```

## Development

```bash
npm install
npm start
```

(Requires Node.js 22+)
