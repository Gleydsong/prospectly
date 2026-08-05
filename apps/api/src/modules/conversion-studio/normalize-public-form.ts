/**
 * AI-generated pt-BR landings often emit Portuguese input names.
 * Map common aliases onto the canonical PublicFormSubmitDto fields.
 */
const NAME_KEYS = ['name', 'nome', 'fullname', 'full_name', 'fullname', 'seu_nome', 'your_name'];
const EMAIL_KEYS = ['email', 'e-mail', 'e_mail', 'correio'];
const PHONE_KEYS = [
  'phone',
  'telefone',
  'tel',
  'celular',
  'whatsapp',
  'mobile',
  'fone',
  'telemovel',
  'telemóvel',
];
const MESSAGE_KEYS = [
  'message',
  'mensagem',
  'msg',
  'comentario',
  'comentário',
  'comments',
  'notes',
  'nota',
];
const HONEYPOT_KEYS = ['companyWebsite', 'company_website', 'website', 'url', 'honeypot'];

function normalizeKey(key: string): string {
  return key.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[\s_-]+/g, '');
}

function pick(raw: Record<string, unknown>, aliases: string[]): string | undefined {
  const entries = Object.entries(raw).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' && entry[1].trim().length > 0,
  );
  // Alias order is preference order (canonical English keys first).
  for (const alias of aliases) {
    const target = normalizeKey(alias);
    const found = entries.find(([key]) => normalizeKey(key) === target);
    if (found) return found[1].trim();
  }
  return undefined;
}

export type NormalizedPublicForm = {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  companyWebsite?: string;
};

export function normalizePublicFormFields(raw: Record<string, unknown>): NormalizedPublicForm {
  return {
    name: pick(raw, NAME_KEYS),
    email: pick(raw, EMAIL_KEYS),
    phone: pick(raw, PHONE_KEYS),
    message: pick(raw, MESSAGE_KEYS),
    companyWebsite: pick(raw, HONEYPOT_KEYS),
  };
}
