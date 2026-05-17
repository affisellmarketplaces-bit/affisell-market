declare module "@vercel/blob" {
  export function put(
    pathname: string,
    body: Buffer | Uint8Array,
    options: { access: "public"; contentType: string; token?: string }
  ): Promise<{ url: string }>
}
