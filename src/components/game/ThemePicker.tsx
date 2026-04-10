'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { THEMES, getSavedTheme, applyTheme, type ThemeId } from '@/lib/theme';

export function ThemePicker() {
  const [current, setCurrent] = useState<ThemeId>('midnight');

  useEffect(() => {
    setCurrent(getSavedTheme());
  }, []);

  function handleSelect(id: ThemeId) {
    setCurrent(id);
    applyTheme(id);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Theme</p>
      <div className="grid grid-cols-3 gap-2">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            type="button"
            onClick={() => handleSelect(theme.id)}
            className="relative flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors hover:border-primary"
            style={{
              borderColor: current === theme.id ? 'var(--color-primary)' : 'var(--color-border)',
            }}
          >
            {/* Color swatch */}
            <div
              className="w-10 h-10 rounded-full border border-black/10"
              style={{ background: `linear-gradient(135deg, ${theme.bg} 60%, ${theme.accent})` }}
            />
            <span className="text-xs text-muted-foreground">{theme.label}</span>

            {/* Selected checkmark */}
            {current === theme.id && (
              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-primary-foreground" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
