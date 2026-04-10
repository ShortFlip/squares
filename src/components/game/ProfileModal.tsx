'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { usePlayerStore } from '@/stores/playerStore';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ThemePicker } from './ThemePicker';
import { PlayerStats } from '@/components/stats/PlayerStats';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { player, updatePlayer } = usePlayerStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(player?.display_name ?? '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reset local state when modal opens
  function handleOpen(nextOpen: boolean) {
    if (nextOpen) {
      setDisplayName(player?.display_name ?? '');
      setPreviewUrl(null);
      setPendingFile(null);
    }
    onOpenChange(nextOpen);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show an instant local preview before uploading
    setPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
  }

  async function handleSave() {
    if (!player) return;
    if (!displayName.trim()) {
      toast.error('Display name cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      let avatarUrl = player.avatar_url;

      // Upload new avatar if one was selected
      if (pendingFile) {
        const ext = pendingFile.name.split('.').pop() ?? 'jpg';
        // Use player ID as filename so re-uploads replace the old file
        const path = `${player.id}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(path);

        // Bust the CDN cache by appending a timestamp query param
        avatarUrl = `${publicUrl}?t=${Date.now()}`;
      }

      // Persist to DB
      const { error: dbError } = await supabase
        .from('players')
        .update({ display_name: displayName.trim(), avatar_url: avatarUrl })
        .eq('id', player.id);

      if (dbError) throw dbError;

      // Reflect changes in the store immediately — no page reload needed
      updatePlayer({ display_name: displayName.trim(), avatar_url: avatarUrl });
      toast.success('Profile saved!');
      onOpenChange(false);
    } catch (err) {
      console.error('Profile save failed:', err);
      toast.error('Could not save profile. Try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!player) return null;

  const currentAvatarUrl = previewUrl ?? player.avatar_url;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Your Profile</DialogTitle>
          <DialogDescription>
            Update your name and photo — your friends will see this in the lobby and game.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">

          {/* Avatar picker */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <PlayerAvatar
                playerId={player.id}
                displayName={displayName || player.display_name}
                avatarUrl={currentAvatarUrl}
                size="xl"
              />
              {/* Camera overlay on hover */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Change photo"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              {currentAvatarUrl ? 'Change photo' : 'Add a photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Display name */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
              placeholder="How your friends see you"
            />
          </div>

          {/* Theme */}
          <ThemePicker />

          {/* Stats */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Your stats</p>
            <PlayerStats
              playerId={player.id}
              displayName={player.display_name}
              avatarUrl={player.avatar_url}
              compact
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !displayName.trim()}>
              {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save'}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
