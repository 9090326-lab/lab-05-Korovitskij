import { z } from 'zod';

// 1. Zod-схеми для вхідних повідомлень клієнта
export const InputMessageSchema = z.object({
  type: z.literal('input'),
  seq: z.number(),
  thrust: z.boolean(),
  turnLeft: z.boolean(),
  turnRight: z.boolean()
});

export const PingMessageSchema = z.object({
  type: z.literal('ping'),
  clientTime: z.number()
});

// Discriminated union для повідомлень (вимога лаби)
export const ClientMessageSchema = z.discriminatedUnion('type', [
  InputMessageSchema,
  PingMessageSchema
]);

// Витягуємо типи безпосередньо зі схем Zod
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type InputMessage = z.infer<typeof InputMessageSchema>;
export type PingMessage = z.infer<typeof PingMessageSchema>;

// Функція безпечного парсингу: якщо дані биті -> повертає null (вимога лаби)
export function parseClientMessage(raw: unknown): ClientMessage | null {
  let dataToParse: unknown = raw;

  if (typeof raw === 'string') {
    try {
      dataToParse = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  const result = ClientMessageSchema.safeParse(dataToParse);
  if (!result.success) {
    return null;
  }

  return result.data;
}