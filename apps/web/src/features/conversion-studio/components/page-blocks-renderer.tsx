import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ButtonAction, PageBlock } from '../types/blocks';
import { resolveButtonHref } from '../utils/blocks';

function CtaLink({
  label,
  action,
  onTrack,
}: {
  label: string;
  action: ButtonAction;
  onTrack?: (ctaType: string) => void;
}) {
  const href = resolveButtonHref(action);
  if (!href) return null;
  const external = href.startsWith('http');
  return (
    <a
      href={href}
      className="inline-flex min-h-11 items-center justify-center rounded-control bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      onClick={() => onTrack?.(action.type)}
    >
      {label}
    </a>
  );
}

export function PageBlocksRenderer({
  blocks,
  onTrack,
  onSubmitForm,
}: {
  blocks: PageBlock[];
  onTrack?: (ctaType: string) => void;
  onSubmitForm?: (payload: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
  }) => Promise<void> | void;
}) {
  return (
    <div className="space-y-6">
      {blocks.map((block) => (
        <section key={block.id} id={`block-${block.id}`} className="scroll-mt-8">
          {renderBlock(block, onTrack, onSubmitForm)}
        </section>
      ))}
    </div>
  );
}

function renderBlock(
  block: PageBlock,
  onTrack?: (ctaType: string) => void,
  onSubmitForm?: (payload: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
  }) => Promise<void> | void,
) {
  switch (block.type) {
    case 'hero':
      return (
        <div className="rounded-control bg-gradient-to-br from-zinc-900 to-zinc-950 p-8">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">{block.headline}</h1>
          {block.subheadline ? <p className="mt-2 text-zinc-400">{block.subheadline}</p> : null}
          {block.cta && block.ctaLabel ? (
            <div className="mt-6">
              <CtaLink label={block.ctaLabel} action={block.cta} onTrack={onTrack} />
            </div>
          ) : null}
        </div>
      );
    case 'rich_text':
      return (
        <div className="space-y-2">
          {block.title ? <h2 className="text-xl font-semibold text-zinc-50">{block.title}</h2> : null}
          <p className="whitespace-pre-wrap text-zinc-300">{block.body}</p>
          {block.bullets?.length ? (
            <ul className="list-disc space-y-1 pl-5 text-zinc-300">
              {block.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    case 'cta_button':
      return <CtaLink label={block.label} action={block.action} onTrack={onTrack} />;
    case 'service_card':
      return (
        <div
          className={cn(
            'rounded-control border border-zinc-800 p-5',
            block.highlight ? 'border-brand-500/40 bg-brand-500/5' : 'bg-zinc-900/40',
          )}
        >
          <h3 className="text-lg font-medium text-zinc-50">{block.title}</h3>
          <p className="mt-2 text-sm text-zinc-400">{block.description}</p>
        </div>
      );
    case 'pricing_cards':
      return (
        <div className="space-y-3">
          {block.title ? <h2 className="text-xl font-semibold text-zinc-50">{block.title}</h2> : null}
          <div className="grid gap-3 md:grid-cols-2">
            {block.cards.map((card) => (
              <div
                key={card.name}
                className={cn(
                  'rounded-control border p-4',
                  card.highlighted ? 'border-brand-500/50 bg-brand-500/10' : 'border-zinc-800',
                )}
              >
                <p className="font-medium text-zinc-50">{card.name}</p>
                <p className="mt-1 text-2xl text-brand-300">{card.price}</p>
                {card.description ? <p className="mt-2 text-sm text-zinc-400">{card.description}</p> : null}
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-400">
                  {card.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );
    case 'testimonials':
      return (
        <div className="space-y-3">
          {block.title ? <h2 className="text-xl font-semibold text-zinc-50">{block.title}</h2> : null}
          {block.items.map((item) => (
            <blockquote key={item.author + item.quote} className="rounded-control border border-zinc-800 p-4">
              <p className="text-zinc-200">“{item.quote}”</p>
              <footer className="mt-2 text-sm text-zinc-500">
                {item.author}
                {item.role ? ` — ${item.role}` : ''}
              </footer>
            </blockquote>
          ))}
        </div>
      );
    case 'gallery':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {block.images.map((image) => (
            <img
              key={image.url + image.alt}
              src={image.url}
              alt={image.alt}
              className="h-40 w-full rounded-control object-cover"
            />
          ))}
        </div>
      );
    case 'faq':
      return (
        <div className="space-y-2">
          {block.title ? <h2 className="text-xl font-semibold text-zinc-50">{block.title}</h2> : null}
          {block.items.map((item) => (
            <details key={item.question} className="rounded-control border border-zinc-800 p-3">
              <summary className="cursor-pointer font-medium text-zinc-100">{item.question}</summary>
              <p className="mt-2 text-sm text-zinc-400">{item.answer}</p>
            </details>
          ))}
        </div>
      );
    case 'contact_form':
      return (
        <form
          className="space-y-3 rounded-control border border-zinc-800 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void onSubmitForm?.({
              name: String(form.get('name') ?? '') || undefined,
              email: String(form.get('email') ?? '') || undefined,
              phone: String(form.get('phone') ?? '') || undefined,
              message: String(form.get('message') ?? '') || undefined,
            });
          }}
        >
          {block.title ? <h2 className="text-lg font-semibold text-zinc-50">{block.title}</h2> : null}
          {block.fields.includes('name') ? (
            <label className="block text-sm text-zinc-400">
              Nome
              <input name="name" className="mt-1 w-full rounded-control border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
            </label>
          ) : null}
          {block.fields.includes('email') ? (
            <label className="block text-sm text-zinc-400">
              E-mail
              <input name="email" type="email" className="mt-1 w-full rounded-control border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
            </label>
          ) : null}
          {block.fields.includes('phone') ? (
            <label className="block text-sm text-zinc-400">
              Telefone
              <input name="phone" className="mt-1 w-full rounded-control border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
            </label>
          ) : null}
          {block.fields.includes('message') ? (
            <label className="block text-sm text-zinc-400">
              Mensagem
              <textarea name="message" rows={4} className="mt-1 w-full rounded-control border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100" />
            </label>
          ) : null}
          <input type="text" name="companyWebsite" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <p className="text-xs text-zinc-500">{block.privacyNotice}</p>
          <Button type="submit">{block.submitLabel}</Button>
        </form>
      );
    case 'map_address':
      return (
        <div>
          {block.title ? <h2 className="text-lg font-semibold text-zinc-50">{block.title}</h2> : null}
          <p className="mt-1 text-zinc-300">{block.address}</p>
        </div>
      );
    case 'footer':
      return (
        <footer className="border-t border-zinc-800 pt-4 text-sm text-zinc-500">
          {block.text}
          {block.showProspectlyBrand ? <span className="ml-2">· Powered by Prospectly</span> : null}
        </footer>
      );
    case 'spacer':
      return <div className={block.size === 'sm' ? 'h-4' : block.size === 'lg' ? 'h-16' : 'h-8'} aria-hidden />;
  }
}
