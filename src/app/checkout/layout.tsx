import React, { Suspense } from 'react';

type Props = {
  children: React.ReactNode;
};

export default function CheckoutLayout({ children }: Props) {
  return (
    <Suspense
      fallback={(
        <div className="min-h-dvh bg-[#08090d] text-white font-sans flex items-center justify-center">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Loading checkout...</div>
        </div>
      )}
    >
      {children}
    </Suspense>
  );
}
