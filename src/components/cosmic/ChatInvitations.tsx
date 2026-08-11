/**
 * @deprecated Replaced by PatternGapTraces discovery questions. Kept for import safety.
 * Do not use for new UI — engine-named / full-sentence invitations are out of scope.
 */
export type ChatInvitation = {
  id: string;
  label: string;
  prompt?: string;
  href?: string;
};

/** Empty — invitations removed in favor of lived traces. */
export const CHAT_INVITATIONS: ChatInvitation[] = [];

type Props = {
  onSelect: (invitation: ChatInvitation) => void;
  className?: string;
};

export default function ChatInvitations(_props: Props) {
  return null;
}
