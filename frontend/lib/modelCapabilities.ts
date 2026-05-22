export type ModelCapability = "text" | "vision" | "image gen" | "audio" | "code";

export function detectCapabilities(modelId: string): ModelCapability[] {
  const id = modelId.toLowerCase();
  const caps: ModelCapability[] = ["text"];

  const visionPatterns = [
    "vision", "4o", "gpt-4-turbo", "gpt-4v",
    "claude-3", "claude-opus", "claude-sonnet", "claude-haiku",
    "gemini", "llava", "pixtral", "qwen-vl", "internvl",
  ];
  if (visionPatterns.some((p) => id.includes(p))) caps.push("vision");

  const imageGenPatterns = [
    "dall-e", "imagen", "stable-diffusion", "sdxl", "flux", "midjourney",
    "gpt-image", "image-generation", "image-gen", "image-alpha", "image-beta",
    "kandinsky", "playground", "leonardo",
  ];
  // models with "-image" suffix (e.g. gemini-2.5-flash-image, gemini-2.0-flash-image-generation)
  const imageGenSuffixes = ["-image", "-image-generation"];
  const isImageGen =
    imageGenPatterns.some((p) => id.includes(p)) ||
    imageGenSuffixes.some((s) => id.endsWith(s) || id.includes(s + "-"));
  if (isImageGen) caps.push("image gen");

  const audioPatterns = ["whisper", "tts", "speech", "audio", "voice"];
  if (audioPatterns.some((p) => id.includes(p))) caps.push("audio");

  const codePatterns = ["codex", "code", "starcoder", "deepseek-coder", "codegemma", "codellama"];
  if (codePatterns.some((p) => id.includes(p))) caps.push("code");

  return caps;
}

export const CAPABILITY_STYLES: Record<ModelCapability, string> = {
  text: "bg-muted text-muted-foreground",
  vision: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "image gen": "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  audio: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  code: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};
