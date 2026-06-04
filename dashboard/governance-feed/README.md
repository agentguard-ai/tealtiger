# Governance Event Feed Dashboard

React dashboard for monitoring TealTiger governance events from the WebSocket stream.

## Run locally

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
