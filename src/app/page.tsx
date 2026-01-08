import { Suspense } from 'react';
import ForgeDemo from '@/components/ForgeDemo';

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-screen bg-zinc-950">
      <div className="text-zinc-400">Loading...</div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ForgeDemo />
    </Suspense>
  );
}
