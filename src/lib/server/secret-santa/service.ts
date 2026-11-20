import { client } from "$lib/server/prisma";
import { draw } from "./draw";
import { expandExclusions, type CreateInput } from "./input";

export class NoValidDrawError extends Error {}
export class InvalidParticipantError extends Error {}

export async function createSecretSanta(
    groupId: string,
    creatorId: string,
    input: CreateInput
): Promise<{ id: string }> {
    const memberCount = await client.userGroupMembership.count({
        where: { groupId, userId: { in: input.participantIds } }
    });
    if (memberCount !== new Set(input.participantIds).size) {
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
