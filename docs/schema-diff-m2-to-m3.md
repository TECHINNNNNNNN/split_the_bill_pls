# Database Schema Changes: Milestone 2 → Milestone 3

## Tables Renamed / Redesigned

| Milestone 2 | Milestone 3 | What changed |
|-------------|-------------|-------------|
| `bills` | `rooms` | Renamed. A "room" is now the entire splitting session. Added `inviteCode`, `name`, `hostName`, `expectedMembers`, `promptpayId`, `promptpayType`. Status enum changed from `draft/active/settled` → `waiting/splitting/payment/settled`. `shareToken` replaced by `inviteCode`. `groupId` is now nullable (rooms can exist without a group via Quick Split). |
| `billItems` | `room_bill_items` | Simplified. Removed `quantity` and `unitPrice` — now just `amount` (total price). Added nullable `sectionId` FK to support bill sections. Added `sortOrder`. |
| `itemClaims` | `room_item_splits` | Simplified to a pure junction table. Removed `shareAmount` column — share amounts are now calculated at runtime by `calculateSplit()` instead of being stored. Has unique constraint on `(itemId, memberId)`. |
| `payments` | `room_payments` | Added slip verification fields: `slipTransRef`, `slipSendingBank`, `slipImageData`, `slipVerifiedAmount`, `slipVerifiedAt`. These support the automated bank slip verification pipeline. |

## New Tables (not in Milestone 2)

| Table | Purpose |
|-------|---------|
| `room_members` | Tracks who is in a specific room. Has `displayName`, `isHost`, `lineUserId`, nullable `userId` (guests don't need accounts). Separate from group members — a room member exists per splitting session. |
| `room_bill_sections` | Allows splitting a bill into multiple restaurant sections (e.g., eating at 3 places and paying together). Each section has its own `vatRate`, `serviceChargeRate`, `discountAmount`, and `sortOrder`. |
| `room_invites` | In-app invitation system. Tracks invites with `userId`, `invitedBy`, `displayName`, and status (`pending/accepted/declined`). |
| `push_notification_log` | Tracks which reminder tiers (`30min`, `1hr`, `3hr`, etc.) were sent to each payment to prevent sending duplicate reminders. Has `tier`, `channel` (line/web-push), `sentAt`. |
| `session` | Better Auth managed table. Stores login sessions with `token`, `expiresAt`, `ipAddress`, `userAgent`. |
| `account` | Better Auth managed table. Links OAuth providers (Google, LINE) to users. Stores `providerId`, `accountId`, access/refresh tokens. |
| `verification` | Better Auth managed table. Temporary tokens for email verification and password resets. |

## Tables That Stayed Similar

| Table | Changes from M2 → M3 |
|-------|----------------------|
| `user` | Now managed by Better Auth. Added `promptpayId`, `promptpayType`. Field naming changed to Better Auth conventions (`displayName` → `name`, `avatarUrl` → `image`). Auth fields (`authProvider`, `authProviderId`) moved to separate `account` table. |
| `groups` | Added `inviteCode` for group invite links. `createdBy` renamed to `createdBy` (references user). |
| `group_members` | Same concept. `isGuest` flag added. `userId` remains nullable for guests. |
| `push_subscriptions` | Now linked to `room_members` + `rooms` instead of `group_members`. This ties push subscriptions to a specific room context. |

## Key Architectural Changes

1. **Quick Split flow** — Milestone 2 assumed everything goes through Groups → Bills. Milestone 3 has standalone Rooms (`rooms.groupId` is nullable) via the Quick Split feature. Users can split a bill without creating a group first.

2. **Bill Sections** — Milestone 2 had one flat list of items per bill. Milestone 3 supports multiple sections per bill, each with its own VAT/service charge/discount. This handles the common Thai scenario of eating at multiple restaurants in one outing.

3. **Runtime calculation** — Milestone 2 stored `shareAmount` per claim. Milestone 3 calculates splits at runtime using `calculateSplit()` in the shared package, following the Thai ++ convention (subtotal → discount → service charge → VAT).

4. **Auth system** — Milestone 2 assumed custom auth with `authProvider`/`authProviderId` fields on the user table. Milestone 3 uses Better Auth which manages its own `session`, `account`, and `verification` tables.

5. **Slip verification** — Milestone 2 had `slipImageUrl` on payments. Milestone 3 stores the full verification pipeline result: `slipTransRef`, `slipSendingBank`, `slipImageData` (base64), `slipVerifiedAmount`, `slipVerifiedAt`.

6. **Room member identity** — Milestone 2 identified friends via `groupMembers`. Milestone 3 has `room_members` with per-room HTTP-only cookies for guest identification, and optional `userId` linking for logged-in users.

7. **Item quantity + unit price** — Milestone 2 had a single `amount` column on bill items (total price). Milestone 3 splits this into `quantity` (integer, default 1) and `unitPrice` (numeric). Total price is computed at runtime as `quantity × unitPrice`. This enables OCR to extract "2x Pad Thai ฿60" as quantity: 2, unitPrice: 60.

8. **Removed legacy fields** — Milestone 3 removed room-level `vatRate`, `serviceChargeRate`, `discountAmount` (superseded by per-section rates on `room_bill_sections`), `pushSubscriptions.userId` (never queried), and `groupMembers.isGuest` (groups are logged-in only, `userId` is now NOT NULL).

9. **Finalized timestamp** — Added `rooms.finalizedAt` to track when the bill was actually split, separate from `createdAt`. Used for reminder scheduling and display.

10. **Settlements** — Added `settlements` and `settlement_payments` tables for cross-room debt netting. Settlements track net amounts between two users, with slip verification and claim/confirm/reject lifecycle mirroring room payments.
