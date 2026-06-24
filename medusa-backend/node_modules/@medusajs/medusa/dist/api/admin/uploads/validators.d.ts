import { z } from "@medusajs/framework/zod";
export type AdminGetUploadParamsType = z.infer<typeof AdminGetUploadParams>;
export declare const AdminGetUploadParams: z.ZodObject<{
    fields: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const AdminUploadPreSignedUrl: z.ZodObject<{
    originalname: z.ZodString;
    mime_type: z.ZodString;
    size: z.ZodNumber;
    access: z.ZodOptional<z.ZodEnum<{
        private: "private";
        public: "public";
    }>>;
}, z.core.$strip>;
export type AdminUploadPreSignedUrlType = z.infer<typeof AdminUploadPreSignedUrl>;
//# sourceMappingURL=validators.d.ts.map