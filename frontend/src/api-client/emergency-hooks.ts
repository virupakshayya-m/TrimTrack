import { useMutation } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { MessageResponse } from "./generated/api.schemas";

export interface TransferBulkBody {
  bookingIds: string[];
  targetBarberId: string | 'auto';
  reason?: string;
}

export interface CancelBulkBody {
  bookingIds: string[];
  reason?: string;
}

export const transferBulk = async (data: TransferBulkBody): Promise<MessageResponse & { targetBarberName?: string }> => {
  return customFetch<any>('/api/queue/transfer-bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

export const useTransferBulk = (options?: any) => {
  return useMutation({
    mutationFn: (data: TransferBulkBody) => transferBulk(data),
    ...options,
  });
};

export const cancelBulk = async (data: CancelBulkBody): Promise<MessageResponse> => {
  return customFetch<MessageResponse>('/api/queue/cancel-bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

export const useCancelBulk = (options?: any) => {
  return useMutation({
    mutationFn: (data: CancelBulkBody) => cancelBulk(data),
    ...options,
  });
};
