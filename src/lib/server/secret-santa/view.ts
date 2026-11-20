import type { SecretSantaView } from "../../secret-santa-types";

export type { SecretSantaView };

type UserRef = { id: string; name: string; username: string };

export type SecretSantaRecord = {
    id: string;
    name: string;
    description: string | null;
    createdById: string | null;
    createdAt: Date;
    participants: {
        userId: string;
        recipientId: string | null;
        user: UserRef;
        recipient: UserRef | null;
    }[];
    exclusions: { giverId: string; receiverId: string }[];
};

export function toSecretSantaView(
    record: SecretSantaRecord,
    viewerId: string,
    isManagerOrAdmin: boolean
): SecretSantaView {
    const own = record.participants.find((p) => p.userId === viewerId);
    const names = new Map(record.participants.map((p) => [p.userId, p.user.name]));
    const directed = new Set(record.exclusions.map((e) => `${e.giverId}\u0000${e.receiverId}`));
    const handled = new Set<string>();
    const exclusions: SecretSantaView["exclusions"] = [];

    for (const e of record.exclusions) {
        const key = `${e.giverId}\u0000${e.receiverId}`;
        if (handled.has(key)) continue;
        const reverse = `${e.receiverId}\u0000${e.giverId}`;
        const twoWay = directed.has(reverse);
        handled.add(key);
        handled.add(reverse);
        exclusions.push({
            giverName: names.get(e.giverId) ?? "",
            receiverName: names.get(e.receiverId) ?? "",
            twoWay
        });
    }

    return {
        id: record.id,
        name: record.name,
        description: record.description,
        isParticipant: own !== undefined,
        recipient: own?.recipient
            ? { id: own.recipient.id, name: own.recipient.name, username: own.recipient.username }
            : null,
        recipientRemoved: own !== undefined && own.recipientId === null,
        participants: record.participants.map((p) => ({ id: p.userId, name: p.user.name })),
        exclusions,
        canDelete: isManagerOrAdmin || record.createdById === viewerId
    };
}
