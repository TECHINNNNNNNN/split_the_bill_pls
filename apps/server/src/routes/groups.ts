import { Hono } from "hono"
import { db } from "../db/index.js"
import { groups, groupMembers, rooms, roomMembers, roomInvites } from "../db/schema.js"
import { requireAuth } from "../lib/middleware.js"
import { eq, and } from "drizzle-orm"
import { zValidator } from "@hono/zod-validator"
import { setCookie } from "hono/cookie"
import { createGroupSchema, startGroupSplitSchema } from "@pladuk/shared/schemas"
import { randomUUID } from "node:crypto"
import { notifyPartyKit } from "../lib/partykit.js"

const app = new Hono()

  // Every route in this file requires login
  .use(requireAuth)

  // ─── GET /groups ─────────────────────────────
  // List all groups the logged-in user is a member of.
  // Returns groups with their members, newest first.
  .get("/", async (c) => {
    const user = c.get("user")

    // Find all groups where user is a member (not just creator)
    const memberships = await db.query.groupMembers.findMany({
      where: eq(groupMembers.userId, user.id),
      with: {
        group: {
          with: { members: true },
        },
      },
    })

    const userGroups = memberships
      .map(m => m.group)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return c.json(userGroups)
  })

  // ─── POST /groups ────────────────────────────
  // Create a new group. Only needs a name.
  .post("/", zValidator("json", createGroupSchema), async (c) => {
    const user = c.get("user")
    const { name } = c.req.valid("json")

    const groupId = randomUUID()

    const group = await db.insert(groups).values({
      id: groupId,
      name,
      createdBy: user.id,
      inviteCode: randomUUID().slice(0, 8),
    }).returning()

    // Auto-add the creator as a non-guest member
    await db.insert(groupMembers).values({
      id: randomUUID(),
      groupId,
      displayName: user.name,
      isGuest: false,
      userId: user.id,
    })

    return c.json(group[0], 201)
  })

  // ─── GET /groups/join/:code ────────────────────
  // Preview a group before joining. Returns group name
  // and member count so the join page can show what
  // you're about to join. Requires login.
  .get("/join/:code", async (c) => {
    const user = c.get("user")
    const code = c.req.param("code")

    const group = await db.query.groups.findFirst({
      where: eq(groups.inviteCode, code),
      with: { members: true },
    })

    if (!group) {
      return c.json({ error: "Group not found" }, 404)
    }

    const alreadyMember = group.members.some(m => m.userId === user.id)

    return c.json({
      id: group.id,
      name: group.name,
      memberCount: group.members.length,
      alreadyMember,
    })
  })

  // ─── POST /groups/join/:code ───────────────────
  // Join a group by invite code. Adds the logged-in
  // user as a non-guest member. Prevents duplicates.
  .post("/join/:code", async (c) => {
    const user = c.get("user")
    const code = c.req.param("code")

    const group = await db.query.groups.findFirst({
      where: eq(groups.inviteCode, code),
      with: { members: true },
    })

    if (!group) {
      return c.json({ error: "Group not found" }, 404)
    }

    // Check if already a member
    const existing = group.members.find(m => m.userId === user.id)
    if (existing) {
      return c.json({ groupId: group.id, alreadyMember: true })
    }

    await db.insert(groupMembers).values({
      id: randomUUID(),
      groupId: group.id,
      displayName: user.name,
      isGuest: false,
      userId: user.id,
    })

    // Real-time: notify group detail page
    notifyPartyKit(`group-${group.id}`, "member-joined", { displayName: user.name })

    return c.json({ groupId: group.id, alreadyMember: false }, 201)
  })

  // ─── GET /groups/:id ─────────────────────────
  // Get one group's details, including members and bills.
  // Any group member can access it.
  .get("/:id", async (c) => {
    const user = c.get("user")
    const groupId = c.req.param("id")

    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      with: {
        members: true,
        bills: true,
      },
    })

    if (!group) {
      return c.json({ error: "Group not found" }, 404)
    }

    // Check user is a member of this group
    const isMember = group.members.some(m => m.userId === user.id)
    if (!isMember) {
      return c.json({ error: "Group not found" }, 404)
    }

    return c.json(group)
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

    await db.delete(groupMembers).where(
      and(eq(groupMembers.id, memberId), eq(groupMembers.groupId, groupId))
    )

    return c.json({ success: true })
  })

  // ─── DELETE /groups/:id ─────────────────────
  // Delete a group. Only the creator can delete it.
  // Cascade deletes members, bills, items, claims, payments.
  // Rooms linked to this group get groupId set to NULL.
  .delete("/:id", async (c) => {
    const user = c.get("user")
    const groupId = c.req.param("id")

    const group = await db.query.groups.findFirst({
      where: and(eq(groups.id, groupId), eq(groups.createdBy, user.id)),
    })

    if (!group) {
      return c.json({ error: "Group not found" }, 404)
    }

    await db.delete(groups).where(eq(groups.id, groupId))

    return c.json({ success: true })
  })

  // ─── POST /groups/:id/split ────────────────
  // Start a quick split from a group. Creates a room,
  // adds the host, and sends invites to selected group
  // members (who must be logged-in users with userId).
  // Any group member can start a split.
  .post("/:id/split", zValidator("json", startGroupSplitSchema), async (c) => {
    const user = c.get("user")
    const groupId = c.req.param("id")
    const { memberIds } = c.req.valid("json")

    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
      with: { members: true },
    })

    if (!group) {
      return c.json({ error: "Group not found" }, 404)
    }

    // Verify the user is a member
    const isMember = group.members.some(m => m.userId === user.id)
    if (!isMember) {
      return c.json({ error: "Group not found" }, 404)
    }

    // Filter to selected members that are logged-in users (have userId)
    // Exclude the current user (they'll be the host)
    const selected = group.members.filter(
      m => memberIds.includes(m.id) && m.userId && m.userId !== user.id
    )

    const inviteCode = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()
    const [room] = await db.insert(rooms).values({
      hostName: user.name,
      expectedMembers: selected.length + 1,
      inviteCode,
      createdByUserId: user.id,
      groupId,
    }).returning()

    // Add host as room member
    const [hostMember] = await db.insert(roomMembers).values({
      roomId: room.id,
      displayName: user.name,
      isHost: true,
    }).returning()

    // Auto-add selected members to the room AND create invites
    // so they appear on the invited user's /home as a navigation link
    if (selected.length > 0) {
      await db.insert(roomMembers).values(
        selected.map(m => ({
          roomId: room.id,
          displayName: m.displayName,
          isHost: false,
        }))
      )

      await db.insert(roomInvites).values(
        selected.map(m => ({
          roomId: room.id,
          userId: m.userId!,
          invitedBy: user.id,
          displayName: m.displayName,
        }))
      )

      // Notify each invited user's personal channel
      await Promise.all(
        selected.map(m =>
          notifyPartyKit(`user-${m.userId}`, "invite-received", {
            roomInviteCode: inviteCode,
            hostName: user.name,
          })
        )
      )
    }

    setCookie(c, `room_member_${room.id}`, hostMember.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
      path: "/",
      maxAge: 86400,
    })

    return c.json({ room, inviteCode: room.inviteCode }, 201)
  })

export default app
