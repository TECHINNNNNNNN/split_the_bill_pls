# PlaDuk ER Diagram — Presentation Script & Q&A Prep

## How to use this guide
- This is NOT a script to read word-for-word. It's a walkthrough guide.
- Freestyle it in your own words. The key points are what matter.
- Estimated time: 15-20 minutes for the walkthrough, then Q&A.

---

## OPENING (30 seconds)

"Our database has 17 tables organized into 5 layers. I'll walk through each layer and explain WHY each table exists — not just what it stores, but the design decisions behind it."

The 5 layers:
1. Authentication (4 tables) — managed by Better Auth
2. Groups (2 tables) — persistent friend lists
3. Rooms (7 tables) — one bill-splitting session, the core
4. Push Notifications (2 tables) — payment reminders
5. Settlements (2 tables) — cross-room debt netting

---

## LAYER 1: AUTHENTICATION (4 tables)

### Key message: "These 4 tables are managed by Better Auth. We extended `user` with 2 custom columns."

**user**
- One row per registered person. Only HOSTS need accounts — friends never sign up.
- Better Auth gives us: id, name, email, emailVerified, image, createdAt, updatedAt
- WE added: `promptpayId` and `promptpayType` — stores their PromptPay phone number or national ID for receiving payments via QR code.

**account**
- One user can have MULTIPLE login methods. Google + LINE = 2 rows, same userId.
- Why? Google OAuth doesn't work inside LINE's in-app browser. Thai Gen-Z uses LINE for everything. So we need LINE Login as an alternative entry point.
- Relationship: user 1:N account

**session**
- Active login sessions. One user, many sessions (phone + laptop).
- `ipAddress` and `userAgent` are auto-recorded by Better Auth for security auditing. We don't query them.
- Relationship: user 1:N session

**verification**
- Temporary email verification tokens. Managed entirely by Better Auth. No FK to user — matches by email string.

---

## LAYER 2: GROUPS (2 tables)

### Key message: "A group is just a contact list. No bill, no payment. It's persistent — you create it once and reuse it."

**groups**
- name ("ISE Squad"), inviteCode ("ABC123"), createdBy → user
- A group can spawn many rooms (one per meal). groupId on rooms is NULLABLE — rooms can exist without a group (Quick Split flow).
- Relationship: user 1:N groups

**groupMembers**
- This is the M:N junction table between user and groups.
- WHY a junction table? In relational databases, you can't store an array of userIds in one column — it violates First Normal Form and loses FK integrity.
- `userId` is NOT NULL here — everyone in a group must have an account. This is different from roomMembers where userId IS nullable.
- `displayName` is cached per membership — avoids JOINing user table every time.
- Relationships: groups 1:N groupMembers, user 1:N groupMembers

---

## LAYER 3: ROOMS — THE CORE (7 tables)

### Key message: "A room is ONE bill-splitting event. It goes through a lifecycle: waiting → splitting → payment → settled."

**rooms**
- `inviteCode` — the 6-char code in the shareable URL: pladuk.online/quick-split/066D30
- `promptpayId/promptpayType` — COPIED from user at room creation. Why? If the user changes their PromptPay later, existing rooms still have the correct QR code.
- `status` — the room lifecycle: waiting (lobby) → splitting (adding items) → payment (collecting money) → settled (all paid)
- `finalizedAt` — when the host locked the bill. Used to calculate "fastest payer" time. This answers the professor's previous question: "add the date when split, not only date created."
- `createdByUserId` — nullable (ON DELETE SET NULL). If user deletes account, room data survives.
- `groupId` — nullable. Quick Split rooms have no group.
- Relationships: user 1:N rooms (both FKs nullable → single lines both sides), groups 1:N rooms (nullable → single lines both sides)

**roomMembers**
- Same junction concept as groupMembers, BUT `userId` IS NULLABLE.
- This is THE core design decision: friends never need accounts. A friend joins with just a display name.
- `isHost` — boolean, marks who created the room.
- `lineUserId` — stored when the tracking page loads inside LINE's LIFF. Used for sending payment reminders via LINE instead of web push.
- Relationships: rooms 1:N roomMembers, user 1:N roomMembers (userId nullable → single line on roomMembers side)

**roomBillSections**
- Groups bill items together. Each section has its own VAT rate, service charge rate, and discount.
- Why per-section? A Thai restaurant might charge 7% VAT + 10% service on food but no service charge on takeaway items. Or you might split one receipt that has both a restaurant section and a bar section with different rates.
- Relationship: rooms 1:N roomBillSections

**roomBillItems**
- Individual menu items: name, quantity, unitPrice.
- `sectionId` is NULLABLE — an item can exist without being in a section.
- `sortOrder` — controls display order on the bill page.
- Relationships: rooms 1:N roomBillItems, roomBillSections 1:N roomBillItems (nullable)

**roomItemSplits**
- M:N junction table between roomBillItems and roomMembers. "Who had what."
- If 3 people share Pad Thai → 3 rows. The calculation engine divides the price by the split count.
- UNIQUE constraint on (itemId, memberId) — one person can't claim the same item twice.
- Relationships: roomBillItems 1:N roomItemSplits, roomMembers 1:N roomItemSplits

**roomPayments**
- One row per non-host member per room. Created when the bill is finalized.
- `amount` — their total share including proportional VAT/service charge.
- `status` lifecycle: unpaid → claimed → confirmed OR rejected
- `claimedAt/confirmedAt/rejectedAt` — timestamps for each status transition. `claimedAt` is used for "Fastest Payer" feature.
- Slip verification fields (`slipTransRef`, `slipSendingBank`, `slipImageData`, `slipVerifiedAmount`, `slipVerifiedAt`) — when a friend uploads a bank transfer slip, we extract the QR code with the `promptparse` library, verify it against Bank of Thailand records via OpenVerifySlip API, and store the verified amount. If it doesn't match the owed amount, the host sees a warning.
- Relationships: rooms 1:N roomPayments, roomMembers 1:N roomPayments

**roomInvites**
- Only used when creating a room FROM a group. The host selects group members → invites are created.
- `status`: pending → accepted / declined
- `displayName` — copied from groupMembers so the invite notification shows the person's name without an extra JOIN.
- `invitedBy` — FK to user, tracks who sent the invite.
- Relationships: rooms 1:N roomInvites, user 1:N roomInvites (as invitee), user 1:N roomInvites (as sender)

---

## LAYER 4: PUSH NOTIFICATIONS (2 tables)

### Key message: "Automated payment reminders. The system reminds people to pay so the host doesn't have to chase anyone."

**pushSubscriptions**
- When a friend allows browser notifications, the browser gives us an endpoint URL + encryption keys (p256dh, auth). Standard Web Push VAPID protocol.
- One subscription per member per room.
- Relationships: roomMembers 1:N pushSubscriptions, rooms 1:N pushSubscriptions

**pushNotificationLog**
- Prevents duplicate reminders. The scheduler runs every 15 minutes.
- `tier` — escalation levels: "30m", "1h", "6h", "24h", then daily ("recurring-2d", "recurring-3d", etc.). Also "manual-nudge" when the host taps Nudge.
- `channel` — "line" or "web-push". LINE is attempted first if the member has lineUserId; falls back to web push.
- Before sending, the scheduler checks: does a row exist for this paymentId + tier? If yes, skip.
- Relationship: roomPayments 1:N pushNotificationLog

---

## LAYER 5: SETTLEMENTS (2 tables)

### Key message: "Cross-room debt netting. Instead of 5 separate transfers across 3 dinners, the system calculates one net amount."

**settlements**
- Boom owes Opal ฿200 from dinner A. Opal owes Boom ฿150 from dinner B. Instead of two transfers → one settlement: Boom pays Opal ฿50 net.
- `payerUserId` and `payeeUserId` — both FK to user. Two relationships from one table to the same entity.
- Same payment lifecycle and slip verification fields as roomPayments.
- Relationships: user 1:N settlements (as payer), user 1:N settlements (as payee)

**settlementPayments**
- Audit trail junction table. Links a settlement back to the specific room payments that created it.
- "Why is the net amount ฿50?" → This table shows: ฿200 from Room A payment + ฿150 from Room B payment.
- Relationships: settlements 1:N settlementPayments, roomPayments 1:N settlementPayments

---

## CLOSING (15 seconds)

"17 tables, 5 layers. The key design decisions are: friends never need accounts (userId nullable on roomMembers), M:N relationships use junction tables (groupMembers, roomItemSplits, settlementPayments), and the notification system uses a log table to prevent duplicates. Every column exists for a reason — there are zero zombie columns in this schema."

---

---

# Q&A PREP — EXPECTED QUESTIONS & ANSWERS

## From the Professor

**Q: Why is userId nullable in roomMembers but not in groupMembers?**
A: "Groups are permanent contact lists — you need an account to be tracked persistently. Rooms are temporary — a friend joins one dinner with just a name, no sign-up required. This is our core design principle: friends never need accounts."

**Q: Why do you copy promptpayId to the rooms table instead of just referencing the user?**
A: "If the host changes their PromptPay number after creating a room, the existing room's QR code should still work. We snapshot the payment info at room creation time."

**Q: Why do you copy displayName to groupMembers/roomMembers instead of just using user.name?**
A: "Two reasons. First, roomMembers.userId is nullable — guests don't have a user row to reference. Second, it avoids a JOIN every time we list members. It's a denormalization for performance and flexibility."

**Q: What's the difference between rooms and groups?**
A: "A group is a contact list — persistent, no bills, no payments. A room is one bill-splitting event — temporary, has items, payments, VAT, goes through a lifecycle and ends. A group can spawn many rooms. A room can also exist without a group."

**Q: Why do you have a separate roomBillSections table?**
A: "Thai restaurants often charge different rates on different items — 7% VAT + 10% service charge on dine-in food, but maybe no service charge on takeaway. Sections let us apply different rates to different parts of the bill."

**Q: How does your payment status work?**
A: "Four states: unpaid → claimed (friend says 'I paid') → confirmed (host verified) or rejected (host says no). The host is always the final authority. We also have automated slip verification — extract QR from bank slip → verify with Bank of Thailand API → auto-confirm if amount matches."

**Q: What is finalizedAt for?**
A: "The timestamp when the host locks the bill and moves to payment stage. Used for: (1) calculating 'fastest payer' time, (2) triggering the reminder scheduler, (3) preventing further edits to the bill. This was added based on your previous feedback about needing the split date, not just creation date."

**Q: Why not use an array column instead of junction tables?**
A: "It violates First Normal Form — columns must contain atomic values, not lists. Also loses foreign key integrity, can't be indexed efficiently, and can't store per-membership data like displayName."

---

## From High-Ego Developers

**Q: Why Better Auth and not build your own?**
A: "Auth is the #1 source of security vulnerabilities. Password hashing, CSRF, token rotation, OAuth flow — one mistake and you leak user data. Better Auth is open-source, self-hosted, runs inside our Hono server, supports Google + LINE, works with Drizzle ORM natively, and lets us extend the user table. Auth.js v5 is in maintenance mode — Better Auth team acquired it."

**Q: Why PostgreSQL and not MongoDB?**
A: "Our data is highly relational — users belong to groups, groups spawn rooms, rooms have items, items have splits, splits reference members. That's 5 levels of relations. In MongoDB you'd either nest everything (unmaintainable) or duplicate data (inconsistency). PostgreSQL with Drizzle ORM gives us type-safe queries, FK constraints, and transactional integrity."

**Q: Why Drizzle ORM and not Prisma?**
A: "Drizzle is lighter (no binary engine), faster cold starts (important for serverless), and the query syntax is closer to SQL — so we understand what's actually happening. Prisma's client generation step also adds complexity to CI/CD."

**Q: Why separate rooms and groups? Isn't that redundant?**
A: "No. A group is a CONTACT LIST (persistent, no financial data). A room is a TRANSACTION (temporary, has money). Merging them would mean your contact list has payment statuses, VAT rates, and expires — that's a modeling violation. Think of it like: your phone's Contacts app vs. a Venmo transaction."

**Q: Why store slip images as base64 in the database instead of a file storage service?**
A: "For MVP speed. The slip is only ~200KB after compression. At our scale (capstone project), it's simpler than setting up S3/Cloudflare R2. For production scale, we'd move to object storage — the column is just a text field, so migration is trivial."

**Q: Your schema has a lot of denormalization (displayName copied everywhere). Isn't that bad?**
A: "It's intentional denormalization. In a bill-splitting app, we display member names on every screen — item cards, payment cards, history. JOINing the user table every time adds latency. More importantly, roomMembers.userId is nullable (guests), so we CAN'T always JOIN. The trade-off is: slightly more storage for significantly simpler queries and support for anonymous users."

**Q: Why not use Supabase or Firebase instead of building your own backend?**
A: "We need: (1) Hono RPC for end-to-end type safety with our Next.js frontend, (2) custom LINE LIFF integration, (3) PartyKit WebSocket rooms for real-time collaboration, (4) custom slip verification pipeline with Bank of Thailand API. No BaaS supports all of these. Our Hono backend gives us full control."

**Q: What happens if two people claim the same item simultaneously (race condition)?**
A: "The UNIQUE constraint on roomItemSplits(itemId, memberId) prevents duplicate claims at the database level. Even if two requests arrive simultaneously, the second INSERT fails with a constraint violation. We handle this gracefully in the API."
