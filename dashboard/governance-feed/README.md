# Governance Event Feed Dashboard

React dashboard for monitoring TealTiger governance events from the WebSocket stream.

## Run locally

Launch the local dashboard and WebSocket stream from the TealTiger CLI:

```sh
npx tealtiger dashboard
```

The command serves the dashboard on `http://localhost:3000`, reads the local event store from `~/.tealtiger/events.db`, and exposes `ws://localhost:3000/ws/events`. Use `--port`, `--db`, or `--no-open` to customize the launcher:

```sh
npx tealtiger dashboard --port 3100 --db ./events.db --no-open
```

## Run the standalone demo stream

Start a local stream that publishes demo governance decisions:

```sh
npm run dashboard:mock-stream
```

In another terminal, start the dashboard:

```sh
npm run dashboard:dev
```

The dashboard connects to `ws://127.0.0.1:8787/ws/events` by default. Use `VITE_GOVERNANCE_WS_URL` or the URL input in the UI to point it at another stream.

## Build

```sh
npm run dashboard:build
```
