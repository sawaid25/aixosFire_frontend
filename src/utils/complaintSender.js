/**
 * Label for a complaint reply sent by an Internal Team member, e.g.
 * "Sara Khan · Support Lead". Returns null for every other message (Admin, AI, user),
 * so callers keep their existing labels. sender_* are written only by the backend
 * (DB trigger complaints_guard_team_sender clears them on browser writes).
 */
export const teamSenderLabel = (message) => {
    if (!message?.sender_team_member_id) return null;
    return `${message.sender_name || 'Team member'} · ${message.sender_designation || 'Internal Team'}`;
};
