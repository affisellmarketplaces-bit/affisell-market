# Journal des opérations — sécurité et finalisation (novembre 2026)

Chaque ligne : date UTC, opération, cible, preuve. « Préparée » = SQL/procédure écrite, pas exécutée.

| Date (UTC) | Opération | Cible | Résultat / preuve |
|---|---|---|---|
| 2026-11-25 11:55 | Écriture autorisée : `lightningEnabled` → false | SupplierProfile `cmqz…f5d` (production) | 1 ligne, 0 fournisseur restant à true, empreinte des 14 autres inchangée |
| 2026-11-25 13:57 | Lecture : compte admin Medusa | `provider_identity`, `user`, `api_key` (production) | admin actif, jamais modifié depuis 2026-06-23 ; 1 clé secrète active |
| 2026-11-25 14:08 | Lecture : Railway | compte Railway connecté | 0 projet (supprimés compris) |
| 2026-11-25 14:15 | Code : retrait des identifiants publiés, garde base Medusa, secrets de session, scan CI | PR #14 (`eec44cf27`, `23d0889e8`) | CI verte |
| 2026-11-25 14:35 | Lecture : comptes de test | `User` + relations (production) | 7 comptes, mot de passe actif, aucune donnée métier |
| 2026-11-25 14:46 | Lecture : rétention PITR Neon | projet `affisell` | 168 h ; point de restauration noté 14:45:56 |
| 2026-11-25 14:47 | **Tentative d'écriture refusée par le garde-fou de la session** (verrou des 7 comptes) | `User` (production) | Rien exécuté ; SQL prêt (`MEDUSA-CREDENTIALS-REMEDIATION.md` §7.1) |
| 2026-11-25 15:05 | Code : derniers mots de passe littéraux (scripts gate, seed), scan étendu (hash/compare, propriété password) | PR #14 (`2c8457bbe`) | 38 tests, CI verte |
| 2026-11-25 15:10 | Lecture : comptes seed | `User` (production) | `admin@affisell.io` (seul ADMIN) et `supplier@affisell.io` présents avec mot de passe |
| — | Préparées, non exécutées | Medusa A (identité admin), Medusa B (clé secrète), 7 comptes de test, comptes seed | `MEDUSA-CREDENTIALS-REMEDIATION.md` §4 et §7 |
