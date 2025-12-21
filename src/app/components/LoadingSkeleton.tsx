"use client";

export function ItemCardSkeleton() {
  return (
    <div className="bg-[#11141d] p-3 md:p-4 lg:p-5 rounded-[1.5rem] md:rounded-[2rem] lg:rounded-[2.5rem] border border-white/5 animate-pulse">
      <div className="aspect-square bg-black/20 rounded-[1.5rem] md:rounded-[2rem] mb-3 md:mb-4" />
      <div className="h-4 bg-gray-700/50 rounded mb-2" />
      <div className="h-3 bg-gray-700/30 rounded w-2/3" />
    </div>
  );
}

export function InventoryItemSkeleton() {
  return (
    <div className="bg-[#11141d] p-4 md:p-7 rounded-[1.5rem] md:rounded-[2.5rem] border border-white/5 animate-pulse">
      <div className="w-full h-24 md:h-32 bg-black/20 rounded mb-4 md:mb-6" />
      <div className="h-3 bg-gray-700/50 rounded mb-2" />
      <div className="h-4 bg-gray-700/30 rounded w-1/2" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-[#11141d] p-3 md:p-4 lg:p-5 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 animate-pulse">
      <div className="h-3 bg-gray-700/50 rounded w-1/3 mb-2 md:mb-3" />
      <div className="h-6 md:h-8 bg-gray-700/30 rounded w-1/2" />
    </div>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="bg-[#11141d] p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem] border border-white/5 shadow-2xl animate-pulse">
      <div className="flex items-center gap-4 md:gap-6">
        <div className="w-16 h-16 md:w-24 md:h-24 rounded-[1.5rem] md:rounded-[2.5rem] bg-gray-700/50" />
        <div className="flex-1 space-y-3">
          <div className="h-6 md:h-8 bg-gray-700/50 rounded w-1/2" />
          <div className="h-4 bg-gray-700/30 rounded w-1/3" />
        </div>
      </div>
    </div>
  );
}

