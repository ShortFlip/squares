'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getBrowserId } from '@/lib/utils/browser-id';
import { usePlayerStore } from '@/stores/playerStore';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { DisplayNameDialog } from './DisplayNameDialog';
import { ProfileModal } from './ProfileModal';
import { getSavedTheme, applyTheme } from '@/lib/theme';

interface PlayerProviderProps {
  children: React.ReactNode;
}

/**
 * Resolves player identity on mount and gates the app behind a display
 * name prompt if this is the user's first visit.
 *
 * Flow:
 * 1. Get (or create) the browser UUID from localStorage
 * 2. Ensure we have a Supabase auth session — sign in anonymously if not
 * 3. Look up existing player record by browser_id
 * 4. If found → load into store, done
 * 5. If not found → show DisplayNameDialog → create player → load into store
 */
export function PlayerProvider({ children }: PlayerProviderProps) {
  const { player, setPlayer, setLoading } = usePlayerStore();
  const [needsName, setNeedsName] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    // Restore saved theme on every page load
    applyTheme(getSavedTheme());
    initPlayer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initPlayer() {
    const supabase = createClient();
    const browserId = getBrowserId();

    // Ensure we always have a Supabase auth session.
    // Anonymous sessions give us an auth.uid() for RLS without requiring sign-up.
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error('Anonymous sign-in failed:', error.message);
      } else {
        session = data.session;
      }
    }

    // Look for an existing player tied to this browser
    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('browser_id', browserId)
      .maybeSingle();

    if (player) {
      // If the player was created before anonymous auth was enabled their
      // auth_id will be null. Backfill it now so RLS ownership checks work.
      if (!player.auth_id && session?.user.id) {
        await supabase
          .from('players')
          .update({ auth_id: session.user.id })
          .eq('id', player.id);
        setPlayer({ ...player, auth_id: session.user.id });
      } else {
        setPlayer(player);
      }
    } else {
      // First visit — stop the loading spinner and show the name prompt
      setLoading(false);
      setNeedsName(true);
    }
  }

  async function handleNameSubmit(displayName: string) {
    const supabase = createClient();
    const browserId = getBrowserId();

    // Get auth_id from the session we created in initPlayer
    const { data: { session } } = await supabase.auth.getSession();

    const { data: player, error } = await supabase
      .from('players')
      .insert({
        browser_id: browserId,
        auth_id: session?.user.id ?? null,
        display_name: displayName,
      })
      .select()
      .single();

    if (error) throw error; // caught by DisplayNameDialog and shown to user

    setPlayer(player);
    setNeedsName(false);
  }

  return (
    <>
      <DisplayNameDialog open={needsName} onSubmit={handleNameSubmit} />
      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />

      {/* Floating profile button — top-right on every page */}
      {player && (
        <button
          onClick={() => setProfileOpen(true)}
          className="fixed top-3 right-4 z-40 rounded-full ring-2 ring-border hover:ring-primary transition-all"
          aria-label="Edit profile"
        >
          <PlayerAvatar
            playerId={player.id}
            displayName={player.display_name}
            avatarUrl={player.avatar_url}
            size="sm"
          />
        </button>
      )}

      {children}
    </>
  );
}
