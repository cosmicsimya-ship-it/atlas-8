import { Link } from 'react-router-dom';

import { cn } from '../../utils/cn';

export type ChatInvitation = {
  id: string;
  label: string;
  /** Prefill composer */
  prompt?: string;
  href?: string;
};

export const CHAT_INVITATIONS: ChatInvitation[] = [
  {
    id: 'daily',
    label: 'Bugünü Yorumla',
    prompt: 'Bugünün katmanlarını birlikte okuyalım.',
  },
  {
    id: 'dream',
    label: 'Bir Rüya Anlat',
    prompt: 'Gece gördüğüm bir rüyayı paylaşmak istiyorum.',
  },
  {
    id: 'image',
    label: 'Bir Görüntüyü Anlat',
    prompt: 'Zihnimde kalan bir görüntüyü anlatayım, birlikte okuyalım.',
  },
  { id: 'chart', label: 'Doğum Haritası', href: '/analysis' },
  { id: 'symbolic', label: 'Sembolik Analiz', href: '/analysis/symbolic' },
];

type Props = {
  onSelect: (invitation: ChatInvitation) => void;
  className?: string;
};

export default function ChatInvitations({ onSelect, className }: Props) {
  return (
    <div
      className={cn('flex flex-wrap justify-center gap-2 sm:gap-2.5', className)}
      role="group"
      aria-label="Konuşmaya davetler"
    >
      {CHAT_INVITATIONS.map((item) => {
        const shared =
          'site-focus rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[13px] font-medium tracking-[-0.01em] text-[#c5ccd6] transition duration-200 hover:border-[rgba(142,234,250,0.28)] hover:bg-[rgba(126,182,255,0.07)] hover:text-[#e8ecf2]';

        if (item.href) {
          return (
            <Link key={item.id} to={item.href} className={shared}>
              {item.label}
            </Link>
          );
        }

        return (
          <button key={item.id} type="button" onClick={() => onSelect(item)} className={shared}>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
