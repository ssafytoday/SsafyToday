/**
 * Default template constants for SsafyToday
 * Used by parseTemplateString for consistent string generation
 */

/**
 * Default directory templates by platform
 */
export const DEFAULT_DIR_TEMPLATES = {
  baekjoon: "백준/{{removeAfterSpace(level)}}/{{problemId}}. {{safe(title)}}",
  swea: "SWEA/{{level}}/{{problemId}}. {{safe(title)}}",
  programmers: "프로그래머스/{{level}}/{{problemId}}. {{safe(title)}}",
} as const;

/**
 * Default commit message templates by platform
 */
export const DEFAULT_MESSAGE_TEMPLATES = {
  baekjoon: "[{{level}}] Title: {{title}}, Time: {{runtime}} ms, Memory: {{memory}} KB -SsafyToday",
  baekjoonWithScore:
    "[{{level}}] Title: {{title}}, Time: {{runtime}} ms, Memory: {{memory}} KB, Score: {{score}} point -SsafyToday",
  swea: "[{{level}}] Title: {{title}}, Time: {{runtime}}, Memory: {{memory}} -SsafyToday",
  programmers: "[{{level}}] Title: {{title}}, Time: {{runtime}}, Memory: {{memory}} -SsafyToday",
} as const;

/**
 * Default filename template
 */
export const DEFAULT_FILENAME_TEMPLATE = "{{safe(title)}}.{{languageExtension}}" as const;

export type DirTemplateKey = keyof typeof DEFAULT_DIR_TEMPLATES;
export type MessageTemplateKey = keyof typeof DEFAULT_MESSAGE_TEMPLATES;
