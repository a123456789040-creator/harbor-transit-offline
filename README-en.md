# Harbor Transit — Offline Edition

Download the Windows x64 ZIP from [Releases](https://github.com/a123456789040-creator/harbor-transit-offline/releases/latest), extract **all files**, and run **HarborTransit.exe**. The launcher opens your installed Edge or Chrome browser. Keep the launcher open while playing; its Exit button stops the local service.

No internet connection, account, API key, or separate Node.js installation is needed to play. The download includes Node.js and all map files. Windows 10/11 x64 is supported; the executable is unsigned. Verify the ZIP against the release's SHA-256 file. `127.0.0.1` is your own computer, not the developer's server.

Choose **English** in the main menu's **Language** selector. Your choice is remembered in this browser and applies to gameplay, planning, history, timetable display, help, accessibility labels, and source information. Traditional Chinese remains available. Station, route, operator, and project proper names keep their source script when no verified English form is available.

## Play

- Hong Kong, Taipei, New York, Tokyo, Osaka–Kyoto, and a large original canal city.
- Draw routes between stations, assign trains and carriages, and connect transfers. Unconnected stations flash red.
- Automatic mode builds routes using real station patterns where available. BUG mode supplies unlimited trains, carriages, and tunnels.
- Normal city challenges unlock endless play after completion. The New Stations switch, beside BUG mode, enables up to 50 extra stations after the real/planned catalog; disabling it preserves existing stations and routes.
- Network Planning gives you five minutes to build stations and routes, then runs the network for ten seconds before the next planning round. Progress is preserved between rounds.
- Future Plans adds sourced project stations, extra planning lines, and expected timeline entries. Targets may change; dashed paths are schematic.

High scores, completed cities, display settings, and language are stored in the browser. The current session's network is not saved. Clearing browser data or using private browsing changes persistence.

## Public data coverage

All five current station catalogs, tracks, and maps are bundled. Taipei, Hong Kong, and New York retain their published opening histories and collected ridership records. Tokyo and Osaka–Kyoto retain current networks, collected ridership, and future plans; Japanese N05 historical databases and their derived opening dates are **not distributed**, because their source terms exclude redistribution.

Offline timetable display includes Taipei headway estimates, the bundled New York timetable, and Kyoto City's CC-BY 4.0 timetable. Other Japanese operator timetables without redistribution permission are omitted. There are no live positions, arrival feeds, daily delays, or service-change updates. Expired schedules stop producing estimates rather than pretending to be current.

Original game code is MIT licensed. Maps, official data, and the Node.js runtime retain their own terms and attribution. See `THIRD_PARTY_NOTICES.md`, `dist/maps/LICENSE.txt`, the in-game Sources page, and `runtime/LICENSE.txt`. This is not an official or licensed railway application.

## Source and build

With Node.js 24 LTS installed, run `node server.mjs`; no `npm install` is required. Run `npm test` for checks. On Windows, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-windows.ps1` builds the portable ZIP. Building downloads and verifies the official Node runtime; playing the completed build does not need the internet.
