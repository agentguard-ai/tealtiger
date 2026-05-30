import React, { forwardRef, type HTMLAttributes, type ReactNode } from "react";

// ------------------------------------------------------------------
// Utility for merging class names (lightweight alternative to clsx)
// If you have @/lib/utils with `cn`, replace this import.
// ------------------------------------------------------------------
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ------------------------------------------------------------------
// Type definitions
// ------------------------------------------------------------------
type CardVariant = "default" | "elevated" | "bordered" | "flat";
type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Primary content rendered inside the card body */
  children: ReactNode;

  /** Visual style variant */
  variant?: CardVariant;

  /** Padding applied to header, body, and footer uniformly */
  padding?: CardPadding;

  /** Optional header slot (rendered above the body with a separator) */
  header?: ReactNode;

  /** Optional footer slot (rendered below the body with a separator) */
  footer?: ReactNode;

  /** Additional CSS class names */
  className?: string;
}

// ------------------------------------------------------------------
// Style maps
// ------------------------------------------------------------------
const variantStyles: Record<CardVariant, string> = {
  default: "bg-white shadow-sm border border-gray-200",
  elevated: "bg-white shadow-md border border-gray-200",
  bordered: "bg-white border-2 border-gray-300 shadow-sm",
  flat: "bg-white border border-gray-100",
};

const paddingStyles: Record<CardPadding, string> = {
  none: "",
  sm: "px-3 py-2",
  md: "px-4 py-3",
  lg: "px-6 py-5",
};

const radius = "rounded-lg";

// ------------------------------------------------------------------
// Card Component
// ------------------------------------------------------------------
/**
 * Card container that wraps content with optional header and footer.
 *
 * @example
 * <Card variant="elevated" header={<h2>Title</h2>}>
 *   <p>Body content</p>
 * </Card>
 */
const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = "default",
      padding = "md",
      header,
      footer,
      className,
      ...props
    },
    ref,
  ) => {
    const baseClasses = cn(
      radius,
      "transition-shadow duration-200",
      variantStyles[variant],
      className,
    );

    // Separate padding for content-only (when no header/footer exist)
    // to avoid double border issues.
    const hasHeader = header !== undefined && header !== null;
    const hasFooter = footer !== undefined && footer !== null;

    return (
      <div ref={ref} className={baseClasses} {...props}>
        {hasHeader && (
          <div
            className={cn(
              "border-b border-gray-200",
              paddingStyles[padding],
              radius,
              "rounded-b-none",
            )}
          >
            {header}
          </div>
        )}

        <div className={paddingStyles[padding]}>{children}</div>

        {hasFooter && (
          <div
            className={cn(
              "border-t border-gray-200",
              paddingStyles[padding],
              radius,
              "rounded-t-none",
            )}
          >
            {footer}
          </div>
        )}
      </div>
    );
  },
);

Card.displayName = "Card";

export default Card;