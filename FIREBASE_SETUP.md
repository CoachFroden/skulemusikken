# Firebase-oppsett for Skulemusikken

Appkoden er klar for Firebase Authentication og Cloud Firestore, men selve Firebase-prosjektet må opprettes i eierens Google/Firebase-konto.

## 1. Opprett prosjekt

Opprett et nytt Firebase-prosjekt, for eksempel `skulemusikken`.

## 2. Legg til webapp

Registrer en webapp i prosjektet. Kopier Firebase-konfigurasjonsobjektet og lim verdiene inn i `firebase-config.js`.

`firebase-config.js` skal ende omtrent slik:

```js
window.SKULEMUSIKKEN_FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Firebase Web config er ikke en hemmelig servernøkkel. Tilgangen til persondata styres av Authentication og Firestore-reglene.

## 3. Authentication

Aktiver Google som innloggingsleverandør under Authentication -> Sign-in method.

## 4. Firestore

Opprett Cloud Firestore.

Publiser reglene fra `firestore.rules`.

Reglene gjør at `duties` og `settings` kun kan leses av innloggede brukere som er registrert i `members/{uid}`.

## 5. Godkjenn første bruker

1. Åpne appen og logg inn med Google.
2. Appen viser brukerens Firebase UID når brukeren ennå ikke er godkjent.
3. I Firestore opprettes dokumentet `members/<UID>` manuelt. Dokumentet kan inneholde for eksempel:

```json
{
  "name": "Administrator",
  "role": "admin"
}
```

Dokumentets innhold er foreløpig mindre viktig enn at dokument-ID-en er nøyaktig lik brukerens UID.

## 6. Vaktdata

Vaktdata lagres som dokumenter i samlingen `duties`, med dato som dokument-ID, for eksempel:

`duties/2026-09-03`

Felter:

- `date`
- `hoved`
- `junior`
- `aspirant`
- `styre`
- `updatedAt`

Personnavn skal ikke legges i den offentlige GitHub-kildekoden.
