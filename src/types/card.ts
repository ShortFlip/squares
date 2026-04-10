import type { Database } from '@/lib/supabase/types';

export type CardTemplate = Database['public']['Tables']['card_templates']['Row'];
export type CardTemplateInsert = Database['public']['Tables']['card_templates']['Insert'];
export type CardTemplateUpdate = Database['public']['Tables']['card_templates']['Update'];

// A single item on a bingo card — at least one of text or imageUrl must be set
export interface SquareItem {
  text?: string;
  imageUrl?: string;
  clue?: string;       // optional hint shown to host when calling this item
  isFreeSpace?: boolean;   // set by generateCard at runtime — never stored in DB
  originalIndex?: number;  // original position in the template item pool — used for call verification
}

// Per-template visual customization stored in card_templates.styles
export interface CardStyles {
  preset?: string;         // which named preset is active
  cardBg?: string;         // board container background
  squareBg?: string;       // unmarked square background
  squareBgMarked?: string; // marked square background
  squareBgFree?: string;   // free space background
  gridLine?: string;       // square border color
  textColor?: string;      // square text color
}
