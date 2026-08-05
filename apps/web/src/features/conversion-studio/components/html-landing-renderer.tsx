import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

type HtmlLandingRendererProps = {
  html: string;
  title?: string;
  className?: string;
  minHeight?: number;
  onFormSubmit?: (payload: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    companyWebsite?: string;
  }) => void | Promise<void>;
};

const BRIDGE_SOURCE = 'prospectly-landing';

/**
 * Isolates AI-generated HTML in a sandboxed iframe.
 * Scripts from page HTML are stripped by the API; we inject a tiny bridge for
 * form capture + height sync. `allow-same-origin` is intentionally omitted so
 * injected scripts cannot touch the parent origin.
 */
export function HtmlLandingRenderer({
  html,
  title = 'Landing',
  className,
  minHeight = 720,
  onFormSubmit,
}: HtmlLandingRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);
  const onFormSubmitRef = useRef(onFormSubmit);
  onFormSubmitRef.current = onFormSubmit;

  const srcDoc = useMemo(() => {
    const trimmed = html.trim();
    if (!trimmed) return '';
    const bridge = buildBridgeScript();
    if (/<!DOCTYPE html>/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
      if (/<\/body>/i.test(trimmed)) {
        return trimmed.replace(/<\/body>/i, `${bridge}</body>`);
      }
      return `${trimmed}${bridge}`;
    }
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeAttr(title)}</title></head><body>${trimmed}${bridge}</body></html>`;
  }, [html, title]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | {
            source?: string;
            type?: string;
            height?: number;
            payload?: Record<string, string>;
          }
        | null;
      if (!data || data.source !== BRIDGE_SOURCE) return;
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;

      if (data.type === 'resize' && typeof data.height === 'number') {
        setHeight(Math.max(minHeight, Math.ceil(data.height)));
        return;
      }
      if (data.type === 'form_submit' && data.payload && onFormSubmitRef.current) {
        void onFormSubmitRef.current(normalizeFormPayload(data.payload));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [minHeight, srcDoc]);

  if (!srcDoc) {
    return (
      <div className={cn('rounded-control border border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-500', className)}>
        Pré-visualização HTML indisponível
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-forms allow-scripts allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      className={cn('w-full overflow-hidden rounded-control border border-zinc-800 bg-white', className)}
      style={{ height, minHeight }}
    />
  );
}

function buildBridgeScript(): string {
  // Keep this self-contained; no template interpolation of user data.
  return `<script>(function(){
var SOURCE=${JSON.stringify(BRIDGE_SOURCE)};
function post(msg){try{parent.postMessage(Object.assign({source:SOURCE},msg),'*');}catch(e){}}
function sendHeight(){
  var h=Math.max(document.documentElement?document.documentElement.scrollHeight:0,document.body?document.body.scrollHeight:0);
  post({type:'resize',height:h});
}
document.addEventListener('submit',function(ev){
  var form=ev.target;
  if(!form||form.tagName!=='FORM')return;
  ev.preventDefault();
  var payload={};
  try{
    var fd=new FormData(form);
    fd.forEach(function(value,key){payload[String(key)]=String(value);});
  }catch(e){}
  post({type:'form_submit',payload:payload});
},true);
if(document.readyState==='complete')sendHeight();
else window.addEventListener('load',sendHeight);
window.addEventListener('resize',sendHeight);
setInterval(sendHeight,1000);
})();</script>`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s_-]+/g, '');
}

function pickAlias(payload: Record<string, string>, aliases: string[]): string | undefined {
  const entries = Object.entries(payload).filter(([, value]) => Boolean(value?.trim()));
  for (const alias of aliases) {
    const target = normalizeKey(alias);
    const found = entries.find(([key]) => normalizeKey(key) === target);
    if (found?.[1]?.trim()) return found[1].trim();
  }
  return undefined;
}

/** AI pt-BR landings often use nome/telefone/mensagem — map to API fields. */
export function normalizeFormPayload(payload: Record<string, string>): {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  companyWebsite?: string;
} {
  return {
    name: pickAlias(payload, ['name', 'nome', 'fullname', 'full_name', 'fullname', 'seu_nome', 'your_name']),
    email: pickAlias(payload, ['email', 'e-mail', 'e_mail', 'correio']),
    phone: pickAlias(payload, [
      'phone',
      'telefone',
      'tel',
      'celular',
      'whatsapp',
      'mobile',
      'fone',
      'telemovel',
      'telemóvel',
    ]),
    message: pickAlias(payload, [
      'message',
      'mensagem',
      'msg',
      'comentario',
      'comentário',
      'comments',
      'notes',
      'nota',
    ]),
    companyWebsite: pickAlias(payload, [
      'companyWebsite',
      'company_website',
      'website',
      'url',
      'honeypot',
    ]),
  };
}
