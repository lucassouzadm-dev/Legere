/**
 * storageService.ts
 * Upload / download de arquivos via Supabase Storage.
 *
 * Bucket: "attachments" (deve ser criado no Supabase com visibilidade pública
 * ou com políticas RLS que permitam INSERT/SELECT ao papel autenticado).
 *
 * Migration SQL para criar o bucket (execute no SQL Editor do Supabase):
 *   INSERT INTO storage.buckets (id, name, public)
 *   VALUES ('attachments', 'attachments', true)
 *   ON CONFLICT DO NOTHING;
 *
 *   CREATE POLICY "Tenant upload" ON storage.objects
 *     FOR INSERT TO authenticated
 *     WITH CHECK (bucket_id = 'attachments');
 *
 *   CREATE POLICY "Public read" ON storage.objects
 *     FOR SELECT USING (bucket_id = 'attachments');
 *
 *   CREATE POLICY "Tenant delete" ON storage.objects
 *     FOR DELETE TO authenticated
 *     USING (bucket_id = 'attachments');
 */

import { supabase } from './supabase';
import { getCurrentTenantId } from './tenantService';

const BUCKET = 'attachments';

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Faz upload de um arquivo para o Supabase Storage.
 * Retorna a URL pública do arquivo ou null em caso de erro.
 *
 * @param file   Arquivo a ser enviado
 * @param prefix Prefixo para o nome do arquivo (ex: 'tx', 'doc', 'crm')
 */
export async function uploadAttachment(file: File, prefix = 'file'): Promise<string | null> {
  const tenantId = getCurrentTenantId();
  const ext = file.name.split('.').pop() ?? 'bin';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${tenantId}/${prefix}_${Date.now()}_${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });

  if (error) {
    console.error('[Storage] upload error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Remove um arquivo do Storage a partir da sua URL pública.
 * Silencia erros (não critica se o arquivo já foi removido).
 */
export async function deleteAttachment(url: string): Promise<void> {
  if (!isStorageUrl(url)) return;
  // Extrai o path depois de /object/public/{bucket}/
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = decodeURIComponent(url.slice(idx + marker.length));
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('[Storage] delete warning:', error.message);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retorna true se a string é uma URL do Supabase Storage
 * (e não um base64 legado).
 */
export function isStorageUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith('http') && value.includes('/storage/');
}

/**
 * Abre ou baixa um comprovante, compatível com URLs de Storage e base64 legado.
 */
export function openOrDownloadAttachment(data: string, filename = 'comprovante'): void {
  if (isStorageUrl(data)) {
    window.open(data, '_blank', 'noopener,noreferrer');
  } else {
    // base64 legado
    const link = document.createElement('a');
    link.href = data;
    link.download = filename;
    link.click();
  }
}
