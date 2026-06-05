import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid email"),
  orderId: z.string().optional(),
  message: z.string().min(10, "Tell us a little more (min 10 characters)"),
});

export const newsletterSchema = z.object({
  email: z.string().email("Enter a valid email"),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Please tick the consent box to subscribe" }),
  }),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type NewsletterInput = z.infer<typeof newsletterSchema>;
