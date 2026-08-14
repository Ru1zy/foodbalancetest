import { processAllOutboxJobs } from "../lib/outbox"; async function run() { console.log("Processing outbox..."); await processAllOutboxJobs(); console.log("Done"); } run();
