// Worker entrypoint for the `scheduler` Fly process group.
// This process does NOT serve HTTP — it exists only to run the periodic
// reminder check, isolated from the user-facing API machine.
//
// Deployed via fly.toml `[processes] scheduler = "node dist/scheduler.js"`.

import "dotenv/config"
import { startReminderScheduler } from "./lib/reminder-scheduler.js"

console.log("[scheduler] worker process starting")
startReminderScheduler()

// Pin the process. setInterval inside startReminderScheduler keeps Node alive,
// but if it ever returns early (e.g. dev guard hits), we don't want the
// process to exit silently — better to keep idling than to disappear.
setInterval(() => {}, 1 << 30)
