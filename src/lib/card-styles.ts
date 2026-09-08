import type { CardStyles } from '@/types/card';

export interface CardStylePreset {
  id: string;
  label: string;
  styles: CardStyles;
}

/**
 * Built-in card style presets.
 * The 'default' preset uses empty overrides — BingoSquare falls back to
 * CSS vars so it inherits whatever theme the player has active.
 */
export const CARD_PRESETS: CardStylePreset[] = [
  {
    id: 'default',
    label: 'Default',
    styles: { preset: 'default' },
  },
  {
    id: 'classic',
    label: 'Classic',
    styles: {
      preset: 'classic',
      cardBg: '#e8e8e0',
      squareBg: '#ffffff',
      squareBgMarked: '#bbf7d0',
      squareBgFree: '#86efac',
      gridLine: '#d1d5db',
      textColor: '#111827',
    },
  },
  {
    id: 'neon',
    label: 'Neon',
    styles: {
      preset: 'neon',
      cardBg: '#05050f',
      squareBg: '#0d0d20',
      squareBgMarked: '#7c3aed',
      squareBgFree: '#10b981',
      gridLine: '#1e1e3a',
      textColor: '#e0e0ff',
    },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    styles: {
      preset: 'ocean',
      cardBg: '#082035',
      squareBg: '#0f2a4a',
      squareBgMarked: '#0ea5e9',
      squareBgFree: '#06b6d4',
      gridLine: '#163d60',
      textColor: '#e0f2fe',
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    styles: {
      preset: 'sunset',
      cardBg: '#150800',
      squareBg: '#231200',
      squareBgMarked: '#f59e0b',
      squareBgFree: '#ef4444',
      gridLine: '#3d2000',
      textColor: '#fef3c7',
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    styles: {
      preset: 'forest',
      cardBg: '#041a06',
      squareBg: '#082b0c',
      squareBgMarked: '#22c55e',
      squareBgFree: '#16a34a',
      gridLine: '#103d16',
      textColor: '#dcfce7',
    },
  },
  {
    id: 'retro',
    label: 'Retro',
    styles: {
      preset: 'retro',
      cardBg: '#e8d5b0',
      squareBg: '#f5e6c8',
      squareBgMarked: '#b91c1c',
      squareBgFree: '#92400e',
      gridLine: '#c4a97a',
      textColor: '#3d1c00',
    },
  },
  {
    id: 'slate',
    label: 'Slate',
    styles: {
      preset: 'slate',
      cardBg: '#0f172a',
      squareBg: '#1e293b',
      squareBgMarked: '#475569',
      squareBgFree: '#334155',
      gridLine: '#334155',
      textColor: '#f1f5f9',
    },
  },
];
