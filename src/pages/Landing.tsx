// HealthVault — Landing / splash screen for first-time visitors

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, changeLanguage } from '../i18n';

const SLIDE_ICONS = ['🛡️', '🍎', '🩺', '🔒', '💬', '🚀'];

export default function Landing() {
  const { t, i18n } = useTranslation();
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();
  const isLast = current === SLIDE_ICONS.length - 1;

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language);
  const nextLang = SUPPORTED_LANGUAGES.find((l) => l.code !== i18n.language);

  const next = () => {
    if (isLast) {
      navigate('/onboarding');
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const skip = () => navigate('/onboarding');

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-between px-6 py-12 text-center select-none">
      {/* Top bar: language toggle + skip */}
      <div className="w-full flex justify-between items-center">
        <button
          onClick={() => {
            if (nextLang) changeLanguage(nextLang.code);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm transition-colors cursor-pointer"
        >
          <span>{currentLang?.flag}</span>
          <span>{currentLang?.label}</span>
        </button>
        <button
          onClick={skip}
          className="text-surface-400 hover:text-surface-200 text-sm transition-colors cursor-pointer"
        >
          {t('landing.skip')}
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto gap-6">
        <div className="text-7xl" aria-hidden="true">
          {SLIDE_ICONS[current]}
        </div>
        <h1 className="text-2xl font-bold text-white leading-tight">
          {t(`landing.slides.${current}.title`)}
        </h1>
        <p className="text-surface-300 text-base leading-relaxed">
          {t(`landing.slides.${current}.description`)}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        {/* Dots */}
        <div className="flex gap-2">
          {SLIDE_ICONS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                i === current
                  ? 'w-6 bg-primary-500'
                  : 'w-2 bg-surface-600 hover:bg-surface-500'
              }`}
              aria-label={t('landing.goToSlide', { n: i + 1 })}
            />
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={next}
          className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-lg transition-colors cursor-pointer"
        >
          {isLast ? t('landing.getStarted') : t('landing.next')}
        </button>
      </div>
    </div>
  );
}
