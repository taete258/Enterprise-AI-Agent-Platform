"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  display: string;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle Escape key to close
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Reset search when opening/closing
  React.useEffect(() => {
    if (!isOpen) {
      setSearch("");
    }
  }, [isOpen]);

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.display.toLowerCase().includes(query) ||
        opt.id.toLowerCase().includes(query)
    );
  }, [options, search]);

  const selectedOption = options.find((opt) => opt.id === value);

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-left cursor-pointer",
          !selectedOption && "text-muted-foreground"
        )}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.display : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-80 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md flex flex-col animate-in fade-in-50 duration-100">
          <div className="flex items-center border-b border-border px-2.5 py-1.5 gap-2 bg-accent/10">
            <Search className="h-4 w-4 opacity-50 shrink-0" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground border-none ring-0 focus:ring-0"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto p-1 max-h-56 flex-1">
            {filteredOptions.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-3">
                No items found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onValueChange(opt.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-left",
                      isSelected && "bg-accent/40 font-medium"
                    )}
                  >
                    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </span>
                    <span className="truncate">{opt.display}</span>
                    <span className="ml-2 text-xs text-muted-foreground truncate font-mono">
                      ({opt.id})
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
