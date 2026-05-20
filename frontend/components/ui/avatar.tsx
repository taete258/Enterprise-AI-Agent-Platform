import * as React from "react";
import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative flex h-8 w-8 shrink-0 overflow-hidden rounded-md", className)} {...props} />
  )
);
Avatar.displayName = "Avatar";

const AvatarFallback = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex h-full w-full items-center justify-center bg-accent text-accent-foreground text-[11px] font-serif font-semibold", className)} {...props} />
  )
);
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarFallback };
