# Base44 workspace notes

- The application lives in `eis-main/`, not the repository root. Start the existing environment with `docker compose -f eis-main/docker-compose.base44.yml up -d --build`.
- The preview uses the local PostgREST database, not the production Supabase member network. Fresh volumes contain only the seeded admin; a one-member click test is not a large-network regression test. See `eis-main/AGENTS.md` for login and placement details.
- Genealogy regression tests: `docker compose -f eis-main/docker-compose.base44.yml exec -T web node --test src/components/genealogy/treeData.test.js`. They cover a 20,000-member network, cycles, placement precedence, and maintenance status parity.
- Genealogy's searchable list renders a small window of fixed-height rows. Its scroll/search state and countdown are isolated from the bounded tree. Tree navigation must preserve access to every authorized member without rendering the whole network at once.
- When browser-testing scroll after a search, wait for the full result list's rendered height before scrolling. Finding an item is insufficient: that same item may still be in the previous deferred filter. Desktop/mobile preview tests passed with 600 temporary members and 600 codes; every test record was deleted and cleanup was read back.
- After a source edit, do not assume the verification browser retains a development login from an earlier check. Wait for login inputs and assert both fills were performed; a transient welcome toast alone is not a robust session assertion.
- Build verification without modifying tracked `dist/`: `docker compose -f eis-main/docker-compose.base44.yml exec -T web npm run build -- --outDir /tmp/genealogy-build`.
- The compose `health-tools` one-shot copies the existing Alpine HTTP probe and loader into a volume because the PostgREST image has no shell. Healthchecks otherwise use existing read-only responses; the storage stand-in returns a known JSON 404 at its root.
