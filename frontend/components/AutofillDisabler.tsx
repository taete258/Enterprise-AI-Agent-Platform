"use client";

import { useEffect } from "react";

export default function AutofillDisabler() {
  useEffect(() => {
    const disableAutofill = (input: HTMLInputElement) => {
      if (input.type === "password") {
        input.setAttribute("autocomplete", "new-password");
      } else if (input.type !== "checkbox" && input.type !== "radio" && input.type !== "file" && input.type !== "range") {
        input.setAttribute("autocomplete", "one-time-code");
      }
    };

    // Run initially
    document.querySelectorAll("input").forEach(disableAutofill);

    // Watch for dynamically added input fields
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLInputElement) {
            disableAutofill(node);
          } else if (node instanceof HTMLElement) {
            node.querySelectorAll("input").forEach(disableAutofill);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
