'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { generateRoomCode } from '@/lib/game/room-code';
import { usePlayer } from '@/hooks/usePlayer';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { CardTemplate } from '@/types/card';

interface CreateRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRoomDialog({ open, onOpenChange }: CreateRoomDialogProps) {
  const router = useRouter();
  const { player } = usePlayer();

  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch the player's templates when the dialog opens
  useEffect(() => {
    if (!open || !player) return;

    setIsLoading(true);
    const supabase = createClient();
    supabase
      .from('card_templates')
      .select('*')
      .eq('creator_id', player.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast.error('Failed to load your templates.');
        } else {
          setTemplates(data ?? []);
          // Auto-select the most recent one
          if (data && data.length > 0) setSelectedId(data[0].id);
        }
        setIsLoading(false);
      });
  }, [open, player]);

  async function handleCreate() {
    if (!player || !selectedId) return;

    setIsCreating(true);
    try {
      const supabase = createClient();

      // Generate a unique room code — retry on the rare collision
      let joinCode = generateRoomCode();
      const { data: existing } = await supabase
        .from('rooms')
        .select('id')
        .eq('join_code', joinCode)
        .maybeSingle();
      if (existing) joinCode = generateRoomCode(); // one retry is statistically sufficient

      const { data: room, error } = await supabase
        .from('rooms')
        .insert({
          host_id: player.id,
          join_code: joinCode,
          name: roomName.trim() || null,
          template_id: selectedId,
          status: 'waiting',
          settings: {
            winPatterns: ['row', 'column', 'diagonal'],
            autoCall: false,
            callInterval: 15,
          },
        })
        .select()
        .single();

      if (error) throw error;

      onOpenChange(false);
      router.push(`/room/${room.join_code}`);
    } catch (err) {
      console.error('Failed to create room:', err);
      toast.error('Could not create room. Please try again.');
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Create a Game</DialogTitle>
          <DialogDescription>
            Pick a card template to play with. You&apos;ll get a shareable room code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">

          {/* Optional room name */}
          <div className="space-y-1.5">
            <Label htmlFor="room-name">Room name <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="room-name"
              placeholder="e.g. Friday Night Bingo"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={60}
            />
          </div>

          {/* Template picker */}
          <div className="space-y-1.5">
            <Label>Card template</Label>

            {isLoading ? (
              <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading your templates…
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-6 space-y-3 border border-dashed border-border rounded-lg">
                <LayoutGrid className="w-8 h-8 mx-auto text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">No templates yet</p>
                  <p className="text-xs text-muted-foreground">Create a card first, then come back here.</p>
                </div>
                <Link
                  href="/create"
                  onClick={() => onOpenChange(false)}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Create a card
                </Link>
              </div>
            ) : (
              <ul className="space-y-1.5 max-h-52 overflow-y-auto">
                {templates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        selectedId === t.id
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-card hover:border-primary/40'
                      }`}
                    >
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.board_size}×{t.board_size} · {t.free_space ? 'Free space' : 'No free space'} · {t.shuffle_mode} shuffle
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!selectedId || isCreating}
            >
              {isCreating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
              ) : (
                'Create Room'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
