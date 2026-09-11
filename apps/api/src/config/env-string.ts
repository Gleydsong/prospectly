/** Render dashboard pastes often leave a trailing newline and break OAuth (invalid_client). */
export function stripEnvString(value: string | undefined, fallback = ''): string {
  return (value ?? fallback).trim();
}
