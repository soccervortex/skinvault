/**
 * Example component showing how to use Statsig
 * This is a reference - you can delete it or use it as a template
 */

'use client';

import { useGate, useExperiment, logEvent } from '@/app/lib/statsig-client';

interface StatsigExampleProps {
  userId?: string;
  isPro?: boolean;
}

export default function StatsigExample({ userId, isPro }: StatsigExampleProps) {
  // Example: Check if a feature gate is enabled
  const showNewFeature = useGate('new_feature_enabled', userId);
  
  // Example: Get experiment configuration
  const proExperiment = useExperiment('pro_subscription_test', userId);
  
  const handleProClick = () => {
    // Log event for analytics
    logEvent(
      'pro_subscription_clicked',
      undefined,
      { 
        source: 'homepage',
        isPro: isPro || false,
        experiment_variant: proExperiment.variant || 'control'
      },
      userId
    );
  };

  return (
    <div>
      {/* Example: Conditionally show feature based on gate */}
      {showNewFeature && (
        <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <p className="text-sm text-blue-400">New Feature Enabled!</p>
        </div>
      )}
      
      {/* Example: Show different UI based on experiment */}
      {proExperiment.variant === 'variant_a' ? (
        <button 
          onClick={handleProClick}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Upgrade to Pro (Variant A)
        </button>
      ) : (
        <button 
          onClick={handleProClick}
          className="px-4 py-2 bg-indigo-600 text-white rounded"
        >
          Get Pro Access (Variant B)
        </button>
      )}
    </div>
  );
}

