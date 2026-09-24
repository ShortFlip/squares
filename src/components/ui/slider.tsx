"use client"

import type * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "@/lib/utils"

// shadcn's base-nova slider, plus: an accessible name for the thumb
// (`thumbLabel`, `thumbValueText`) and hooks to colour the track and the filled part, which the
// library's mix slider uses to show each game's share in its own colour.
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbLabel,
  thumbValueText,
  trackClassName,
  trackStyle,
  indicatorClassName,
  indicatorStyle,
  ...props
}: SliderPrimitive.Root.Props & {
  thumbLabel?: string
  thumbValueText?: (value: number) => string
  trackClassName?: string
  trackStyle?: React.CSSProperties
  indicatorClassName?: string
  indicatorStyle?: React.CSSProperties
}) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max]

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      // shadcn ships "edge", which renders an inline <script> for pre-hydration
      // layout. A slider mounted after load (the library's mix) then trips
      // React's "script tag while rendering" error, so align after hydration.
      thumbAlignment="edge-client-only"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center py-1.5 select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className={cn(
            "relative grow overflow-hidden rounded-full bg-muted select-none data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1",
            trackClassName
          )}
          style={trackStyle}
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className={cn("bg-primary select-none data-horizontal:h-full data-vertical:w-full", indicatorClassName)}
            style={indicatorStyle}
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            aria-label={thumbLabel}
            getAriaValueText={thumbValueText ? (_formatted, v) => thumbValueText(v) : undefined}
            className="relative block size-4 shrink-0 rounded-full border border-ring bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] duration-150 select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
