'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import SpinWheel from '@/app/components/SpinWheel';
import { useToast } from '@/app/components/Toast';

export default function SpinPage() {
  const { data: session } = useSession();
  const [canSpin, setCanSpin] = useState(false);
  const [nextEligibleAt, setNextEligibleAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSpinner, setShowSpinner] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (session?.user?.steamId) {
      fetch('/api/spins')
        .then(res => res.json())
        .then(data => {
          setCanSpin(data.canSpin);
          setNextEligibleAt(data.nextEligibleAt);
          setIsLoading(false);
        });
    }
  }, [session]);

  const handleSpinClick = () => {
    if (canSpin) {
      setShowSpinner(true);
    }
  };

  const onSpinComplete = (reward: number) => {
    toast.success(`You won ${reward} credits!`);
    setShowSpinner(false);
    setCanSpin(false);
    // Refetch eligibility to get the next eligible time
    fetch('/api/spins').then(res => res.json()).then(data => setNextEligibleAt(data.nextEligibleAt));
  };

  if (!session) {
    return (
      <div className="text-center p-10">
        <p>Please sign in to use the daily spin.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center p-10">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-4xl font-bold mb-4">Daily Spin</h1>
      {canSpin ? (
        <button
          onClick={handleSpinClick}
          className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 px-8 rounded-lg text-2xl transition-all"
        >
          Spin Now!
        </button>
      ) : (
        <div className='p-5'>
          <p className="text-xl">You have already spun today. Come back tomorrow!</p>
          {nextEligibleAt && <p>Next spin available in {formatTimeLeft(nextEligibleAt)}</p>}
        </div>
      )}
      {showSpinner && <SpinWheel onSpinComplete={onSpinComplete} />}
    </div>
  );
}
