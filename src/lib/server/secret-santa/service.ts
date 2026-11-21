import { error } from "@sveltejs/kit";
import { client } from "$lib/server/prisma";
import { Role } from "$lib/schema";
import { toSecretSantaView, type SecretSantaView } from "./view";
import { draw } from "./draw";
import { expandExclusions, type CreateInput } from "./input";

export class NoValidDrawError extends Error {}
export class InvalidParticipantError extends Error {}

export async function createSecretSanta(
    groupId: string,
    creatorId: string,
    input: CreateInput
): Promise<{ id: string }> {
    const members = await client.userGroupMembership.findMany({
        where: { groupId, userId: { in: input.participantIds } },
        select: { userId: true },
        distinct: ["userId"]
    });
    const memberIds = new Set(members.map((m) => m.userId));
    if (!input.participantIds.every((id) => memberIds.has(id))) {
        throw new InvalidParticipantError("Participant is not a member of the group");
    }

    const exclusions = expandExclusions(input.exclusions);
    const assignments = draw(input.participantIds, exclusions);
    if (!assignments) {
        throw new NoValidDrawError("No valid draw possible");
    }

    return client.$transaction(async (tx) => {
        const created = await tx.secretSanta.create({
            data: {
                name: input.name,
                description: input.description,
                groupId,
                createdById: creatorId,
                participants: {
                    create: input.participantIds.map((userId) => ({
                        userId,
                        recipientId: assignments.get(userId)!
                    }))
                },
                exclusions: {
                    create: exclusions.map(([giverId, receiverId]) => ({ giverId, receiverId }))
                }
            },
            select: { id: true }
        });
        return created;
    });
}

type Viewer = { id: string; roleId: number };

const userSelect = { id: true, name: true, username: true } as const;
const viewInclude = {
    participants: { include: { user: { select: userSelect }, recipient: { select: userSelect } } },
    exclusions: true
} as const;

async function isManagerOrAdmin(groupId: string, viewer: Viewer): Promise<boolean> {
    if (viewer.roleId === Role.ADMIN) return true;
    const membership = await client.userGroupMembership.findFirst({
        where: { groupId, userId: viewer.id },
        select: { roleId: true }
    });
    return membership?.roleId === Role.GROUP_MANAGER;
}

export async function listSecretSantasForViewer(groupId: string, viewer: Viewer): Promise<SecretSantaView[]> {
    const manager = await isManagerOrAdmin(groupId, viewer);
    const records = await client.secretSanta.findMany({
        where: {
            groupId,
            ...(manager ? {} : { OR: [{ createdById: viewer.id }, { participants: { some: { userId: viewer.id } } }] })
        },
        include: viewInclude,
        orderBy: { createdAt: "desc" }
    });
    return records.map((record) => toSecretSantaView(record, viewer.id, manager));
}

export async function deleteSecretSanta(id: string, groupId: string, viewer: Viewer): Promise<void> {
    const found = await client.secretSanta.findFirst({
        where: { id, groupId },
        select: { createdById: true }
    });
    if (!found) error(404, "Not found");
    if (found.createdById !== viewer.id && !(await isManagerOrAdmin(groupId, viewer))) {
        error(403, "Forbidden");
    }
    await client.secretSanta.delete({ where: { id } });
}
