'use client';

import { LogTrainingButton } from '@/components/log-training-sheet';
import { LogMealButton } from '@/components/log-meal-sheet';
import { LogWeightButton } from '@/components/log-weight-sheet';
import { QuickHydration } from '@/components/quick-hydration';
import { QuickMood } from '@/components/quick-mood';

interface QuickAddRowProps {
  selectedDate: string;
}

export function QuickAddRow({ selectedDate }: QuickAddRowProps) {
  return (
    <div
      role="toolbar"
      aria-label="Registrar"
      className="mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <LogTrainingButton defaultDate={selectedDate} />
      <LogMealButton />
      <LogWeightButton />
      <QuickHydration />
      <QuickMood initialMood={null} initialEnergy={null} />
    </div>
  );
}
