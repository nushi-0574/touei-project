'use client';

import { useLocale } from '../../lib/i18n';

export default function SkipLink() {
  const { t } = useLocale();
  return (
    <a
      className="skip-link"
      href="#main-content"
      onClick={(event) => {
        const main = document.querySelector('main');
        if (!main) return;
        event.preventDefault();
        main.id = 'main-content';
        main.tabIndex = -1;
        main.focus();
        main.scrollIntoView();
      }}
    >
      {t('skipToContent')}
    </a>
  );
}
