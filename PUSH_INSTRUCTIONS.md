# Pousser du code vers GitHub

> Ce fichier disait « cliquer sur Push dans Cursor » ou `git push origin main`. Ce n'est **plus** la procédure : un push sur `main` **déploie en production**, et le build Vercel
> échoue (volontairement) si le schéma de base de données n'a pas été migré avant. Les règles de référence sont `AGENTS.md` (section « Git push ») et `docs/DEPLOY-SCHEMA-CHANGES.md`.

## Procédure

1. **Travailler sur une branche**, jamais directement sur `main` (`git switch -c fix/ma-modification`). Une branche poussée construit une **Preview** (base de staging, clés Stripe de test).
2. **Avant de pousser**, selon ce que vous avez touché :
   - toute modification d'interface cliente (tableau de bord, navigation, accueil) : `npm run check:client-prisma` ;
   - toute modification de schéma : la migration doit être appliquée **à la main**, sur staging puis sur production, **avant** le push :
     `DATABASE_URL='<url>' npm run schema:migrate -- --expect-endpoint <ep-id> [--confirm-production]`, puis `npm run schema:verify` (`docs/DEPLOY-SCHEMA-CHANGES.md` §5).
     Sans cela le build Vercel s'arrête à la vérification du schéma (code de sortie 5) et l'ancienne version continue de servir : c'est sans danger, mais rien ne se déploie.
3. **Deux commandes shell séparées** (un `commit && push` peut rester bloqué sur le réseau) :

   ```bash
   git commit -m "message"                      # commande 1
   npm run push:safe -- fix/ma-modification     # commande 2, seule : analyse de secrets, fetch / pull --rebase / push avec délais maximum, sans invite interactive
   ```

   Première publication d'une **nouvelle** branche : le script commence par `git fetch origin <branche>`, qui échoue tant que la branche n'existe pas côté GitHub [déduit de la lecture du script, non exécuté] ;
   faire alors une fois `git push -u origin <branche>`, puis utiliser `push:safe` pour les suivants.

   **Nommez la branche.** `scripts/git-push-safe.mjs` a pour branche par défaut **`main`** (`process.argv[2]` ou `GIT_BRANCH`, sinon `main`) : lancé sans argument depuis une autre branche, il avertit
   (« on branch X, pushing main ») mais vise quand même `main`. Sans argument, c'est un push vers la production.

4. **Ne jamais** : `git push origin main` ; `git push --force` ; pousser un fichier `.env*`, `prisma/env.local` ou une clé (le script `push:safe` s'arrête sur un secret détecté — ne pas le contourner).
5. **Fusion dans `main`** (= déploiement en production) : par pull request sur GitHub, après relecture et vérification de la Preview. C'est une décision du fondateur (master §0) ; ne pas fusionner sans accord.

## Si un push « s'interrompt » dans l'éditeur

Ce n'est presque jamais le commit : c'est `git pull --rebase` qui attend le réseau ou une invite. Vérifier l'état réel avec `npm run git:sync` (ou `git status`), relancer `npm run push:safe -- <branche>` seul.
Le hook facultatif (une fois par clone) : `git config core.hooksPath .githooks` puis `chmod +x .githooks/pre-push`.
