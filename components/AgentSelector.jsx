"use client"

import { useState } from "react"

import { AGENTS, PLATFORMS } from "../lib/agents"

/** Conseil Affisell selon la source choisie (explications simples, non-initiés). */
function adviceFor(platform) {
  if (platform === "Usines") {
    return "Prends Superbuy ou Anovabuy – seuls à gérer la négociation MOQ et le paiement usine."
  }
  if (platform === "Weidian") {
    return "Litbuy ou Oopbuy sont les plus rapides sur Weidian."
  }
  return "Anovabuy offre le meilleur équilibre prix/qualité pour du multi-sites."
}

export default function AgentSelector({ onSelect }) {
  const [platform, setPlatform] = useState("1688")
  const [selected, setSelected] = useState("anovabuy")

  const filtered = AGENTS.filter((a) => a.platforms.includes(platform))
  const agent = filtered.find((a) => a.id === selected) || filtered[0]

  function pickPlatform(next) {
    setPlatform(next)
    const nextFiltered = AGENTS.filter((a) => a.platforms.includes(next))
    const effective = nextFiltered.find((a) => a.id === selected) || nextFiltered[0]
    if (effective) onSelect?.(effective, next)
  }

  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
        Choisis ta source en Chine
      </h2>
      <p className="mb-3 text-sm text-gray-600 dark:text-zinc-400">
        On achète pour toi sur tous les sites chinois et directement en usine.
      </p>

      <label
        htmlFor="agent-platform-select"
        className="flex items-center gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-200"
      >
        D&apos;où vient ton produit ?
        <span
          className="cursor-help rounded-full border border-zinc-300 px-1.5 text-[11px] text-zinc-500 dark:border-zinc-600"
          title="Usines = contact direct fabricant, pas de site"
          aria-label="Usines = contact direct fabricant, pas de site"
        >
          ?
        </span>
      </label>
      <select
        id="agent-platform-select"
        value={platform}
        onChange={(e) => pickPlatform(e.target.value)}
        className="mb-1 w-full rounded border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {PLATFORMS.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <p className="mb-4 text-xs text-gray-500 dark:text-zinc-500">
        {platform === "Usines"
          ? "Usines = contact direct fabricant (WeChat, carte de visite), pas de site marchand."
          : "Colle ensuite l’URL du produit ci-dessous — on s’occupe du reste."}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        {filtered.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => {
              setSelected(a.id)
              onSelect?.(a, platform)
            }}
            className={`rounded-lg border p-3 text-left transition-colors ${
              selected === a.id || (!filtered.some((f) => f.id === selected) && agent?.id === a.id)
                ? "border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
                : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
            }`}
          >
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{a.name}</div>
            <div className="text-xs text-zinc-700 dark:text-zinc-300">
              {a.fee} – {a.processing}
            </div>
            <div className="text-xs text-gray-500 dark:text-zinc-500">
              {a.strengths.join(" • ")}
            </div>
          </button>
        ))}
      </div>

      {agent && (
        <div className="rounded-lg bg-gray-50 p-4 dark:bg-zinc-900">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
            {agent.name} pour {platform}
          </h3>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{agent.bestFor}</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            <li>
              <b>Frais :</b> {agent.fee}
            </li>
            <li>
              <b>Traitement :</b> {agent.processing}
            </li>
            <li>
              <b>QC :</b> {agent.qcPhotos}
            </li>
            <li>
              <b>Stockage :</b> {agent.storage}
            </li>
            <li>
              <b>Domestique :</b> {agent.domesticShipping}
            </li>
            <li>
              <b>Support :</b> {agent.support}
            </li>
            <li>
              <b>Prix :</b> {agent.priceLevel}
            </li>
            <li>
              <b>Livraison UE :</b> {agent.deliveryEU}
            </li>
          </ul>
          <div className="mt-3 rounded bg-blue-50 p-2 text-xs text-zinc-800 dark:bg-blue-950/40 dark:text-zinc-200">
            <b>Conseil Affisell :</b> {adviceFor(platform)}
            {agent.note ? (
              <>
                <br />
                {agent.note}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
