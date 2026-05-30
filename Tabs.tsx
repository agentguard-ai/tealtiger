import * as React from "react";
import { cn } from "@/lib/utils"; // Assuming a cn utility exists (like shadcn/ui pattern)

// ------------------------------------------------------------------
// Context
// ------------------------------------------------------------------

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  orientation: "horizontal" | "vertical";
  activateOnFocus: boolean;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs compound components must be used within <Tabs />");
  return ctx;
}

// ------------------------------------------------------------------
// <Tabs> (root)
// ------------------------------------------------------------------

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  activateOnFocus?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  orientation = "horizontal",
  activateOnFocus = false,
  children,
  className,
}: TabsProps) {
  const isControlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? "");
  const currentValue = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = React.useCallback(
    (val: string) => {
      if (!isControlled) setUncontrolledValue(val);
      onValueChange?.(val);
    },
    [isControlled, onValueChange]
  );

  const contextValue = React.useMemo<TabsContextValue>(
    () => ({
      value: currentValue,
      onValueChange: handleValueChange,
      orientation,
      activateOnFocus,
    }),
    [currentValue, handleValueChange, orientation, activateOnFocus]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-row gap-4" : "flex-col gap-2",
          className
        )}
        data-orientation={orientation}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}
Tabs.displayName = "Tabs";

// ------------------------------------------------------------------
// <TabsList> – container for tab triggers
// ------------------------------------------------------------------

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    const { orientation } = useTabsContext();

    return (
      <div
        ref={ref}
        role="tablist"
        aria-orientation={orientation}
        className={cn(
          "inline-flex items-center",
          orientation === "horizontal"
            ? "flex-row border-b border-border"
            : "flex-col border-r border-border",
          "bg-background",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsList.displayName = "TabsList";

// ------------------------------------------------------------------
// <TabsTrigger> – individual tab button
// ------------------------------------------------------------------

interface TabsTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "onFocus"> {
  value: string;
  disabled?: boolean;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, disabled, children, ...props }, ref) => {
    const { value: selectedValue, onValueChange, orientation, activateOnFocus } =
      useTabsContext();
    const isSelected = selectedValue === value;

    const handleClick = () => {
      if (!disabled) onValueChange(value);
    };

    const handleFocus = () => {
      if (!disabled && activateOnFocus) onValueChange(value);
    };

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      const list = (e.target as HTMLElement).closest('[role="tablist"]');
      if (!list) return;
      const triggers = Array.from(
        list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
      );
      const currentIndex = triggers.indexOf(e.target as HTMLButtonElement);
      let nextIndex: number | null = null;

      if (orientation === "horizontal") {
        if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % triggers.length;
        else if (e.key === "ArrowLeft")
          nextIndex = (currentIndex - 1 + triggers.length) % triggers.length;
      } else {
        if (e.key === "ArrowDown") nextIndex = (currentIndex + 1) % triggers.length;
        else if (e.key === "ArrowUp")
          nextIndex = (currentIndex - 1 + triggers.length) % triggers.length;
      }

      if (nextIndex !== null) {
        e.preventDefault();
        triggers[nextIndex].focus();
        triggers[nextIndex].click(); // immediately activate on click (or use activateOnFocus logic)
      }
    };

    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={isSelected}
        aria-controls={`tabpanel-${value}`}
        data-state={isSelected ? "active" : "inactive"}
        data-disabled={disabled || undefined}
        disabled={disabled}
        tabIndex={isSelected ? 0 : -1}
        onClick={handleClick}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          orientation === "horizontal"
            ? "border-b-2 border-transparent"
            : "border-r-2 border-transparent",
          isSelected
            ? "border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400"
            : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30",
          disabled && "pointer-events-none opacity-40",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

// ------------------------------------------------------------------
// <TabsContent> – the panel content for a tab
// ------------------------------------------------------------------

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, forceMount, children, ...props }, ref) => {
    const { value: selectedValue } = useTabsContext();
    const isSelected = selectedValue === value;

    if (!forceMount && !isSelected) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`tabpanel-${value}`}
        aria-labelledby={undefined} // would need trigger id; omitted for simplicity
        hidden={!isSelected}
        data-state={isSelected ? "active" : "inactive"}
        className={cn(
          "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          !isSelected && "hidden",
          className
        )}
        tabIndex={isSelected ? 0 : -1}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = "TabsContent";