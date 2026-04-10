'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARD_PRESETS } from '@/lib/card-styles';
import { Label } from '@/components/ui/label';
import type { CardStyles } from '@/types/card';

interface CardStylePickerProps {
  value: CardStyles;
  onChange: (styles: CardStyles) => void;
}

/** Small color swatch with a native <input type="color"> overlay */
function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (hex: string) => void;
}) {
  return (
    <label className="flex flex-col items-center gap-1 cursor-pointer group">
      <div className="relative w-8 h-8 rounded-md border border-border overflow-hidden hover:ring-1 hover:ring-primary transition-all">
        {/* Visible color preview */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: value ?? 'transparent' }}
        />
        {/* Invisible native color picker covers the whole area */}
        <input
          type="color"
          value={value ?? '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        {/* "+" hint when no color is set */}
        {!value && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50 text-xs pointer-events-none">
            +
          </div>
        )}
      </div>
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
    </label>
  );
}

export function CardStylePicker({ value, onChange }: CardStylePickerProps) {
  const activePreset = value.preset ?? 'default';

  function selectPreset(presetId: string) {
    const preset = CARD_PRESETS.find((p) => p.id === presetId);
    if (preset) onChange(preset.styles);
  }

  function updateColor(key: keyof CardStyles, hex: string) {
    // Mark as 'custom' when the user manually tweaks a color
    onChange({ ...value, preset: 'custom', [key]: hex });
  }

  return (
    <div className="space-y-3">
      <Label>Card style</Label>

      {/* Preset swatches */}
      <div className="flex flex-wrap gap-2">
        {CARD_PRESETS.map((preset) => {
          const isActive = activePreset === preset.id;
          const isDefault = preset.id === 'default';

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => selectPreset(preset.id)}
              title={preset.label}
              className={cn(
                'relative w-11 h-8 rounded-md overflow-hidden border-2 transition-all',
                isActive
                  ? 'border-primary shadow-md scale-105'
                  : 'border-transparent hover:border-border',
              )}
            >
              {/* Swatch: left half = unmarked, right half = marked */}
              <div className="absolute inset-0 flex">
                <div
                  className={cn('flex-1', isDefault && 'bg-card')}
                  style={{ backgroundColor: isDefault ? undefined : preset.styles.squareBg }}
                />
                <div
                  className={cn('flex-1', isDefault && 'bg-accent/50')}
                  style={{ backgroundColor: isDefault ? undefined : preset.styles.squareBgMarked }}
                />
              </div>

              {/* Checkmark on active */}
              {isActive && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                </div>
              )}
            </button>
          );
        })}

        {/* "Custom" pseudo-swatch that shows when user has tweaked colors */}
        {activePreset === 'custom' && (
          <div className="relative w-11 h-8 rounded-md overflow-hidden border-2 border-primary shadow-md scale-105">
            <div className="absolute inset-0 flex">
              <div className="flex-1" style={{ backgroundColor: value.squareBg }} />
              <div className="flex-1" style={{ backgroundColor: value.squareBgMarked }} />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
            </div>
          </div>
        )}
      </div>

      {/* Preset label row */}
      <div className="flex flex-wrap gap-2">
        {CARD_PRESETS.map((preset) => (
          <span
            key={preset.id}
            className="w-11 text-center text-[10px] text-muted-foreground leading-none"
          >
            {preset.label}
          </span>
        ))}
      </div>

      {/* Individual color overrides — only shown when a non-default style is active */}
      {activePreset !== 'default' && (
        <div className="flex flex-wrap gap-3 pt-1 border-t border-border">
          <ColorInput
            label="Square"
            value={value.squareBg}
            onChange={(hex) => updateColor('squareBg', hex)}
          />
          <ColorInput
            label="Marked"
            value={value.squareBgMarked}
            onChange={(hex) => updateColor('squareBgMarked', hex)}
          />
          <ColorInput
            label="Free"
            value={value.squareBgFree}
            onChange={(hex) => updateColor('squareBgFree', hex)}
          />
          <ColorInput
            label="Grid"
            value={value.gridLine}
            onChange={(hex) => updateColor('gridLine', hex)}
          />
          <ColorInput
            label="Text"
            value={value.textColor}
            onChange={(hex) => updateColor('textColor', hex)}
          />
          <ColorInput
            label="Board bg"
            value={value.cardBg}
            onChange={(hex) => updateColor('cardBg', hex)}
          />
        </div>
      )}
    </div>
  );
}
