import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border-2 px-4 py-2 text-left font-display text-sm font-bold tracking-[0.14em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-primary bg-primary text-primary-ink hover:border-ink hover:bg-ink",
        ghost: "border-line bg-transparent text-ink hover:border-primary",
        quiet: "border-transparent bg-transparent text-dim hover:text-ink",
      },
      size: { md: "", sm: "min-h-11 px-3 py-1 text-xs" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: Props) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
