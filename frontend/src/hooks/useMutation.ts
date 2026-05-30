import { useState, useCallback } from "react";

export interface UseMutationOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export function useMutation(
  fn: (data: unknown) => Promise<unknown>,
  options?: UseMutationOptions
) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<unknown>(null);

  const mutate = useCallback(
    async (variables: unknown) => {
      setIsPending(true);
      setError(null);
      try {
        const result = await fn(variables);
        setData(result);
        options?.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        options?.onError?.(error);
        throw error;
      } finally {
        setIsPending(false);
      }
    },
    [fn, options]
  );

  return { mutate, isPending, error, data };
}
