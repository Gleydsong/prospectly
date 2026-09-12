'use client';

import { CaretDown } from '@phosphor-icons/react';
import { useState } from 'react';

export type FaqAccordionItem = {
  id: string;
  question: string;
  answer: string;
};

export function FaqAccordion({ items }: { items: readonly FaqAccordionItem[] }) {
  const [openId, setOpenId] = useState(items[0]?.id ?? '');
  return (
    <div className="landing-v2-faq-list landing-v2-reveal">
      {items.map((item) => {
        const isOpen = openId === item.id;
        const buttonId = `landing-v2-faq-${item.id}-button`;
        const panelId = `landing-v2-faq-${item.id}-panel`;
        return (
          <div key={item.id} className="landing-v2-faq-item">
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenId(isOpen ? '' : item.id)}
              >
                <span>{item.question}</span>
                <CaretDown weight="bold" aria-hidden className={isOpen ? 'is-open' : ''} />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen}>
              <p>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
