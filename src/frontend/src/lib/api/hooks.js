import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { useSession } from './session';
const key = (name, role, tenant, ...rest) => [name, role, tenant, ...rest];
export function useMaterials() {
  const { session } = useSession();
  return useQuery({
    queryKey: key('materials', session.role, session.tenant),
    queryFn: () => api.listMaterials(session),
    enabled: session.role !== 'supplier',
  });
}
export function useDeliveries(status) {
  const { session } = useSession();
  return useQuery({
    queryKey: key('deliveries', session.role, session.tenant, status ?? 'all'),
    queryFn: () => api.listDeliveries(session, status),
    enabled: session.role !== 'supplier',
  });
}
export function useActivity() {
  const { session } = useSession();
  return useQuery({
    queryKey: key('activity', session.role, session.tenant),
    queryFn: () => api.listActivity(session),
    enabled: session.role === 'supervisor',
  });
}
export function useCertificates() {
  const { session } = useSession();
  return useQuery({
    queryKey: key('certificates', session.role, session.tenant),
    queryFn: () => api.listCertificates(session),
    enabled: session.role === 'supplier',
  });
}
/** Invalidates everything: coverage is computed, so one write can change many views. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
export function useCreateDelivery() {
  const { session } = useSession();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input) => api.createDelivery(session, input),
    onSuccess: invalidate,
  });
}
export function useDecideDelivery() {
  const { session } = useSession();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...input }) => api.decide(session, id, input),
    onSuccess: invalidate,
  });
}
export function useCreateCertificate() {
  const { session } = useSession();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input) => api.createCertificate(session, input),
    onSuccess: invalidate,
  });
}
export function useResetDemo() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: () => api.resetDemo(),
    onSuccess: invalidate,
  });
}
