/** Заглушка оплаты — реализуется на этапе 5. */
import type { PaymentProvider } from "../types";

const notYet = () => {
  throw new Error("Тестовая оплата появится на этапе 5");
};

export const mockPaymentProvider: PaymentProvider = {
  name: "mock",
  createPayment: async () => notYet(),
  verifyPayment: async () => notYet(),
  refund: async () => notYet(),
};
