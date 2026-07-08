"use client";
import { useTheme } from "./ThemeProvider";
import { Sun, Moon, Laptop } from "lucide-react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 bg-muted/80 p-0.5 rounded-lg border border-border w-fit">
      <button
        onClick={() => setTheme("light")}
        className={`p-1.5 rounded-md transition-all duration-200 cursor-pointer ${
          theme === "light"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-card/40"
        }`}
        title="Light Mode"
      >
        <Sun className="size-3.5" strokeWidth={2} />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`p-1.5 rounded-md transition-all duration-200 cursor-pointer ${
          theme === "dark"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-card/40"
        }`}
        title="Dark Mode"
      >
        <Moon className="size-3.5" strokeWidth={2} />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`p-1.5 rounded-md transition-all duration-200 cursor-pointer ${
          theme === "system"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-card/40"
        }`}
        title="System Mode"
      >
        <Laptop className="size-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
