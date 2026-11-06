'use client';

import Link from 'next/link';

type LegalConsentFieldProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  error?: string;
};

export default function LegalConsentField({
  checked,
  onChange,
  disabled = false,
  error,
}: LegalConsentFieldProps) {
  return (
    <div>
      <label className="flex items-start gap-3 text-sm leading-6 text-slate-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          required
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'legal-consent-error' : undefined}
          className="mt-1 size-4 shrink-0 accent-blue-700"
        />
        <span>
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
            利用規約
          </Link>
          および
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">
            プライバシーポリシー
          </Link>
          を確認し、同意します。
        </span>
      </label>
      {error && <p id="legal-consent-error" role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
