declare module 'safe-template-parser' {
  export function parseTemplateString(
    template: string,
    data: Record<string, unknown>,
    transforms?: Record<string, (value: string, ...args: string[]) => string>
  ): string;
}
