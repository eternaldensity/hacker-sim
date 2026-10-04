# HACKER SIM — Oldnet vs Betanet

Built 2026 from a **2006 design doc** (`Hacker simulator.doc`, 8 Sep 2006 — included in this folder).
No frameworks. Open `index.html` in a browser. Or serve it:

```sh
npx serve .
# or
python3 -m http.server 8000
# → http://localhost:8000
```

## What this is
A playable prototype of the doc's vision:

| Doc asked for | Implemented |
|---|---|
| Console + auto-suggest addresses | terminal + TAB completion + clickable suggestions, ↑↓ history |
| Wired / wireless / laser modems, damaged wires | `scan` finds damage; laser backbone charges tolls; wireless needs range overlap |
| Oldnet (wired, rotting) vs Betanet (wireless, encrypted, gov) | 5 Oldnet + gateway + 5 Betanet devices, incompatible without gateway (`hacker-hq` / `relay-van`) |
| Bounce connections, trace time | `connect` chains; each hop slows trace; `connections` shows path |
| Realistic cracking (not letter-at-a-time) | `crack` is CPU-bound timed task; `crack-pro` 3× |
| Exploits / patches, encrypters, monitors, tracers | `exploit`/`run firewall-bypass`, `decrypter` (Betanet gate), `monitor`, `run tracer-view` **required** to see trace % |
| Scramblers, logs, being caught | `run scrambler`, `wipe`/`run log-wipe`, trace → busted + fine |
| Email trojans, viruses, zombies, spam money | `mail -t`, `infect`, `zombify`, `spam` economy |
| CPU/MEM + completion times, install times (+rush fee) | Actions pane; `buy cpu-2x/mem-512/...`, installs take 30–45 s or `rush` |
| Physical movement, physical access, vehicles→fast travel | `go home/street/datacenter/hideout/cafe/downtown`, `use cafe-laptop` (open, no pass) |
| Connection map, zoom levels | canvas map: world→region→city→live, click-to-connect, wheel zoom |
| Plot: cell-K vs gov + rival crews | 6-mission campaign (`missions`): scan → crack → bounce → steal pricelist → spam empire → ghost the gov supercomputer |
| NPC ambient traffic, notifications | ticker: relay logs, emails, deliveries; notification pane |

## Walkthrough (first 5 min)
```
missions
scan                      # wait ~5s
connect old-router        # wait
connect rusty-archive
ls
cat /pub/betanet-notes.txt
crack archivist           # wait, auto-login
disconnect 2
connect old-router
connect dead-forum
connect hacker-hq         # damaged wire = slow, intentional
login cell-k oldnet-lives
run tracer-view
run scrambler
shop                      # earn via spam later; buy decrypter $80 first when you can
```

Betanet path: `hacker-hq --laser--> beta-tower-2 --wireless--> corp-shop`, `download /corp/pricelist.db` (needs `decrypter` + login `vendor/sellmore` — crack or trojan it).

## Controls
- `help [command]`, `TAB` complete, `↑↓` history, click map nodes to connect.
- Panes mirror the doc's Layout: console bottom, status left, actions top-center, map + notifications right.

## Files
- `index.html` / `style.css` / `game.js` — the game.
- `Hacker simulator.doc` — your original 2006 doc.
- No build step, no telemetry, progress is per-session.
