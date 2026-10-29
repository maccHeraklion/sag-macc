# Offline-first edge operation with store-and-forward sync (greenhouse edge: Node 20 + Fastify + SQLite WAL, LoRaWAN/MQTT in, S7-1200 out, 30+ days offline)

Convention: "Cited Findings" = facts from sources (primary docs preferred). "Inferences" = my recommendations/reasoning, not sourced facts. Research date: 2026-10-29.

## 1. Transactional outbox pattern: design details

### Takeaway
The outbox (write the business row and the outbound message in the same local DB transaction, relay later, consumer dedups) is the canonical way to get "sent if and only if committed" without 2PC; it inherently yields at-least-once delivery, so the cloud side must be an idempotent consumer. The existing cloud `POST /ingest/batch` with `INSERT OR IGNORE` already is that idempotent consumer, provided the dedup key is a stable per-record ID chosen at the edge.

### Cited Findings
- Problem statement: how to atomically update the database and send messages to a broker; 2PC is impractical; sending mid-transaction is unsafe (rollback), sending after commit risks a crash before send — [microservices.io: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)
- Solution: store each message in an outbox table in the same DB transaction that updates the business entities; "A separate process then sends the messages to the message broker." — [microservices.io](https://microservices.io/patterns/data/transactional-outbox.html)
- Benefit: "Messages are guaranteed to be sent if and only if the database transaction commits"; messages are sent in the order the application produced them — [microservices.io](https://microservices.io/patterns/data/transactional-outbox.html)
- Relay implementations named: Polling publisher and Transaction log tailing — [microservices.io](https://microservices.io/patterns/data/transactional-outbox.html)
- Resulting issue: the relay may publish a message more than once (e.g., crash after publishing, before recording it); consumers must be idempotent, e.g., by tracking IDs of processed messages — [microservices.io](https://microservices.io/patterns/data/transactional-outbox.html)
- Drawback: error-prone because a developer might forget to publish after updating the DB — [microservices.io](https://microservices.io/patterns/data/transactional-outbox.html)
- Prior art for the same mechanics in managed products: AWS Greengrass stream manager assigns a sequence number on every append, tracks `last_exported_sequence_number` per export destination, supports per-stream export **priority** ("exports higher priority streams before lower priority streams"), a max stream size (default 256 MB) and a required `StrategyOnFull` (`RejectNewData` or `OverwriteOldestData`) — [AWS docs: Use StreamManagerClient](https://docs.aws.amazon.com/greengrass/v2/developerguide/work-with-streams.html); [AWS docs: Manage data streams](https://docs.aws.amazon.com/greengrass/v2/developerguide/manage-data-streams.html)
- Azure IoT Edge hub: stored messages are delivered on reconnect "in the same order in which they were stored"; retention bounded by TTL (default 7,200 s = 2 h) and disk — [Microsoft Learn: Operate IoT Edge devices offline](https://learn.microsoft.com/en-us/azure/iot-edge/offline-capabilities)

### Inferences (recommendations)
- **Polling publisher is the right relay for SQLite** (no log-tailing infrastructure needed). Since the edge app is single-process, the relay can be an in-process loop (or separate worker) that `SELECT ... WHERE seq > :acked ORDER BY seq LIMIT N`.
- **Per-site monotonic sequence**: use an `INTEGER PRIMARY KEY` (rowid) on the outbox table *within the same transaction* as the fact insert; globally unique ID = `(site_id, seq)`. Do not use `AUTOINCREMENT` unless you need never-reused IDs after deletes — but since pruning deletes acked rows, **use `AUTOINCREMENT` (or a separate counter table) so seq is never reused after pruning the tail**; reused seq would collide with `INSERT OR IGNORE` on the cloud and silently drop data. (Inference from SQLite rowid semantics; verify with SQLite docs on AUTOINCREMENT.)
- **Idempotency key must be edge-generated and stable** (e.g., `site_id`+`seq`, or `site_id`+`stream`+`seq`), and the cloud's `INSERT OR IGNORE` must be keyed on it (a UNIQUE constraint), not on a cloud-generated id or a timestamp. A dedup on (device, ts, variable) alone is fragile if two readings share a timestamp.
- **Acknowledgement**: cloud returns the highest contiguous seq it has durably committed (a "high-water mark"), not just HTTP 200; edge stores `acked_seq` in its own DB in a transaction. Retrying a batch is then always safe. This is the same model as stream manager's `last_exported_sequence_number`.
- **Ordering**: send strictly ascending seq per stream; cloud may still accept gaps-free check (reject/hold a batch whose first seq > acked+1, which detects edge DB restore/rollback).
- **Retry/backoff**: exponential backoff with jitter and a cap (Mosquitto's own bridge default is jittered backoff base 5 s cap 30 s — [mosquitto.conf](https://mosquitto.org/man/mosquitto-conf-5.html)); batch size bounded by bytes, not rows; after a 30-day outage drain at a rate that does not starve live traffic.
- **Prioritization**: separate streams/queues (e.g., `alarm`, `event/command-audit`, `telemetry-bulk`), each with its own seq and ack; relay always drains `alarm` first (stream manager does the same via priority). A single global seq + priority would break per-stream ordering guarantees.
- **Retention when disk fills**: never silently drop alarms/events. For bulk telemetry define an explicit policy (Greengrass forces you to pick `RejectNewData` vs `OverwriteOldestData`). A more useful agronomic option: downsample unsent raw telemetry (e.g., to 15-min aggregates) before dropping, and record a "gap/downsampled" marker row so the cloud knows. Size the budget: 30+ days × sensor rate × row size, with ≥3× headroom.

### Gaps
- No primary source found for an IIoT-specific outbox design with downsampling-on-full; that recommendation is my own.
- Did not fetch SQLite's AUTOINCREMENT page in this session; the rowid-reuse caveat is from general SQLite knowledge and should be verified at https://www.sqlite.org/autoinc.html.

## 2. MQTT-based alternatives (Mosquitto bridge, NanoMQ/EMQX Edge, HiveMQ Edge) vs application-level outbox

### Takeaway
Broker bridges can buffer while offline, but their limits (per-client queue caps, snapshot persistence, licensing, unclear eviction) make them a weaker durability guarantee than an application outbox in the same SQLite transaction as the fact. Use MQTT locally (gateway → edge) and an HTTPS outbox upstream; a bridge adds a second, opaque queue to monitor.

### Cited Findings
- Mosquitto `max_queued_messages` default **1000** QoS 1/2 messages per client beyond in-flight; `0` = unlimited, "not recommended"; `max_queued_bytes` default 0 (no limit) — [mosquitto.conf(5)](https://mosquitto.org/man/mosquitto-conf-5.html)
- Mosquitto built-in persistence (`persistence true`) writes `mosquitto.db` only on clean shutdown, every `autosave_interval` (default **1800 s**), or on SIGUSR1; the docs recommend plugin-based persistence instead — [mosquitto.conf(5)](https://mosquitto.org/man/mosquitto-conf-5.html)
- Mosquitto 2.1 adds a `persist-sqlite` plugin that writes changes as they happen (batched by `plugin_opt_flush_period`, default 5 s), stored as `mosquitto.sqlite3`; built-in snapshot persistence is deprecated in its favour; cannot run both — [mosquitto.org: sqlite persistence](https://mosquitto.org/documentation/persistence/sqlite/); [Eclipse Mosquitto 2.1 release](https://projects.eclipse.org/projects/iot.mosquitto/releases/2.1/review)
- `queue_qos0_messages` default false; QoS 0 messages are not queued for disconnected clients (non-standard if enabled) — [mosquitto.conf(5)](https://mosquitto.org/man/mosquitto-conf-5.html)
- Bridge `cleansession` default false (remote subscriptions survive drops); changing topics with `cleansession false` can leave the remote broker sending on the old topic; `start_type automatic` with jittered backoff (base 5 s, cap 30 s) — [mosquitto.conf(5)](https://mosquitto.org/man/mosquitto-conf-5.html)
- NanoMQ: bridge SQLite caching added in 0.7.2 (stores QoS messages in SQLite when ACK is missing); config block `sqlite { disk_cache_size = 102400 (max messages), flush_mem_threshold (default 100), resend_interval }`; on network drop cached messages are flushed to disk and resent on reconnect. The NanoMQ docs page describes `disk_cache_size` inconsistently (looks like a copy error) — [NanoMQ broker config](https://nanomq.io/docs/en/latest/config-description/broker.html); [NanoMQ TCP bridge](https://nanomq.io/docs/en/latest/bridges/tcp-bridge.html); [NanoMQ 0.7.2 changelog](https://nanomq.io/changelogs/v0.7.2); [EMQX Edge broker config](https://docs.emqx.com/en/emqx-edge/latest/config-description/broker.html) (says 0 disables the cache, default 102400)
- HiveMQ Edge: offline buffering (store-and-forward) is configured per bridge; default persistence mode is in-memory (lost on stop), `file-native` recommended for production; **offline buffering is a commercial (licensed) feature**, protocol adapters are open source — [HiveMQ Edge docs](https://docs.hivemq.com/hivemq-edge/configuration.html); [HiveMQ Edge 2024.3 release](https://www.hivemq.com/changelog/hivemq-edge-2024-3-released/); [HiveMQ community forum](https://community.hivemq.com/t/hivemq-edge-open-source-protocol-adapters/3341)

### Inferences (recommendations)
- **A broker bridge cannot be in the same transaction as the decision/write in SQLite.** If the app writes a fact to SQLite and then publishes to a local broker, there is a crash window (the exact problem the outbox solves). So a bridge only helps for data that never touches the app DB.
- Default Mosquitto settings would **lose data in a 30-day outage**: 1000-message cap per client, plus up to 30 min of queued messages lost on power cut with snapshot persistence. Workable only with 2.1 + persist-sqlite + raised caps, and still opaque to the app (no per-record ack visible to the cloud's dedup logic).
- NanoMQ's SQLite cache is the most edge-oriented of the brokers, but documentation of eviction/limits is ambiguous (doc inconsistency above) — treat as unverified for "zero loss over 30 days".
- HiveMQ Edge's offline buffering needs a commercial license — disproportionate for one greenhouse.
- Keep MQTT where it is natural: **gateway's embedded LNS → local Mosquitto/the LNS's broker → edge app** (subscriber with persistent session, QoS 1). The edge app's job on receipt is to commit the reading + outbox row in one SQLite transaction, then ack (QoS 1 PUBACK). Duplicates from QoS 1 redelivery are absorbed by a UNIQUE key on (dev_eui, f_cnt, gateway time) or the LNS uplink id.

### Gaps
- No authoritative statement found on NanoMQ/EMQX Edge eviction behaviour when `disk_cache_size` is reached, or on ordering guarantees across reconnects.
- HiveMQ Edge pricing not found.
- Did not check whether the specific gateway's embedded network server (e.g., ChirpStack on the gateway) persists uplinks across its own restarts.

## 3. Managed edge runtimes (Greengrass v2 stream manager, Azure IoT Edge, balena, Litmus Edge)

### Takeaway
Greengrass stream manager and Azure IoT Edge hub both implement exactly the store-and-forward semantics needed, but they lock the uplink to their own clouds (Kinesis/SiteWise/S3 or IoT Hub), whereas the target here is a self-hosted Node/Fastify server. For a single small site they add cost and complexity without removing the need for an app-level idempotent ingest. Copy their design ideas (sequence numbers, priority, explicit full-strategy, TTL) instead.

### Cited Findings
- Greengrass stream manager: designed for intermittent/limited connectivity; per-stream policies for storage type, size, retention; export priorities "to handle critical data sooner"; needs ≥70 MB RAM beyond Greengrass core; export destinations are Kinesis Data Streams, IoT SiteWise, S3 (IoT Analytics discontinued 15 Dec 2025) — [AWS: Manage data streams](https://docs.aws.amazon.com/greengrass/v2/developerguide/manage-data-streams.html)
- Stream manager HTTP export target "is intended for testing purposes only. It is not stable or supported for use in production" — [AWS: Use StreamManagerClient](https://docs.aws.amazon.com/greengrass/v2/developerguide/work-with-streams.html)
- Stream defaults: max_size 256 MB, segment 16 MB, no TTL, persistence File, `flush_on_write` false (default), `strategy_on_full` required — [AWS: Use StreamManagerClient](https://docs.aws.amazon.com/greengrass/v2/developerguide/work-with-streams.html)
- Stream manager does not encrypt stream data at rest; relies on file permissions/full-disk encryption — [AWS: Manage data streams](https://docs.aws.amazon.com/greengrass/v2/developerguide/manage-data-streams.html)
- Azure IoT Edge: after one initial sync with IoT Hub, devices "can keep operating indefinitely" offline; edgeHub stores upstream telemetry, authenticates modules/downstream devices locally; message storage bounded by TTL (default 7,200 s; max ~2 billion s) and disk; recommends dedicated host storage for edgeHub; portal may still show "200 OK" when the device is offline — [Microsoft Learn](https://learn.microsoft.com/en-us/azure/iot-edge/offline-capabilities)
- IoT Edge 1.6 LTS is the supported release; 1.5 LTS support ends 10 Nov 2026 — [Microsoft Learn](https://learn.microsoft.com/en-us/azure/iot-edge/offline-capabilities)

### Inferences (recommendations)
- **Not recommended** for this site: both require their cloud (AWS IoT / Azure IoT Hub) as the sink, so the cloud Node/SQLite server would need a second hop; Azure's default 2-h TTL is a trap for a 30-day outage (must be raised explicitly).
- Their design defaults are instructive pitfalls: `flush_on_write=false` (Greengrass) means a power cut can lose recent appends — the same trade-off as SQLite `synchronous=NORMAL` (see §4).
- balena (fleet OS/container management with delta updates) is relevant only for OS/app deployment and remote access, not for data sync; Litmus Edge is an industrial DataOps platform with PLC drivers (S7 among them) — likely overkill/expensive for one greenhouse.

### Gaps
- balena and Litmus Edge pricing/feature claims were **not verified** this session (no source fetched); the last bullet above is general knowledge and should be checked before inclusion in a report.
- No current pricing found for Greengrass or IoT Edge for a single device.

## 4. SQLite specifics: durability, wear, backups, replication tools

### Takeaway
For an edge that is the system of record for facts and must survive power loss without losing acknowledged data, use WAL with `synchronous=FULL` (at least on the outbox/commit path). Litestream is a good off-device backup/DR tool but is single-writer, asynchronous, one-replica-per-DB — not a sync protocol. CRDT/sync engines (cr-sqlite, ElectricSQL, PowerSync) solve multi-writer merge, which this architecture deliberately avoids by assigning clear authority (edge for facts, cloud for config).

### Cited Findings
- WAL + `synchronous=NORMAL`: "WAL mode is always consistent ... but WAL mode does lose durability. A transaction committed in WAL mode with synchronous=NORMAL might roll back following a power loss or system crash." — [SQLite PRAGMA docs](https://www.sqlite.org/pragma.html#pragma_synchronous)
- WAL + `synchronous=FULL`: ACID including durability; "an additional sync operation of the WAL file happens after each transaction commit"; EXTRA = FULL in WAL mode — [SQLite PRAGMA docs](https://www.sqlite.org/pragma.html#pragma_synchronous)
- "Transactions are durable across application crashes regardless of the synchronous setting" (power loss/OS crash is the only risk) — [SQLite PRAGMA docs](https://www.sqlite.org/pragma.html#pragma_synchronous)
- `wal_autocheckpoint` default 1000 pages, PASSIVE checkpoints; WAL file is not truncated after checkpoint (reused); `journal_size_limit` default -1 (no limit) — [SQLite PRAGMA docs](https://www.sqlite.org/pragma.html)
- Litestream: separate background process; takes over checkpointing (holds a long-running read transaction); ships WAL pages as LTX files with TXIDs to a single replica destination; asynchronous replication; compaction L1/L2/L3 every 30 s / 5 min / 1 h; daily snapshot; default retention 24 h; restore detects TXID gaps; v0.5.x current (LTX format replaced v0.3 generations); `litestream-vfs` for read-only replicas — [Litestream: How it works](https://litestream.io/how-it-works/)
- cr-sqlite: loadable extension adding multi-master replication via CRDTs (LWW, fractional index, Observe-Remove sets; counters/rich text in progress); README advises building against release tags since `main` may be unstable; no release/date visible on the repo page — [GitHub vlcn-io/cr-sqlite](https://github.com/vlcn-io/cr-sqlite)
- ElectricSQL (current "electric-next") has no built-in SQLite support; it exposes "Shapes" over HTTP, local side via PGlite (WASM Postgres) — [PowerSync blog comparison](https://powersync.com/blog/electricsql-electric-next-vs-powersync) (vendor source, competitor — treat with caution)
- PowerSync: service + SDKs syncing a backend SQL DB (Postgres/MongoDB/MySQL/SQL Server) to embedded SQLite; actively released in 2026 — [PowerSync docs](https://docs.powersync.com/architecture/); [PowerSync changelog Jan 2026](https://powersync.com/blog/powersync-changelog-january-2026)

### Inferences (recommendations)
- **PRAGMAs**: `journal_mode=WAL`, `synchronous=FULL`, `busy_timeout=5000`, `foreign_keys=ON`, `journal_size_limit` set (e.g., 64 MB) so the WAL doesn't stay large after a 30-day backlog. The extra fsync per commit is negligible at greenhouse data rates (tens of rows/minute) — batch MQTT readings into one transaction per second if needed.
- Rationale for FULL rather than NORMAL: with NORMAL, a reading the edge has already PUBACKed to the LNS, or a setpoint already written to the PLC, may vanish from the DB after a power cut → silent loss or an audit hole. Power cuts are a realistic greenhouse failure mode in Crete (storms, generator switchover).
- **Wear (eMMC/SD)**: FULL increases fsyncs; mitigate with industrial-grade eMMC/SSD with power-loss protection, batch writes, ext4 with `noatime`, log to RAM/journald limits, monitor SMART/eMMC life (`mmc extcsd read` EXT_CSD_DEVICE_LIFE_TIME). Avoid consumer microSD for the DB. (General engineering practice; not sourced this session.)
- **Local backups**: nightly `VACUUM INTO '/backup/db-YYYYMMDD.sqlite'` to a second physical medium (USB SSD), keep N days — consistent snapshot without stopping the app. Off-site: Litestream to S3-compatible storage *when online*; it will catch up after an outage (asynchronous by design), but Litestream's 24-h default retention means restore-points are coarse — set retention explicitly.
- **Caution combining Litestream with the app**: Litestream takes over checkpointing via a long read transaction; do not also run manual `wal_checkpoint(TRUNCATE)` from the app, and test WAL growth during long offline periods (Litestream cannot upload, WAL may grow).
- **Replication tool fit for "edge authoritative for facts, cloud authoritative for config"**: none of the CRDT/sync engines is needed. Facts flow one-way edge→cloud (outbox, append-only); config flows one-way cloud→edge (versioned pull). There is no shared mutable row that both sides write, so merge semantics (CRDT) add complexity without benefit. LiteFS/Litestream are single-primary replication of a whole DB, also not a fit for bidirectional partial sync. PowerSync/Electric target Postgres backends (the cloud here is SQLite) — mismatch.

### Gaps
- LiteFS current status (Fly.io) not checked this session.
- Litestream default `sync-interval` and exact behaviour during prolonged offline (WAL growth limits) not confirmed from primary docs.
- No primary source fetched for eMMC wear quantification under SQLite FULL.

## 5. Time and ordering (RTC/GNSS/NTP, HLC, sequence numbers, skew)

### Takeaway
Order by a per-site monotonic sequence number, never by wall-clock time; store wall-clock timestamps as data with a quality flag. A battery-backed RTC plus GNSS (or NTP when online) gives usable wall time offline; HLC is only needed if multiple writers must causally order events, which this design avoids.

### Cited Findings
- Hybrid Logical Clocks (Kulkarni, Demirbas et al., 2014): combine logical-clock causality tracking with closeness to NTP physical time; timestamp fits 64-bit NTP format; component = approximate physical time + counter for ties — [HLC paper (PDF)](https://www.cse.buffalo.edu//~demirbas/publications/hlc.pdf); [summary notes](https://notes.andymatuschak.org/Hybrid_logical_clock)
- HLC-style hybrid timestamps are used in CockroachDB and MongoDB — [sookocheff.com overview](https://sookocheff.com/post/time/hybrid-logical-clocks/) (secondary source)
- Outbox ordering is guaranteed by commit order of outbox rows, not by timestamps — [microservices.io](https://microservices.io/patterns/data/transactional-outbox.html)

### Inferences (recommendations)
- Each record carries: `seq` (ordering + dedup), `ts_device` (sensor/LNS time if trustworthy), `ts_edge` (edge wall clock at receipt), `clock_state` (e.g., `ntp_synced`, `gnss`, `rtc_only`, `unsynced`), and `boot_id` + monotonic ms since boot (`process.hrtime.bigint()`), so the cloud can re-anchor timestamps after an outage if the RTC drifted or reset.
- Hardware: battery-backed RTC (e.g., DS3231-class, ~±2 ppm ≈ ±5 s/month) + GNSS module with PPS feeding chrony as a local stratum-1 source if 30-day accuracy matters for irrigation logs; chrony `makestep` only at boot, slew afterwards (avoid time jumps mid-run). Never let the edge start with time = 1970 — refuse to write facts until clock_state is at least `rtc_only` and flag it.
- Cloud-side skew check: on ingest, compare `ts_edge` of the newest record with server receipt time; if the difference exceeds a threshold, flag the batch and correct using the boot_id/monotonic anchor.
- HLC is unnecessary for single-writer edge facts; consider it only if the cloud is also allowed to create facts for the same site (e.g., manual operator entries) and a single merged order is required.

### Gaps
- No primary source fetched for RTC drift figures or chrony GNSS/PPS configuration; values above are typical datasheet figures and should be verified.

## 6. Config sync cloud → edge (versioning, pull, validation, rollback, offline local edits)

### Takeaway
Use a pull model with immutable, versioned, signed config bundles; the edge validates (schema + semantic limits) before atomic activation, keeps the last-known-good, and reports applied version back through the outbox. Offline local edits should be modelled as separate "local override" records with their own seq, not as mutations of cloud config, so there is no merge conflict — the cloud decides.

### Cited Findings
- Azure IoT Edge reconciles desired vs reported properties on reconnect; while offline the agent cannot report status, and the portal can keep showing stale "200 OK" — [Microsoft Learn](https://learn.microsoft.com/en-us/azure/iot-edge/offline-capabilities)
- Greengrass stream manager update semantics: a stream update must include the complete object; "Undefined properties revert to the default values" — an example of how partial-config updates can silently reset settings — [AWS: Use StreamManagerClient](https://docs.aws.amazon.com/greengrass/v2/developerguide/work-with-streams.html)
- Mosquitto bridge config changes apply "at the next natural reconnection" by default (`bridge_reload_type lazy`) — example that config activation timing must be explicit — [mosquitto.conf(5)](https://mosquitto.org/man/mosquitto-conf-5.html)

### Inferences (recommendations)
- Model (desired/reported, like device twins): cloud holds `desired_config_version` per site; edge polls `GET /config?since=<applied_version>` (outbound only), receives a full bundle (never patches that rely on defaults), with SHA-256 + signature (e.g., Ed25519 public key pinned on the edge).
- Activation: write bundle to `config_versions` table, validate (JSON schema, physical limits e.g. setpoint ranges permitted for the PLC, cross-references to known sensors), then flip `active_version` in one transaction; keep previous N versions; auto-rollback if a post-activation health check fails (e.g., PLC rejects writes, decision loop errors) within T minutes. Report `{applied_version, status, error}` as an outbox event.
- Two-phase for safety-relevant parameters: PLC hard limits stay in the PLC program (cloud config can only move setpoints within PLC-enforced bounds).
- Offline local edits (operator on site via local UI): store as `local_override` rows with author, seq, ts, reason, and an expiry; the effective value = override if active else cloud config. On reconnect the overrides are uploaded as facts; the cloud may "adopt" them into the next desired version or let them expire. This avoids bidirectional merge/CRDT entirely.
- Knowledge bases (crop profiles, rule tables): same mechanism, separate version stream, so a knowledge update cannot be blocked by an invalid operational config and vice versa.

### Gaps
- No primary source fetched specifically on signed config bundles / TUF-style update frameworks for IoT (e.g., The Update Framework, Mender, RAUC for OS updates). Worth a follow-up if OS/app OTA is in scope.

## 7. Security (outbound-only, WireGuard/VPN, mTLS, offline credential rotation)

### Takeaway
Keep the edge outbound-only (HTTPS with mTLS to the ingest/config API; WireGuard tunnel for operator remote access), and design credentials so they do not expire during a 30-day outage (rotate with overlap windows, check expiry on reconnect).

### Cited Findings
- Greengrass stream manager does not encrypt stream data at rest or in local transit; relies on file permissions and full-disk encryption; uploads use TLS — [AWS: Manage data streams](https://docs.aws.amazon.com/greengrass/v2/developerguide/manage-data-streams.html)
- Azure IoT Edge hub authenticates modules and downstream devices locally while offline (cached credentials after initial sync) — [Microsoft Learn](https://learn.microsoft.com/en-us/azure/iot-edge/offline-capabilities)
- Mosquitto bridge supports reconnect backoff and multiple addresses (primary/secondary) — [mosquitto.conf(5)](https://mosquitto.org/man/mosquitto-conf-5.html)

### Inferences (recommendations)
- **Outbound-only**: edge initiates all connections (ingest POST, config pull, optional WireGuard handshake to a cloud hub). No inbound port forwarding at the greenhouse router.
- **mTLS** with a per-site client certificate (private key on disk with tight permissions, ideally TPM/secure element); cert lifetime ≥ 1 year with renewal starting at 60 % lifetime when online, so a 30-day outage never crosses expiry. Server also checks `site_id` in the cert matches `site_id` in batch payloads (prevents one site writing another's data — relevant given MACC's prior cross-customer controller issues).
- **WireGuard** for SSH/maintenance: persistent keepalive from edge; keys don't expire, so rotation is a planned operation with two peers configured during transition.
- PLC side: S7-1200 PUT/GET access should be restricted (enable only what's needed, PLC on a separate VLAN/interface from the internet-facing NIC); prefer S7-1200 "access protection" and, on newer firmware, secure PG/HMI communication. (General practice; not sourced this session.)
- Encrypt the edge disk (LUKS) if the site is physically accessible; back up the key off-site.

### Gaps
- No primary source fetched for S7-1200 security settings (PUT/GET, firmware V4.x secure communication) or for WireGuard key rotation guidance.

## 8. Real-world IIoT best practices and failure modes (lost data, duplicate commands)

### Takeaway
The documented failure modes cluster around: in-memory or snapshot buffers losing data on power loss, default queue/TTL limits far below the outage length, at-least-once redelivery producing duplicate side effects, and status dashboards that look healthy while the device is offline. Commands to actuators must be idempotent (absolute setpoints with command IDs), never relative ("open +10 %").

### Cited Findings
- Azure IoT Edge default store-and-forward TTL is only 2 hours — [Microsoft Learn](https://learn.microsoft.com/en-us/azure/iot-edge/offline-capabilities)
- Offline device can still show "200 OK" in the Azure portal — [Microsoft Learn](https://learn.microsoft.com/en-us/azure/iot-edge/offline-capabilities)
- HiveMQ Edge default buffer mode is in-memory; "data stored in-memory is not persisted to disk" when stopped — [HiveMQ Edge docs](https://docs.hivemq.com/hivemq-edge/configuration.html)
- Mosquitto default per-client queue 1000 messages; snapshot persistence every 1800 s — [mosquitto.conf(5)](https://mosquitto.org/man/mosquitto-conf-5.html)
- Greengrass `flush_on_write` defaults to false; `OverwriteOldestData` silently discards oldest when full — [AWS: Use StreamManagerClient](https://docs.aws.amazon.com/greengrass/v2/developerguide/work-with-streams.html)
- Outbox relays can publish more than once; consumers must dedup — [microservices.io](https://microservices.io/patterns/data/transactional-outbox.html)
- Community reports of LoRaWAN gateway local persistence needs during internet outages exist (ChirpStack forum) — [ChirpStack forum](https://forum.chirpstack.io/t/gateway-local-persistence-for-internet-outages/1747) (not read in full)

### Inferences (recommendations)
- **Duplicate commands**: every PLC write is an absolute setpoint with a `command_id`; the edge writes `command_id` + value into a PLC DB block and the PLC program ignores repeats (or the edge reads back and compares before writing). Never replay a backlog of cloud commands after reconnect — commands should carry `valid_until` and be discarded if stale. (This mirrors the open MACC issue where an ack checker resends unacked commands to any controller.)
- **Lost data**: test by pulling power during a burst of writes and during an upload; verify cloud row counts == edge seq range; run a nightly reconciliation (`edge: max(seq), count` vs `cloud: max(seq), count`) and alert on mismatch.
- **Monitoring**: expose `outbox_backlog_rows`, `oldest_unacked_age`, `disk_free`, `clock_state`, `last_config_version` as a heartbeat; the cloud should alarm on missing heartbeats rather than trusting "last known status".

### Gaps
- No primary, well-documented public post-mortem of an agricultural/IIoT store-and-forward data-loss incident was found in this session; the failure modes above are derived from product defaults documented by vendors, not from incident reports.

## 9. Concrete recommendation for this stack (Node 20 + Fastify + SQLite WAL edge → Node/Fastify/SQLite cloud)

### Takeaway
Build a small application-level outbox in the existing edge SQLite (WAL, synchronous=FULL), relay over HTTPS+mTLS to the existing `/ingest/batch` with an edge-generated `(site_id, stream, seq)` unique key and high-water-mark acks; keep MQTT only for gateway→edge; pull versioned, signed config bundles; skip managed runtimes, broker bridges and CRDT sync engines.

### Cited Findings
- All supporting facts are cited in §§1–8 (outbox semantics: [microservices.io](https://microservices.io/patterns/data/transactional-outbox.html); SQLite durability: [SQLite PRAGMA](https://www.sqlite.org/pragma.html); broker limits: [mosquitto.conf](https://mosquitto.org/man/mosquitto-conf-5.html); managed runtime designs: [AWS](https://docs.aws.amazon.com/greengrass/v2/developerguide/work-with-streams.html), [Azure](https://learn.microsoft.com/en-us/azure/iot-edge/offline-capabilities); backups: [Litestream](https://litestream.io/how-it-works/)).

### Inferences (recommendations)
- **Schema sketch (edge)**:
  - `outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT, stream TEXT NOT NULL CHECK(stream IN ('alarm','event','telemetry')), stream_seq INTEGER NOT NULL, created_ts_edge INTEGER, clock_state TEXT, payload TEXT NOT NULL, UNIQUE(stream, stream_seq))`
  - `outbox_ack(stream TEXT PRIMARY KEY, acked_seq INTEGER NOT NULL)`
  - Facts tables (readings, decisions, PLC writes) written in the same `db.transaction(...)` as the outbox row (better-sqlite3 transactions are synchronous and fit this well).
- **Relay loop**: per stream in priority order alarm → event → telemetry; batch ≤ ~256 KB; POST `{site_id, stream, from_seq, to_seq, records[]}`; cloud inserts with `INSERT OR IGNORE` on `UNIQUE(site_id, stream, stream_seq)` in one transaction, then returns `{acked_seq}` = highest contiguous committed; edge updates `outbox_ack`. Backoff with jitter (e.g., 2 s → 5 min cap). On HTTP 409 "gap" (from_seq > acked+1) → alarm (edge DB was restored/rolled back).
- **Pruning**: delete rows `seq <= acked` older than X days (keep a local window for diagnostics); disk watermark policy: at 80 % downsample unacked telemetry older than 7 days into aggregates + marker, at 95 % stop raw telemetry ingest but never alarms/events/PLC audit.
- **Cloud side**: `ingest_batch` must be idempotent and transactional (it already uses INSERT OR IGNORE); add per-site `received_max_seq` table; reject batches where cert site ≠ payload site.
- **Inbound MQTT**: persistent session (clean_session=false / MQTT5 session expiry), QoS 1, ack only after SQLite commit; dedup on LNS uplink identity (DevEUI + FCnt + frame/receive time).
- **Durability**: `PRAGMA journal_mode=WAL; synchronous=FULL; journal_size_limit=67108864;` industrial SSD with PLP + UPS/supercap for clean shutdown; nightly `VACUUM INTO` to second medium; optional Litestream to S3 when online.
- **Time**: RTC + GNSS/chrony; store `clock_state`, `boot_id`, monotonic offset; order only by seq.
- **Config**: pull, full signed bundles, validate → atomic activate → health check → auto-rollback; report applied version via outbox `event` stream; local overrides as facts with expiry.
- **Security**: outbound-only, mTLS per-site cert with long lifetime + early renewal, WireGuard for maintenance, PLC on isolated interface with PUT/GET limited.
- **Testing**: chaos tests — kill -9 relay mid-batch, cut power mid-commit, 30-day simulated offline with accelerated data, clock jump ±1 h, cloud returns 500 after commit (must produce zero duplicates/zero loss via reconciliation).
- **Why not alternatives**: broker bridges (default 1000-message caps, snapshot persistence, licensing for HiveMQ offline buffering, unclear NanoMQ eviction) add a second queue outside the DB transaction; Greengrass/IoT Edge tie upstream to AWS/Azure and their default TTL/flush settings need tuning anyway; CRDT engines solve multi-writer merges that this authority split avoids.

### Gaps
- Effort/size estimates for implementation not researched.
- Not verified whether the chosen gateway's embedded LNS (RAK7393 or alternative, mentioned in the parent plan) exposes a stable uplink id suitable as a dedup key.
