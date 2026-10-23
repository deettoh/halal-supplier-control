import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../session.jsx";
export function useRecord(method, { enabled = true } = {}) {
  const session = useSession();
  const context = { ...session.identity };
  return useQuery({
    queryKey: [...session.key, method],
    queryFn: ({ signal }) => session.gateway[method](context, { signal }),
    enabled: enabled && !!session.identity,
  });
}
export function useScopedMutation(operation, { onSuccess, onError } = {}) {
  const session = useSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const ticket = session.capture();
      const value = await operation(ticket.context, input);
      return session.isCurrent(ticket) ? value : undefined;
    },
    onSuccess: (value) => {
      if (value === undefined) return;
      client.invalidateQueries();
      onSuccess?.(value);
    },
    onError: (error) => onError?.(error),
  });
}
