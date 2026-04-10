import { Suspense } from 'react';
import { BoardEditor } from '@/components/board/BoardEditor';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const metadata = {
  title: 'Card Creator — Squares',
};

export default function CreatePage() {
  return (
    <main className="container mx-auto px-4 py-6 max-w-5xl">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to home
      </Link>
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading editor…</div>}>
        <BoardEditor />
      </Suspense>
    </main>
  );
}
