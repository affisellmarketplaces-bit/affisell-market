import { cache } from "react"

import { auth } from "@/auth"

/** One `auth()` per RSC request — feeds SessionProvider to skip client bootstrap fetch. */
export const getCachedSession = cache(auth)
