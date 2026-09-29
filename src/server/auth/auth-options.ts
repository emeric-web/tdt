import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { AuthService } from "@/server/auth/auth.service";
import { PrismaAuthRepository } from "@/server/auth/auth.repository";

const authService = new AuthService(new PrismaAuthRepository(), bcrypt.compare);

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Adresse e-mail", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: (credentials) => authService.authenticate(credentials),
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub && token.role) {
        session.user.id = token.sub;
        session.user.role = token.role;
      }

      return session;
    },
  },
};
