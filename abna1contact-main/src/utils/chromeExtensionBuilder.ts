export async function generateNoorChromeExtensionZip(): Promise<Blob> {
  return new Blob([""], { type: "application/zip" });
}

export function generateSingleFileUserScript(): string {
  return "// User script for Noor";
}
