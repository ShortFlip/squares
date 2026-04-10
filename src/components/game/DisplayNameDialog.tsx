'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DisplayNameDialogProps {
  open: boolean;
  onSubmit: (displayName: string) => Promise<void>;
}

const MAX_NAME_LENGTH = 20;

/**
 * Shown on first visit — forces the player to pick a display name before
 * they can do anything. Not dismissable (no X, no click-outside).
 */
export function DisplayNameDialog({ open, onSubmit }: DisplayNameDialogProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const trimmed = name.trim();
  const isValid = trimmed.length > 0 && trimmed.length <= MAX_NAME_LENGTH;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit(trimmed);
    } catch {
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }

  // Controlled open + no-op onOpenChange blocks Escape; disablePointerDismissal blocks outside clicks
  return (
    <Dialog open={open} onOpenChange={() => {}} disablePointerDismissal={true}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-display text-xl">What do we call you?</DialogTitle>
          <DialogDescription>
            Pick a display name for your friends to see. You can change it later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              placeholder="e.g. BingoQueen, DabMaster..."
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              maxLength={MAX_NAME_LENGTH}
              autoFocus
              autoComplete="off"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              {error ? (
                <span className="text-destructive">{error}</span>
              ) : (
                <span>{trimmed.length === 0 ? 'Required' : ' '}</span>
              )}
              <span>{name.length}/{MAX_NAME_LENGTH}</span>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Let's go..." : "Let's play"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
