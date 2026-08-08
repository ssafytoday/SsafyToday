/**
 * Submission-related type definitions
 */

// Submission handler result
export interface UploadHandlerResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Parse data function type
export type ParseDataFunction = () => Promise<unknown> | unknown;

// Start function type
export type StartUploadFunction = () => void;

// Submission handler factory create function
export type UploadHandlerCreator = (
  platformName: string,
  parseDataFunction: ParseDataFunction,
  startUploadFunction?: StartUploadFunction
) => () => Promise<UploadHandlerResult>;
