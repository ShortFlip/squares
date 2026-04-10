import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RoomClient } from '@/components/game/RoomClient';

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: RoomPageProps) {
  const { code } = await params;
  return { title: `Room ${code.toUpperCase()} — Squares` };
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;
  const joinCode = code.toUpperCase();

  const supabase = await createClient();
  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('join_code', joinCode)
    .maybeSingle();

  if (!room) notFound();

  return <RoomClient initialRoom={room} />;
}
