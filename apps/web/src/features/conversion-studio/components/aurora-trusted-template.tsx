import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Check, Quote } from 'lucide-react';
import { useRef } from 'react';

import type { ButtonAction, PageBlock } from '../types/blocks';

gsap.registerPlugin(useGSAP, ScrollTrigger);

type Props = {
  title: string;
  blocks: PageBlock[];
  onTrack?: (type: string) => void;
  onSubmit?: (payload: { name?: string; email?: string; phone?: string; message?: string }) => Promise<void>;
  preview?: boolean;
};

function actionHref(action: ButtonAction) {
  if (action.type === 'anchor') return `#${action.anchor}`;
  if (action.type === 'call') return `tel:${action.phone.replace(/\D/g, '')}`;
  if (action.type === 'email') return `mailto:${action.email}`;
  if (action.type === 'external_url' || action.type === 'calendar') return action.url;
  if (action.type === 'whatsapp') return `https://wa.me/${action.phone.replace(/\D/g, '')}`;
  return '#contacto';
}

export function AuroraTrustedTemplate({ title, blocks, onTrack, onSubmit, preview = false }: Props) {
  const root = useRef<HTMLElement>(null);
  const hero = blocks.find((block) => block.type === 'hero');
  const sections = blocks.filter((block) => !['hero', 'footer', 'spacer'].includes(block.type));
  const footer = blocks.find((block) => block.type === 'footer');
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useGSAP(() => {
    if (reduce) return;
    gsap.from('[data-aurora-hero]', { opacity: 0, y: 28, duration: 0.7, ease: 'power2.out', stagger: 0.1 });
    gsap.utils.toArray<HTMLElement>('[data-aurora-reveal]').forEach((element) => {
      gsap.from(element, { opacity: 0, y: 30, duration: 0.55, ease: 'power2.out', scrollTrigger: { trigger: element, start: 'top 84%', once: true } });
    });
  }, { scope: root, dependencies: [blocks.length], revertOnUpdate: true });

  const renderAction = (label: string, action?: ButtonAction) => {
    if (!action) return null;
    return <a href={actionHref(action)} onClick={() => onTrack?.(action.type)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500">{label}<ArrowRight className="h-4 w-4" /></a>;
  };

  return <main ref={root} className="min-h-screen overflow-x-hidden bg-[#090b12] font-sans text-slate-100 selection:bg-blue-400/30">
    <section className="relative isolate min-h-[46rem] overflow-hidden px-5 pb-16 pt-6 sm:px-8 lg:px-12">
      {hero?.type === 'hero' && hero.imageUrl ? <img src={hero.imageUrl} alt={hero.imageAlt || ''} className="absolute inset-0 -z-20 h-full w-full object-cover opacity-45" /> : null}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_10%,rgba(37,99,235,.42),transparent_38%),linear-gradient(180deg,rgba(9,11,18,.25),#090b12_92%)]" />
      <nav data-aurora-hero className="mx-auto flex max-w-6xl items-center justify-between"><span className="text-base font-semibold tracking-tight">{title}</span><a href="#contacto" className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Contacto</a></nav>
      <div className="mx-auto flex min-h-[38rem] max-w-6xl items-end py-16"><div className="max-w-3xl"><p data-aurora-hero className="mb-5 text-xs font-bold uppercase tracking-[.22em] text-blue-200">Presença que converte</p><h1 data-aurora-hero className="max-w-3xl text-5xl font-semibold tracking-[-.05em] sm:text-7xl">{hero?.type === 'hero' ? hero.headline : title}</h1>{hero?.type === 'hero' && hero.subheadline ? <p data-aurora-hero className="mt-6 max-w-xl text-lg leading-8 text-slate-300">{hero.subheadline}</p> : null}<div data-aurora-hero className="mt-9">{hero?.type === 'hero' ? renderAction(hero.ctaLabel || 'Falar agora', hero.cta) : null}</div></div></div>
    </section>
    <div className="mx-auto max-w-6xl space-y-20 px-5 py-20 sm:px-8 lg:px-12">
      {sections.map((block) => <section key={block.id} id={`block-${block.id}`} data-aurora-reveal>{block.type === 'rich_text' ? <div className="max-w-3xl"><p className="text-sm font-semibold text-blue-300">{block.title}</p><p className="mt-4 text-2xl leading-9 text-slate-200">{block.body}</p>{block.bullets ? <ul className="mt-7 grid gap-3 sm:grid-cols-2">{block.bullets.map((item) => <li key={item} className="flex gap-3 text-slate-300"><Check className="mt-1 h-4 w-4 text-blue-400" />{item}</li>)}</ul> : null}</div> : null}{block.type === 'service_card' ? <article className="rounded-3xl border border-white/10 bg-white/[.035] p-8 sm:p-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-300">Serviço</p><h2 className="mt-4 text-3xl font-semibold">{block.title}</h2><p className="mt-4 leading-7 text-slate-300">{block.description}</p></article> : null}{block.type === 'gallery' ? <div><h2 className="text-3xl font-semibold">{block.title}</h2><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{block.images.map((image) => <img key={image.url} src={image.url} alt={image.alt} loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover" />)}</div></div> : null}{block.type === 'testimonials' ? <div><h2 className="text-3xl font-semibold">{block.title}</h2><div className="mt-7 grid gap-4 md:grid-cols-2">{block.items.map((item) => <blockquote key={item.author} className="rounded-2xl border border-white/10 p-6"><Quote className="h-5 w-5 text-blue-300" /><p className="mt-4 leading-7 text-slate-200">“{item.quote}”</p><footer className="mt-5 text-sm text-slate-400">{item.author}{item.role ? ` · ${item.role}` : ''}</footer></blockquote>)}</div></div> : null}{block.type === 'faq' ? <div className="max-w-3xl"><h2 className="text-3xl font-semibold">{block.title}</h2><div className="mt-6 divide-y divide-white/10">{block.items.map((item) => <details key={item.question} className="py-5"><summary className="cursor-pointer font-medium">{item.question}</summary><p className="mt-3 leading-7 text-slate-300">{item.answer}</p></details>)}</div></div> : null}{block.type === 'contact_form' ? <form id="contacto" className="rounded-3xl bg-blue-600 p-7 text-white sm:p-10" onSubmit={(event) => { event.preventDefault(); if (preview || !onSubmit) return; const data = new FormData(event.currentTarget); void onSubmit({ name: String(data.get('name') || ''), email: String(data.get('email') || ''), phone: String(data.get('phone') || ''), message: String(data.get('message') || '') }); }}><h2 className="text-3xl font-semibold">{block.title || 'Vamos conversar?'}</h2><div className="mt-6 grid gap-3 sm:grid-cols-2">{block.fields.map((field) => <label key={field} className={field === 'message' ? 'sm:col-span-2' : ''}><span className="sr-only">{field}</span>{field === 'message' ? <textarea name={field} placeholder="Mensagem" className="min-h-28 w-full rounded-xl bg-white px-4 py-3 text-slate-950" /> : <input name={field} type={field === 'email' ? 'email' : 'text'} placeholder={field === 'phone' ? 'Telefone' : field === 'email' ? 'E-mail' : 'Nome'} className="h-12 w-full rounded-xl bg-white px-4 text-slate-950" />}</label>)}</div><button className="mt-4 min-h-11 rounded-full bg-slate-950 px-5 py-3 font-semibold">{block.submitLabel}</button><p className="mt-4 text-xs text-blue-100">{block.privacyNotice}</p></form> : null}</section>)}
    </div><footer className="border-t border-white/10 px-5 py-10 text-center text-sm text-slate-500">{footer?.type === 'footer' && footer.text ? footer.text : `© ${title}`}</footer>
  </main>;
}
