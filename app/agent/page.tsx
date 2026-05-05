import { AgentChat } from "@/components/AgentChat"

export const metadata = {
  title: "Shopping Agent | Affisell",
  description: "Affisell Personal Shopping Agent — discover products from our marketplace.",
}

export default function AgentPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <div className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
          Trouvez. Comparez. Achetez.
        </h1>
        <p className="mt-2 text-zinc-400">
          Votre agent IA cherche dans 10,000+ produits en temps réel
        </p>
      </div>
      <AgentChat />
    </main>
  )
}
