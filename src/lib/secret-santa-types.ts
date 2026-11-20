export type ExclusionInput = { giverId: string; receiverId: string; twoWay: boolean };

export type SecretSantaView = {
    id: string;
    name: string;
    description: string | null;
    isParticipant: boolean;
    recipient: { id: string; name: string; username: string } | null;
    recipientRemoved: boolean;
    participants: { id: string; name: string }[];
    exclusions: { giverId: string; giverName: string; receiverId: string; receiverName: string; twoWay: boolean }[];
    canDelete: boolean;
};
