import { useState } from 'preact/hooks';
import type { Sensitivity } from '../../shared/types';

interface OnboardingProps {
  onComplete: (sensitivity: Sensitivity) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [sensitivity, setSensitivity] = useState<Sensitivity>('strict');

  const steps = [
    // Step 1: Welcome
    <div key="welcome" className="flex flex-col items-center text-center px-6">
      <div className="relative w-16 h-16 flex items-center justify-center mb-4">
        <svg viewBox="0 0 32 32" width="64" height="64" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M16 2 L28 7 L28 15 C28 22.5 22.5 28.5 16 30 C9.5 28.5 4 22.5 4 15 L4 7 Z"
            fill="#4f46e5"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg" style={{ paddingBottom: '4px' }}>
          PG
        </span>
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Welcome to PG Patrol
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Making the web family-friendly, one page at a time.
      </p>
    </div>,

    // Step 2: How it works
    <div key="how" className="px-6">
      <h2 className="text-lg font-bold text-center text-gray-900 dark:text-gray-100 mb-4">
        How it works
      </h2>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-indigo-600 dark:text-indigo-400 text-lg mt-0.5">
            <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.5 5.5l-4 4a.75.75 0 01-1.06 0l-2-2a.75.75 0 011.06-1.06L7 8.94l3.44-3.44a.75.75 0 011.06 1.06z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Replaces swear words</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Automatically swaps profanity with funny, family-friendly alternatives
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-indigo-600 dark:text-indigo-400 text-lg mt-0.5">
            <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
              <path d="M3.5 3A1.5 1.5 0 002 4.5v7A1.5 1.5 0 003.5 13h9a1.5 1.5 0 001.5-1.5v-7A1.5 1.5 0 0012.5 3h-9zM5 9.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm7 2H7V11a2.5 2.5 0 015 0v.5z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Detects NSFW images</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              AI-powered image scanning hides inappropriate visual content
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-indigo-600 dark:text-indigo-400 text-lg mt-0.5">
            <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM6.5 5a1 1 0 112 0 1 1 0 01-2 0zm-1 5.5c-.28 0-.5-.22-.5-.5 0-1.66 1.34-3 3-3s3 1.34 3 3c0 .28-.22.5-.5.5h-5z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Hides distressing news</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Good Vibes Mode softens negative and upsetting content
            </p>
          </div>
        </div>
      </div>
    </div>,

    // Step 3: Choose your level
    <div key="level" className="px-6">
      <h2 className="text-lg font-bold text-center text-gray-900 dark:text-gray-100 mb-4">
        Choose your level
      </h2>
      <div className="space-y-2">
        {([
          { value: 'mild' as Sensitivity, label: 'Mild', desc: 'Catches the worst offenders' },
          { value: 'moderate' as Sensitivity, label: 'Moderate', desc: 'Good balance for most families' },
          { value: 'strict' as Sensitivity, label: 'Strict', desc: 'Maximum protection for young kids' },
        ]).map((option) => (
          <button
            key={option.value}
            onClick={() => setSensitivity(option.value)}
            className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
              sensitivity === option.value
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <p className={`text-sm font-medium ${
              sensitivity === option.value
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-gray-900 dark:text-gray-100'
            }`}>
              {option.label}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{option.desc}</p>
          </button>
        ))}
      </div>
    </div>,
  ];

  const isLastStep = step === steps.length - 1;

  return (
    <div className="w-[360px] min-h-[480px] bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      {/* Content */}
      <div className="flex-1 flex items-center justify-center py-8">
        {steps[step]}
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-4" role="tablist" aria-label="Onboarding steps">
        {steps.map((_, i) => (
          <div
            key={i}
            role="tab"
            aria-selected={i === step}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === step ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 px-6 pb-6">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Back
          </button>
        )}
        <button
          onClick={() => {
            if (isLastStep) {
              onComplete(sensitivity);
            } else {
              setStep(step + 1);
            }
          }}
          className="flex-1 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          {isLastStep ? 'Start browsing safely' : 'Next'}
        </button>
      </div>
    </div>
  );
}
