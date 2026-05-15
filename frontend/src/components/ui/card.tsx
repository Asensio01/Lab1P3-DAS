import type React from "react";

import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn("panel rounded-2xl p-6 shadow-glow", className)}
      {...props}
    />
  );
}
