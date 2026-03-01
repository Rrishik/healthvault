// HealthVault — Landing / splash screen for first-time visitors

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SLIDES = [
  {
    icon: '🛡️',
    title: 'Welcome to HealthVault',
    description:
      'Your personal health assistant that helps you make safer food choices and answers health questions — all personalized to you.',
  },
  {
    icon: '🍎',
    title: 'Scan Food, Get Verdicts',
    description:
      'Type ingredients, upload a photo, or snap a food label. HealthVault tells you if something is safe, needs caution, or should be avoided — based on your specific health needs.',
  },
  {
    icon: '🩺',
    title: 'Why We Ask for Your Info',
    description:
      'To give you personalized advice, we\'ll ask about your conditions, allergies, medications, and dietary goals. A peanut allergy changes everything about a snack bar\'s safety rating.',
  },
  {
    icon: '🔒',
    title: 'Your Data Never Leaves',
    description:
      'Everything is stored locally in your browser — not on any server. No accounts, no sign-ups, no cloud sync. Your health info stays on your device, period.',
  },
  {
    icon: '💬',
    title: 'Chat About Your Health',
    description:
      'Ask questions about nutrition, medications, or wellness. The AI uses your profile to give answers that actually apply to you, not generic advice.',
  },
  {
    icon: '🚀',
    title: 'Let\'s Set You Up',
    description:
      'Next, we\'ll walk you through a quick setup: pick an AI provider (the free Community option works great) and optionally add your health details. Takes about 2 minutes.',
  },
];

export default function Landing() {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();
  const isLast = current === SLIDES.length - 1;

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
      {/* Skip button */}
      <div className="w-full flex justify-end">
        <button
          onClick={skip}
          className="text-surface-400 hover:text-surface-200 text-sm transition-colors cursor-pointer"
        >
          Skip
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto gap-6">
        <div className="text-7xl" aria-hidden="true">
          {SLIDES[current].icon}
        </div>
        <h1 className="text-2xl font-bold text-white leading-tight">
          {SLIDES[current].title}
        </h1>
        <p className="text-surface-300 text-base leading-relaxed">
          {SLIDES[current].description}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        {/* Dots */}
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                i === current
                  ? 'w-6 bg-primary-500'
                  : 'w-2 bg-surface-600 hover:bg-surface-500'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={next}
          className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-lg transition-colors cursor-pointer"
        >
          {isLast ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  );
}
