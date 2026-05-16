Simulator skeleton (async).

Suggested next steps:
- Load accounts from JSON/CSV and create missing accounts via API.
- Generate transactions with rate limits and bursts.
- Implement fraud scenario: 3x 9000 < 10s, then a 4th blocked.
- Add IP burst scenario and concurrent balance-drain scenario.
- Add latency metrics and correlation IDs per request.
- Support CLI flags for rate, duration, and base URL.
