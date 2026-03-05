import { Hono } from "hono"
import { db } from "../db/index.js"
import { groups, groupMembers } from "../db/schema.js"
import { requireAuth } from "../lib/middleware.js"
import { eq, and } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { createGroupSchema, addGroupMemberSchema } from "@pladuk/shared/schemas"
import { randomUUID } from "node:crypto"

const app = new Hono()

  // Every route in this file requires login
  .use(requireAuth)

  // ─── GET /groups ─────────────────────────────
  // List all groups the logged-in user created.
  // Returns groups with their members, newest first.
  .get("/", async (c) => {
    const user = c.get("user")

    const userGroups = await db.query.groups.findMany({
      where: eq(groups.createdBy, user.id),
      with: {
        members: true,
      },
      orderBy: (groups, { desc }) => [desc(groups.createdAt)],
    })

    return c.json(userGroups)
  })

  // ─── POST /groups ────────────────────────────
  // Create a new group. Only needs a name.
  // zValidator automatically validates the request body
  // against createGroupSchema ({ name: string }).
  // If validation fails, Hono returns 400 with error details
  // before our code even runs.
  .post("/", zValidator("json", createGroupSchema), async (c) => {
    const user = c.get("user")
    const { name } = c.req.valid("json")

    const group = await db.insert(groups).values({
      id: randomUUID(),
      name,
      createdBy: user.id,
      inviteCode: randomUUID().slice(0, 8),
    }).returning()

    // returning() gives us the inserted row back from Postgres
    return c.json(group[0], 201)
  })

  // ─── GET /groups/:id ─────────────────────────
  // Get one group's details, including members and bills.
  // Only the group creator can access it.
  .get("/:id", async (c) => {
    const user = c.get("user")
    const groupId = c.req.param("id")

    const group = await db.query.groups.findFirst({
      where: and(
        eq(groups.id, groupId),
        eq(groups.createdBy, user.id),  // ownership check
      ),
      with: {
        members: true,
        bills: true,
      },
    })

    if (!group) {
      return c.json({ error: "Group not found" }, 404)
    }

    return c.json(group)
  })

  // ─── POST /groups/:id/members ────────────────
  // Add a member to a group.
  // Members can be guests (just a display name, no account)
  // or linked to a real user (userId).
  // This is the "friends never need accounts" feature.
  .post("/:id/members", zValidator("json", addGroupMemberSchema), async (c) => {
    const user = c.get("user")
    const groupId = c.req.param("id")
    const { displayName, isGuest, userId } = c.req.valid("json")

    // Only the group creator can add members
    const group = await db.query.groups.findFirst({
      where: and(eq(groups.id, groupId), eq(groups.createdBy, user.id)),
    })

    if (!group) {
      return c.json({ error: "Group not found" }, 404)
    }

    const member = await db.insert(groupMembers).values({
      id: randomUUID(),
      groupId,
      displayName,
      isGuest: isGuest ?? true,
      userId: userId ?? null,
    }).returning()

    return c.json(member[0], 201)
  })

  // ─── DELETE /groups/:id/members/:memberId ────
  // Remove a member from a group.
  // Only the group creator can remove members.
  .delete("/:id/members/:memberId", async (c) => {
    const user = c.get("user")
    const groupId = c.req.param("id")
    const memberId = c.req.param("memberId")

    // Ownership check
    const group = await db.query.groups.findFirst({
      where: and(eq(groups.id, groupId), eq(groups.createdBy, user.id)),
    })

    if (!group) {
      return c.json({ error: "Group not found" }, 404)
    }

    // Delete where both member ID and group ID match
    // (prevents deleting a member from a different group)
    await db.delete(groupMembers).where(
      and(eq(groupMembers.id, memberId), eq(groupMembers.groupId, groupId))
    )

    return c.json({ success: true })
  })

export default app
