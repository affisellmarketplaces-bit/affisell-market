import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [Credentials({
    credentials:{email:{},password:{}},
    async authorize(c){
      const email=c?.email?.toString().toLowerCase().trim()
      const user=await prisma.user.findUnique({where:{email}})
      if(!user?.password) return null
      return await bcrypt.compare(c!.password,user.password)?{id:user.id,email:user.email,role:user.role}:null
    }
  })],
  pages:{signIn:"/login"}
})
