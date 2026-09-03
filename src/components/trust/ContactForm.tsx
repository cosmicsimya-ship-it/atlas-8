/**
 * Shared Contact/Support submission form. Persists to the server-side
 * contact store (server/contact/store.js) — a real, safe, persistent
 * backend path, not a decorative form. Does not send email; the success
 * state says so honestly rather than implying a confirmation email exists.
 */

import { useState, type FormEvent } from 'react';
import { Loader2, Send } from 'lucide-react';

import { CONTACT_TOPICS, type ContactTopicOption } from '../../data/trust-content';
import { submitContactMessage, type ContactTopic } from '../../services/atlas-contact';

type SubmitState = 'idle' | 'submitting' | 'sent' | 'error';

export default function ContactForm({
  defaultTopic = 'general',
  topics = CONTACT_TOPICS,
}: {
  defaultTopic?: ContactTopic;
  topics?: ContactTopicOption[];
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<ContactTopic>(defaultTopic);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — must stay empty
  const [state, setState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);

  const messageTooShort = message.trim().length > 0 && message.trim().length < 10;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (state === 'submitting') return;
    setState('submitting');
    setError(null);
    const result = await submitContactMessage({
      name: name.trim() || undefined,
      email: email.trim(),
      topic,
      message: message.trim(),
      route: window.location.hash.replace(/^#/, '') || window.location.pathname,
      website,
    });
    if (result.ok) {
      setState('sent');
      setName('');
      setEmail('');
      setMessage('');
    } else {
      setState('error');
      setError(result.error);
    }
  }

  if (state === 'sent') {
    return (
      <div className="rounded-xl border border-[#c9b37a]/25 bg-[#c9b37a]/[0.06] p-5">
        <p className="text-sm font-medium text-[#e5e8ec]">Mesajın kaydedildi.</p>
        <p className="mt-2 text-[13px] leading-6 text-[#a7afbc]">
          Destek ekibi başvuruları gönderim sırasına göre inceler. Şu an için otomatik bir e-posta
          onayı gönderilmemektedir — bu formu yalnızca kayıt amacıyla kullanıyoruz.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {/* Honeypot — hidden from real visitors, never remove aria-hidden/tabIndex. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
        <label htmlFor="website">Web sitesi</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="block text-[11px] uppercase tracking-[0.14em] text-[#8b93a3]">
            İsim (opsiyonel)
          </label>
          <input
            id="contact-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="atlas-focus mt-2 w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-3.5 py-2.5 text-sm text-[#e5e8ec] placeholder:text-[#565d6a] focus:border-[#c9b37a]/40"
            placeholder="Adın"
          />
        </div>
        <div>
          <label htmlFor="contact-email" className="block text-[11px] uppercase tracking-[0.14em] text-[#8b93a3]">
            E-posta *
          </label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="atlas-focus mt-2 w-full rounded-lg border border-white/[0.1] bg-white/[0.02] px-3.5 py-2.5 text-sm text-[#e5e8ec] placeholder:text-[#565d6a] focus:border-[#c9b37a]/40"
            placeholder="sen@ornek.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="contact-topic" className="block text-[11px] uppercase tracking-[0.14em] text-[#8b93a3]">
          Konu
        </label>
        <select
          id="contact-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value as ContactTopic)}
          className="atlas-focus mt-2 w-full rounded-lg border border-white/[0.1] bg-[#0b0c10] px-3.5 py-2.5 text-sm text-[#e5e8ec] focus:border-[#c9b37a]/40"
        >
          {topics.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-[11px] uppercase tracking-[0.14em] text-[#8b93a3]">
          Mesaj *
        </label>
        <textarea
          id="contact-message"
          required
          minLength={10}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="atlas-focus mt-2 w-full resize-y rounded-lg border border-white/[0.1] bg-white/[0.02] px-3.5 py-2.5 text-sm leading-6 text-[#e5e8ec] placeholder:text-[#565d6a] focus:border-[#c9b37a]/40"
          placeholder="Nasıl yardımcı olabiliriz?"
        />
        {messageTooShort ? (
          <p className="mt-1.5 text-[12px] text-[#9aa3b2]">En az 10 karakter yaz.</p>
        ) : null}
      </div>

      {error ? <p className="text-[13px] leading-6 text-rose-300/90">{error}</p> : null}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="atlas-focus inline-flex items-center gap-2 rounded-lg border border-[#d5c184]/40 bg-[#d5c184]/14 px-5 py-2.5 text-sm font-medium text-[#f4ecd7] transition hover:bg-[#d5c184]/20 disabled:cursor-wait disabled:opacity-60"
      >
        {state === 'submitting' ? (
          <>
            <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Gönderiliyor…
          </>
        ) : (
          <>
            <Send size={14} aria-hidden="true" /> Gönder
          </>
        )}
      </button>
    </form>
  );
}
