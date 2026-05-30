// /src/components/ui/TimeRangeSelector.tsx
import { useState, useEffect, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────
export type Preset = "5m" | "1h" | "24h" | "custom";

export interface TimeRange {
  preset: Preset;
  start?: string; // ISO datetime string (only for custom)
  end?: string;   // ISO datetime string (only for custom)
}

// ── Props ───────────────────────────────────────────────
export interface TimeRangeSelectorProps {
  /** Controlled value */
  value: TimeRange;
  /** Callback when time range changes */
  onChange: (range: TimeRange) => void;
  /** Additional class names for container */
  className?: string;
  /** Disables the selector */
  disabled?: boolean;
}

// ── Constants ───────────────────────────────────────────
const PRESET_LABELS: Record<Preset, string> = {
  "5m": "Last 5 minutes",
  "1h": "Last 1 hour",
  "24h": "Last 24 hours",
  custom: "Custom range",
};

// ── Component ───────────────────────────────────────────
export function TimeRangeSelector({
  value,
  onChange,
  className,
  disabled = false,
}: TimeRangeSelectorProps) {
  // Local state for custom date inputs (initialized from controlled value)
  const [customStart, setCustomStart] = useState(
    value.preset === "custom" && value.start ? value.start.slice(0, 16) : ""
  );
  const [customEnd, setCustomEnd] = useState(
    value.preset === "custom" && value.end ? value.end.slice(0, 16) : ""
  );

  // Sync local state when controlled value changes (e.g., parent resets)
  useEffect(() => {
    if (value.preset === "custom") {
      if (value.start) setCustomStart(value.start.slice(0, 16));
      if (value.end) setCustomEnd(value.end.slice(0, 16));
    }
  }, [value.start, value.end, value.preset]);

  const handlePresetChange = useCallback(
    (preset: Preset) => {
      if (preset === "custom") {
        // When switching to custom, keep previous start/end if available,
        // or default to last hour
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const newStart =
          customStart ||
          (value.start
            ? value.start.slice(0, 16)
            : oneHourAgo.toISOString().slice(0, 16));
        const newEnd =
          customEnd ||
          (value.end ? value.end.slice(0, 16) : now.toISOString().slice(0, 16));

        setCustomStart(newStart);
        setCustomEnd(newEnd);

        onChange({
          preset: "custom",
          start: newStart + ":00.000Z",
          end: newEnd + ":00.000Z",
        });
      } else {
        onChange({ preset });
        // Reset custom inputs (optional, keeps UI clean)
        setCustomStart("");
        setCustomEnd("");
      }
    },
    [customStart, customEnd, value.start, value.end, onChange]
  );

  const handleCustomStartChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setCustomStart(val);
      if (customEnd && val) {
        onChange({
          preset: "custom",
          start: val + ":00.000Z",
          end: customEnd + ":00.000Z",
        });
      }
    },
    [customEnd, onChange]
  );

  const handleCustomEndChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setCustomEnd(val);
      if (customStart && val) {
        onChange({
          preset: "custom",
          start: customStart + ":00.000Z",
          end: val + ":00.000Z",
        });
      }
    },
    [customStart, onChange]
  );

  return (
    <div className={cn("flex flex-col gap-2", className)} role="group" aria-label="Time range selector">
      {/* Preset dropdown */}
      <Select
        value={value.preset}
        onValueChange={(val: Preset) => handlePresetChange(val)}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            "w-full border-teal-600/30 text-teal-900",
            "focus:ring-2 focus:ring-teal-500/50 focus:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <SelectValue placeholder="Select time range" />
        </SelectTrigger>
        <SelectContent
          className={cn(
            "bg-white border border-slate-200 shadow-lg rounded-md z-50",
            "dark:bg-slate-900 dark:border-slate-700"
          )}
        >
          {(Object.keys(PRESET_LABELS) as Preset[]).map((preset) => (
            <SelectItem
              key={preset}
              value={preset}
              className={cn(
                "cursor-pointer transition-colors",
                "hover:bg-teal-50 hover:text-teal-900",
                "focus:bg-teal-50 focus:text-teal-900",
                "data-[state=checked]:bg-teal-100 data-[state=checked]:text-teal-900"
              )}
            >
              {PRESET_LABELS[preset]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Custom date inputs (only shown when preset is custom) */}
      {value.preset === "custom" && (
        <div className="flex flex-col sm:flex-row gap-2 mt-1">
          <div className="flex-1">
            <label
              htmlFor="time-range-start"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Start
            </label>
            <input
              type="datetime-local"
              id="time-range-start"
              value={customStart}
              onChange={handleCustomStartChange}
              disabled={disabled}
              className={cn(
                "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm",
                "shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium",
                "placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-teal-500/50 focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            />
          </div>
          <div className="flex-1">
            <label
              htmlFor="time-range-end"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              End
            </label>
            <input
              type="datetime-local"
              id="time-range-end"
              value={customEnd}
              onChange={handleCustomEndChange}
              disabled={disabled}
              min={customStart || undefined}
              className={cn(
                "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm",
                "shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium",
                "placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-teal-500/50 focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}