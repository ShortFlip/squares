'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { usePlayer } from '@/hooks/usePlayer';
import { Button, buttonVariants } from '@/components/ui/button';
import type { CardTemplate } from '@/types/card';

export function TemplateList() {
  const router = useRouter();
  const { player } = usePlayer();
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!player) return;
    const supabase = createClient();
    supabase
      .from('card_templates')
      .select('*')
      .eq('creator_id', player.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTemplates(data ?? []);
        setIsLoading(false);
      });
  }, [player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(id: string) {
    setDeletingId(id);
    const supabase = createClient();
    const { error } = await supabase.from('card_templates').delete().eq('id', id);
    if (error) {
      toast.error('Could not delete template.');
    } else {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success('Template deleted.');
    }
    setDeletingId(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading your cards…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Your Cards</h2>
        <Link
          href="/create"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Card
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No cards yet. Make one to get started.</p>
          <Link href="/create" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create your first card
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3"
            >
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-sm truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{t.board_size}×{t.board_size}</span> ·{' '}
                  <span className="font-mono">{(t.items as unknown[]).length}</span> items ·{' '}
                  {t.free_space ? 'Free space' : 'No free space'}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/create?id=${t.id}`}
                  className={buttonVariants({ variant: 'outline', size: 'sm', className: 'flex-1 gap-1.5' })}
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:border-destructive"
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingId === t.id}
                >
                  {deletingId === t.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />
                  }
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
